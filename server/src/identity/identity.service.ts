import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerificationStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { currentKeyId, decrypt, decryptFile, encrypt, encryptFile, EncryptionKeyError, hasDedicatedKey, keyIdOf, reencrypt } from '../common/crypto';
import { sniffType } from '../common/file-types';
import { StoreService } from '../domain/store.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type Actor } from './audit.service';
import { FACE_KINDS, IMAGE_ONLY, kindLabel, OWNER_KINDS, type OwnerType } from './identity-kinds';
import { documentToApi, paperStatus } from './identity-status';

const KEY_CHECK_SETTING = 'security.keyCheck';
const KEY_CHECK_TEXT = 'keygo-key-check';
export const MAX_IDENTITY_BYTES = 10 * 1024 * 1024;

/**
 * Identity documents of customers and drivers, stored encrypted (see common/crypto.ts), plus the checks staff do
 * on them: verify/reject, and the face check. Every sensitive step is written to the audit log.
 *
 * On start-up it also checks that the server has the encryption key the stored data needs, and moves anything
 * still on an older key to the current one.
 */
@Injectable()
export class IdentityService implements OnModuleInit {
  private readonly logger = new Logger('Identity');
  private readonly root: string;
  /** Set when the server's key cannot open the stored identity data (e.g. restored without the right key). */
  private keyProblem: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.root = resolve(config.get<string>('FILE_STORAGE_DIR') || './storage');
  }

  // ---------------------------------------------------------------- encryption key check

  async onModuleInit() {
    try {
      await this.checkKeys();
    } catch (e) {
      this.logger.error(`Encryption key check failed: ${(e as Error).message}`);
    }
  }

  async checkKeys() {
    if (!hasDedicatedKey()) {
      this.logger.warn('DATA_ENCRYPTION_KEY is not set: identity data is encrypted with the sign-in secret. Set DATA_ENCRYPTION_KEY (see deploy/.env.example).');
    }
    const saved = await this.store.setting<{ keyId: string; sample: string } | null>(KEY_CHECK_SETTING, null);
    if (saved && decrypt(saved.sample) !== KEY_CHECK_TEXT) {
      this.keyProblem =
        `KeyGo's identity documents were encrypted with key ${keyIdOf(saved.sample)}, but this server has key ${currentKeyId()}. ` +
        'Put the original DATA_ENCRYPTION_KEY back in the server settings (or add it to DATA_ENCRYPTION_OLD_KEYS) and restart.';
      this.logger.error(this.keyProblem);
      return;
    }
    this.keyProblem = null;
    const moved = await this.moveToCurrentKey();
    if (!saved || keyIdOf(saved.sample) !== currentKeyId()) {
      await this.store.saveSetting(KEY_CHECK_SETTING, { keyId: currentKeyId(), sample: encrypt(KEY_CHECK_TEXT), checkedAt: new Date().toISOString() }, 'system');
    }
    if (moved.values || moved.files) this.logger.log(`Re-encrypted ${moved.values} identity numbers and ${moved.files} file keys with key ${currentKeyId()}.`);
    if (moved.unreadable) this.logger.error(`${moved.unreadable} encrypted items could not be read with any known key.`);
  }

  /** Re-encrypts Aadhaar numbers and file keys that are still on an older key. */
  private async moveToCurrentKey() {
    const now = currentKeyId();
    let values = 0;
    let files = 0;
    let unreadable = 0;
    const customers = await this.prisma.customer.findMany({ where: { aadhaarNoEnc: { not: null } }, select: { id: true, aadhaarNoEnc: true } });
    for (const c of customers) {
      if (keyIdOf(c.aadhaarNoEnc!) === now) continue;
      const next = reencrypt(c.aadhaarNoEnc!);
      if (next === null) unreadable++;
      else {
        await this.prisma.customer.update({ where: { id: c.id }, data: { aadhaarNoEnc: next } });
        values++;
      }
    }
    const stored = await this.prisma.storedFile.findMany({ where: { encrypted: true, NOT: { keyId: now } }, select: { id: true, wrappedKey: true } });
    for (const f of stored) {
      const next = f.wrappedKey ? reencrypt(f.wrappedKey) : null;
      if (next === null) unreadable++;
      else {
        await this.prisma.storedFile.update({ where: { id: f.id }, data: { wrappedKey: next, keyId: now } });
        files++;
      }
    }
    return { values, files, unreadable };
  }

  private ready() {
    if (this.keyProblem) throw new ServiceUnavailableException(this.keyProblem);
  }

  /** For the health check and the Owner: is the encryption key in order? */
  keyStatus() {
    return { ok: !this.keyProblem, keyId: currentKeyId(), dedicatedKey: hasDedicatedKey(), problem: this.keyProblem ?? undefined };
  }

  // ---------------------------------------------------------------- owners

  /** Name of the customer or driver (throws when they do not exist). */
  async ownerName(ownerType: OwnerType, ownerId: string): Promise<string> {
    if (ownerType === 'customer') {
      const c = await this.prisma.customer.findUnique({ where: { id: ownerId }, select: { firstName: true, lastName: true } });
      if (!c) throw new NotFoundException('Customer not found.');
      return `${c.firstName} ${c.lastName}`.trim();
    }
    const d = await this.store.get('drivers', ownerId);
    if (!d) throw new NotFoundException('Driver not found.');
    return String(d.name ?? ownerId);
  }

  async list(ownerType: OwnerType, ownerId: string) {
    const docs = await this.prisma.identityDocument.findMany({ where: { ownerType, ownerId }, include: { file: { select: { mimeType: true } } }, orderBy: { createdAt: 'asc' } });
    return docs.map((d) => documentToApi(d));
  }

  // ---------------------------------------------------------------- upload

  /** Encrypts and stores one document, replacing the one in the same position. */
  async upload(ownerType: OwnerType, ownerId: string, kind: string, file: Express.Multer.File | undefined, actor: Actor, via: string) {
    this.ready();
    if (!OWNER_KINDS[ownerType].includes(kind)) throw new BadRequestException('Unknown document position.');
    if (!file) throw new BadRequestException('Attach the document in the "file" field.');
    if (file.size > MAX_IDENTITY_BYTES) throw new BadRequestException('The file is larger than 10 MB.');
    const type = sniffType(file.buffer);
    if (!type) throw new BadRequestException('Only JPG, PNG, WebP photos or PDF files are accepted.');
    if (IMAGE_ONLY.has(kind) && !type.startsWith('image/')) throw new BadRequestException('A photo is needed here (JPG, PNG or WebP).');
    const name = await this.ownerName(ownerType, ownerId);

    const sealed = encryptFile(file.buffer);
    const id = randomUUID();
    const folder = join('identity', new Date().toISOString().slice(0, 7));
    mkdirSync(join(this.root, folder), { recursive: true });
    const path = join(folder, `${id}.kge`);
    writeFileSync(join(this.root, path), sealed.data);
    await this.prisma.storedFile.create({
      data: {
        id,
        name: `${kind}.${type.split('/')[1]}`,
        mimeType: type,
        size: file.size,
        path,
        uploadedBy: actor.name,
        category: 'identity',
        encrypted: true,
        wrappedKey: sealed.wrappedKey,
        keyId: sealed.keyId,
      },
    });

    const previous = await this.prisma.identityDocument.findUnique({ where: { ownerType_ownerId_kind: { ownerType, ownerId, kind } } });
    const doc = await this.prisma.identityDocument.upsert({
      where: { ownerType_ownerId_kind: { ownerType, ownerId, kind } },
      create: { ownerType, ownerId, kind, fileId: id, uploadedBy: actor.name, uploadedVia: via, status: 'PENDING' },
      update: { fileId: id, uploadedBy: actor.name, uploadedVia: via, status: 'PENDING', rejectReason: null, reviewedBy: null, reviewedAt: null, createdAt: new Date() },
      include: { file: { select: { mimeType: true } } },
    });
    if (previous) await this.deleteStoredFile(previous.fileId);

    await this.audit.log(actor, previous ? 'document.replaced' : 'document.uploaded', { type: ownerType, id: ownerId, name }, { kind, label: kindLabel(ownerType, kind), via });
    if (ownerType === 'customer') await this.refreshCustomer(ownerId, actor, FACE_KINDS.includes(kind) || kind === 'id_front' ? 'new picture' : undefined);
    return documentToApi(doc);
  }

  private async deleteStoredFile(fileId: string) {
    const f = await this.prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!f) return;
    // Still referenced (should not happen) → keep
    if (await this.prisma.identityDocument.count({ where: { fileId } })) return;
    await this.prisma.storedFile.delete({ where: { id: fileId } });
    rmSync(join(this.root, f.path), { force: true });
  }

  // ---------------------------------------------------------------- open, review, remove

  private async doc(id: string) {
    const d = await this.prisma.identityDocument.findUnique({ where: { id }, include: { file: true } });
    if (!d) throw new NotFoundException('Document not found.');
    return d;
  }

  /** Decrypts a document for someone allowed to see it, and records that they opened it. */
  async open(id: string, actor: Actor) {
    this.ready();
    const d = await this.doc(id);
    const full = join(this.root, d.file.path);
    if (!existsSync(full)) throw new NotFoundException('The file is missing from storage. Restore it from the backup.');
    let content: Buffer;
    try {
      content = d.file.encrypted ? decryptFile(readFileSync(full), d.file.wrappedKey ?? '') : readFileSync(full);
    } catch (e) {
      if (e instanceof EncryptionKeyError) throw new ServiceUnavailableException(e.message);
      throw e;
    }
    const name = await this.ownerName(d.ownerType as OwnerType, d.ownerId).catch(() => d.ownerId);
    await this.audit.log(actor, 'document.viewed', { type: d.ownerType, id: d.ownerId, name }, { kind: d.kind, label: kindLabel(d.ownerType, d.kind), documentId: d.id });
    return { content, mimeType: d.file.mimeType, name: d.file.name };
  }

  async review(id: string, status: 'Verified' | 'Rejected', reason: string | undefined, actor: Actor) {
    const d = await this.doc(id);
    if (status === 'Rejected' && !reason?.trim()) throw new BadRequestException('Give a reason so the customer knows what to fix.');
    const next: VerificationStatus = status === 'Verified' ? 'VERIFIED' : 'REJECTED';
    const saved = await this.prisma.identityDocument.update({
      where: { id },
      data: { status: next, rejectReason: status === 'Rejected' ? reason!.trim().slice(0, 300) : null, reviewedBy: actor.name, reviewedAt: new Date() },
      include: { file: { select: { mimeType: true } } },
    });
    const name = await this.ownerName(d.ownerType as OwnerType, d.ownerId).catch(() => d.ownerId);
    await this.audit.log(actor, status === 'Verified' ? 'document.verified' : 'document.rejected', { type: d.ownerType, id: d.ownerId, name }, {
      kind: d.kind,
      label: kindLabel(d.ownerType, d.kind),
      previous: d.status,
      reason: status === 'Rejected' ? reason!.trim() : undefined,
    });
    if (d.ownerType === 'customer') await this.refreshCustomer(d.ownerId, actor);
    return documentToApi(saved);
  }

  async remove(id: string, actor: Actor) {
    const d = await this.doc(id);
    await this.prisma.identityDocument.delete({ where: { id } });
    await this.deleteStoredFile(d.fileId);
    const name = await this.ownerName(d.ownerType as OwnerType, d.ownerId).catch(() => d.ownerId);
    await this.audit.log(actor, 'document.deleted', { type: d.ownerType, id: d.ownerId, name }, { kind: d.kind, label: kindLabel(d.ownerType, d.kind) });
    if (d.ownerType === 'customer') await this.refreshCustomer(d.ownerId, actor, FACE_KINDS.includes(d.kind) || d.kind === 'id_front' ? 'picture removed' : undefined);
  }

  /** A driver or customer was deleted: delete all their documents and files (recorded in the audit log). */
  async removeAllFor(ownerType: OwnerType, ownerId: string, actor: Actor, name?: string) {
    const docs = await this.prisma.identityDocument.findMany({ where: { ownerType, ownerId } });
    for (const d of docs) {
      await this.prisma.identityDocument.delete({ where: { id: d.id } });
      await this.deleteStoredFile(d.fileId);
    }
    if (docs.length) {
      await this.audit.log(actor, 'documents.deleted_with_owner', { type: ownerType, id: ownerId, name }, { count: docs.length, kinds: docs.map((d) => d.kind) });
    }
    return docs.length;
  }

  // ---------------------------------------------------------------- face check

  /** Staff compared the customer's photo or selfie with the ID card photo. Recorded in the audit log. */
  async faceCheck(customerId: string, result: 'match' | 'no_match', note: string | undefined, actor: Actor) {
    this.ready();
    const name = await this.ownerName('customer', customerId);
    const docs = await this.prisma.identityDocument.findMany({ where: { ownerType: 'customer', ownerId: customerId } });
    const faces = docs.filter((d) => FACE_KINDS.includes(d.kind));
    const id = docs.find((d) => d.kind === 'id_front');
    if (!faces.length || !id) throw new BadRequestException('The face check needs a customer photo or selfie and the front of the ID card.');
    if (result === 'no_match' && !note?.trim()) throw new BadRequestException('Say why the face does not match.');
    const status: VerificationStatus = result === 'match' ? 'VERIFIED' : 'REJECTED';
    const before = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { faceVerification: true } });
    await this.prisma.customer.update({ where: { id: customerId }, data: { faceVerification: status } });
    await this.audit.log(actor, result === 'match' ? 'face.match' : 'face.no_match', { type: 'customer', id: customerId, name }, {
      result: result === 'match' ? 'Match' : 'Not a match',
      note: note?.trim() || undefined,
      previous: before?.faceVerification,
      compared: [...faces, id].map((d) => ({ documentId: d.id, kind: d.kind })),
    });
    return { faceVerification: status === 'VERIFIED' ? 'Verified' : 'Rejected' };
  }

  // ---------------------------------------------------------------- customer statuses

  /**
   * Keeps the customer's ID card and face check statuses in line with the documents. A new face picture or ID
   * front means the face must be checked again.
   */
  async refreshCustomer(customerId: string, actor: Actor, faceChange?: string) {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { idCardStatus: true, faceVerification: true } });
    if (!c) return;
    const docs = await this.prisma.identityDocument.findMany({ where: { ownerType: 'customer', ownerId: customerId }, select: { kind: true, status: true } });
    const idCardStatus = paperStatus(docs, 'id_front', 'id_back');
    const canCompare = docs.some((d) => FACE_KINDS.includes(d.kind)) && docs.some((d) => d.kind === 'id_front');
    let faceVerification = c.faceVerification;
    if (!canCompare) faceVerification = 'NOT_UPLOADED';
    else if (faceChange || faceVerification === 'NOT_UPLOADED') faceVerification = 'PENDING';
    if (idCardStatus === c.idCardStatus && faceVerification === c.faceVerification) return;
    await this.prisma.customer.update({ where: { id: customerId }, data: { idCardStatus, faceVerification } });
    if (faceVerification !== c.faceVerification && c.faceVerification !== 'NOT_UPLOADED') {
      await this.audit.log(actor, 'face.reset', { type: 'customer', id: customerId }, { reason: faceChange ?? 'documents changed', previous: c.faceVerification, next: faceVerification });
    }
  }

  /** The licence number or expiry changed: a verified licence must be checked again. */
  async licenceChanged(customerId: string, actor: Actor, change: Record<string, unknown>) {
    const updated = await this.prisma.identityDocument.updateMany({
      where: { ownerType: 'customer', ownerId: customerId, kind: { in: ['dl_front', 'dl_back'] }, status: 'VERIFIED' },
      data: { status: 'PENDING', reviewedBy: null, reviewedAt: null },
    });
    await this.audit.log(actor, 'licence.details_changed', { type: 'customer', id: customerId }, { ...change, sentBackForReview: updated.count });
  }
}

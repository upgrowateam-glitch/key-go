import { BadRequestException, GoneException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { verificationEnum } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { Actor } from './audit.service';
import { CUSTOMER_LINK_KINDS, IMAGE_ONLY, kindLabel, OWNER_KINDS, type OwnerType } from './identity-kinds';
import { IdentityService } from './identity.service';

const LINK_MINUTES = 30;
const MAX_UPLOADS = 40;

interface Link {
  ownerType: OwnerType;
  ownerId: string;
  /** staff-phone (QR code shown by staff) or customer-link (the customer's own, from the app) */
  via: 'staff-phone' | 'customer-link';
  actor: Actor;
  kinds: string[];
  expiresAt: number;
  uploads: number;
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * Short-lived upload pages for identity documents, opened on a phone: by staff scanning a QR code at the counter,
 * or by customers from the app. A link can only add documents for one person; it never shows documents already on
 * file (only whether each one is there). Only a hash of the token is kept, in memory.
 */
@Injectable()
export class IdentityLinksService {
  private readonly links = new Map<string, Link>();

  constructor(
    private readonly identity: IdentityService,
    private readonly prisma: PrismaService,
  ) {}

  private sweep() {
    const now = Date.now();
    for (const [k, l] of this.links) if (l.expiresAt <= now) this.links.delete(k);
  }

  async create(ownerType: OwnerType, ownerId: string, via: Link['via'], actor: Actor) {
    await this.identity.ownerName(ownerType, ownerId);
    this.sweep();
    for (const [k, l] of this.links) if (l.ownerType === ownerType && l.ownerId === ownerId && l.via === via) this.links.delete(k);
    const token = randomBytes(32).toString('base64url');
    const kinds = via === 'customer-link' ? CUSTOMER_LINK_KINDS : OWNER_KINDS[ownerType];
    const expiresAt = Date.now() + LINK_MINUTES * 60_000;
    this.links.set(hash(token), { ownerType, ownerId, via, actor, kinds, expiresAt, uploads: 0 });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  close(ownerType: OwnerType, ownerId: string) {
    for (const [k, l] of this.links) if (l.ownerType === ownerType && l.ownerId === ownerId && l.via === 'staff-phone') this.links.delete(k);
  }

  private link(token: string) {
    this.sweep();
    const l = this.links.get(hash(token));
    if (!l) throw new GoneException('This upload link has expired or was closed. Ask for a new one.');
    return l;
  }

  /** What the phone page shows: first name and, for each position, whether a document is on file. */
  async describe(token: string) {
    const l = this.link(token);
    const name = await this.identity.ownerName(l.ownerType, l.ownerId);
    const docs = await this.prisma.identityDocument.findMany({ where: { ownerType: l.ownerType, ownerId: l.ownerId }, select: { kind: true, status: true, rejectReason: true } });
    return {
      ownerType: l.ownerType,
      firstName: name.split(' ')[0],
      via: l.via,
      expiresAt: new Date(l.expiresAt).toISOString(),
      slots: l.kinds.map((kind) => {
        const d = docs.find((x) => x.kind === kind);
        return {
          kind,
          label: kindLabel(l.ownerType, kind),
          photoOnly: IMAGE_ONLY.has(kind),
          // Selfies use the front camera; papers the back camera
          camera: kind === 'selfie' ? 'user' : 'environment',
          status: d ? verificationEnum.fromDb(d.status) : 'Not uploaded',
          rejectReason: d?.rejectReason ?? undefined,
        };
      }),
    };
  }

  async upload(token: string, kind: string, file: Express.Multer.File | undefined) {
    const l = this.link(token);
    if (!l.kinds.includes(kind)) throw new BadRequestException('This document cannot be added with this link.');
    if (l.uploads >= MAX_UPLOADS) throw new BadRequestException('This link has been used many times. Ask for a new one.');
    l.uploads++;
    const saved = await this.identity.upload(l.ownerType, l.ownerId, kind, file, l.actor, l.via);
    return { kind: saved.kind, label: saved.label, status: saved.status };
  }
}

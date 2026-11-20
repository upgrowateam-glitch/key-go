import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AuditService } from '../identity/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const GRACE_DAYS = 7;
const DAY_MS = 86_400_000;
const FIRST_RUN_DELAY_MS = 10 * 60_000;
const EVERY_MS = 7 * DAY_MS;

/**
 * Weekly clean-up of uploaded files that nothing uses any more: an old photo whose delete request never reached
 * the server, a photo uploaded while saving the car failed, and so on.
 *
 * A file counts as in use when its id appears anywhere KeyGo keeps references: cars (photos), bookings,
 * customers, settings (car documents), records, or identity documents. Only files unused AND older than
 * 7 days are deleted, so a photo that is just being saved is never touched. Each run is written to the audit log.
 */
@Injectable()
export class StorageCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('StorageCleanup');
  private readonly root: string;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.root = resolve(config.get<string>('FILE_STORAGE_DIR') || './storage');
  }

  onModuleInit() {
    const run = () => this.run().catch((e) => this.logger.error(`Clean-up failed: ${(e as Error).message}`));
    this.timers.push(setTimeout(run, FIRST_RUN_DELAY_MS));
    this.timers.push(setInterval(run, EVERY_MS));
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  /** Everything that can mention a file id, as one block of text. */
  private async references(): Promise<{ text: string; identityFileIds: Set<string> }> {
    const [vehicles, bookings, customers, settings, records, identity] = await Promise.all([
      this.prisma.vehicle.findMany({ select: { details: true, photoUrl: true } }),
      this.prisma.booking.findMany({ select: { details: true } }),
      this.prisma.customer.findMany({ select: { details: true } }),
      this.prisma.appSetting.findMany({ select: { value: true } }),
      this.prisma.appRecord.findMany({ select: { data: true } }),
      this.prisma.identityDocument.findMany({ select: { fileId: true } }),
    ]);
    const parts = [
      ...vehicles.map((v) => `${JSON.stringify(v.details)} ${v.photoUrl ?? ''}`),
      ...bookings.map((b) => JSON.stringify(b.details)),
      ...customers.map((c) => JSON.stringify(c.details)),
      ...settings.map((s) => JSON.stringify(s.value)),
      ...records.map((r) => JSON.stringify(r.data)),
    ];
    return { text: parts.join('\n'), identityFileIds: new Set(identity.map((d) => d.fileId)) };
  }

  /** Finds and deletes unused files older than the grace period. Returns what it did. */
  async run(now = new Date()) {
    const cutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS);
    const candidates = await this.prisma.storedFile.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true, path: true, size: true, category: true } });
    if (!candidates.length) return { checked: 0, deleted: 0, freedBytes: 0 };
    const { text, identityFileIds } = await this.references();
    const unused = candidates.filter((f) => !identityFileIds.has(f.id) && !text.includes(f.id));
    let freedBytes = 0;
    let deleted = 0;
    for (const f of unused) {
      try {
        await this.prisma.storedFile.delete({ where: { id: f.id } });
        rmSync(join(this.root, f.path), { force: true });
        freedBytes += f.size;
        deleted++;
      } catch (e) {
        // Still referenced by a foreign key, or already gone: leave it
        this.logger.warn(`Kept ${f.id}: ${(e as Error).message.split('\n')[0]}`);
      }
    }
    if (deleted) {
      this.logger.log(`Removed ${deleted} unused file(s), freed ${(freedBytes / 1024 / 1024).toFixed(1)} MB.`);
      await this.audit
        .log({ name: 'KeyGo (automatic)', role: 'System' }, 'storage.cleanup', { type: 'storage', id: 'files' }, { checked: candidates.length, deleted, freedBytes })
        .catch(() => undefined);
    }
    return { checked: candidates.length, deleted, freedBytes };
  }
}

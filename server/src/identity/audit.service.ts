import { Injectable } from '@nestjs/common';
import type { AuthPayload } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

/** Who did something: a staff member, a customer, or an upload link (named after the person who opened it). */
export interface Actor {
  id?: string;
  name: string;
  role?: string;
}

export const actorOf = (me: AuthPayload): Actor => ({ id: me.sub, name: me.name, role: me.kind === 'customer' ? 'Customer' : me.role });

/**
 * The audit log: face checks, document reviews, every time an identity document is opened, payroll changes.
 * Entries can only be added; the database refuses to change or delete them (see the migration).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(actor: Actor, action: string, subject: { type: string; id: string; name?: string }, detail: Record<string, unknown> = {}) {
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id ?? null,
        actorName: actor.name,
        actorRole: actor.role ?? null,
        action,
        subjectType: subject.type,
        subjectId: subject.id,
        subjectName: subject.name ?? null,
        detail: detail as object,
      },
    });
  }

  async list(subjectType: string, subjectId: string, take = 200) {
    const rows = await this.prisma.auditLog.findMany({ where: { subjectType, subjectId }, orderBy: { at: 'desc' }, take });
    return rows.map((r) => ({
      id: r.id.toString(),
      at: r.at.toISOString(),
      actorId: r.actorId,
      actorName: r.actorName,
      actorRole: r.actorRole,
      action: r.action,
      subjectName: r.subjectName,
      detail: r.detail,
    }));
  }
}

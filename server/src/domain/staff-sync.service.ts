import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { User } from '@prisma/client';
import { roleEnum } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { Json } from './mappers';
import { StoreService } from './store.service';

const COLLECTION = 'staffPunches';
/** Staff records made from a sign-in account use this id, so each account has exactly one. */
export const staffIdFor = (userId: string) => `stf-${userId}`;

/**
 * Keeps the Staff list (Drivers & Staff → Staff directory, attendance and payroll) in step with the sign-in
 * accounts in Settings → Users & Roles: every account except Drivers (who have their own Drivers list) has a staff
 * record, and its name, role and phone follow the account. Records added by hand (people without a login) are left alone.
 */
@Injectable()
export class StaffSyncService implements OnModuleInit {
  private readonly log = new Logger('StaffSync');

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
  ) {}

  /** Accounts that existed before this feature get their staff record once. */
  async onModuleInit() {
    try {
      const users = await this.prisma.user.findMany();
      let added = 0;
      for (const u of users) if (await this.sync(u)) added++;
      if (added) this.log.log(`Added ${added} staff record(s) for existing accounts`);
    } catch (e) {
      this.log.warn(`Could not sync staff records: ${(e as Error).message}`);
    }
  }

  /** Creates or updates the staff record for an account. Returns true when one was created. */
  async sync(user: User): Promise<boolean> {
    const id = staffIdFor(user.id);
    const role = roleEnum.fromDb(user.role);
    const existing = await this.store.get(COLLECTION, id);
    if (role === 'Driver') {
      if (existing) await this.store.remove(COLLECTION, id);
      return false;
    }
    const linked: Json = { userId: user.id, staffName: user.name, role, phone: user.phone ? `+${user.phone}` : (existing?.phone ?? '') };
    if (existing) {
      await this.store.put(COLLECTION, id, { ...existing, ...linked });
      return false;
    }
    await this.store.put(COLLECTION, id, {
      ...linked,
      shift: '09:00 – 18:00',
      punchIn: '',
      hoursWorked: 0,
      hoursThisMonth: 0,
      overtimeHours: 0,
      baseSalary: 0,
      tripAllowance: 0,
      deductions: 0,
      netPayable: 0,
      status: 'Punched Out',
      attendance: [],
    });
    return true;
  }

  /** A deleted account takes its staff record with it. */
  async remove(userId: string) {
    await this.store.remove(COLLECTION, staffIdFor(userId));
  }
}

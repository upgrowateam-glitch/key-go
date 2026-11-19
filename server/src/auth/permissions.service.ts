import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyPermissions, currentPermissions, EDITABLE_ROLES, PERMISSIONS_SETTING, withOverrides } from './permissions';

/** Loads the Owner's access changes at start-up and saves new ones; checks then read them from memory. */
@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const row = await this.prisma.appSetting.findUnique({ where: { key: PERMISSIONS_SETTING } });
    applyPermissions(withOverrides(row?.value));
  }

  table() {
    return currentPermissions();
  }

  /** Saves new access for Admin, Manager and Staff; takes effect on the next request. */
  async save(roles: unknown, savedBy: string) {
    const table = withOverrides(roles);
    const stored = Object.fromEntries(EDITABLE_ROLES.map((r) => [r, table[r]])) as Prisma.InputJsonValue;
    await this.prisma.appSetting.upsert({
      where: { key: PERMISSIONS_SETTING },
      create: { key: PERMISSIONS_SETTING, value: stored, updatedBy: savedBy },
      update: { value: stored, updatedBy: savedBy },
    });
    applyPermissions(table);
    return this.table();
  }

  async reset() {
    await this.prisma.appSetting.deleteMany({ where: { key: PERMISSIONS_SETTING } });
    applyPermissions(withOverrides(null));
    return this.table();
  }
}

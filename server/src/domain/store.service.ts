import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Json } from './mappers';

const NAME = /^[A-Za-z0-9._-]{1,80}$/;

export function checkName(kind: string, name: string) {
  if (!NAME.test(name)) throw new BadRequestException(`Invalid ${kind} name.`);
  return name;
}

/** JSON records (app_records) and settings documents (app_settings) shared by the admin and customer APIs. */
@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- records

  async list(collection: string): Promise<Json[]> {
    const rows = await this.prisma.appRecord.findMany({ where: { collection }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ ...(r.data as Json), id: r.id }));
  }

  async listWhere(collection: string, match: (item: Json) => boolean) {
    return (await this.list(collection)).filter(match);
  }

  async get(collection: string, id: string): Promise<Json | null> {
    const row = await this.prisma.appRecord.findUnique({ where: { collection_id: { collection, id } } });
    return row ? { ...(row.data as Json), id: row.id } : null;
  }

  async put(collection: string, id: string, data: Json): Promise<Json> {
    const value = { ...data, id } as Prisma.InputJsonValue;
    await this.prisma.appRecord.upsert({
      where: { collection_id: { collection, id } },
      create: { collection, id, data: value },
      update: { data: value },
    });
    return { ...data, id };
  }

  async patch(collection: string, id: string, patch: Json) {
    const current = await this.get(collection, id);
    if (!current) return null;
    return this.put(collection, id, { ...current, ...patch });
  }

  async remove(collection: string, id: string) {
    await this.prisma.appRecord.deleteMany({ where: { collection, id } });
  }

  /** Every collection, grouped, newest record first. */
  async allRecords(): Promise<Record<string, Json[]>> {
    const rows = await this.prisma.appRecord.findMany({ orderBy: { createdAt: 'desc' } });
    const grouped: Record<string, Json[]> = {};
    for (const r of rows) (grouped[r.collection] ??= []).push({ ...(r.data as Json), id: r.id });
    return grouped;
  }

  // ---------------------------------------------------------------- settings

  async setting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  }

  async saveSetting(key: string, value: unknown, updatedBy?: string) {
    const json = value as Prisma.InputJsonValue;
    await this.prisma.appSetting.upsert({ where: { key }, create: { key, value: json, updatedBy }, update: { value: json, updatedBy } });
    return value;
  }

  async allSettings(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.appSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  // ---------------------------------------------------------------- notifications

  /** Adds an in-app notification. Without a customerId it goes to staff in the admin portal. */
  async notify(input: { title: string; message: string; type: string; customerId?: string }) {
    const id = `NTF-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return this.put('notifications', id, { ...input, time, unread: true });
  }
}

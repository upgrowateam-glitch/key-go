import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Turns database rule violations into clear API errors:
 * - the no-double-booking constraint → 409 Conflict
 * - unique values (email, phone, vehicle number, ...) → 409 Conflict
 * - references to records that don't exist → 400
 * Anything else is rethrown and becomes a 500.
 */
export function rethrowDbError(e: unknown, labels: Record<string, string> = {}): never {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes('bookings_no_overlap') || message.includes('23P01')) {
    throw new ConflictException('This car is already booked for an overlapping period. Choose other dates or another car.');
  }
  if (message.includes('bookings_period_valid')) {
    throw new BadRequestException('The return time must be after the pickup time.');
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const fields = ([] as string[]).concat((e.meta?.target as string[] | string | undefined) ?? []);
      const field = fields.map((f) => labels[f] ?? f).join(', ') || 'value';
      throw new ConflictException(`Another record already uses this ${field}.`);
    }
    if (e.code === 'P2003') throw new BadRequestException('A linked record (vehicle or customer) does not exist.');
    if (e.code === 'P2025') throw new NotFoundException('Record not found.');
  }
  throw e;
}

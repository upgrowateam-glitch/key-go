import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { BookingsService } from './bookings.service';
import { StoreService } from './store.service';
import { reminderDueAt, wallNow } from './booking-rules';
import { bookingToApi, type Json } from './mappers';

const CHECK_EVERY_MS = 5 * 60 * 1000;

/** "Wed, 25 Nov" from "2026-11-25". */
const dayLabel = (iso: unknown) => {
  const d = typeof iso === 'string' ? new Date(`${iso}T00:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    : String(iso ?? '');
};
const time = (t: unknown) => String(t ?? '').replace(/^0/, '');
const rupees = (n: unknown) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/**
 * Level 5 messages to customers:
 * - the pickup reminder, sent automatically N days before pickup at the set time (Settings → Bookings), in the app and
 *   by WhatsApp when KeyGo's number is linked; staff can also send it now;
 * - a quotation sent by WhatsApp from the admin portal.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Reminders');
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly store: StoreService,
    private readonly whatsapp: WhatsAppService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sendDue(), CHECK_EVERY_MS);
    setTimeout(() => void this.sendDue(), 30_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Sends every reminder that is due and not sent yet (confirmed bookings whose pickup is still ahead). */
  async sendDue() {
    if (this.running) return;
    this.running = true;
    try {
      const rules = await this.bookings.bookingRules();
      if (!rules.reminder.enabled) return;
      const now = new Date();
      const wall = wallNow();
      const horizon = new Date(wall.getTime() + (rules.reminder.daysBefore + 1) * 86_400_000);
      const rows = await this.prisma.booking.findMany({
        where: { status: 'CONFIRMED', reminderSent: false, pickupAt: { gt: wall, lt: horizon } },
        select: { id: true, pickupAt: true },
      });
      for (const b of rows) {
        if (reminderDueAt(b.pickupAt, rules) > now) continue;
        try {
          await this.sendReminder(b.id, 'KeyGo (automatic)');
        } catch (e) {
          this.log.warn(`Reminder for ${b.id} failed: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.log.warn(`Reminder check failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** The pickup reminder for one booking: in the app, by WhatsApp (when linked and switched on), and a note for staff. */
  async sendReminder(id: string, by: string) {
    const row = await this.bookings.getBooking(id);
    if (row.status !== 'CONFIRMED') throw new BadRequestException('A pickup reminder is only sent for a confirmed booking that has not started.');
    const b = bookingToApi(row);
    const rules = await this.bookings.bookingRules();
    const car = await this.carName(row.vehicleId);
    const first = String(b.customerName ?? '').split(' ')[0] || 'there';
    const when = `${dayLabel(b.pickupDate)} at ${time(b.pickupTime)}`;
    const text =
      `Hi ${first}, a reminder from KeyGo 🚗\n\n` +
      `Your ${car} pickup is on ${when}${b.pickupLocation ? ` at ${b.pickupLocation}` : ''}.\n` +
      `Booking: ${b.id}\n\n` +
      `Please bring your driving licence and ID card. Reply here if you need to change anything. See you soon!`;

    const channels: string[] = [];
    let whatsappError: string | undefined;
    if (row.customerId) {
      await this.store.notify({
        type: 'reminder',
        customerId: row.customerId,
        title: 'Pickup reminder',
        message: `Your ${car} (${b.id}) pickup is on ${when}.`,
      });
      channels.push('app');
    }
    if (rules.reminder.whatsapp && b.customerPhone) {
      try {
        await this.whatsapp.sendText(String(b.customerPhone), text);
        channels.push('whatsapp');
      } catch (e) {
        whatsappError = (e as Error).message;
      }
    }
    await this.store.notify({
      type: 'reminder',
      title: 'Pickup reminder sent',
      message: `${b.customerName} · ${b.id} · ${car} on ${when} (${channels.length ? channels.join(' + ') : 'not delivered'})${whatsappError ? ` · WhatsApp: ${whatsappError}` : ''}`,
    });
    const reminderLog: Json = { sentAt: new Date().toISOString(), by, channels, ...(whatsappError ? { whatsappError } : {}) };
    return this.bookings.setServerDetails(id, { reminderLog }, { reminderSent: true });
  }

  /** Sends a quotation to the customer by WhatsApp (KeyGo's linked number). */
  async sendQuote(id: string, by: string) {
    const row = await this.bookings.getBooking(id);
    if (row.status !== 'QUOTED' && row.status !== 'PENDING') throw new BadRequestException('Only a quotation can be sent.');
    const b = bookingToApi(row);
    if (!b.customerPhone) throw new BadRequestException('This customer has no phone number.');
    const car = await this.carName(row.vehicleId);
    const until = typeof b.quoteValidUntil === 'string' ? new Date(b.quoteValidUntil) : null;
    const validLine = until
      ? `Valid until ${until.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.`
      : '';
    const discount = Number(b.discount) || 0;
    const text =
      `KeyGo quotation ${b.id}\n\n` +
      `Car: ${car}\n` +
      `Pickup: ${dayLabel(b.pickupDate)}, ${time(b.pickupTime)}${b.pickupLocation ? ` · ${b.pickupLocation}` : ''}\n` +
      `Return: ${dayLabel(b.returnDate)}, ${time(b.returnTime)}\n` +
      `${b.days} day${b.days === 1 ? '' : 's'} · ${b.term} rental · ${b.purpose}\n\n` +
      `Rent: ${rupees(Number(b.subtotal) + discount)}\n` +
      (discount ? `Discount: −${rupees(discount)}\n` : '') +
      `GST: ${rupees(b.tax)}\n` +
      `Total: ${rupees(b.totalAmount)}\n` +
      `Refundable deposit: ${rupees(b.depositAmount)}\n\n` +
      `${validLine} Reply to this message to confirm your booking.`;
    await this.whatsapp.sendText(String(b.customerPhone), text);
    return this.bookings.setServerDetails(id, { quoteSentAt: new Date().toISOString(), quoteSentBy: by });
  }

  private async carName(vehicleId: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { name: true, registrationNo: true } });
    return v ? `${v.name}${v.registrationNo ? ` (${v.registrationNo})` : ''}` : 'car';
  }
}

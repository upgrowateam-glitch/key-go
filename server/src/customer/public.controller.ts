import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookingsService } from '../domain/bookings.service';
import { DEFAULT_LOYALTY_TIERS, SETTING_LOYALTY_TIERS } from '../domain/defaults';
import { StoreService } from '../domain/store.service';

/** Data anyone may see before signing in. */
@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly store: StoreService,
  ) {}

  @Get('vehicles')
  @ApiOperation({ summary: 'The rentable fleet with prices' })
  vehicles() {
    return this.bookings.listVehicles({ status: { not: 'SOLD' } });
  }

  @Get('contact')
  @ApiOperation({ summary: 'How customers reach KeyGo (from the company profile in admin Settings)' })
  async contact() {
    const c = await this.store.setting<Record<string, unknown>>('settings.company', {});
    const text = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : '');
    return { name: text('name') || 'KeyGo', phone: text('phone'), email: text('email'), address: text('address'), supportHours: text('supportHours'), website: text('website') };
  }

  @Get('loyalty-tiers')
  @ApiOperation({ summary: 'Loyalty programme tiers' })
  loyaltyTiers() {
    return this.store.setting(SETTING_LOYALTY_TIERS, DEFAULT_LOYALTY_TIERS);
  }
}

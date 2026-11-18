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

  @Get('loyalty-tiers')
  @ApiOperation({ summary: 'Loyalty programme tiers' })
  loyaltyTiers() {
    return this.store.setting(SETTING_LOYALTY_TIERS, DEFAULT_LOYALTY_TIERS);
  }
}

import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CurrentUser, StaffOnly, type AuthPayload } from '../auth/auth.decorators';
import { BookingsService } from '../domain/bookings.service';
import type { Json } from '../domain/mappers';
import { StoreService } from '../domain/store.service';

class DutyDto {
  @IsIn(['On Duty', 'Off Duty'], { message: 'Choose On Duty or Off Duty.' })
  status: 'On Duty' | 'Off Duty';
}

const OPEN = ['Confirmed', 'Active'];

/**
 * The driver's own page in the admin portal: the trips they are assigned to and their duty punch.
 * Drivers see only their own record and only the booking details they need for the trip.
 */
@ApiTags('driver')
@ApiBearerAuth()
@StaffOnly('Driver')
@Controller('driver')
export class DriverController {
  constructor(
    private readonly store: StoreService,
    private readonly bookings: BookingsService,
  ) {}

  private async myRecord(me: AuthPayload) {
    if (!me.driverId) throw new ForbiddenException('This account is not linked to a driver. Ask your manager to link it.');
    const driver = await this.store.get('drivers', me.driverId);
    if (!driver) throw new NotFoundException('Your driver record was removed. Ask your manager.');
    return driver;
  }

  @Get('me')
  @ApiOperation({ summary: 'My driver profile, duty status and assigned trips' })
  async me(@CurrentUser() me: AuthPayload) {
    const driver = await this.myRecord(me);
    const trips = (await this.bookings.listBookings({ details: { path: ['driverId'], equals: me.driverId! } }))
      .filter((b) => b.status !== 'Quoted')
      .map((b) => ({
        id: b.id,
        status: b.status,
        vehicleName: b.vehicleName,
        vehicleNumber: b.vehicleNumber,
        customerName: b.customerName,
        // The customer's phone is shared only while the trip is open
        customerPhone: OPEN.includes(String(b.status)) ? b.customerPhone : '',
        pickupLocation: b.pickupLocation,
        pickupDate: b.pickupDate,
        pickupTime: b.pickupTime,
        returnDate: b.returnDate,
        returnTime: b.returnTime,
        days: b.days,
      }));
    return {
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        licenseNo: driver.licenseNo,
        licenseExpiry: driver.licenseExpiry,
        dutyStatus: driver.dutyStatus,
        lastPunchIn: driver.lastPunchIn ?? null,
        lastPunchOut: driver.lastPunchOut ?? null,
        commissionPercent: driver.commissionPercent,
        tripsThisMonth: driver.tripsThisMonth,
      },
      trips,
    };
  }

  @Post('duty')
  @HttpCode(200)
  @ApiOperation({ summary: 'Punch in (On Duty) or out (Off Duty)' })
  async duty(@CurrentUser() me: AuthPayload, @Body() body: DutyDto) {
    const driver = await this.myRecord(me);
    if (driver.dutyStatus === 'On Trip' && body.status === 'Off Duty') throw new BadRequestException('You are on a trip. Punch out after the trip is finished.');
    const now = new Date().toISOString();
    const patch: Json = { dutyStatus: body.status, ...(body.status === 'On Duty' ? { lastPunchIn: now } : { lastPunchOut: now }) };
    await this.store.patch('drivers', me.driverId!, patch);
    return { dutyStatus: body.status, at: now };
  }
}

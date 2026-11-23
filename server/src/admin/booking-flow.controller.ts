import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { Can, CurrentUser, type AuthPayload } from '../auth/auth.decorators';
import { BookingsService } from '../domain/bookings.service';
import { RemindersService } from '../domain/reminders.service';
import { bookingToApi, type Json } from '../domain/mappers';
import { dateTime } from '../common/dates';

/**
 * Level 5 booking flow in the admin portal: create a quotation (the server gives the booking ID), check a car's
 * availability for exact dates and times, confirm (with the clash check), renew or send a quotation, and send the
 * pickup reminder now.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/bookings')
export class BookingFlowController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly reminders: RemindersService
  ) {}

  @Post()
  @Can('bookings', 'edit')
  @ApiOperation({ summary: 'Create a quotation; the server gives the booking ID (KG + yymmdd + count of the day)' })
  create(@Body() body: Json) {
    return this.bookings.createBooking({ ...(body ?? {}), id: undefined, status: 'Quoted' });
  }

  @Get('availability')
  @Can('bookings', 'view')
  @ApiOperation({ summary: 'Bookings that hold a car between ?vehicleId&pickupDate&pickupTime&returnDate&returnTime (empty = free)' })
  async availability(
    @Query('vehicleId') vehicleId: string,
    @Query('pickupDate') pickupDate: string,
    @Query('pickupTime') pickupTime: string,
    @Query('returnDate') returnDate: string,
    @Query('returnTime') returnTime: string,
    @Query('except') except?: string
  ) {
    const from = dateTime(pickupDate, pickupTime);
    const to = dateTime(returnDate, returnTime);
    if (!vehicleId || !from || !to || to <= from) throw new BadRequestException('Give a car and valid pickup and return dates and times.');
    const clashes = await this.bookings.findClashes(vehicleId, from, to, except);
    return { available: clashes.length === 0, clashes: clashes.map(bookingToApi) };
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @Can('bookings', 'edit')
  @ApiOperation({ summary: 'Confirm a quotation (409 with the clashing booking when the car is taken at those times)' })
  confirm(@Param('id') id: string) {
    return this.bookings.confirmQuote(id);
  }

  @Post(':id/renew-quote')
  @HttpCode(200)
  @Can('bookings', 'edit')
  @ApiOperation({ summary: 'Give a quotation a fresh validity period (same price)' })
  renew(@Param('id') id: string) {
    return this.bookings.renewQuote(id);
  }

  @Post(':id/send-quote')
  @HttpCode(200)
  @Can('bookings', 'edit')
  @ApiOperation({ summary: "Send the quotation to the customer's WhatsApp from KeyGo's linked number" })
  sendQuote(@Param('id') id: string, @CurrentUser() me: AuthPayload) {
    return this.reminders.sendQuote(id, me.name);
  }

  @Post(':id/reminder')
  @HttpCode(200)
  @Can('bookings', 'edit')
  @ApiOperation({ summary: 'Send the pickup reminder now (in the app, and by WhatsApp when linked)' })
  remind(@Param('id') id: string, @CurrentUser() me: AuthPayload) {
    return this.reminders.sendReminder(id, me.name);
  }
}

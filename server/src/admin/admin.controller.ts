import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, StaffOnly, type AuthPayload } from '../auth/auth.decorators';
import { rethrowDbError } from '../common/prisma-errors';
import { BookingsService } from '../domain/bookings.service';
import { customerFromApi, customerToApi, revealAadhaar, type Json } from '../domain/mappers';
import { checkName, StoreService } from '../domain/store.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin portal data. Every route needs a staff token. The portal loads everything once with
 * GET /admin/workspace and then saves each change with the PUT/DELETE routes below.
 */
@ApiTags('admin')
@ApiBearerAuth()
@StaffOnly()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly bookings: BookingsService,
  ) {}

  @Get('workspace')
  @ApiOperation({ summary: 'Everything the admin portal shows: fleet, bookings, customers, records and settings' })
  async workspace() {
    const [vehicles, bookings, customers, records, settings] = await Promise.all([
      this.bookings.listVehicles(),
      this.bookings.listBookings(),
      this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } }),
      this.store.allRecords(),
      this.store.allSettings(),
    ]);
    return { vehicles, bookings, customers: customers.map(customerToApi), records, settings };
  }

  // ---------------------------------------------------------------- fleet, bookings, customers

  @Put('vehicles/:id')
  @ApiOperation({ summary: 'Create or replace a vehicle' })
  saveVehicle(@Param('id') id: string, @Body() body: Json) {
    return this.bookings.saveVehicle(checkName('vehicle', id), body);
  }

  @Put('bookings/:id')
  @ApiOperation({ summary: 'Create or replace a booking (409 if it overlaps another confirmed or active booking)' })
  saveBooking(@Param('id') id: string, @Body() body: Json) {
    return this.bookings.saveBooking(checkName('booking', id), body);
  }

  @Put('customers/:id')
  @ApiOperation({ summary: 'Create or replace a customer profile' })
  async saveCustomer(@Param('id') id: string, @Body() body: Json) {
    const data = customerFromApi(body);
    try {
      const saved = await this.prisma.customer.upsert({ where: { id: checkName('customer', id) }, create: { ...data, id }, update: data });
      return customerToApi(saved);
    } catch (e) {
      rethrowDbError(e, { email: 'email', phone: 'phone number', customer_code: 'customer code' });
    }
  }

  @Get('customers/:id/aadhaar')
  @StaffOnly('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Full Aadhaar number of a customer (stored encrypted)' })
  async aadhaar(@Param('id') id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found.');
    return { aadhaarNo: revealAadhaar(c) ?? '' };
  }

  // ---------------------------------------------------------------- records (agreements, inspections, finance, ...)

  @Get('records/:collection')
  @ApiOperation({ summary: 'All records of one collection, newest first' })
  list(@Param('collection') collection: string) {
    return this.store.list(checkName('collection', collection));
  }

  @Put('records/:collection/:id')
  @ApiOperation({ summary: 'Create or replace one record' })
  put(@Param('collection') collection: string, @Param('id') id: string, @Body() body: Json) {
    return this.store.put(checkName('collection', collection), checkName('record', id), body);
  }

  @Delete('records/:collection/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one record' })
  async remove(@Param('collection') collection: string, @Param('id') id: string) {
    await this.store.remove(checkName('collection', collection), checkName('record', id));
  }

  // ---------------------------------------------------------------- settings (company profile, policies, terms, templates, ...)

  @Get('settings/:key')
  @ApiOperation({ summary: 'One settings document (null when it was never saved)' })
  async getSetting(@Param('key') key: string) {
    return { key, value: await this.store.setting(checkName('setting', key), null) };
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Save one settings document; the body is { value }' })
  async saveSetting(@Param('key') key: string, @Body() body: { value: unknown }, @CurrentUser() me: AuthPayload) {
    return { key, value: await this.store.saveSetting(checkName('setting', key), body?.value ?? null, me.name) };
  }
}

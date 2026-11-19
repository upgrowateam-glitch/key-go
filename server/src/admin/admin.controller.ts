import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { hash } from 'bcryptjs';
import { Can, CurrentUser, StaffOnly, type AuthPayload } from '../auth/auth.decorators';
import { AREA_LABELS, areaOfCollection, areaOfSetting, can, isPrivateSetting, OPERATIONAL_VEHICLE_FIELDS, type Access, type Area } from '../auth/permissions';
import { rethrowDbError } from '../common/prisma-errors';
import { BookingsService } from '../domain/bookings.service';
import { customerFromApi, customerToApi, revealAadhaar, type Json } from '../domain/mappers';
import { checkName, StoreService } from '../domain/store.service';
import { PrismaService } from '../prisma/prisma.service';

/** Throws unless the caller's role may view or change the area (see auth/permissions.ts). */
function ensure(me: AuthPayload, area: Area, access: Exclude<Access, 'none'>) {
  if (!can(me.role, area, access)) throw new ForbiddenException(`Your ${me.role} account cannot ${access === 'edit' ? 'change' : 'open'} ${AREA_LABELS[area]}.`);
}

/** Settings that only have their own routes (the permission table). */
const reservedSetting = (key: string) => key.startsWith('auth.');

const canReadSetting = (me: AuthPayload, key: string) =>
  !reservedSetting(key) && (can(me.role, areaOfSetting(key), 'view') || (!isPrivateSetting(key) && can(me.role, 'settings', 'view')));

/**
 * Admin portal data. Every route needs a staff token and checks the caller's permission for the area it touches.
 * The portal loads everything the role may see once with GET /admin/workspace and then saves each change with
 * the PUT/DELETE routes below.
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
  @ApiOperation({ summary: 'Everything the admin portal shows, limited to what the caller’s role may see' })
  async workspace(@CurrentUser() me: AuthPayload) {
    const see = (area: Area) => can(me.role, area, 'view');
    const [vehicles, bookings, customers, records, settings] = await Promise.all([
      see('fleet') || see('bookings') ? this.bookings.listVehicles() : [],
      see('bookings') ? this.bookings.listBookings() : [],
      see('customers') ? this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } }) : [],
      this.store.allRecords(),
      this.store.allSettings(),
    ]);
    // Purchase price and loan details are for people who manage the fleet
    const fleetEditor = can(me.role, 'fleet', 'edit');
    const shownVehicles = fleetEditor ? vehicles : vehicles.map(({ purchaseCost: _cost, loanDetails: _loan, ...v }) => v);
    return {
      vehicles: shownVehicles,
      bookings,
      customers: customers.map(customerToApi),
      records: Object.fromEntries(Object.entries(records).filter(([collection]) => see(areaOfCollection(collection)))),
      settings: Object.fromEntries(Object.entries(settings).filter(([key]) => canReadSetting(me, key))),
    };
  }

  // ---------------------------------------------------------------- fleet, bookings, customers

  @Put('vehicles/:id')
  @ApiOperation({ summary: 'Create or replace a vehicle (booking and inspection staff may only change status, odometer and fuel)' })
  async saveVehicle(@Param('id') id: string, @Body() body: Json, @CurrentUser() me: AuthPayload) {
    checkName('vehicle', id);
    if (can(me.role, 'fleet', 'edit')) return this.bookings.saveVehicle(id, body);
    if (!can(me.role, 'bookings', 'edit') && !can(me.role, 'inspections', 'edit')) ensure(me, 'fleet', 'edit');
    const [current] = await this.bookings.listVehicles({ id });
    if (!current) throw new ForbiddenException('Only people who manage the fleet can add vehicles.');
    const allowed = Object.fromEntries(OPERATIONAL_VEHICLE_FIELDS.filter((k) => k in body).map((k) => [k, body[k]]));
    return this.bookings.saveVehicle(id, { ...current, ...allowed });
  }

  @Put('bookings/:id')
  @Can('bookings', 'edit')
  @ApiOperation({ summary: 'Create or replace a booking (409 if it overlaps another confirmed or active booking)' })
  saveBooking(@Param('id') id: string, @Body() body: Json) {
    return this.bookings.saveBooking(checkName('booking', id), body);
  }

  @Put('customers/:id')
  @Can('customers', 'edit')
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

  @Put('customers/:id/password')
  @StaffOnly('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Set a new password for a customer who forgot theirs; signs them out on every device' })
  async resetCustomerPassword(@Param('id') id: string, @Body() body: { password?: unknown }) {
    const password = typeof body?.password === 'string' ? body.password : '';
    if (password.length < 8) throw new BadRequestException('Use at least 8 characters for the new password.');
    const c = await this.prisma.customer.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!c) throw new NotFoundException('Customer not found.');
    if (!c.email) throw new BadRequestException('This customer has no email address, so they cannot sign in to the app. Add an email first.');
    await this.prisma.customer.update({ where: { id }, data: { passwordHash: await hash(password, 10), tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- records (agreements, inspections, finance, ...)

  @Get('records/:collection')
  @ApiOperation({ summary: 'All records of one collection, newest first' })
  list(@Param('collection') collection: string, @CurrentUser() me: AuthPayload) {
    ensure(me, areaOfCollection(checkName('collection', collection)), 'view');
    return this.store.list(collection);
  }

  @Put('records/:collection/:id')
  @ApiOperation({ summary: 'Create or replace one record' })
  put(@Param('collection') collection: string, @Param('id') id: string, @Body() body: Json, @CurrentUser() me: AuthPayload) {
    ensure(me, areaOfCollection(checkName('collection', collection)), 'edit');
    return this.store.put(collection, checkName('record', id), body);
  }

  @Delete('records/:collection/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one record' })
  async remove(@Param('collection') collection: string, @Param('id') id: string, @CurrentUser() me: AuthPayload) {
    ensure(me, areaOfCollection(checkName('collection', collection)), 'edit');
    await this.store.remove(collection, checkName('record', id));
  }

  // ---------------------------------------------------------------- settings (company profile, policies, terms, templates, ...)

  @Get('settings/:key')
  @ApiOperation({ summary: 'One settings document (null when it was never saved)' })
  async getSetting(@Param('key') key: string, @CurrentUser() me: AuthPayload) {
    if (reservedSetting(checkName('setting', key))) throw new ForbiddenException('See Settings → Permissions.');
    if (!canReadSetting(me, key)) ensure(me, areaOfSetting(key), 'view');
    return { key, value: await this.store.setting(key, null) };
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Save one settings document; the body is { value }' })
  async saveSetting(@Param('key') key: string, @Body() body: { value: unknown }, @CurrentUser() me: AuthPayload) {
    if (reservedSetting(checkName('setting', key))) throw new ForbiddenException('Change access in Settings → Permissions.');
    ensure(me, areaOfSetting(key), 'edit');
    return { key, value: await this.store.saveSetting(key, body?.value ?? null, me.name) };
  }
}

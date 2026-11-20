import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Put, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { hash } from 'bcryptjs';
import { Can, CurrentUser, StaffOnly, type AuthPayload } from '../auth/auth.decorators';
import { AREA_LABELS, areaOfCollection, areaOfSetting, can, isPrivateSetting, OPERATIONAL_VEHICLE_FIELDS, type Access, type Area } from '../auth/permissions';
import { rethrowDbError } from '../common/prisma-errors';
import { BookingsService } from '../domain/bookings.service';
import { customerFromApi, customerToApi, revealAadhaar, type IdentityDocWithFile, type Json } from '../domain/mappers';
import { normaliseLicence } from '../domain/licence';
import { actorOf, AuditService } from '../identity/audit.service';
import { encrypt } from '../common/crypto';
import { IdentityService } from '../identity/identity.service';
import { checkName, StoreService } from '../domain/store.service';
import { PrismaService } from '../prisma/prisma.service';

/** Throws unless the caller's role may view or change the area (see auth/permissions.ts). */
function ensure(me: AuthPayload, area: Area, access: Exclude<Access, 'none'>) {
  if (!can(me.role, area, access)) throw new ForbiddenException(`Your ${me.role} account cannot ${access === 'edit' ? 'change' : 'open'} ${AREA_LABELS[area]}.`);
}

/** Records with their own routes and audit log (driver pay). */
const PROTECTED_COLLECTIONS = new Set(['driverPayEntries', 'driverSalaries', 'driverPayslips']);

const maskLicence = (n: string | null) => (n ? `${n.slice(0, 4)} ••••${n.slice(-4)}` : undefined);

/** A new or changed licence number must be a valid Indian licence number; unchanged older numbers are left alone. */
function checkLicence(body: Json, previous: { dlNumber: string | null } | null) {
  const raw = typeof body.dlNumber === 'string' ? body.dlNumber.trim() : '';
  if (!raw) return null;
  const same = previous?.dlNumber && previous.dlNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() === raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return same ? null : normaliseLicence(raw);
}

const licenceDetailsChanged = (a: { dlNumber: string | null; dlExpiry: Date | null }, b: { dlNumber: string | null; dlExpiry: Date | null }) =>
  (a.dlNumber ?? '') !== (b.dlNumber ?? '') || (a.dlExpiry?.getTime() ?? 0) !== (b.dlExpiry?.getTime() ?? 0);

/** Settings that only have their own routes (the permission table, the encryption key check). */
const reservedSetting = (key: string) => key.startsWith('auth.') || key.startsWith('security.');

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
    private readonly identity: IdentityService,
    private readonly audit: AuditService,
  ) {}

  /** Identity documents of one customer (or all customers), for the customer views. */
  private async customerDocs(customerId?: string) {
    const docs = await this.prisma.identityDocument.findMany({
      where: { ownerType: 'customer', ...(customerId ? { ownerId: customerId } : {}) },
      include: { file: { select: { mimeType: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const byOwner = new Map<string, IdentityDocWithFile[]>();
    for (const d of docs) byOwner.set(d.ownerId, [...(byOwner.get(d.ownerId) ?? []), d]);
    return byOwner;
  }

  @Get('workspace')
  @ApiOperation({ summary: 'Everything the admin portal shows, limited to what the caller’s role may see' })
  async workspace(@CurrentUser() me: AuthPayload) {
    const see = (area: Area) => can(me.role, area, 'view');
    const [vehicles, bookings, customers, records, settings, docs] = await Promise.all([
      see('fleet') || see('bookings') ? this.bookings.listVehicles() : [],
      see('bookings') ? this.bookings.listBookings() : [],
      see('customers') ? this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } }) : [],
      this.store.allRecords(),
      this.store.allSettings(),
      see('customers') ? this.customerDocs() : new Map<string, IdentityDocWithFile[]>(),
    ]);
    // Purchase price and loan details are for people who manage the fleet
    const fleetEditor = can(me.role, 'fleet', 'edit');
    const shownVehicles = fleetEditor ? vehicles : vehicles.map(({ purchaseCost: _cost, loanDetails: _loan, ...v }) => v);
    return {
      vehicles: shownVehicles,
      bookings,
      customers: customers.map((c) => customerToApi(c, docs.get(c.id))),
      // Driver pay is served by its own routes (with the audit log), not as plain records
      records: Object.fromEntries(Object.entries(records).filter(([collection]) => see(areaOfCollection(collection)) && !PROTECTED_COLLECTIONS.has(collection))),
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
  @ApiOperation({ summary: 'Create or replace a customer profile (verification statuses are set by the document and face checks)' })
  async saveCustomer(@Param('id') id: string, @Body() body: Json, @CurrentUser() me: AuthPayload) {
    const previous = await this.prisma.customer.findUnique({ where: { id: checkName('customer', id) } });
    const licence = checkLicence(body, previous);
    const data = customerFromApi(licence ? { ...body, dlNumber: licence.number, dlState: body.dlState || licence.state } : body);
    // Only the document review and the face check change these
    delete data.idCardStatus;
    delete data.faceVerification;
    try {
      const saved = await this.prisma.customer.upsert({ where: { id }, create: { ...data, id }, update: data });
      if (previous && licenceDetailsChanged(previous, saved)) {
        await this.identity.licenceChanged(id, actorOf(me), { dlNumber: maskLicence(saved.dlNumber), dlExpiry: saved.dlExpiry?.toISOString().slice(0, 10) });
      }
      return customerToApi(saved, (await this.customerDocs(id)).get(id));
    } catch (e) {
      rethrowDbError(e, { email: 'email', phone: 'phone number', customer_code: 'customer code' });
    }
  }

  @Get('customers/:id')
  @Can('customers', 'view')
  @ApiOperation({ summary: 'One customer with document and verification statuses' })
  async customer(@Param('id') id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found.');
    return customerToApi(c, (await this.customerDocs(id)).get(id));
  }

  @Put('customers/:id/aadhaar')
  @Can('customers', 'edit')
  @ApiOperation({ summary: "Store a customer's full Aadhaar number (encrypted; the portal only ever shows the last 4 digits)" })
  async setAadhaar(@Param('id') id: string, @Body() body: { aadhaarNo?: unknown }, @CurrentUser() me: AuthPayload) {
    const digits = String(body?.aadhaarNo ?? '').replace(/\D/g, '');
    if (digits.length !== 12) throw new BadRequestException('Aadhaar number must have 12 digits.');
    const c = await this.prisma.customer.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true } });
    if (!c) throw new NotFoundException('Customer not found.');
    await this.prisma.customer.update({ where: { id }, data: { aadhaarNoEnc: encrypt(digits), aadhaarLast4: digits.slice(-4) } });
    await this.audit.log(actorOf(me), 'aadhaar.updated', { type: 'customer', id, name: `${c.firstName} ${c.lastName}`.trim() }, { last4: digits.slice(-4) });
    return { aadhaarNo: `XXXX-XXXX-${digits.slice(-4)}` };
  }

  @Get('customers/:id/aadhaar')
  @StaffOnly('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Full Aadhaar number of a customer (stored encrypted)' })
  async aadhaar(@Param('id') id: string, @CurrentUser() me: AuthPayload) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found.');
    await this.audit.log(actorOf(me), 'aadhaar.viewed', { type: 'customer', id, name: `${c.firstName} ${c.lastName}`.trim() });
    const full = revealAadhaar(c);
    if (c.aadhaarNoEnc && full === null) throw new ServiceUnavailableException("This Aadhaar number cannot be opened with the server's encryption key. Check DATA_ENCRYPTION_KEY.");
    return { aadhaarNo: full ?? '' };
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
    if (PROTECTED_COLLECTIONS.has(collection)) throw new ForbiddenException('Use the Driver pay screen for salaries, advances and deductions.');
    ensure(me, areaOfCollection(checkName('collection', collection)), 'edit');
    return this.store.put(collection, checkName('record', id), body);
  }

  @Delete('records/:collection/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one record' })
  async remove(@Param('collection') collection: string, @Param('id') id: string, @CurrentUser() me: AuthPayload) {
    if (PROTECTED_COLLECTIONS.has(collection)) throw new ForbiddenException('Use the Driver pay screen for salaries, advances and deductions.');
    ensure(me, areaOfCollection(checkName('collection', collection)), 'edit');
    // A deleted driver's licence, ID and police verification files are deleted too
    const driver = collection === 'drivers' ? await this.store.get('drivers', id) : null;
    await this.store.remove(collection, checkName('record', id));
    if (driver) await this.identity.removeAllFor('driver', id, actorOf(me), String(driver.name ?? id));
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

import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser, CustomerOnly, type AuthPayload } from '../auth/auth.decorators';
import { addDays, daysBetween, isIsoDate, todayIst } from '../common/dates';
import { rethrowDbError } from '../common/prisma-errors';
import { BookingsService } from '../domain/bookings.service';
import { DEFAULT_LOYALTY_TIERS, DEFAULT_PENALTIES, SETTING_LOYALTY_TIERS, SETTING_PENALTIES } from '../domain/defaults';
import { CUSTOMER_SELF_EDITABLE, bookingToApi, currentRate, customerFromApi, customerToApi, ratesToApi, type Json } from '../domain/mappers';
import { computeQuote, type Term } from '../domain/pricing';
import { StoreService } from '../domain/store.service';
import { PrismaService } from '../prisma/prisma.service';

class CreateBookingDto {
  /** Optional id chosen by the app, so it can show the booking before the server answers. */
  @IsOptional() @Matches(/^KG-[A-Z0-9]{4,12}$/) id?: string;
  @IsString() @MaxLength(40) vehicleId: string;
  @IsString() @MaxLength(160) pickupLocation: string;
  @IsString() pickupDate: string;
  @IsString() @MaxLength(12) pickupTime: string;
  @IsString() returnDate: string;
  @IsString() @MaxLength(12) returnTime: string;
  @IsIn(['Daily', 'Weekly', 'Monthly']) term: Term;
  @IsIn(['Personal', 'Business', 'Outstation', 'Vacation']) purpose: string;
}

class ExtendDto {
  @IsInt() @Min(1) @Max(60) extraDays: number;
}

class SignDto {
  /** Optional agreement number chosen by the app, so it can show the agreement before the server answers. */
  @IsOptional() @Matches(/^AGR-\d{4}-[A-Z0-9]{4,14}$/) id?: string;
  @IsString() @MaxLength(200_000) signaturePath: string;
  @IsString() @MaxLength(120) signedBy: string;
}

const newBookingId = () => `KG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/** The signed-in customer's own data. Prices are always worked out here, never trusted from the app. */
@ApiTags('customer')
@ApiBearerAuth()
@CustomerOnly()
@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly bookings: BookingsService,
  ) {}

  private async ownBooking(me: AuthPayload, id: string) {
    const b = await this.bookings.getBooking(id);
    if (b.customerId !== me.sub) throw new NotFoundException('Booking not found.');
    return b;
  }

  private async profile(me: AuthPayload) {
    const c = await this.prisma.customer.findUnique({ where: { id: me.sub } });
    if (!c) throw new NotFoundException('Account not found.');
    return c;
  }

  @Get('workspace')
  @ApiOperation({ summary: 'Everything the customer app shows: profile, fleet, own bookings, agreements and notifications' })
  async workspace(@CurrentUser() me: AuthPayload) {
    const [customer, vehicles, bookings, loyaltyTiers, penalties] = await Promise.all([
      this.profile(me),
      this.bookings.listVehicles({ status: { not: 'SOLD' } }),
      this.bookings.listBookings({ customerId: me.sub }),
      this.store.setting(SETTING_LOYALTY_TIERS, DEFAULT_LOYALTY_TIERS),
      this.store.setting(SETTING_PENALTIES, DEFAULT_PENALTIES),
    ]);
    const ids = new Set(bookings.map((b) => b.id as string));
    const mine = (r: Json) => ids.has(r.bookingId as string);
    const [agreements, inspections, fastagLogs, notifications] = await Promise.all([
      this.store.listWhere('agreements', mine),
      this.store.listWhere('inspections', mine),
      this.store.listWhere('fastagLogs', mine),
      this.store.listWhere('notifications', (n) => n.customerId === me.sub),
    ]);
    return {
      customer: customerToApi(customer),
      vehicles,
      bookings,
      agreements,
      inspections,
      fastagLogs,
      notifications,
      loyaltyTiers,
      // Rules and lists the app needs to price trips the same way as the server
      pricing: await this.bookings.pricing(),
      standardFines: (penalties as Json[]).filter((p) => p.active !== false).map((p) => ({ id: p.id, label: p.label, amount: p.amount })),
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update own profile' })
  async updateProfile(@CurrentUser() me: AuthPayload, @Body() body: Json) {
    const current = customerToApi(await this.profile(me));
    const allowed = Object.fromEntries(Object.entries(body).filter(([k]) => (CUSTOMER_SELF_EDITABLE as readonly string[]).includes(k)));
    const data = customerFromApi({ ...current, ...allowed });
    // Verification states, tier, points and rating are managed by KeyGo staff
    for (const k of ['idCardStatus', 'faceVerification', 'loyaltyTier', 'loyaltyPoints', 'trustRating', 'customerCode', 'email', 'createdAt'] as const) delete data[k];
    try {
      return customerToApi(await this.prisma.customer.update({ where: { id: me.sub }, data }));
    } catch (e) {
      rethrowDbError(e, { phone: 'phone number' });
    }
  }

  // ---------------------------------------------------------------- bookings

  @Post('bookings')
  @ApiOperation({ summary: 'Request a quote for a car and dates (status Quoted)' })
  async createBooking(@CurrentUser() me: AuthPayload, @Body() body: CreateBookingDto) {
    if (!isIsoDate(body.pickupDate) || !isIsoDate(body.returnDate)) throw new BadRequestException('Choose valid pickup and return dates.');
    if (body.pickupDate < todayIst()) throw new BadRequestException('The pickup date cannot be in the past.');
    const vehicle = await this.bookings.vehicleWithRates(body.vehicleId);
    if (vehicle.status === 'SOLD' || vehicle.status === 'MAINTENANCE') throw new BadRequestException('This car is not available for booking.');
    const rules = await this.bookings.pricing();
    const rates = this.bookings.ratesFor(vehicle, rules);
    if (!rates) throw new BadRequestException('This car has no price yet.');
    const customer = await this.profile(me);
    const days = Math.max(1, daysBetween(body.pickupDate, body.returnDate) || 1);
    const q = computeQuote(rates, days, body.term, 0, rules.taxRate);
    const id = body.id && !(await this.prisma.booking.count({ where: { id: body.id } })) ? body.id : newBookingId();
    return this.bookings.saveBooking(id, {
      customerId: me.sub,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      customerPhone: customer.phone ?? '',
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehicleNumber: vehicle.registrationNo,
      vehicleCategory: vehicle.type,
      pickupLocation: body.pickupLocation,
      pickupDate: body.pickupDate,
      pickupTime: body.pickupTime,
      returnDate: body.returnDate,
      returnTime: body.returnTime,
      days,
      term: body.term,
      purpose: body.purpose,
      classification: 'Online',
      baseRatePerDay: q.ratePerDay,
      subtotal: q.subtotal,
      discount: q.manualDiscount + q.termDiscount,
      tax: q.tax,
      totalAmount: q.total,
      depositAmount: q.deposit,
      status: 'Quoted',
      paymentStatus: 'Unpaid',
      createdAt: todayIst(),
      reminderScheduledFor: addDays(body.pickupDate, -2),
      reminderSent: false,
    });
  }

  @Post('bookings/:id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a quote after the deposit (409 if the car was booked meanwhile)' })
  async confirm(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const b = await this.ownBooking(me, id);
    if (b.status !== 'QUOTED' && b.status !== 'PENDING') throw new BadRequestException('Only a quote can be confirmed.');
    const saved = await this.bookings.patchBooking(id, {
      status: 'Confirmed',
      ...(b.paymentStatus === 'UNPAID' ? { paymentStatus: 'Deposit paid' } : {}),
    });
    const vehicle = await this.bookings.vehicleWithRates(b.vehicleId);
    await this.store.notify({ type: 'booking', title: 'New app booking', message: `${b.customerName} confirmed ${vehicle.name} (${id}) for ${saved?.pickupDate}.` });
    await this.store.notify({ type: 'booking', customerId: me.sub, title: 'Booking confirmed', message: `Your ${vehicle.name} (${id}) is confirmed for pickup on ${saved?.pickupDate} at ${saved?.pickupTime}.` });
    return saved;
  }

  @Post('bookings/:id/pay')
  @HttpCode(200)
  @ApiOperation({ summary: 'Record a payment (online payment gateway pending): the deposit confirms a quote, the balance settles it' })
  async pay(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const b = await this.ownBooking(me, id);
    if (b.paymentStatus === 'UNPAID') return this.confirm(me, id);
    if (b.paymentStatus !== 'DEPOSIT_PAID') throw new BadRequestException('Nothing is due on this booking.');
    return this.bookings.patchBooking(id, { paymentStatus: 'Paid' });
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a quote or confirmed booking before pickup' })
  async cancel(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const b = await this.ownBooking(me, id);
    if (!['QUOTED', 'PENDING', 'CONFIRMED'].includes(b.status)) throw new BadRequestException('This booking can no longer be cancelled in the app. Please contact KeyGo.');
    const saved = await this.bookings.patchBooking(id, { status: 'Cancelled' });
    const vehicle = await this.bookings.vehicleWithRates(b.vehicleId);
    if (b.status === 'CONFIRMED') await this.store.notify({ type: 'booking', title: 'Booking cancelled', message: `${b.customerName} cancelled ${id} (${vehicle.name}).` });
    return saved;
  }

  @Post('bookings/:id/extend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Extend a confirmed or active rental by some days (409 if the car is booked after it)' })
  async extend(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: ExtendDto) {
    const b = await this.ownBooking(me, id);
    if (b.status !== 'CONFIRMED' && b.status !== 'ACTIVE') throw new BadRequestException('Only an upcoming or active rental can be extended.');
    const current = bookingToApi(b);
    const vehicle = await this.bookings.vehicleWithRates(b.vehicleId);
    const rules = await this.bookings.pricing();
    const rates = this.bookings.ratesFor(vehicle, rules)!;
    const days = b.days + body.extraDays;
    const q = computeQuote(rates, days, current.term as Term, 0, rules.taxRate);
    const saved = await this.bookings.patchBooking(id, {
      days,
      returnDate: addDays(current.returnDate as string, body.extraDays),
      subtotal: q.subtotal,
      discount: q.manualDiscount + q.termDiscount,
      tax: q.tax,
      totalAmount: q.total,
    });
    await this.store.notify({ type: 'return', title: 'Rental extended', message: `${b.customerName} extended ${id} by ${body.extraDays} day(s); new return ${saved?.returnDate}.` });
    return saved;
  }

  @Post('bookings/:id/keyless')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lock or unlock the car with the digital key (vehicle integration pending)' })
  async keyless(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const b = await this.ownBooking(me, id);
    if (b.status !== 'ACTIVE' && b.status !== 'CONFIRMED') throw new BadRequestException('The digital key works only during your rental.');
    const current = bookingToApi(b);
    return this.bookings.patchBooking(id, { keylessUnlocked: !current.keylessUnlocked });
  }

  @Post('bookings/:id/agreement')
  @ApiOperation({ summary: 'Sign the rental agreement for a confirmed booking' })
  async sign(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: SignDto) {
    const b = await this.ownBooking(me, id);
    const current = bookingToApi(b);
    if (b.status !== 'CONFIRMED' && b.status !== 'ACTIVE') throw new BadRequestException('Confirm the booking before signing the agreement.');
    if (current.agreementId) throw new BadRequestException('This booking already has a signed agreement.');
    const penalties = (await this.store.setting<Json[]>(SETTING_PENALTIES, DEFAULT_PENALTIES)).filter((p) => p.active !== false);
    const generated = `AGR-${todayIst().slice(0, 4)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const agreementId = body.id && !(await this.store.get('agreements', body.id)) ? body.id : generated;
    const agreement = await this.store.put('agreements', agreementId, {
      bookingId: id,
      customerName: b.customerName,
      vehicleNumber: current.vehicleNumber ?? '',
      signedDate: todayIst(),
      status: 'Active',
      depositTermsAccepted: true,
      signaturePreview: `${body.signedBy.trim()} (Digitally Signed)`,
      signaturePath: body.signaturePath,
      rentalAmount: current.totalAmount,
      securityDeposit: current.depositAmount,
      discount: current.discount,
      fines: penalties.map((p) => ({ id: p.id, label: p.label, amount: p.amount })),
    });
    const booking = await this.bookings.patchBooking(id, { agreementId });
    return { agreement, booking };
  }

  // ---------------------------------------------------------------- notifications

  @Post('notifications/:id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark one notification as read' })
  async read(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const n = await this.store.get('notifications', id);
    if (!n || n.customerId !== me.sub) throw new ForbiddenException();
    return this.store.patch('notifications', id, { unread: false });
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark all own notifications as read' })
  async readAll(@CurrentUser() me: AuthPayload) {
    const mine = await this.store.listWhere('notifications', (n) => n.customerId === me.sub && n.unread === true);
    await Promise.all(mine.map((n) => this.store.patch('notifications', n.id as string, { unread: false })));
    return { updated: mine.length };
  }
}

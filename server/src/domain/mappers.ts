import { BadRequestException } from '@nestjs/common';
import type { Booking, Customer, IdentityDocument, Prisma, Vehicle, VehicleRate } from '@prisma/client';
import { decrypt, encrypt, maskAadhaar } from '../common/crypto';
import { clockLabel, dateOnly, dateTime, isIsoDate, isoDate, todayIst } from '../common/dates';
import { documentToApi, kycStatus, paperStatus } from '../identity/identity-status';
import {
  bookingStatusEnum,
  classificationEnum,
  loyaltyTierEnum,
  paymentStatusEnum,
  purposeEnum,
  termEnum,
  transmissionEnum,
  vehicleStatusEnum,
  verificationEnum,
} from '../common/enums';
import { customRatesOf, DEFAULT_PRICING, effectiveRates, type PricingRules } from './catalog';
import { ratesFromDaily, type Rates } from './pricing';

/** A JSON object sent by one of the apps. */
export type Json = Record<string, unknown>;

const paise = (rupees: unknown) => Math.round(Number(rupees ?? 0) * 100);
const optPaise = (rupees: unknown) => (rupees === undefined || rupees === null || rupees === '' ? null : paise(rupees));
const rupees = (p: number | null | undefined) => (p === null || p === undefined ? undefined : p / 100);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v));
const optStr = (v: unknown) => {
  const s = str(v);
  return s ? s : null;
};
const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback);
const asObject = (v: Prisma.JsonValue | null | undefined): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const without = (body: Json, keys: readonly string[]) => Object.fromEntries(Object.entries(body).filter(([k]) => !keys.includes(k)));

/** Runs a mapping and turns a bad value into a 400 with a readable message. */
function mapped<T>(what: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException(`Invalid ${what}: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------- Vehicles

const VEHICLE_KEYS = [
  'id', 'name', 'brand', 'type', 'color', 'seats', 'transmission', 'fuel', 'badge', 'status', 'vehicleNumber', 'purchaseCost',
  'purchaseDate', 'gpsDeviceId', 'fastagId', 'insuranceProvider', 'insurancePolicyNo', 'insuranceExpiry', 'pucCertificateNo',
  'pucExpiry', 'odometerKm', 'fuelLevelPercent', 'pricePerDay', 'rates', 'photoUrl', 'imageAsset',
] as const;

export type VehicleWithRates = Vehicle & { rates: VehicleRate[] };

export const currentRate = (rates: VehicleRate[]) => [...rates].sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];

export const ratesToApi = (r: VehicleRate | undefined): Rates | undefined =>
  r && { daily: r.dailyPaise / 100, weekly: r.weeklyPaise / 100, monthly: r.monthlyPaise / 100, deposit: r.depositPaise / 100, driverPerDay: r.driverPerDayPaise / 100 };

const kindFor = (type: string) => (type === 'Electric' ? 'ev' : type === 'SUV' || type === 'MUV' ? 'suv' : 'sedan');

/** Fields every screen expects, for vehicles that were added without them. */
const vehicleDefaults = (type: string): Json => ({
  kind: kindFor(type),
  gps: { lat: 12.9716, lng: 77.5946, area: 'No GPS signal yet', speedKmh: 0, ignitionOn: false, updatedAt: 'Not available' },
  fuelHistory: [],
  photoLabels: [],
  fastagBalance: 0,
});

/** A vehicle for the apps. Weekly, monthly and deposit follow the pricing rules unless the car has its own prices. */
/** Path of the photo customers see: the chosen main photo, else the front, else the first one uploaded. */
const photosOf = (details: Json) => (details.photos && typeof details.photos === 'object' ? details.photos : {}) as Record<string, string>;
const photoPath = (id: string, fileId: string) => `/public/vehicles/${encodeURIComponent(id)}/photos/${encodeURIComponent(fileId)}`;

/** The photo customers see first: the uploaded "main" photo, else the one chosen as main, else the front, else any. */
function mainPhotoPath(id: string, details: Json): string | undefined {
  const photos = photosOf(details);
  const chosen = typeof details.mainPhoto === 'string' ? photos[details.mainPhoto] : undefined;
  const fileId = photos.main ?? chosen ?? photos.front ?? Object.values(photos)[0];
  return fileId ? photoPath(id, fileId) : undefined;
}

/** Order and names of the car views shown to customers (swipe through them on the car's page). */
const GALLERY: [slot: string, label: string][] = [
  ['main', 'Main photo'],
  ['front', 'Front'],
  ['back', 'Back'],
  ['left', 'Left side'],
  ['right', 'Right side'],
  ['interior', 'Interior'],
  ['dashboard', 'Dashboard'],
];

/** Every uploaded view, main photo first, without repeating the same picture. */
function photoGallery(id: string, details: Json) {
  const photos = photosOf(details);
  const main = mainPhotoPath(id, details);
  const views = GALLERY.filter(([slot]) => photos[slot]).map(([slot, label]) => ({ slot, label, path: photoPath(id, photos[slot]) }));
  return main ? [...views.filter((p) => p.path === main).slice(0, 1), ...views.filter((p) => p.path !== main)] : views;
}

export function vehicleToApi(v: VehicleWithRates, rules: PricingRules = DEFAULT_PRICING): Json {
  const type = v.type;
  const details = asObject(v.details);
  const stored = ratesToApi(currentRate(v.rates));
  const rates = stored && effectiveRates(stored.daily, stored.driverPerDay, type, customRatesOf(details), rules);
  return {
    ...vehicleDefaults(type),
    ...details,
    customRates: customRatesOf(details),
    id: v.id,
    name: v.name,
    brand: v.brand ?? undefined,
    type,
    color: v.color ?? '#9AA5A0',
    seats: v.seats,
    transmission: transmissionEnum.fromDb(v.transmission),
    fuel: v.fuel,
    badge: v.badge ?? undefined,
    status: vehicleStatusEnum.fromDb(v.status),
    vehicleNumber: v.registrationNo,
    purchaseCost: rupees(v.purchaseCostPaise) ?? 0,
    purchaseDate: isoDate(v.purchaseDate),
    gpsDeviceId: v.gpsDeviceId ?? '',
    fastagId: v.fastagId ?? '',
    insuranceProvider: v.insuranceProvider ?? '',
    insurancePolicyNo: v.insurancePolicyNo ?? '',
    insuranceExpiry: isoDate(v.insuranceExpiry),
    pucCertificateNo: v.pucCertificateNo ?? '',
    pucExpiry: isoDate(v.pucExpiry),
    odometerKm: v.odometerKm,
    fuelLevelPercent: v.fuelLevelPercent,
    photoUrl: v.photoUrl ?? undefined,
    // The car's main photo uploaded by staff (Vehicle → Photos), served by /public/vehicles/:id/photos/:fileId
    mainPhotoPath: mainPhotoPath(v.id, details),
    // All uploaded views for the photo gallery on the car's page (main photo first)
    photoGallery: photoGallery(v.id, details),
    pricePerDay: rates?.daily ?? 0,
    rates,
  };
}

/** Car type from the editable list; any short name is accepted so older apps keep working. */
function vehicleType(v: unknown) {
  const t = str(v).slice(0, 40);
  if (!t) throw new BadRequestException('Choose a car type.');
  return t;
}

export interface VehicleInput {
  data: Omit<Prisma.VehicleUncheckedCreateInput, 'id'>;
  /** Price list to store, when the body carried one or changed the daily price. */
  rates?: Rates;
}

export function vehicleFromApi(body: Json, existingRates?: Rates): VehicleInput {
  return mapped('vehicle', () => {
    const name = str(body.name);
    const registrationNo = str(body.vehicleNumber);
    if (!name) throw new BadRequestException('Vehicle name is required.');
    if (!registrationNo) throw new BadRequestException('Vehicle number is required.');
    const sent = body.rates as Partial<Rates> | undefined;
    const daily = Number(body.pricePerDay ?? sent?.daily ?? existingRates?.daily ?? 0);
    let rates: Rates | undefined;
    if (sent && Number(sent.daily) > 0) {
      rates = { daily: Number(sent.daily), weekly: Number(sent.weekly), monthly: Number(sent.monthly), deposit: Number(sent.deposit), driverPerDay: Number(sent.driverPerDay) };
      if (daily > 0 && daily !== rates.daily) rates = ratesFromDaily(daily, rates.deposit, rates.driverPerDay);
    } else if (daily > 0 && daily !== existingRates?.daily) {
      rates = ratesFromDaily(daily, existingRates?.deposit, existingRates?.driverPerDay);
    }
    return {
      data: {
        name,
        brand: optStr(body.brand),
        type: vehicleType(body.type),
        color: optStr(body.color),
        seats: int(body.seats, 5),
        transmission: transmissionEnum.toDb(body.transmission),
        fuel: str(body.fuel) || 'Petrol',
        badge: optStr(body.badge),
        status: vehicleStatusEnum.toDbOr(body.status, 'AVAILABLE'),
        registrationNo,
        purchaseCostPaise: optPaise(body.purchaseCost),
        purchaseDate: dateOnly(body.purchaseDate),
        odometerKm: int(body.odometerKm),
        fuelLevelPercent: Math.min(100, Math.max(0, int(body.fuelLevelPercent, 100))),
        gpsDeviceId: optStr(body.gpsDeviceId),
        fastagId: optStr(body.fastagId),
        insuranceProvider: optStr(body.insuranceProvider),
        insurancePolicyNo: optStr(body.insurancePolicyNo),
        insuranceExpiry: dateOnly(body.insuranceExpiry),
        pucCertificateNo: optStr(body.pucCertificateNo),
        pucExpiry: dateOnly(body.pucExpiry),
        photoUrl: optStr(body.photoUrl),
        details: without(body, VEHICLE_KEYS) as Prisma.InputJsonValue,
      },
      rates,
    };
  });
}

// ---------------------------------------------------------------- Bookings

const BOOKING_KEYS = [
  'id', 'customerId', 'customerName', 'customerPhone', 'vehicleId', 'pickupLocation', 'pickupDate', 'returnDate', 'days', 'term',
  'purpose', 'classification', 'baseRatePerDay', 'subtotal', 'discount', 'tax', 'totalAmount', 'depositAmount', 'status',
  'paymentStatus', 'reminderScheduledFor', 'reminderSent', 'startOdometerKm', 'endOdometerKm', 'damageCharges', 'fuelCharges',
  'tollCharges', 'fineCharges', 'completedAt',
] as const;

export function bookingToApi(b: Booking): Json {
  const d = asObject(b.details);
  return {
    ...d,
    id: b.id,
    customerId: b.customerId ?? undefined,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    vehicleId: b.vehicleId,
    pickupLocation: b.pickupLocation,
    pickupDate: isoDate(b.pickupAt),
    pickupTime: (d.pickupTime as string) || clockLabel(b.pickupAt),
    returnDate: isoDate(b.returnAt),
    returnTime: (d.returnTime as string) || clockLabel(b.returnAt),
    days: b.days,
    term: termEnum.fromDb(b.term),
    purpose: purposeEnum.fromDb(b.purpose),
    classification: classificationEnum.fromDb(b.classification),
    baseRatePerDay: rupees(b.baseRatePaise),
    subtotal: rupees(b.subtotalPaise),
    discount: rupees(b.discountPaise),
    tax: rupees(b.taxPaise),
    totalAmount: rupees(b.totalPaise),
    depositAmount: rupees(b.depositPaise),
    status: bookingStatusEnum.fromDb(b.status),
    paymentStatus: paymentStatusEnum.fromDb(b.paymentStatus),
    createdAt: (d.createdAt as string) || isoDate(b.createdAt),
    reminderScheduledFor: b.reminderAt ? isoDate(b.reminderAt) : undefined,
    reminderSent: b.reminderSent,
    startOdometerKm: b.startOdometerKm ?? undefined,
    endOdometerKm: b.endOdometerKm ?? undefined,
    damageCharges: rupees(b.damageChargesPaise),
    fuelCharges: rupees(b.fuelChargesPaise),
    tollCharges: rupees(b.tollChargesPaise),
    fineCharges: rupees(b.fineChargesPaise),
    completedAt: b.completedAt ? isoDate(b.completedAt) : undefined,
  };
}

export function bookingFromApi(body: Json): Omit<Prisma.BookingUncheckedCreateInput, 'id'> {
  return mapped('booking', () => {
    const pickupAt = dateTime(body.pickupDate, body.pickupTime);
    const returnAt = dateTime(body.returnDate, body.returnTime);
    if (!pickupAt || !returnAt) throw new BadRequestException('Pickup and return dates must be valid dates (YYYY-MM-DD).');
    if (returnAt <= pickupAt) throw new BadRequestException('The return time must be after the pickup time.');
    const vehicleId = str(body.vehicleId);
    if (!vehicleId) throw new BadRequestException('A vehicle is required.');
    const status = bookingStatusEnum.toDb(body.status ?? 'Quoted');
    return {
      customerId: optStr(body.customerId),
      customerName: str(body.customerName) || 'Walk-in customer',
      customerPhone: str(body.customerPhone),
      vehicleId,
      pickupLocation: str(body.pickupLocation),
      pickupAt,
      returnAt,
      days: Math.max(1, int(body.days, 1)),
      term: termEnum.toDbOr(body.term, 'DAILY'),
      purpose: purposeEnum.toDbOr(body.purpose, 'PERSONAL'),
      classification: classificationEnum.toDbOr(body.classification, 'ONLINE'),
      baseRatePaise: paise(body.baseRatePerDay),
      subtotalPaise: paise(body.subtotal),
      discountPaise: paise(body.discount),
      taxPaise: paise(body.tax),
      totalPaise: paise(body.totalAmount),
      depositPaise: paise(body.depositAmount),
      status,
      paymentStatus: paymentStatusEnum.toDbOr(body.paymentStatus, 'UNPAID'),
      reminderAt: dateOnly(body.reminderScheduledFor),
      reminderSent: Boolean(body.reminderSent),
      startOdometerKm: body.startOdometerKm === undefined || body.startOdometerKm === null ? null : int(body.startOdometerKm),
      endOdometerKm: body.endOdometerKm === undefined || body.endOdometerKm === null ? null : int(body.endOdometerKm),
      damageChargesPaise: optPaise(body.damageCharges),
      fuelChargesPaise: optPaise(body.fuelCharges),
      tollChargesPaise: optPaise(body.tollCharges),
      fineChargesPaise: optPaise(body.fineCharges),
      completedAt: dateOnly(body.completedAt),
      cancelledAt: status === 'CANCELLED' ? new Date() : null,
      details: without(body, BOOKING_KEYS) as Prisma.InputJsonValue,
    };
  });
}

// ---------------------------------------------------------------- Customers

export type IdentityDocWithFile = IdentityDocument & { file?: { mimeType: string } | null };

const LEGACY_KIND: Record<string, string> = {
  photo: 'Photo',
  selfie: 'Photo',
  id_front: 'ID card',
  id_back: 'ID card',
  dl_front: 'Driving licence',
  dl_back: 'Driving licence',
  address_proof: 'Address proof',
};

const CUSTOMER_KEYS = [
  'id', 'name', 'firstName', 'lastName', 'dob', 'phone', 'email', 'address', 'city', 'aadhaarNo', 'idCardStatus', 'faceVerification',
  'dlNumber', 'dlState', 'dlExpiry', 'careOfName', 'careOfRelation', 'careOfPhone', 'customerCode', 'customerSince', 'loyaltyTier',
  'loyaltyPoints', 'trustRating', 'password',
  // Worked out by the server from the identity documents; never saved from the apps
  'documents', 'photoCaptured', 'identityDocs', 'kycStatus', 'kycMissing', 'dlStatus', 'dlExpired',
] as const;

/**
 * A customer for the apps. Documents, the licence status and the overall verification status come from the
 * identity documents (pass them in; without them the customer shows no documents).
 */
export function customerToApi(c: Customer, docs: IdentityDocWithFile[] = [], opts: { forCustomer?: boolean } = {}): Json {
  const d = asObject(c.details);
  const { documents: _old, photoCaptured: _flag, ...rest } = d;
  const dlStatus = paperStatus(docs, 'dl_front', 'dl_back');
  const kyc = kycStatus({ idCard: c.idCardStatus, licence: dlStatus, face: c.faceVerification, dlExpiry: c.dlExpiry, today: todayIst() });
  const identityDocs = docs.map((x) => documentToApi(x, opts));
  return {
    avatarBg: '#DCE8DE',
    ...rest,
    identityDocs,
    // Older screens read these two
    documents: identityDocs.map((x) => ({ id: x.id, name: x.label, kind: LEGACY_KIND[x.kind] ?? 'Other', status: x.status, uploadedAt: x.uploadedAt.slice(0, 10) })),
    photoCaptured: docs.some((x) => x.kind === 'photo' || x.kind === 'selfie'),
    dlStatus: verificationEnum.fromDb(dlStatus),
    dlExpired: !!c.dlExpiry && isoDate(c.dlExpiry) < todayIst(),
    kycStatus: kyc.status,
    kycMissing: kyc.missing,
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    firstName: c.firstName,
    lastName: c.lastName,
    dob: isoDate(c.dob),
    phone: c.phone ?? '',
    email: c.email ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    aadhaarNo: maskAadhaar(c.aadhaarLast4),
    idCardStatus: verificationEnum.fromDb(c.idCardStatus),
    faceVerification: verificationEnum.fromDb(c.faceVerification),
    dlNumber: c.dlNumber ?? '',
    dlState: c.dlState ?? '',
    dlExpiry: isoDate(c.dlExpiry),
    careOfName: c.careOfName ?? '',
    careOfRelation: c.careOfRelation ?? '',
    careOfPhone: c.careOfPhone ?? '',
    customerCode: c.customerCode ?? '',
    customerSince: isoDate(c.createdAt),
    loyaltyTier: loyaltyTierEnum.fromDb(c.loyaltyTier),
    loyaltyPoints: c.loyaltyPoints,
    trustRating: Number(c.trustRating),
  };
}

export const normaliseEmail = (v: unknown) => optStr(v)?.toLowerCase() ?? null;
export const normalisePhone = (v: unknown) => optStr(v)?.replace(/[\s-]/g, '') ?? null;

/** Fields a customer may change on their own profile in the app. */
export const CUSTOMER_SELF_EDITABLE = ['firstName', 'lastName', 'nickname', 'dob', 'phone', 'address', 'city', 'dlNumber', 'dlState', 'dlExpiry', 'careOfName', 'careOfRelation', 'careOfPhone', 'aadhaarNo'] as const;

export function customerFromApi(body: Json): Omit<Prisma.CustomerUncheckedCreateInput, 'id'> {
  return mapped('customer', () => {
    let firstName = str(body.firstName);
    let lastName = str(body.lastName);
    if (!firstName && str(body.name)) [firstName, lastName] = [str(body.name).split(' ')[0], str(body.name).split(' ').slice(1).join(' ')];
    if (!firstName) throw new BadRequestException('First name is required.');
    const data: Omit<Prisma.CustomerUncheckedCreateInput, 'id'> = {
      firstName,
      lastName,
      dob: dateOnly(body.dob),
      phone: normalisePhone(body.phone),
      email: normaliseEmail(body.email),
      address: optStr(body.address),
      city: optStr(body.city),
      dlNumber: optStr(body.dlNumber),
      dlState: optStr(body.dlState),
      dlExpiry: dateOnly(body.dlExpiry),
      careOfName: optStr(body.careOfName),
      careOfRelation: optStr(body.careOfRelation),
      careOfPhone: optStr(body.careOfPhone),
      customerCode: optStr(body.customerCode),
      idCardStatus: verificationEnum.toDbOr(body.idCardStatus, 'NOT_UPLOADED'),
      faceVerification: verificationEnum.toDbOr(body.faceVerification, 'NOT_UPLOADED'),
      loyaltyTier: loyaltyTierEnum.toDbOr(body.loyaltyTier, 'BRONZE'),
      loyaltyPoints: int(body.loyaltyPoints),
      trustRating: Math.min(5, Math.max(0, Number(body.trustRating ?? 5) || 0)),
      details: without(body, CUSTOMER_KEYS) as Prisma.InputJsonValue,
    };
    if (isIsoDate(body.customerSince)) data.createdAt = dateOnly(body.customerSince)!;
    // A masked number ("XXXX-XXXX-1234") means "unchanged"; anything else with 12 digits is a new number
    const aadhaar = str(body.aadhaarNo);
    if (aadhaar && !aadhaar.toUpperCase().startsWith('X')) {
      const digits = aadhaar.replace(/\D/g, '');
      if (digits.length !== 12) throw new BadRequestException('Aadhaar number must have 12 digits.');
      data.aadhaarNoEnc = encrypt(digits);
      data.aadhaarLast4 = digits.slice(-4);
    } else if (!aadhaar) {
      data.aadhaarNoEnc = null;
      data.aadhaarLast4 = null;
    }
    return data;
  });
}

/** Full Aadhaar number for staff who need it (never sent to the customer app). */
export const revealAadhaar = (c: Customer) => (c.aadhaarNoEnc ? decrypt(c.aadhaarNoEnc) : null);

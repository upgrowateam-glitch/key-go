/**
 * Sample data for local development: the same fleet, customers and staff accounts the apps ship as mock
 * data, so switching a screen from mock to API changes nothing visible. Re-runnable: every record is upserted.
 */
import { BookingClassification, BookingStatus, PaymentStatus, PrismaClient, RentalPurpose, RentalTerm, Transmission, UserRole, VehicleStatus, VehicleType } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'keygo123';
const TAX_RATE = 0.18;
const paise = (rupees: number) => Math.round(rupees * 100);
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const daysFromNow = (days: number, hour = 10) => {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

// ---------------------------------------------------------------- Branches

const branches = [
  { id: 'br-blr', name: 'KeyGo Hub Bengaluru', address: '12th Main, Indiranagar', city: 'Bengaluru' },
  { id: 'br-mum', name: 'KeyGo Hub Mumbai', address: 'Hill Road, Bandra West', city: 'Mumbai' },
  { id: 'br-del', name: 'KeyGo Hub Delhi', address: 'Connaught Place', city: 'New Delhi' },
];

// ---------------------------------------------------------------- Staff (admin portal demo accounts)

const staff = [
  { id: 'usr-owner', name: 'Rahul Menon', email: 'owner@keygo.in', role: UserRole.OWNER, branchId: 'br-blr' },
  { id: 'usr-admin', name: 'Priya Nair', email: 'admin@keygo.in', role: UserRole.ADMIN, branchId: 'br-blr' },
  { id: 'usr-manager', name: 'Arjun Das', email: 'manager@keygo.in', role: UserRole.MANAGER, branchId: 'br-mum' },
  { id: 'usr-staff', name: 'Sneha Rao', email: 'staff@keygo.in', role: UserRole.STAFF, branchId: 'br-blr' },
];

// ---------------------------------------------------------------- Customers

const customers = [
  {
    id: 'cust-1',
    firstName: 'Ananya',
    lastName: 'Sharma',
    dob: date('1994-04-18'),
    phone: '+919876543210',
    email: 'ananya.s@example.com',
    address: '42, Lavelle Road',
    city: 'Bengaluru',
    aadhaarLast4: '9012',
    dlNumber: 'KA01 20210098412',
    dlState: 'Karnataka',
    dlExpiry: date('2035-08-14'),
    careOfName: 'Dr. R. K. Sharma',
    careOfRelation: 'Father',
    careOfPhone: '+919845000112',
    customerCode: 'CORP-ROYAL',
    idCardStatus: 'VERIFIED' as const,
    faceVerification: 'VERIFIED' as const,
    loyaltyTier: 'GOLD' as const,
    loyaltyPoints: 1250,
    trustRating: 4.9,
    createdAt: date('2025-02-11'),
  },
  {
    id: 'cust-2',
    firstName: 'Rahul',
    lastName: 'Kapoor',
    dob: date('1988-11-02'),
    phone: '+919811233445',
    email: 'rahul.kapoor@example.com',
    address: '802, Horizon Towers, Bandra',
    city: 'Mumbai',
    aadhaarLast4: '4411',
    dlNumber: 'MH02 20190014299',
    dlState: 'Maharashtra',
    dlExpiry: date('2034-03-20'),
    careOfName: 'Mr. V. M. Kapoor',
    careOfRelation: 'Father',
    careOfPhone: '+919820044123',
    customerCode: 'VIP-EXECUTIVE',
    idCardStatus: 'VERIFIED' as const,
    faceVerification: 'VERIFIED' as const,
    loyaltyTier: 'VIP' as const,
    loyaltyPoints: 3400,
    trustRating: 5.0,
    createdAt: date('2024-11-05'),
  },
];

// ---------------------------------------------------------------- Fleet (matches Customer/src/data)

type SeedVehicle = {
  id: string;
  name: string;
  brand: string;
  type: VehicleType;
  color: string;
  seats: number;
  transmission: Transmission;
  fuel: string;
  status: VehicleStatus;
  registrationNo: string;
  purchaseCost: number;
  purchaseDate: string;
  odometerKm: number;
  fuelLevelPercent: number;
  gpsDeviceId: string;
  fastagId: string;
  insurance: [string, string, string];
  puc: [string, string];
  branchId: string;
  rates: { daily: number; weekly: number; monthly: number; deposit: number; driverPerDay: number };
};

const vehicles: SeedVehicle[] = [
  { id: 'car-1', name: 'Innova Crysta', brand: 'Toyota', type: VehicleType.MUV, color: '#F2F2F0', seats: 7, transmission: Transmission.MANUAL, fuel: 'Diesel', status: VehicleStatus.ON_RENT, registrationNo: 'KA 01 MX 4921', purchaseCost: 1850000, purchaseDate: '2024-03-15', odometerKm: 28610, fuelLevelPercent: 72, gpsDeviceId: 'GPS-NVX-8012', fastagId: 'FT-60091823', insurance: ['HDFC ERGO', 'INS-HDFC-994102', '2027-03-14'], puc: ['PUC-KA01-77120', '2027-02-10'], branchId: 'br-blr', rates: { daily: 3999, weekly: 25199, monthly: 89999, deposit: 10000, driverPerDay: 1000 } },
  { id: 'car-2', name: 'Virtus', brand: 'Volkswagen', type: VehicleType.SEDAN, color: '#5A3420', seats: 5, transmission: Transmission.AUTO, fuel: 'Petrol', status: VehicleStatus.AVAILABLE, registrationNo: 'KA 05 EV 9012', purchaseCost: 2100000, purchaseDate: '2024-06-20', odometerKm: 14200, fuelLevelPercent: 92, gpsDeviceId: 'GPS-VLT-3301', fastagId: 'FT-88910244', insurance: ['ICICI Lombard', 'INS-ICICI-88192', '2027-06-19'], puc: ['PUC-KA05-55120', '2027-06-19'], branchId: 'br-blr', rates: { daily: 2799, weekly: 17599, monthly: 62999, deposit: 7000, driverPerDay: 900 } },
  { id: 'car-3', name: 'Thar', brand: 'Mahindra', type: VehicleType.SUV, color: '#141414', seats: 4, transmission: Transmission.MANUAL, fuel: 'Diesel', status: VehicleStatus.ON_RENT, registrationNo: 'MH 02 GT 7007', purchaseCost: 6500000, purchaseDate: '2023-11-10', odometerKm: 34100, fuelLevelPercent: 65, gpsDeviceId: 'GPS-GT400-007', fastagId: 'FT-10029988', insurance: ['Tata AIG', 'INS-TATA-77401', '2026-11-09'], puc: ['PUC-MH02-11893', '2026-10-15'], branchId: 'br-mum', rates: { daily: 3499, weekly: 21999, monthly: 79999, deposit: 10000, driverPerDay: 1000 } },
  { id: 'car-4', name: 'Swift', brand: 'Maruti Suzuki', type: VehicleType.HATCHBACK, color: '#C8102E', seats: 5, transmission: Transmission.MANUAL, fuel: 'Petrol', status: VehicleStatus.AVAILABLE, registrationNo: 'KA 03 MS 2210', purchaseCost: 1200000, purchaseDate: '2024-01-05', odometerKm: 41900, fuelLevelPercent: 90, gpsDeviceId: 'GPS-KST-9102', fastagId: 'FT-33299104', insurance: ['SBI General', 'INS-SBI-33019', '2027-01-04'], puc: ['PUC-KA03-44102', '2026-10-05'], branchId: 'br-blr', rates: { daily: 1799, weekly: 11299, monthly: 39999, deposit: 5000, driverPerDay: 800 } },
  { id: 'car-5', name: 'Baleno', brand: 'Maruti Suzuki', type: VehicleType.HATCHBACK, color: '#141414', seats: 5, transmission: Transmission.AUTO, fuel: 'Petrol', status: VehicleStatus.RESERVED, registrationNo: 'DL 01 TR 8812', purchaseCost: 1650000, purchaseDate: '2024-02-12', odometerKm: 22150, fuelLevelPercent: 70, gpsDeviceId: 'GPS-MTR-5510', fastagId: 'FT-44910233', insurance: ['Bajaj Allianz', 'INS-BAJAJ-55190', '2027-02-11'], puc: ['PUC-DL01-90023', '2027-01-30'], branchId: 'br-del', rates: { daily: 1999, weekly: 12599, monthly: 44999, deposit: 5000, driverPerDay: 800 } },
  { id: 'car-7', name: 'WagonR', brand: 'Maruti Suzuki', type: VehicleType.HATCHBACK, color: '#1F4FC9', seats: 5, transmission: Transmission.MANUAL, fuel: 'CNG', status: VehicleStatus.AVAILABLE, registrationNo: 'KA 51 MJ 3307', purchaseCost: 1650000, purchaseDate: '2024-02-12', odometerKm: 22150, fuelLevelPercent: 70, gpsDeviceId: 'GPS-WGR-3307', fastagId: 'FT-71200455', insurance: ['Bajaj Allianz', 'INS-BAJAJ-55191', '2027-02-11'], puc: ['PUC-KA51-90024', '2027-01-30'], branchId: 'br-blr', rates: { daily: 1499, weekly: 9449, monthly: 32999, deposit: 5000, driverPerDay: 800 } },
  { id: 'car-8', name: 'Creta', brand: 'Hyundai', type: VehicleType.SUV, color: '#F2F2F0', seats: 5, transmission: Transmission.AUTO, fuel: 'Diesel', status: VehicleStatus.AVAILABLE, registrationNo: 'KA 03 NC 6620', purchaseCost: 1650000, purchaseDate: '2024-02-12', odometerKm: 22150, fuelLevelPercent: 70, gpsDeviceId: 'GPS-CRT-6620', fastagId: 'FT-80233197', insurance: ['Bajaj Allianz', 'INS-BAJAJ-55192', '2027-02-11'], puc: ['PUC-KA03-90025', '2027-01-30'], branchId: 'br-blr', rates: { daily: 2999, weekly: 18899, monthly: 66999, deposit: 8000, driverPerDay: 900 } },
];

// ---------------------------------------------------------------- Bookings (dated relative to today so statuses make sense)

type SeedBooking = {
  id: string;
  customerId: string;
  vehicleId: string;
  pickupLocation: string;
  pickupInDays: number;
  days: number;
  purpose: RentalPurpose;
  classification: BookingClassification;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  startOdometerKm?: number;
  endOdometerKm?: number;
};

const bookings: SeedBooking[] = [
  { id: 'KG-8492', customerId: 'cust-1', vehicleId: 'car-1', pickupLocation: 'Bengaluru International Airport (BLR)', pickupInDays: -2, days: 3, purpose: RentalPurpose.OUTSTATION, classification: BookingClassification.REPEAT_CUSTOMER, status: BookingStatus.ACTIVE, paymentStatus: PaymentStatus.PAID, startOdometerKm: 28400 },
  { id: 'KG-7104', customerId: 'cust-2', vehicleId: 'car-3', pickupLocation: 'Bandra West, Mumbai', pickupInDays: -1, days: 3, purpose: RentalPurpose.BUSINESS, classification: BookingClassification.CORPORATE, status: BookingStatus.ACTIVE, paymentStatus: PaymentStatus.PAID, startOdometerKm: 33700 },
  { id: 'KG-6299', customerId: 'cust-1', vehicleId: 'car-5', pickupLocation: 'Connaught Place, New Delhi', pickupInDays: 4, days: 2, purpose: RentalPurpose.PERSONAL, classification: BookingClassification.ONLINE, status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.DEPOSIT_PAID },
  { id: 'KG-5530', customerId: 'cust-2', vehicleId: 'car-4', pickupLocation: 'Indiranagar, Bengaluru', pickupInDays: 9, days: 7, purpose: RentalPurpose.VACATION, classification: BookingClassification.ONLINE, status: BookingStatus.QUOTED, paymentStatus: PaymentStatus.UNPAID },
  { id: 'KG-4102', customerId: 'cust-2', vehicleId: 'car-2', pickupLocation: 'Whitefield, Bengaluru', pickupInDays: -20, days: 2, purpose: RentalPurpose.BUSINESS, classification: BookingClassification.CORPORATE, status: BookingStatus.COMPLETED, paymentStatus: PaymentStatus.PAID, startOdometerKm: 13900, endOdometerKm: 14200 },
];

async function main() {
  const passwordHash = hashSync(PASSWORD, 10);

  for (const b of branches) {
    await prisma.branch.upsert({ where: { id: b.id }, update: b, create: b });
  }

  for (const u of staff) {
    await prisma.user.upsert({ where: { id: u.id }, update: { ...u, passwordHash }, create: { ...u, passwordHash } });
  }

  for (const c of customers) {
    const { createdAt, ...rest } = c;
    await prisma.customer.upsert({ where: { id: c.id }, update: { ...rest, passwordHash }, create: { ...rest, passwordHash, createdAt } });
  }

  const rateByVehicle = new Map<string, SeedVehicle['rates']>();
  for (const v of vehicles) {
    const { insurance, puc, rates, purchaseCost, purchaseDate, ...rest } = v;
    const record = {
      ...rest,
      purchaseCostPaise: paise(purchaseCost),
      purchaseDate: date(purchaseDate),
      insuranceProvider: insurance[0],
      insurancePolicyNo: insurance[1],
      insuranceExpiry: date(insurance[2]),
      pucCertificateNo: puc[0],
      pucExpiry: date(puc[1]),
    };
    await prisma.vehicle.upsert({ where: { id: v.id }, update: record, create: record });
    const rateRow = {
      vehicleId: v.id,
      dailyPaise: paise(rates.daily),
      weeklyPaise: paise(rates.weekly),
      monthlyPaise: paise(rates.monthly),
      depositPaise: paise(rates.deposit),
      driverPerDayPaise: paise(rates.driverPerDay),
      validFrom: date('2026-01-01'),
    };
    await prisma.vehicleRate.upsert({ where: { vehicleId_validFrom: { vehicleId: v.id, validFrom: rateRow.validFrom } }, update: rateRow, create: rateRow });
    rateByVehicle.set(v.id, rates);
  }

  for (const b of bookings) {
    const customer = customers.find((c) => c.id === b.customerId)!;
    const rates = rateByVehicle.get(b.vehicleId)!;
    const baseRatePaise = paise(rates.daily);
    const subtotalPaise = baseRatePaise * b.days;
    const taxPaise = Math.round(subtotalPaise * TAX_RATE);
    const pickupAt = daysFromNow(b.pickupInDays);
    const returnAt = daysFromNow(b.pickupInDays + b.days, 18);
    const record = {
      customerId: b.customerId,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerPhone: customer.phone,
      vehicleId: b.vehicleId,
      pickupLocation: b.pickupLocation,
      pickupAt,
      returnAt,
      days: b.days,
      term: RentalTerm.DAILY,
      purpose: b.purpose,
      classification: b.classification,
      baseRatePaise,
      subtotalPaise,
      discountPaise: 0,
      taxPaise,
      totalPaise: subtotalPaise + taxPaise,
      depositPaise: paise(rates.deposit),
      status: b.status,
      paymentStatus: b.paymentStatus,
      reminderAt: daysFromNow(b.pickupInDays - 2),
      reminderSent: b.pickupInDays <= 2,
      startOdometerKm: b.startOdometerKm,
      endOdometerKm: b.endOdometerKm,
      completedAt: b.status === BookingStatus.COMPLETED ? returnAt : null,
    };
    await prisma.booking.upsert({ where: { id: b.id }, update: record, create: { id: b.id, ...record } });
  }

  console.log(`Seeded ${branches.length} branches, ${staff.length} staff, ${customers.length} customers, ${vehicles.length} vehicles, ${bookings.length} bookings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

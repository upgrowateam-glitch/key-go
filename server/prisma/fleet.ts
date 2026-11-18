/**
 * KeyGo's fleet: the 7 vehicles and their price lists. Used by the seed (to create them on a new database)
 * and by remove-sample-data (to fill in their details on an existing one). Rupee amounts.
 */
import { Transmission, VehicleType } from '@prisma/client';

const PHOTO_SET = ['Front', 'Rear', 'Left side', 'Right side', 'Interior', 'Dashboard'];

export interface FleetVehicle {
  id: string;
  name: string;
  brand: string;
  type: VehicleType;
  color: string;
  seats: number;
  transmission: Transmission;
  fuel: string;
  registrationNo: string;
  purchaseCost: number;
  purchaseDate: string;
  odometerKm: number;
  fuelLevelPercent: number;
  gpsDeviceId: string;
  fastagId: string;
  insurance: [provider: string, policyNo: string, expiry: string];
  puc: [certificateNo: string, expiry: string];
  rates: { daily: number; weekly: number; monthly: number; deposit: number; driverPerDay: number };
  /** Shown in the apps; stored in vehicles.details. */
  details: Record<string, unknown>;
}

export const FLEET: FleetVehicle[] = [
  {
    id: 'car-1', name: 'Innova Crysta', brand: 'Toyota', type: VehicleType.MUV, color: '#F2F2F0', seats: 7, transmission: Transmission.MANUAL, fuel: 'Diesel',
    registrationNo: 'KA 01 MX 4921', purchaseCost: 1850000, purchaseDate: '2024-03-15', odometerKm: 28610, fuelLevelPercent: 72,
    gpsDeviceId: 'GPS-NVX-8012', fastagId: 'FT-60091823', insurance: ['HDFC ERGO', 'INS-HDFC-994102', '2027-03-14'], puc: ['PUC-KA01-77120', '2027-02-10'],
    rates: { daily: 3999, weekly: 25199, monthly: 89999, deposit: 10000, driverPerDay: 1000 },
    details: { kind: 'suv', photoKey: 'fleet_innova_crysta', photoLabels: PHOTO_SET, fastagBalance: 1890, loanDetails: { bankName: 'HDFC Bank Auto Loan', accountNo: 'LN-99201488', emiAmount: 24500, tenureMonths: 60, paidMonths: 18 } },
  },
  {
    id: 'car-2', name: 'Virtus', brand: 'Volkswagen', type: VehicleType.SEDAN, color: '#5A3420', seats: 5, transmission: Transmission.AUTO, fuel: 'Petrol',
    registrationNo: 'KA 05 EV 9012', purchaseCost: 2100000, purchaseDate: '2024-06-20', odometerKm: 14200, fuelLevelPercent: 92,
    gpsDeviceId: 'GPS-VLT-3301', fastagId: 'FT-88910244', insurance: ['ICICI Lombard', 'INS-ICICI-88192', '2027-06-19'], puc: ['PUC-KA05-55120', '2027-06-19'],
    rates: { daily: 2799, weekly: 17599, monthly: 62999, deposit: 7000, driverPerDay: 900 },
    details: { kind: 'sedan', photoKey: 'fleet_virtus', photoLabels: PHOTO_SET.slice(0, 4), fastagBalance: 2640, loanDetails: { bankName: 'ICICI EV Green Loan', accountNo: 'LN-7741029', emiAmount: 28900, tenureMonths: 48, paidMonths: 12 } },
  },
  {
    id: 'car-3', name: 'Thar', brand: 'Mahindra', type: VehicleType.SUV, color: '#141414', seats: 4, transmission: Transmission.MANUAL, fuel: 'Diesel',
    registrationNo: 'MH 02 GT 7007', purchaseCost: 6500000, purchaseDate: '2023-11-10', odometerKm: 34100, fuelLevelPercent: 65,
    gpsDeviceId: 'GPS-GT400-007', fastagId: 'FT-10029988', insurance: ['Tata AIG', 'INS-TATA-77401', '2026-11-09'], puc: ['PUC-MH02-11893', '2026-10-15'],
    rates: { daily: 3499, weekly: 21999, monthly: 79999, deposit: 10000, driverPerDay: 1000 },
    details: { kind: 'suv', photoKey: 'fleet_thar', photoLabels: PHOTO_SET, fastagBalance: 3450, loanDetails: { bankName: 'Axis Bank Luxury Auto', accountNo: 'LN-1104882', emiAmount: 85000, tenureMonths: 60, paidMonths: 22 } },
  },
  {
    id: 'car-4', name: 'Swift', brand: 'Maruti Suzuki', type: VehicleType.HATCHBACK, color: '#C8102E', seats: 5, transmission: Transmission.MANUAL, fuel: 'Petrol',
    registrationNo: 'KA 03 MS 2210', purchaseCost: 1200000, purchaseDate: '2024-01-05', odometerKm: 41900, fuelLevelPercent: 90,
    gpsDeviceId: 'GPS-KST-9102', fastagId: 'FT-33299104', insurance: ['SBI General', 'INS-SBI-33019', '2027-01-04'], puc: ['PUC-KA03-44102', '2026-10-05'],
    rates: { daily: 1799, weekly: 11299, monthly: 39999, deposit: 5000, driverPerDay: 800 },
    details: { kind: 'sedan', photoKey: 'fleet_swift', photoLabels: PHOTO_SET.slice(0, 5), fastagBalance: 740, loanDetails: { bankName: 'SBI Auto Finance', accountNo: 'LN-4481902', emiAmount: 16200, tenureMonths: 60, paidMonths: 20 } },
  },
  {
    id: 'car-5', name: 'Baleno', brand: 'Maruti Suzuki', type: VehicleType.HATCHBACK, color: '#141414', seats: 5, transmission: Transmission.AUTO, fuel: 'Petrol',
    registrationNo: 'DL 01 TR 8812', purchaseCost: 1650000, purchaseDate: '2024-02-12', odometerKm: 22150, fuelLevelPercent: 70,
    gpsDeviceId: 'GPS-MTR-5510', fastagId: 'FT-44910233', insurance: ['Bajaj Allianz', 'INS-BAJAJ-55190', '2027-02-11'], puc: ['PUC-DL01-90023', '2027-01-30'],
    rates: { daily: 1999, weekly: 12599, monthly: 44999, deposit: 5000, driverPerDay: 800 },
    details: { kind: 'sedan', photoKey: 'fleet_baleno', photoLabels: PHOTO_SET, fastagBalance: 1210 },
  },
  {
    id: 'car-7', name: 'WagonR', brand: 'Maruti Suzuki', type: VehicleType.HATCHBACK, color: '#1F4FC9', seats: 5, transmission: Transmission.MANUAL, fuel: 'CNG',
    registrationNo: 'KA 51 MJ 3307', purchaseCost: 1650000, purchaseDate: '2024-02-12', odometerKm: 22150, fuelLevelPercent: 70,
    gpsDeviceId: 'GPS-WGR-3307', fastagId: 'FT-71200455', insurance: ['Bajaj Allianz', 'INS-BAJAJ-55191', '2027-02-11'], puc: ['PUC-KA51-90024', '2027-01-30'],
    rates: { daily: 1499, weekly: 9449, monthly: 32999, deposit: 5000, driverPerDay: 800 },
    details: { kind: 'sedan', photoKey: 'fleet_wagonr', photoLabels: PHOTO_SET, fastagBalance: 1210 },
  },
  {
    id: 'car-8', name: 'Creta', brand: 'Hyundai', type: VehicleType.SUV, color: '#F2F2F0', seats: 5, transmission: Transmission.AUTO, fuel: 'Diesel',
    registrationNo: 'KA 03 NC 6620', purchaseCost: 1650000, purchaseDate: '2024-02-12', odometerKm: 22150, fuelLevelPercent: 70,
    gpsDeviceId: 'GPS-CRT-6620', fastagId: 'FT-80233197', insurance: ['Bajaj Allianz', 'INS-BAJAJ-55192', '2027-02-11'], puc: ['PUC-KA03-90025', '2027-01-30'],
    rates: { daily: 2999, weekly: 18899, monthly: 66999, deposit: 8000, driverPerDay: 900 },
    details: { kind: 'suv', photoKey: 'fleet_creta', photoLabels: PHOTO_SET, fastagBalance: 1210 },
  },
];

const paise = (rupees: number) => Math.round(rupees * 100);
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Columns for prisma.vehicle.create. */
export const vehicleRow = (v: FleetVehicle) => ({
  id: v.id,
  name: v.name,
  brand: v.brand,
  type: v.type,
  color: v.color,
  seats: v.seats,
  transmission: v.transmission,
  fuel: v.fuel,
  registrationNo: v.registrationNo,
  purchaseCostPaise: paise(v.purchaseCost),
  purchaseDate: date(v.purchaseDate),
  odometerKm: v.odometerKm,
  fuelLevelPercent: v.fuelLevelPercent,
  gpsDeviceId: v.gpsDeviceId,
  fastagId: v.fastagId,
  insuranceProvider: v.insurance[0],
  insurancePolicyNo: v.insurance[1],
  insuranceExpiry: date(v.insurance[2]),
  pucCertificateNo: v.puc[0],
  pucExpiry: date(v.puc[1]),
  details: v.details as object,
});

/** Columns for prisma.vehicleRate.create. */
export const rateRow = (v: FleetVehicle) => ({
  vehicleId: v.id,
  dailyPaise: paise(v.rates.daily),
  weeklyPaise: paise(v.rates.weekly),
  monthlyPaise: paise(v.rates.monthly),
  depositPaise: paise(v.rates.deposit),
  driverPerDayPaise: paise(v.rates.driverPerDay),
  validFrom: date('2026-01-01'),
});

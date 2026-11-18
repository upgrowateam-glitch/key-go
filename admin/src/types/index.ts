// Domain types for the KeyGo admin portal, matching the records the KeyGo server returns;
// these shapes are intended to map 1:1 onto future backend API payloads.

export type VehicleType = 'Hatchback' | 'SUV' | 'MUV' | 'Sedan' | 'Electric' | 'Luxury';
export type CarKind = 'suv' | 'sedan' | 'sport' | 'ev';
export type VehicleStatus = 'Available' | 'Reserved' | 'On Rent' | 'Maintenance' | 'Sold';

export interface FuelEntry {
  id: string;
  date: string;
  litres: number; // kWh for electric vehicles
  cost: number;
  odometerKm: number;
  station: string;
}

/** Last known GPS fix (simulated — no live tracking in the UI phase). */
export interface GpsFix {
  lat: number;
  lng: number;
  area: string;
  speedKmh: number;
  ignitionOn: boolean;
  updatedAt: string;
}

export interface PhotoCredit {
  author: string;
  license: string;
  url: string;
}

/** Vehicle price list in rupees, from the server. */
export interface VehicleRates {
  daily: number;
  weekly: number;
  monthly: number;
  deposit: number;
  driverPerDay: number;
}

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  kind: CarKind;
  color: string;
  brand?: string;
  pricePerDay: number;
  seats: number;
  transmission: 'Auto' | 'Manual';
  fuel: string;
  badge?: string;
  status: VehicleStatus;
  vehicleNumber: string;
  purchaseCost: number;
  purchaseDate: string;
  loanDetails?: {
    bankName: string;
    accountNo: string;
    emiAmount: number;
    tenureMonths: number;
    paidMonths: number;
  };
  gpsDeviceId: string;
  gps: GpsFix;
  fastagId: string;
  fastagBalance: number;
  insuranceProvider: string;
  insurancePolicyNo: string;
  insuranceExpiry: string;
  pucCertificateNo: string;
  pucExpiry: string;
  odometerKm: number;
  fuelLevelPercent: number;
  fuelHistory: FuelEntry[];
  /** Labels of photos on file (e.g. "Front", "Interior"); images are placeholders in the UI phase. */
  photoLabels: string[];
  photoUrl?: string;
  /** Name of the fleet photo shipped with the apps (public/images/fleet/<photoKey>.png). */
  photoKey?: string;
  /** Current price list; pricePerDay equals rates.daily. */
  rates?: VehicleRates;
  imageAsset?: any;
  /** Attribution for `imageAsset` (real photos are Creative Commons licensed and must be credited). */
  photoCredit?: PhotoCredit;
  /**
   * The catalog photo is an accurate car photo presented on the studio set rather than a real showroom
   * shot. Flagged so the asset can be replaced with a proper showroom photo later.
   */
  photoNeedsReplacement?: boolean;
  saleInfo?: {
    soldDate: string;
    salePrice: number;
    buyerName: string;
    buyerPhone?: string;
    notes?: string;
  };
}

export type RentalTerm = 'Daily' | 'Weekly' | 'Monthly';
export type RentalPurpose = 'Personal' | 'Business' | 'Outstation' | 'Vacation';
export type BookingStatus = 'Quoted' | 'Pending' | 'Confirmed' | 'Active' | 'Completed' | 'Cancelled';
export type BookingClassification = 'Online' | 'Walk-in' | 'Corporate' | 'Repeat customer' | 'Referral';
export type PaymentStatus = 'Unpaid' | 'Deposit paid' | 'Paid' | 'Refunded';

export interface Booking {
  id: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  vehicleName: string;
  vehicleNumber: string;
  vehicleCategory: VehicleType;
  pickupLocation: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  days: number;
  term: RentalTerm;
  purpose: RentalPurpose;
  classification: BookingClassification;
  baseRatePerDay: number;
  /** Rental amount after term discount and manual discount, before tax. */
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  depositAmount: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  /** Reservation (booking creation) date. */
  createdAt: string;
  /** Date the pickup reminder is scheduled for (2 days before pickup). */
  reminderScheduledFor?: string;
  reminderSent?: boolean;
  keylessUnlocked?: boolean;
  driverId?: string;
  agreementId?: string;
  pickupInspectionId?: string;
  returnInspectionId?: string;
  startOdometerKm?: number;
  endOdometerKm?: number;
  kmDriven?: number;
  /** Charges settled at return. */
  damageCharges?: number;
  fuelCharges?: number;
  tollCharges?: number;
  fineCharges?: number;
  completedAt?: string;
}

export type VerificationStatus = 'Verified' | 'Pending' | 'Not uploaded' | 'Rejected';

export interface CustomerDocument {
  id: string;
  name: string; // e.g. "Driving licence (front)"
  kind: 'ID card' | 'Driving licence' | 'Address proof' | 'Photo' | 'Other';
  status: VerificationStatus;
  uploadedAt?: string;
}

export interface Customer {
  id: string;
  /** Full display name — kept in sync with firstName + lastName. */
  name: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  aadhaarNo: string;
  idCardStatus: VerificationStatus;
  faceVerification: VerificationStatus;
  photoCaptured: boolean;
  dlNumber: string;
  dlState: string;
  dlExpiry: string;
  careOfName: string;
  careOfRelation: string;
  careOfPhone: string;
  customerCode: string; // Commission referral code
  documents: CustomerDocument[];
  customerSince: string;
  loyaltyTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  loyaltyPoints: number;
  avatarBg: string;
  trustRating: number;
}

export interface AgreementFine {
  id: string;
  label: string;
  amount: number;
}

export interface Agreement {
  id: string;
  bookingId: string;
  customerName: string;
  vehicleNumber: string;
  signedDate: string;
  status: 'Active' | 'Draft' | 'Closed';
  depositTermsAccepted: boolean;
  signaturePreview: string; // Display text
  /** SVG path data captured from the signature pad. */
  signaturePath?: string;
  rentalAmount: number;
  securityDeposit: number;
  discount: number;
  fines: AgreementFine[];
}

export const CAR_ZONES = [
  'Front bumper',
  'Bonnet',
  'Windshield',
  'Roof',
  'Rear glass',
  'Boot',
  'Rear bumper',
  'Left front door',
  'Left rear door',
  'Right front door',
  'Right rear door',
  'Left front wheel',
  'Right front wheel',
  'Left rear wheel',
  'Right rear wheel',
] as const;
export type CarZone = (typeof CAR_ZONES)[number];

export interface DamageMark {
  id: string;
  zone: CarZone;
  kind: 'Scratch' | 'Dent' | 'Crack' | 'Paint chip';
  severity: 'Minor' | 'Moderate' | 'Major';
  estimatedCost: number;
}

export interface InspectionRecord {
  id: string;
  bookingId: string;
  vehicleNumber: string;
  type: 'Pickup' | 'Return';
  inspectorName: string;
  fuelPercent: number;
  odometerKm: number;
  /** Human-readable damage summary (derived from damageMarks). */
  damagesMarked: string[];
  damageMarks: DamageMark[];
  /** Photo angles captured (placeholders in the UI phase). */
  photosCaptured: string[];
  notes?: string;
  estimatedDamageCost: number;
  date: string;
}

export interface FASTagLog {
  id: string;
  vehicleNumber: string;
  plazaName: string;
  amount: number;
  dateTime: string;
  balanceRemaining: number;
  bookingId?: string;
  customerName?: string;
  billedToCustomer: boolean;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleNumber: string;
  serviceType: string;
  category: MaintenanceReminderType;
  cost: number;
  vendorName: string;
  date: string;
  status: 'Scheduled' | 'In Progress' | 'Completed';
  nextServiceKm: number;
}

export type MaintenanceReminderType =
  | 'Oil change'
  | 'Brake pad'
  | 'Service'
  | 'Insurance renewal'
  | 'Emission renewal';

export interface MaintenanceReminder {
  id: string;
  vehicleId: string;
  type: MaintenanceReminderType;
  dueDate: string;
  dueKm?: number;
  status: 'Overdue' | 'Due soon' | 'Scheduled' | 'Done';
}

export interface DriverAssignment {
  id: string;
  bookingId: string;
  vehicleNumber: string;
  date: string;
  status: 'Upcoming' | 'In progress' | 'Completed';
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNo: string;
  licenseState: string;
  licenseExpiry: string;
  dutyStatus: 'On Duty' | 'Off Duty' | 'On Trip';
  assignedVehicle?: string;
  rating: number;
  joinedOn: string;
  monthlySalary: number;
  /** Configurable commission % on chauffeur trips. */
  commissionPercent: number;
  tripsThisMonth: number;
  tripRevenueThisMonth: number;
  documents: CustomerDocument[];
  assignments: DriverAssignment[];
  avatarBg: string;
}

/** P = present, A = absent, L = leave, H = half day, W = weekly off */
export type AttendanceMark = 'P' | 'A' | 'L' | 'H' | 'W';

export interface StaffPunch {
  id: string;
  staffName: string;
  role: string;
  phone: string;
  shift: string; // e.g. "09:00 – 18:00"
  punchIn: string;
  punchOut?: string;
  hoursWorked: number;
  hoursThisMonth: number;
  overtimeHours: number;
  baseSalary: number;
  tripAllowance: number;
  deductions: number;
  netPayable: number;
  status: 'Punched In' | 'Punched Out';
  /** Attendance for the current month, day 1 first. */
  attendance: AttendanceMark[];
}

export interface CustomerCodeCommission {
  code: string;
  ownerName: string;
  /** Configurable percentage. How it is applied is pending business clarification. */
  commissionPercent: number;
  totalBookings: number;
  totalRevenueGenerated: number;
  commissionEarned: number;
  vehicleIds: string[];
  active: boolean;
}

export type FinanceCategory =
  | 'Rental income'
  | 'Fine collection'
  | 'Maintenance'
  | 'Loan EMI'
  | 'Fuel'
  | 'Toll'
  | 'Salary'
  | 'Commission';

export interface FinanceEntry {
  id: string;
  date: string;
  category: FinanceCategory;
  direction: 'in' | 'out';
  amount: number;
  vehicleId?: string;
  reference: string;
}

export type NotificationType =
  | 'booking'
  | 'return'
  | 'insurance'
  | 'emission'
  | 'service'
  | 'emi'
  | 'alert'
  | 'system';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: NotificationType;
  unread: boolean;
  /** Set for customer-facing notifications; admin/staff notifications leave it empty. */
  customerId?: string;
}

export interface NotificationChannelSetting {
  type: Exclude<NotificationType, 'alert' | 'system'>;
  label: string;
  description: string;
  leadTime: string; // e.g. "2 days before pickup"
  whatsapp: boolean;
  sms: boolean;
}

export interface MessageLogEntry {
  id: string;
  channel: 'WhatsApp' | 'SMS';
  type: NotificationChannelSetting['type'];
  recipient: string;
  preview: string;
  status: 'Queued' | 'Sent' | 'Delivered' | 'Read' | 'Failed';
  time: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  enabled: boolean;
  lastRun?: string;
}

export interface Campaign {
  id: string;
  name: string;
  channel: 'WhatsApp' | 'SMS' | 'Email';
  audience: string;
  status: 'Draft' | 'Scheduled' | 'Running' | 'Completed';
  scheduledFor: string;
  sent: number;
  opened: number;
  conversions: number;
}

export interface LoyaltyRewardTier {
  id: string;
  tier: Customer['loyaltyTier'];
  minTrips: number;
  reward: string;
}

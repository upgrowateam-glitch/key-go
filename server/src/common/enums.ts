import {
  BookingClassification,
  BookingStatus,
  LoyaltyTier,
  PaymentStatus,
  RentalPurpose,
  RentalTerm,
  Transmission,
  UserRole,
  VehicleStatus,
  VehicleType,
  VerificationStatus,
} from '@prisma/client';

/**
 * The apps use readable labels ("On Rent", "Deposit paid"); the database uses enum names (ON_RENT,
 * DEPOSIT_PAID). Each map converts in both directions and rejects values it does not know.
 */
function labelEnum<L extends string, D extends string>(name: string, labels: Record<L, D>) {
  const reverse = Object.fromEntries(Object.entries(labels).map(([l, d]) => [d, l])) as Record<D, L>;
  return {
    labels: Object.keys(labels) as L[],
    toDb(label: unknown): D {
      const value = labels[label as L];
      if (!value) throw new Error(`Unknown ${name}: ${String(label)}`);
      return value;
    },
    toDbOr(label: unknown, fallback: D): D {
      return labels[label as L] ?? fallback;
    },
    fromDb(value: D): L {
      return reverse[value];
    },
  };
}

export const vehicleTypeEnum = labelEnum('vehicle type', {
  Hatchback: VehicleType.HATCHBACK,
  Sedan: VehicleType.SEDAN,
  SUV: VehicleType.SUV,
  MUV: VehicleType.MUV,
  Electric: VehicleType.ELECTRIC,
  Luxury: VehicleType.LUXURY,
});

export const vehicleStatusEnum = labelEnum('vehicle status', {
  Available: VehicleStatus.AVAILABLE,
  Reserved: VehicleStatus.RESERVED,
  'On Rent': VehicleStatus.ON_RENT,
  Maintenance: VehicleStatus.MAINTENANCE,
  Sold: VehicleStatus.SOLD,
});

export const transmissionEnum = labelEnum('transmission', {
  Auto: Transmission.AUTO,
  Manual: Transmission.MANUAL,
});

export const termEnum = labelEnum('rental term', {
  Daily: RentalTerm.DAILY,
  Weekly: RentalTerm.WEEKLY,
  Monthly: RentalTerm.MONTHLY,
});

export const purposeEnum = labelEnum('rental purpose', {
  Personal: RentalPurpose.PERSONAL,
  Business: RentalPurpose.BUSINESS,
  Outstation: RentalPurpose.OUTSTATION,
  Vacation: RentalPurpose.VACATION,
});

export const classificationEnum = labelEnum('booking classification', {
  Online: BookingClassification.ONLINE,
  'Walk-in': BookingClassification.WALK_IN,
  Corporate: BookingClassification.CORPORATE,
  'Repeat customer': BookingClassification.REPEAT_CUSTOMER,
  Referral: BookingClassification.REFERRAL,
});

export const bookingStatusEnum = labelEnum('booking status', {
  Quoted: BookingStatus.QUOTED,
  Pending: BookingStatus.PENDING,
  Confirmed: BookingStatus.CONFIRMED,
  Active: BookingStatus.ACTIVE,
  Completed: BookingStatus.COMPLETED,
  Cancelled: BookingStatus.CANCELLED,
});

export const paymentStatusEnum = labelEnum('payment status', {
  Unpaid: PaymentStatus.UNPAID,
  'Deposit paid': PaymentStatus.DEPOSIT_PAID,
  Paid: PaymentStatus.PAID,
  Refunded: PaymentStatus.REFUNDED,
});

export const loyaltyTierEnum = labelEnum('loyalty tier', {
  Bronze: LoyaltyTier.BRONZE,
  Silver: LoyaltyTier.SILVER,
  Gold: LoyaltyTier.GOLD,
  VIP: LoyaltyTier.VIP,
});

export const verificationEnum = labelEnum('verification status', {
  Verified: VerificationStatus.VERIFIED,
  Pending: VerificationStatus.PENDING,
  'Not uploaded': VerificationStatus.NOT_UPLOADED,
  Rejected: VerificationStatus.REJECTED,
});

export const roleEnum = labelEnum('staff role', {
  Owner: UserRole.OWNER,
  Admin: UserRole.ADMIN,
  Manager: UserRole.MANAGER,
  Staff: UserRole.STAFF,
  Driver: UserRole.DRIVER,
});

export type StaffRoleLabel = 'Owner' | 'Admin' | 'Manager' | 'Staff' | 'Driver';

-- btree_gist lets the exclusion constraint below compare vehicle ids inside a GiST index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'ELECTRIC', 'LUXURY');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ON_RENT', 'MAINTENANCE', 'SOLD');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "RentalTerm" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RentalPurpose" AS ENUM ('PERSONAL', 'BUSINESS', 'OUTSTATION', 'VACATION');

-- CreateEnum
CREATE TYPE "BookingClassification" AS ENUM ('ONLINE', 'WALK_IN', 'CORPORATE', 'REPEAT_CUSTOMER', 'REFERRAL');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('QUOTED', 'PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'DEPOSIT_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'VIP');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'PENDING', 'NOT_UPLOADED', 'REJECTED');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "branch_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "dob" DATE,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "address" TEXT,
    "city" TEXT,
    "aadhaar_no_enc" TEXT,
    "aadhaar_last4" TEXT,
    "dl_number" TEXT,
    "dl_state" TEXT,
    "dl_expiry" DATE,
    "care_of_name" TEXT,
    "care_of_relation" TEXT,
    "care_of_phone" TEXT,
    "customer_code" TEXT,
    "id_card_status" "VerificationStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
    "face_verification" "VerificationStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
    "loyalty_tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "trust_rating" DECIMAL(2,1) NOT NULL DEFAULT 5.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "type" "VehicleType" NOT NULL,
    "color" TEXT,
    "seats" INTEGER NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "fuel" TEXT NOT NULL,
    "badge" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "registration_no" TEXT NOT NULL,
    "purchase_cost_paise" INTEGER,
    "purchase_date" DATE,
    "odometer_km" INTEGER NOT NULL DEFAULT 0,
    "fuel_level_percent" INTEGER NOT NULL DEFAULT 100,
    "gps_device_id" TEXT,
    "fastag_id" TEXT,
    "insurance_provider" TEXT,
    "insurance_policy_no" TEXT,
    "insurance_expiry" DATE,
    "puc_certificate_no" TEXT,
    "puc_expiry" DATE,
    "photo_url" TEXT,
    "branch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_rates" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "daily_paise" INTEGER NOT NULL,
    "weekly_paise" INTEGER NOT NULL,
    "monthly_paise" INTEGER NOT NULL,
    "deposit_paise" INTEGER NOT NULL,
    "driver_per_day_paise" INTEGER NOT NULL,
    "valid_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "pickup_location" TEXT NOT NULL,
    "pickup_at" TIMESTAMP(3) NOT NULL,
    "return_at" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "term" "RentalTerm" NOT NULL,
    "purpose" "RentalPurpose" NOT NULL,
    "classification" "BookingClassification" NOT NULL DEFAULT 'ONLINE',
    "base_rate_paise" INTEGER NOT NULL,
    "subtotal_paise" INTEGER NOT NULL,
    "discount_paise" INTEGER NOT NULL DEFAULT 0,
    "tax_paise" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "deposit_paise" INTEGER NOT NULL,
    "with_driver" BOOLEAN NOT NULL DEFAULT false,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "reminder_at" TIMESTAMP(3),
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "start_odometer_km" INTEGER,
    "end_odometer_km" INTEGER,
    "damage_charges_paise" INTEGER,
    "fuel_charges_paise" INTEGER,
    "toll_charges_paise" INTEGER,
    "fine_charges_paise" INTEGER,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registration_no_key" ON "vehicles"("registration_no");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_type_idx" ON "vehicles"("type");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_rates_vehicle_id_valid_from_key" ON "vehicle_rates"("vehicle_id", "valid_from");

-- CreateIndex
CREATE INDEX "bookings_vehicle_id_pickup_at_idx" ON "bookings"("vehicle_id", "pickup_at");

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rates" ADD CONSTRAINT "vehicle_rates_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- No double bookings: a vehicle can never hold two CONFIRMED/ACTIVE bookings whose
-- [pickup_at, return_at) periods overlap. The API turns this violation into 409 Conflict.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("vehicle_id" WITH =, tsrange("pickup_at", "return_at", '[)') WITH &&)
  WHERE ("status" IN ('CONFIRMED', 'ACTIVE'));

-- A booking must end after it starts.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_period_valid" CHECK ("return_at" > "pickup_at");

-- Driver accounts
ALTER TYPE "UserRole" ADD VALUE 'DRIVER';

-- Staff sign-in: driver link, sign-out-everywhere counter, wrong-password lock
ALTER TABLE "users" ADD COLUMN "driver_id" TEXT,
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failed_logins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP(3);

-- Customer sign-in: sign-out-everywhere counter, wrong-password lock
ALTER TABLE "customers" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failed_logins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP(3);

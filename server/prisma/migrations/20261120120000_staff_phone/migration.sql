-- Staff can be added with a WhatsApp number; email becomes optional and either can be used to sign in
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL,
ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

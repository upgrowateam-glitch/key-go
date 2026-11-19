-- Invitation links for new staff accounts: the person opens the link and sets their own password
ALTER TABLE "users" ADD COLUMN "invite_token_hash" TEXT,
ADD COLUMN "invite_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_invite_token_hash_key" ON "users"("invite_token_hash");

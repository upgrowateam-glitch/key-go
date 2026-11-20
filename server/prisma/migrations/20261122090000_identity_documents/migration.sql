-- Level 4: encrypted identity documents, append-only audit log.

-- Stored files: identity files are encrypted on disk with their own key, which is itself encrypted ("wrapped")
-- with the server's DATA_ENCRYPTION_KEY. key_id says which server key wrapped it (for key changes and restores).
ALTER TABLE "stored_files" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "stored_files" ADD COLUMN "encrypted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stored_files" ADD COLUMN "wrapped_key" TEXT;
ALTER TABLE "stored_files" ADD COLUMN "key_id" TEXT;

-- ID cards, licences, photos, selfies and other identity papers of customers and drivers.
CREATE TABLE "identity_documents" (
    "id" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "file_id" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "uploaded_via" TEXT NOT NULL DEFAULT 'staff',
    "reject_reason" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "identity_documents_owner_type_owner_id_idx" ON "identity_documents"("owner_type", "owner_id");
-- One current document per position (a new upload replaces the old one)
CREATE UNIQUE INDEX "identity_documents_owner_type_owner_id_kind_key" ON "identity_documents"("owner_type", "owner_id", "kind");
ALTER TABLE "identity_documents" ADD CONSTRAINT "identity_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Who did what and when: face checks, document reviews, who opened a document, payroll changes.
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "subject_name" TEXT,
    "detail" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_log_subject_type_subject_id_at_idx" ON "audit_log"("subject_type", "subject_id", "at");
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- The audit log can only grow: the database itself refuses to change or delete entries.
CREATE OR REPLACE FUNCTION keygo_audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'The audit log cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "audit_log_append_only" BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION keygo_audit_log_append_only();

-- Drop default temporarily
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Convert role column to TEXT temporarily to bypass Postgres E55P04 enum parse check
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT;

-- Add new ADMIN enum value
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';

-- Update existing OWNER records to ADMIN
UPDATE "users" SET "role" = 'ADMIN' WHERE "role" = 'OWNER';

-- Re-convert role column back to Role enum
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";

-- Restore default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'DEV'::"Role";

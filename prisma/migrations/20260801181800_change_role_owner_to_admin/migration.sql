-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';

-- Update existing users
UPDATE "users" SET "role" = 'ADMIN' WHERE "role"::text = 'OWNER';

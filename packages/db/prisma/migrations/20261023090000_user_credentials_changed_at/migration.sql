-- Staff security page: a changed password or authenticator ends sessions signed in before it.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "credentialsChangedAt" TIMESTAMP(3);

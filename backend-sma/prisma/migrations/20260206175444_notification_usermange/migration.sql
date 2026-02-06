-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "notifyDaysArray" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

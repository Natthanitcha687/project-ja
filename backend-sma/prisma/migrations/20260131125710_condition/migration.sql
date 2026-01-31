-- AlterTable
ALTER TABLE "WarrantyItem" ADD COLUMN     "customCondition" TEXT,
ADD COLUMN     "selectedConditions" JSONB;

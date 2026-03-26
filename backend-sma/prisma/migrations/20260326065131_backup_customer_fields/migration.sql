-- AlterTable
ALTER TABLE "Warranty" ADD COLUMN     "previousCustomerEmail" TEXT,
ADD COLUMN     "previousCustomerName" TEXT,
ADD COLUMN     "previousCustomerPhone" TEXT,
ADD COLUMN     "previousCustomerUserId" INTEGER;

-- CreateIndex
CREATE INDEX "Warranty_previousCustomerUserId_idx" ON "Warranty"("previousCustomerUserId");

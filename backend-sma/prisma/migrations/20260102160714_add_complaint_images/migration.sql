-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

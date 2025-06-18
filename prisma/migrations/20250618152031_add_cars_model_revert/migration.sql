/*
  Warnings:

  - You are about to drop the `Car` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Auction" DROP CONSTRAINT "Auction_carId_fkey";

-- AlterTable
ALTER TABLE "Auction" ALTER COLUMN "carId" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "Car";

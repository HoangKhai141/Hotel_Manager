/*
  Warnings:

  - The values [QR] on the enum `Payment_method` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Room` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `payment` MODIFY `method` ENUM('CASH', 'ONLINE') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Room_name_key` ON `Room`(`name`);

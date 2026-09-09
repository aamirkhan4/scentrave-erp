-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MEN', 'WOMEN', 'UNISEX');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "gender" "Gender";

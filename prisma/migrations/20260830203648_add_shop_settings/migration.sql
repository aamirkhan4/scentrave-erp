-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "shopName" TEXT NOT NULL DEFAULT 'Scentrave',
    "address" TEXT,
    "gstin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstHomeState" TEXT NOT NULL,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'SCV',
    "upiVpa" TEXT,
    "upiPayeeName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

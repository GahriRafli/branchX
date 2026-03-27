/*
  Warnings:

  - You are about to drop the `MonitoringGMM` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('INTENSIFICATION', 'EXTENSIFICATION', 'BOTTOM_UP');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'READY_TO_FOLLOW_UP', 'CONTACTED', 'IN_DISCUSSION', 'WAITING_CUSTOMER', 'NEED_SUPPORT', 'WON', 'LOST', 'DORMANT', 'CANCELLED', 'KICK');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "leadId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- DropTable
DROP TABLE "MonitoringGMM";

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "referenceId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringActivity" (
    "id" TEXT NOT NULL,
    "activityType" TEXT NOT NULL DEFAULT 'GMM',
    "name" TEXT NOT NULL,
    "codeReferral" TEXT NOT NULL,
    "product" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "noAccount" TEXT NOT NULL DEFAULT '',
    "bookingId" TEXT NOT NULL DEFAULT '',
    "branchCode" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "lead_name" TEXT NOT NULL,
    "cif" TEXT,
    "lead_type" "LeadType" NOT NULL,
    "branch" TEXT,
    "potential_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "owner_user_id" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "lead_category" TEXT,
    "area" TEXT,
    "area_name" TEXT,
    "branch_code" TEXT,
    "three_p" TEXT DEFAULT 'Pebisnis',
    "closing_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "next_action" TEXT,
    "support_needed" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "source_upload_batch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "valid_rows" INTEGER NOT NULL,
    "invalid_rows" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringActivity" ADD CONSTRAINT "MonitoringActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

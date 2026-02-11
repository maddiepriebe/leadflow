-- DropForeignKey
ALTER TABLE "Sequence" DROP CONSTRAINT "Sequence_campaignId_fkey";

-- DropIndex
DROP INDEX "Lead_email_idx";

-- AlterTable
ALTER TABLE "ICP" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "description" TEXT,
ADD COLUMN     "icpId" TEXT,
ADD COLUMN     "socials" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "trengoMessageId" TEXT;

-- AlterTable
ALTER TABLE "Sequence" ADD COLUMN     "description" TEXT,
ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ALTER COLUMN "campaignId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "nextStepAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepExecution" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "messageId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_sequenceId_idx" ON "SequenceEnrollment"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_leadId_idx" ON "SequenceEnrollment"("leadId");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_status_idx" ON "SequenceEnrollment"("status");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_nextStepAt_idx" ON "SequenceEnrollment"("nextStepAt");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceEnrollment_sequenceId_leadId_key" ON "SequenceEnrollment"("sequenceId", "leadId");

-- CreateIndex
CREATE INDEX "StepExecution_enrollmentId_idx" ON "StepExecution"("enrollmentId");

-- CreateIndex
CREATE INDEX "StepExecution_status_idx" ON "StepExecution"("status");

-- CreateIndex
CREATE INDEX "StepExecution_scheduledFor_idx" ON "StepExecution"("scheduledFor");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_icpId_idx" ON "Lead"("icpId");

-- CreateIndex
CREATE INDEX "Lead_score_idx" ON "Lead"("score");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "Sequence_status_idx" ON "Sequence"("status");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_icpId_fkey" FOREIGN KEY ("icpId") REFERENCES "ICP"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepExecution" ADD CONSTRAINT "StepExecution_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SequenceEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepExecution" ADD CONSTRAINT "StepExecution_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

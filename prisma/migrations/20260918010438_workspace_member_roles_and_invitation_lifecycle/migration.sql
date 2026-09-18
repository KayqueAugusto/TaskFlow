-- AlterEnum
ALTER TYPE "InvitationStatus" ADD VALUE 'REVOKED';

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "workspaceJob" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "workspaceJob" TEXT;

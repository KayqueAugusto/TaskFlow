-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

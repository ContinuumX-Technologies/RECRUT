/*
  Warnings:

  - You are about to drop the column `aiSummary` on the `Interview` table. All the data in the column will be lost.
  - You are about to drop the column `shadowAnalysis` on the `MediaRecord` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Interview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "suspicionScore" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT,
    "customConfig" JSONB,
    "interviewerId" TEXT,
    "referenceFacePath" TEXT,
    "referenceVoicePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interview_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InterviewTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Interview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Interview" ("candidateEmail", "candidateId", "candidateName", "completedAt", "createdAt", "customConfig", "id", "interviewerId", "referenceFacePath", "referenceVoicePath", "scheduledAt", "startedAt", "status", "suspicionScore", "templateId", "updatedAt") SELECT "candidateEmail", "candidateId", "candidateName", "completedAt", "createdAt", "customConfig", "id", "interviewerId", "referenceFacePath", "referenceVoicePath", "scheduledAt", "startedAt", "status", "suspicionScore", "templateId", "updatedAt" FROM "Interview";
DROP TABLE "Interview";
ALTER TABLE "new_Interview" RENAME TO "Interview";
CREATE TABLE "new_MediaRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "durationSec" REAL,
    "transcript" TEXT,
    "analysisJson" JSONB,
    "yoloProcessed" BOOLEAN NOT NULL DEFAULT false,
    "yoloSummary" JSONB,
    "yoloFlags" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingStage" TEXT NOT NULL DEFAULT 'pending',
    "suspicionScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediaRecord_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MediaRecord" ("analysisJson", "createdAt", "durationSec", "id", "interviewId", "path", "processed", "processingStage", "suspicionScore", "transcript", "type", "updatedAt", "yoloFlags", "yoloProcessed", "yoloSummary") SELECT "analysisJson", "createdAt", "durationSec", "id", "interviewId", "path", "processed", "processingStage", "suspicionScore", "transcript", "type", "updatedAt", "yoloFlags", "yoloProcessed", "yoloSummary" FROM "MediaRecord";
DROP TABLE "MediaRecord";
ALTER TABLE "new_MediaRecord" RENAME TO "MediaRecord";
CREATE INDEX "MediaRecord_interviewId_idx" ON "MediaRecord"("interviewId");
CREATE INDEX "MediaRecord_type_idx" ON "MediaRecord"("type");
CREATE INDEX "MediaRecord_yoloProcessed_idx" ON "MediaRecord"("yoloProcessed");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

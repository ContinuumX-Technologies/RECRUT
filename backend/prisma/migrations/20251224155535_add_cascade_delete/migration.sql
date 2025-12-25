-- AlterTable
ALTER TABLE "Interview" ADD COLUMN "aiSummary" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "MediaRecord_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MediaRecord" ("analysisJson", "createdAt", "durationSec", "id", "interviewId", "path", "processed", "processingStage", "suspicionScore", "transcript", "type", "updatedAt", "yoloFlags", "yoloProcessed", "yoloSummary") SELECT "analysisJson", "createdAt", "durationSec", "id", "interviewId", "path", "processed", "processingStage", "suspicionScore", "transcript", "type", "updatedAt", "yoloFlags", "yoloProcessed", "yoloSummary" FROM "MediaRecord";
DROP TABLE "MediaRecord";
ALTER TABLE "new_MediaRecord" RENAME TO "MediaRecord";
CREATE INDEX "MediaRecord_interviewId_idx" ON "MediaRecord"("interviewId");
CREATE INDEX "MediaRecord_type_idx" ON "MediaRecord"("type");
CREATE INDEX "MediaRecord_yoloProcessed_idx" ON "MediaRecord"("yoloProcessed");
CREATE TABLE "new_ProctorEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProctorEvent_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProctorEvent" ("createdAt", "id", "interviewId", "payload", "type") SELECT "createdAt", "id", "interviewId", "payload", "type" FROM "ProctorEvent";
DROP TABLE "ProctorEvent";
ALTER TABLE "new_ProctorEvent" RENAME TO "ProctorEvent";
CREATE TABLE "new_ProctorFrame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProctorFrame_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProctorFrame" ("createdAt", "id", "interviewId", "path") SELECT "createdAt", "id", "interviewId", "path" FROM "ProctorFrame";
DROP TABLE "ProctorFrame";
ALTER TABLE "new_ProctorFrame" RENAME TO "ProctorFrame";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

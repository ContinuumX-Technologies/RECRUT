/*
  Warnings:

  - Added the required column `updatedAt` to the `MediaRecord` table without a default value. This is not possible if the table is not empty.

*/
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
    CONSTRAINT "MediaRecord_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MediaRecord" ("analysisJson", "createdAt", "durationSec", "id", "interviewId", "path", "processed", "transcript", "type") SELECT "analysisJson", "createdAt", "durationSec", "id", "interviewId", "path", "processed", "transcript", "type" FROM "MediaRecord";
DROP TABLE "MediaRecord";
ALTER TABLE "new_MediaRecord" RENAME TO "MediaRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

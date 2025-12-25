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
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaRecord_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MediaRecord" ("createdAt", "durationSec", "id", "interviewId", "path", "type") SELECT "createdAt", "durationSec", "id", "interviewId", "path", "type" FROM "MediaRecord";
DROP TABLE "MediaRecord";
ALTER TABLE "new_MediaRecord" RENAME TO "MediaRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

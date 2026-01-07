-- CreateTable
CREATE TABLE "CompanyOutreach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactPerson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'contacted',
    "timeline" JSONB,
    "onboardedUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOutreach_email_key" ON "CompanyOutreach"("email");

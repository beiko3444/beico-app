-- AlterTable
ALTER TABLE "Product" ADD COLUMN "priceA" INTEGER;
ALTER TABLE "Product" ADD COLUMN "priceB" INTEGER;
ALTER TABLE "Product" ADD COLUMN "priceC" INTEGER;
ALTER TABLE "Product" ADD COLUMN "priceD" INTEGER;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PartnerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "businessName" TEXT,
    "representativeName" TEXT,
    "businessRegNumber" TEXT,
    "address" TEXT,
    "grade" TEXT NOT NULL DEFAULT 'C',
    CONSTRAINT "PartnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PartnerProfile" ("address", "businessName", "businessRegNumber", "contact", "email", "id", "representativeName", "userId") SELECT "address", "businessName", "businessRegNumber", "contact", "email", "id", "representativeName", "userId" FROM "PartnerProfile";
DROP TABLE "PartnerProfile";
ALTER TABLE "new_PartnerProfile" RENAME TO "PartnerProfile";
CREATE UNIQUE INDEX "PartnerProfile_userId_key" ON "PartnerProfile"("userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

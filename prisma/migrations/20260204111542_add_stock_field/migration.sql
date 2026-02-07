-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "buyPrice" INTEGER NOT NULL,
    "sellPrice" INTEGER NOT NULL,
    "priceA" INTEGER,
    "priceB" INTEGER,
    "priceC" INTEGER,
    "priceD" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("buyPrice", "createdAt", "id", "name", "priceA", "priceB", "priceC", "priceD", "sellPrice", "updatedAt") SELECT "buyPrice", "createdAt", "id", "name", "priceA", "priceB", "priceC", "priceD", "sellPrice", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

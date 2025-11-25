-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "setSeries" TEXT,
    "printedTotal" INTEGER,
    "number" TEXT NOT NULL,
    "rarity" TEXT,
    "imageSmallUrl" TEXT NOT NULL,
    "imageLargeUrl" TEXT NOT NULL,
    "tcgplayerProductId" INTEGER
);

-- CreateTable
CREATE TABLE "CollectionEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT NOT NULL DEFAULT 'Near Mint',
    "language" TEXT NOT NULL DEFAULT 'EN',
    "finish" TEXT NOT NULL DEFAULT 'Normal',
    "purchasePrice" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectionEntry_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

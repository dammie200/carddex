-- Add binders for organizing collection cards
CREATE TABLE "Binder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "layout" TEXT NOT NULL DEFAULT 'grid',
    "gridRows" INTEGER,
    "gridCols" INTEGER,
    "pages" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "BinderSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "binderId" INTEGER NOT NULL,
    "collectionEntryId" INTEGER NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BinderSlot_binderId_fkey" FOREIGN KEY ("binderId") REFERENCES "Binder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BinderSlot_collectionEntryId_fkey" FOREIGN KEY ("collectionEntryId") REFERENCES "CollectionEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BinderSlot_binder_page_position_key" ON "BinderSlot" ("binderId", "page", "position");
CREATE INDEX IF NOT EXISTS "BinderSlot_collectionEntryId_idx" ON "BinderSlot" ("collectionEntryId");

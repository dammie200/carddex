-- Add priceJson column and helpful indexes
ALTER TABLE "Card" ADD COLUMN "priceJson" TEXT;
CREATE INDEX IF NOT EXISTS "Card_name_idx" ON "Card" ("name");
CREATE INDEX IF NOT EXISTS "Card_number_idx" ON "Card" ("number");

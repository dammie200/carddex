export type FinishVariant =
  | "Normal"
  | "Holo"
  | "Reverse Holo"
  | "Full Art"
  | "Gold"
  | "Rainbow"
  | "Trainer Gallery"
  | "Other";

export type CardCondition =
  | "Mint"
  | "Near Mint"
  | "Lightly Played"
  | "Moderately Played"
  | "Heavily Played"
  | "Damaged";

export interface CardSummary {
  id: string;
  name: string;
  setName: string;
  setId: string;
  setSeries?: string | null;
  printedTotal?: number | null;
  number: string;
  rarity?: string | null;
  imageSmallUrl: string;
  imageLargeUrl: string;
  tcgplayerProductId?: number | null;
}

export interface PriceVariant {
  finish: FinishVariant;
  marketPrice?: number;
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
}

export interface CardPriceData {
  productId?: number;
  fetchedAt: string;
  variants: PriceVariant[];
}

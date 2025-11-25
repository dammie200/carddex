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
  price?: CardPriceData | null;
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

export interface CollectionEntryDTO {
  id: number;
  quantity: number;
  condition: string;
  language: string;
  finish: string;
  purchasePrice?: number | null;
  notes?: string | null;
  price?: CardPriceData | null;
  card: CardSummary;
}

export type BinderLayout = "grid" | "list";

export interface BinderSlotDTO {
  id: number;
  page: number;
  position: number | null;
  collectionEntry: CollectionEntryDTO;
}

export interface BinderDTO {
  id: number;
  name: string;
  layout: BinderLayout;
  gridRows?: number | null;
  gridCols?: number | null;
  pages?: number | null;
  slots: BinderSlotDTO[];
  createdAt?: string;
  updatedAt?: string;
}

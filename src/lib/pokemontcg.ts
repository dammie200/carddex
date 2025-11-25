import { ensureCardCatalog, findCardsByName, findCardsByNumber, getCard } from "./cardStore";
import { CardSummary } from "@/types";

export async function searchCardsByName(query: string): Promise<CardSummary[]> {
  return findCardsByName(query);
}

export async function searchCardsByNumberId(cardId: string): Promise<CardSummary[]> {
  return findCardsByNumber(cardId);
}

export async function getCardById(id: string): Promise<CardSummary | null> {
  return getCard(id);
}

export async function ensureCatalogSeeded() {
  await ensureCardCatalog();
}

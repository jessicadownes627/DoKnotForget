import type { RelationshipV2Link } from "../models/RelationshipV2.js";
import { normalizeRelationshipV2Links } from "./relationshipV2.js";

export const RELATIONSHIP_LINKS_V2_STORAGE_KEY = "doknotforget_relationship_links_v2";

export function loadRelationshipLinksV2() {
  try {
    const raw = window.localStorage.getItem(RELATIONSHIP_LINKS_V2_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeRelationshipV2Links(parsed as RelationshipV2Link[]) : [];
  } catch {
    return [];
  }
}

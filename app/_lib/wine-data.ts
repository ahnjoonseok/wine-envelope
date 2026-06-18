import { supabase } from "@/lib/supabase";
import {
  TASTING_NOTES_TABLE,
  WINE_CATALOG_TABLE,
  WINE_CATALOG_SEARCH_FIELDS,
  type NewTastingNoteInput,
  type TastingNote,
  type WineCatalogEntry,
} from "@/app/_lib/wine";

const WINE_CATALOG_COLUMNS = [
  "producer",
  "wine_name",
  "vintage",
  "country",
  "region",
  "appellation",
  "grape",
  "color",
  "source",
  "external_id",
  "normalized_name",
].join(",");

function sanitizeCatalogSearchTerm(value: string) {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchTastingNotes(userId: string) {
  const { data, error } = await supabase
    .from(TASTING_NOTES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return {
    data: (data ?? []) as TastingNote[],
    error,
  };
}

export async function insertTastingNote(
  userId: string,
  input: NewTastingNoteInput,
) {
  const { error } = await supabase.from(TASTING_NOTES_TABLE).insert({
    user_id: userId,
    name: input.name,
    vintage: input.vintage || null,
    region: input.region || null,
    grape: input.grape || null,
    rating: input.rating ? Number(input.rating) : null,
    memo: input.memo || null,
    envelope: input.envelope,
    note_tags: input.noteTags,
    appearance_color: input.appearanceColor,
    catalog_source: input.catalogSource || null,
    catalog_external_id: input.catalogExternalId || null,
  });

  return { error };
}

export async function deleteTastingNote(userId: string, noteId: string) {
  const { error } = await supabase
    .from(TASTING_NOTES_TABLE)
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  return { error };
}

export async function fetchWineCatalog(query = "", limit = 60) {
  const normalizedQuery = query.trim();
  const searchTerm = sanitizeCatalogSearchTerm(normalizedQuery);

  let request = supabase
    .from(WINE_CATALOG_TABLE)
    .select(WINE_CATALOG_COLUMNS)
    .order("producer", { ascending: true, nullsFirst: false })
    .order("wine_name", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (searchTerm) {
    const searchRules = WINE_CATALOG_SEARCH_FIELDS.map(
      (field) => `${field}.ilike.%${searchTerm}%`,
    );

    if (/^\d{4}$/.test(searchTerm)) {
      searchRules.push(`vintage.eq.${searchTerm}`);
    }

    request = request.or(searchRules.join(","));
  }

  const { data, error } = await request;

  return {
    data: (data ?? []) as WineCatalogEntry[],
    error,
  };
}

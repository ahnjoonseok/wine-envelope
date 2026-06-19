export const TASTING_NOTES_TABLE = "wines";
export const WINE_CATALOG_TABLE = "wine_catalog";

export type TastingNote = {
  id: string;
  user_id: string;
  name: string;
  vintage: string | null;
  region: string | null;
  grape: string | null;
  rating: number | null;
  memo: string | null;
  envelope?: TastingEnvelope | null;
  note_tags?: TastingNoteTags | null;
  appearance_color?: string | null;
  catalog_source?: string | null;
  catalog_external_id?: string | null;
  created_at: string;
};

export type NewTastingNoteInput = {
  name: string;
  vintage: string;
  region: string;
  grape: string;
  rating?: string;
  memo?: string;
  envelope: TastingEnvelope;
  noteTags: TastingNoteTags;
  appearanceColor: string;
  catalogSource?: string;
  catalogExternalId?: string;
};

export type TastingSectionKey = "aroma" | "palate" | "finish";

export type VerticalEnvelopePoint = {
  y: number;
};

export type FinishCurveHandle = {
  x: number;
  y: number;
};

export type FinishEnvelopePoint = {
  curve: FinishCurveHandle;
  x: number;
  y: number;
};

export type TastingEnvelope = {
  aroma: VerticalEnvelopePoint;
  palate: VerticalEnvelopePoint;
  finish: FinishEnvelopePoint;
};

export type TastingNoteTags = Record<TastingSectionKey, string[]>;

export const DEFAULT_TASTING_ENVELOPE: TastingEnvelope = {
  aroma: { y: 0.62 },
  palate: { y: 0.56 },
  finish: {
    curve: { x: 0.62, y: 0.48 },
    x: 0.5,
    y: 0,
  },
};

export const DEFAULT_TASTING_NOTE_TAGS: TastingNoteTags = {
  aroma: [],
  palate: [],
  finish: [],
};

export const DEFAULT_APPEARANCE_COLOR = "#caa46b";

type HexRgb = {
  b: number;
  g: number;
  r: number;
};

export function createDefaultTastingEnvelope(): TastingEnvelope {
  return {
    aroma: { ...DEFAULT_TASTING_ENVELOPE.aroma },
    palate: { ...DEFAULT_TASTING_ENVELOPE.palate },
    finish: {
      ...DEFAULT_TASTING_ENVELOPE.finish,
      curve: { ...DEFAULT_TASTING_ENVELOPE.finish.curve },
    },
  };
}

export function createDefaultTastingNoteTags(): TastingNoteTags {
  return {
    aroma: [],
    palate: [],
    finish: [],
  };
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function hexToRgb(value: string): HexRgb {
  const normalized = value.replace("#", "");

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: HexRgb) {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function mixHexColors(base: string, target: string, amount: number) {
  const clampedAmount = Math.max(0, Math.min(1, amount));
  const baseRgb = hexToRgb(base);
  const targetRgb = hexToRgb(target);

  return rgbToHex({
    r: baseRgb.r + (targetRgb.r - baseRgb.r) * clampedAmount,
    g: baseRgb.g + (targetRgb.g - baseRgb.g) * clampedAmount,
    b: baseRgb.b + (targetRgb.b - baseRgb.b) * clampedAmount,
  });
}

function isLightAppearanceColor(value: string) {
  const { r, g, b } = hexToRgb(value);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance >= 0.78;
}

export function parseAppearanceColor(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_APPEARANCE_COLOR;
  }

  const normalized = value.trim().toLowerCase();
  return isHexColor(normalized) ? normalized : DEFAULT_APPEARANCE_COLOR;
}

export function getAppearanceGradientColors(value: unknown) {
  const color = parseAppearanceColor(value);
  const isLight = isLightAppearanceColor(color);

  if (isLight) {
    return {
      base: color,
      end: color,
      isLight,
      start: "#ffffff",
    };
  }

  return {
    base: color,
    end: mixHexColors(color, "#18212f", 0.72),
    isLight,
    start: mixHexColors(color, "#ffffff", 0.06),
  };
}

export type WineCatalogEntry = Record<string, unknown> & {
  producer?: string | null;
  wine_name?: string | null;
  vintage?: string | number | null;
  country?: string | null;
  region?: string | null;
  appellation?: string | null;
  grape?: string | null;
  color?: string | null;
  source?: string | null;
  external_id?: string | null;
  normalized_name?: string | null;
  id?: string | number;
};

export type CatalogSearchField =
  | "producer"
  | "wine_name"
  | "country"
  | "region"
  | "appellation"
  | "grape"
  | "color"
  | "source"
  | "external_id"
  | "normalized_name";

export const WINE_CATALOG_SEARCH_FIELDS: CatalogSearchField[] = [
  "producer",
  "wine_name",
  "country",
  "region",
  "appellation",
  "grape",
  "color",
  "source",
  "external_id",
  "normalized_name",
];

const noteDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampUnit(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

export function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => asText(item))
      .filter((item): item is string => Boolean(item))
      .join(", ");

    return joined.length > 0 ? joined : null;
  }

  return null;
}

export function joinMeta(values: unknown[]): string {
  return values
    .map((value) => asText(value))
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function formatNoteDate(value: string): string {
  return noteDateFormatter.format(new Date(value));
}

export function parseTastingEnvelope(value: unknown): TastingEnvelope {
  if (!isRecord(value)) {
    return createDefaultTastingEnvelope();
  }

  const aroma = isRecord(value.aroma) ? value.aroma : {};
  const palate = isRecord(value.palate) ? value.palate : {};
  const finish = isRecord(value.finish) ? value.finish : {};
  const finishCurve = isRecord(finish.curve) ? finish.curve : {};
  const finishY = clampUnit(
    typeof finish.y === "number" ? finish.y : Number(finish.y),
    DEFAULT_TASTING_ENVELOPE.finish.y,
  );

  return {
    aroma: {
      y: clampUnit(
        typeof aroma.y === "number" ? aroma.y : Number(aroma.y),
        DEFAULT_TASTING_ENVELOPE.aroma.y,
      ),
    },
    palate: {
      y: clampUnit(
        typeof palate.y === "number" ? palate.y : Number(palate.y),
        DEFAULT_TASTING_ENVELOPE.palate.y,
      ),
    },
    finish: {
      curve: {
        x: clampUnit(
          typeof finishCurve.x === "number"
            ? finishCurve.x
            : Number(finishCurve.x),
          DEFAULT_TASTING_ENVELOPE.finish.curve.x,
        ),
        y: clampUnit(
          typeof finishCurve.y === "number"
            ? finishCurve.y
            : Number(finishCurve.y),
          finishY,
        ),
      },
      x: clampUnit(
        typeof finish.x === "number" ? finish.x : Number(finish.x),
        DEFAULT_TASTING_ENVELOPE.finish.x,
      ),
      y: finishY,
    },
  };
}

export function parseTastingNoteTags(value: unknown): TastingNoteTags {
  if (!isRecord(value)) {
    return createDefaultTastingNoteTags();
  }

  const sections: TastingSectionKey[] = ["aroma", "palate", "finish"];

  return sections.reduce<TastingNoteTags>((accumulator, section) => {
    const rawValue = value[section];

    accumulator[section] = Array.isArray(rawValue)
      ? rawValue
          .map((item) => asText(item))
          .filter((item): item is string => Boolean(item))
      : [];

    return accumulator;
  }, {
    aroma: [],
    palate: [],
    finish: [],
  });
}

export function getCatalogTitle(entry: WineCatalogEntry): string {
  return (
    asText(entry.wine_name) ??
    asText(entry.normalized_name) ??
    "이름 없는 와인"
  );
}

export function getCatalogSubtitle(entry: WineCatalogEntry): string | null {
  return asText(entry.producer);
}

export function getCatalogMeta(entry: WineCatalogEntry): string {
  return joinMeta([
    entry.vintage,
    entry.country,
    entry.region,
    entry.appellation,
    entry.grape,
    entry.color,
  ]);
}

export function getCatalogLocation(entry: WineCatalogEntry): string {
  return joinMeta([entry.country, entry.region, entry.appellation]);
}

export function getCatalogVarietal(entry: WineCatalogEntry): string {
  return joinMeta([entry.grape, entry.color]);
}

export function getCatalogReference(entry: WineCatalogEntry): string {
  return joinMeta([entry.source, entry.external_id]);
}

export function getCatalogSuggestedAppearanceColor(
  entry: WineCatalogEntry,
): string {
  const color = asText(entry.color)?.toLowerCase() ?? "";

  if (
    color.includes("rose") ||
    color.includes("rosé") ||
    color.includes("pink")
  ) {
    return "#d9a1ad";
  }

  if (color.includes("orange") || color.includes("amber")) {
    return "#d4944a";
  }

  if (color.includes("red") || color.includes("rouge")) {
    return "#7b2334";
  }

  if (
    color.includes("white") ||
    color.includes("blanc") ||
    color.includes("sparkling") ||
    color.includes("champagne")
  ) {
    return "#e3c98f";
  }

  return DEFAULT_APPEARANCE_COLOR;
}

export function getCatalogNormalizedName(
  entry: WineCatalogEntry,
): string | null {
  return asText(entry.normalized_name);
}

export function getCatalogSelectionLabel(entry: WineCatalogEntry): string {
  return joinMeta([entry.producer, getCatalogTitle(entry), entry.vintage]);
}

export function buildTastingNoteInputFromCatalog(
  entry: WineCatalogEntry,
  note: {
    envelope: TastingEnvelope;
    noteTags: TastingNoteTags;
    appearanceColor: string;
  },
): NewTastingNoteInput {
  return {
    name: getCatalogTitle(entry),
    vintage: asText(entry.vintage) ?? "",
    region: joinMeta([
      entry.producer,
      entry.country,
      entry.region,
      entry.appellation,
    ]),
    grape: getCatalogVarietal(entry),
    rating: "",
    memo: "",
    envelope: note.envelope,
    noteTags: note.noteTags,
    appearanceColor: parseAppearanceColor(note.appearanceColor),
    catalogSource: asText(entry.source) ?? "",
    catalogExternalId: asText(entry.external_id) ?? "",
  };
}

export function getCatalogKey(
  entry: WineCatalogEntry,
  index: number,
): string {
  return (
    asText(entry.external_id) ??
    asText(entry.normalized_name) ??
    joinMeta([entry.producer, entry.wine_name, entry.vintage]) ??
    `${index}`
  );
}

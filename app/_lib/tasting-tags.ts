import { type TastingSectionKey } from "@/app/_lib/wine";

type TagColorRule = {
  color: string;
  emoji: string;
  matches: string[];
};

export type TastingTagTone = "selected" | "suggestion" | "stack";

export const TASTING_TAG_SUGGESTIONS: Record<TastingSectionKey, string[]> = {
  aroma: [
    "lemon",
    "lime",
    "green apple",
    "pear",
    "peach",
    "apricot",
    "rose",
    "violet",
    "cherry",
    "blackberry",
    "coffee",
    "vanilla",
    "cedar",
    "mineral",
  ],
  palate: [
    "citrus",
    "stone fruit",
    "berry",
    "plum",
    "cream",
    "toast",
    "coffee",
    "pepper",
    "herbal",
    "saline",
    "chalky",
    "savory",
  ],
  finish: [
    "citrus peel",
    "mineral",
    "saline",
    "smoky",
    "pepper",
    "coffee",
    "earthy",
    "dry",
    "clean",
    "lingering",
    "warming",
    "spice",
  ],
};

const TAG_COLOR_RULES: TagColorRule[] = [
  {
    color: "#f1c94b",
    emoji: "🍋",
    matches: ["lemon", "lime", "yuzu", "citrus", "grapefruit", "bergamot"],
  },
  {
    color: "#cfe08c",
    emoji: "🍏",
    matches: ["green apple", "apple", "pear", "melon"],
  },
  {
    color: "#f2b46f",
    emoji: "🍑",
    matches: ["peach", "apricot", "stone fruit", "orange", "mango"],
  },
  {
    color: "#d97b7b",
    emoji: "🌹",
    matches: ["cherry", "raspberry", "strawberry", "berry", "rose"],
  },
  {
    color: "#7b5aa6",
    emoji: "🫐",
    matches: ["blackberry", "blueberry", "plum", "violet", "lavender"],
  },
  {
    color: "#83b67d",
    emoji: "🌿",
    matches: ["herbal", "mint", "sage", "grass", "eucalyptus"],
  },
  {
    color: "#8b5e3c",
    emoji: "☕",
    matches: [
      "coffee",
      "espresso",
      "mocha",
      "cocoa",
      "chocolate",
      "hazelnut",
      "almond",
      "toast",
      "caramel",
      "cedar",
      "oak",
    ],
  },
  {
    color: "#e3c07d",
    emoji: "🍯",
    matches: ["vanilla", "cream", "brioche", "butter", "honey"],
  },
  {
    color: "#c6884f",
    emoji: "🫚",
    matches: ["pepper", "spice", "clove", "cinnamon", "warming"],
  },
  {
    color: "#8f9aa8",
    emoji: "🪨",
    matches: ["mineral", "saline", "chalky", "smoky", "flint", "stone"],
  },
  {
    color: "#766657",
    emoji: "🍂",
    matches: ["earthy", "mushroom", "tobacco", "leather", "savory"],
  },
];

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");

  if (value.length !== 6) {
    return { r: 156, g: 163, b: 175 };
  }

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixWithWhite(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const clampedAmount = Math.max(0, Math.min(1, amount));

  return `rgb(${Math.round(r + (255 - r) * clampedAmount)}, ${Math.round(
    g + (255 - g) * clampedAmount,
  )}, ${Math.round(b + (255 - b) * clampedAmount)})`;
}

function getTagRule(tag: string) {
  const normalized = normalizeTag(tag);
  return TAG_COLOR_RULES.find((rule) =>
    rule.matches.some((keyword) => normalized.includes(keyword)),
  );
}

function getTagBaseColor(tag: string) {
  return getTagRule(tag)?.color ?? "#8c96a3";
}

export function getTastingTagEmoji(tag: string) {
  return getTagRule(tag)?.emoji ?? "🍷";
}

export function getTastingTagCompactLabel(tag: string, maxLength = 7) {
  const trimmed = tag.trim();
  const characters = Array.from(trimmed);

  if (characters.length <= maxLength) {
    return trimmed;
  }

  return `${characters.slice(0, maxLength).join("")}...`;
}

export function getTastingTagStyle(
  tag: string,
  tone: TastingTagTone = "selected",
) {
  const baseColor = getTagBaseColor(tag);
  const selectedColor = mixWithWhite(baseColor, 0.38);
  const suggestionColor = mixWithWhite(baseColor, 0.58);
  const stackColor = mixWithWhite(baseColor, 0.46);

  if (tone === "stack") {
    return {
      backgroundColor: stackColor,
      borderColor: rgba(baseColor, 0.6),
      color: "#18212f",
    };
  }

  if (tone === "suggestion") {
    return {
      backgroundColor: suggestionColor,
      borderColor: rgba(baseColor, 0.5),
      color: "#243041",
    };
  }

  return {
    backgroundColor: selectedColor,
    borderColor: rgba(baseColor, 0.64),
    color: "#18212f",
  };
}

"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { AuthCard } from "@/app/_components/auth-card";
import {
  getTastingSectionAnchorPercentages,
  TastingEnvelopeChart,
} from "@/app/_components/tasting-envelope-chart";
import { useAuthSession } from "@/app/_components/auth-provider";
import {
  getTastingTagCompactLabel,
  getTastingTagEmoji,
  getTastingTagStyle,
  TASTING_TAG_SUGGESTIONS,
} from "@/app/_lib/tasting-tags";
import {
  deleteTastingNote,
  fetchTastingNotes,
  fetchWineCatalog,
  insertTastingNote,
} from "@/app/_lib/wine-data";
import {
  buildTastingNoteInputFromCatalog,
  DEFAULT_APPEARANCE_COLOR,
  createDefaultTastingEnvelope,
  createDefaultTastingNoteTags,
  formatNoteDate,
  getAppearanceGradientColors,
  getCatalogKey,
  getCatalogMeta,
  getCatalogSelectionLabel,
  getCatalogSuggestedAppearanceColor,
  getCatalogSubtitle,
  getCatalogTitle,
  parseAppearanceColor,
  parseTastingEnvelope,
  parseTastingNoteTags,
  type TastingEnvelope,
  type TastingNote,
  type TastingNoteTags,
  type TastingSectionKey,
  type WineCatalogEntry,
} from "@/app/_lib/wine";

const CATALOG_RESULT_LIMIT = 8;

const TASTING_SECTIONS = [
  {
    key: "aroma",
    title: "아로마",
  },
  {
    key: "palate",
    title: "팔레트",
  },
  {
    key: "finish",
    title: "피니시",
  },
] as const;

type SavedNotePanel = "graph" | "notes";
type TagInputMap = Record<TastingSectionKey, string>;

function createEmptyTagInputs(): TagInputMap {
  return {
    aroma: "",
    palate: "",
    finish: "",
  };
}

function normalizeTagTokens(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTagValue(value: string) {
  return value.trim().toLowerCase();
}

function hasMatchingTag(tags: string[], target: string) {
  const normalizedTarget = normalizeTagValue(target);
  return tags.some((tag) => normalizeTagValue(tag) === normalizedTarget);
}

function mergeUniqueTags(existingTags: string[], nextTags: string[]) {
  const merged = [...existingTags];

  nextTags.forEach((nextTag) => {
    if (!hasMatchingTag(merged, nextTag)) {
      merged.push(nextTag);
    }
  });

  return merged;
}

function getSavedNoteMeta(note: TastingNote) {
  return (
    [note.vintage, note.region, note.grape].filter(Boolean).join(" · ") ||
    "추가 정보 없음"
  );
}

function getNoteSearchText(note: TastingNote) {
  const tags = parseTastingNoteTags(note.note_tags);

  return [
    note.name,
    note.vintage,
    note.region,
    note.grape,
    note.memo,
    ...tags.aroma,
    ...tags.palate,
    ...tags.finish,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type SectionTagEditorProps = {
  inputValue: string;
  onAddTag: (section: TastingSectionKey) => void;
  onChangeInput: (section: TastingSectionKey, value: string) => void;
  onRemoveTag: (section: TastingSectionKey, tag: string) => void;
  onToggleSuggestedTag: (section: TastingSectionKey, tag: string) => void;
  section: TastingSectionKey;
  tags: string[];
  title: string;
};

function SectionTagEditor({
  inputValue,
  onAddTag,
  onChangeInput,
  onRemoveTag,
  onToggleSuggestedTag,
  section,
  tags,
  title,
}: SectionTagEditorProps) {
  const suggestions = TASTING_TAG_SUGGESTIONS[section];

  return (
    <section className="rounded-[1.5rem] border border-black/8 bg-white p-5">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.length === 0 && (
          <p className="text-sm text-neutral-400">아직 추가된 태그가 없어요.</p>
        )}

        {tags.map((tag) => (
          <button
            key={`${section}-${tag}`}
            className="rounded-full border px-3 py-1.5 text-sm transition hover:brightness-[0.98]"
            onClick={() => onRemoveTag(section, tag)}
            style={getTastingTagStyle(tag, "selected")}
            type="button"
          >
            {getTastingTagEmoji(tag)} {tag} x
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
          placeholder="예: citrus, toast, saline"
          value={inputValue}
          onChange={(event) => onChangeInput(section, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              onAddTag(section);
            }
          }}
        />

        <button
          className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
          onClick={() => onAddTag(section)}
          type="button"
        >
          추가
        </button>
      </div>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">
          추천 태그
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((tag) => {
            const isSelected = hasMatchingTag(tags, tag);

            return (
              <button
                key={`${section}-suggestion-${tag}`}
                aria-pressed={isSelected}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? "ring-1 ring-black/8"
                    : "hover:-translate-y-px hover:brightness-[0.99]"
                }`}
                onClick={() => onToggleSuggestedTag(section, tag)}
                style={getTastingTagStyle(
                  tag,
                  isSelected ? "selected" : "suggestion",
                )}
                type="button"
              >
                {getTastingTagEmoji(tag)} {tag}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type SavedNoteActionsProps = {
  deletingNoteId: string | null;
  note: TastingNote;
  onDelete: (note: TastingNote) => void;
};

function SavedNoteActions({
  deletingNoteId,
  note,
  onDelete,
}: SavedNoteActionsProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <button
        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={deletingNoteId === note.id}
        onClick={() => onDelete(note)}
        type="button"
      >
        {deletingNoteId === note.id ? "삭제 중..." : "삭제"}
      </button>
    </div>
  );
}

type SavedNoteTagStackPanelProps = {
  anchors: Record<TastingSectionKey, number>;
  noteId: string;
  tags: TastingNoteTags;
};

function SavedNotePanelAxis({
  anchors,
}: {
  anchors: Record<TastingSectionKey, number>;
}) {
  return (
    <div className="relative h-4">
      {TASTING_SECTIONS.map((section) => (
        <div
          key={`saved-note-axis-${section.key}`}
          className="absolute top-0 -translate-x-1/2 text-center"
          style={{ left: `${anchors[section.key]}%` }}
        >
          <p className="text-[10px] tracking-[0.08em] text-neutral-500">
            {section.title}
          </p>
        </div>
      ))}
    </div>
  );
}

function SavedNoteTagStackPanel({
  anchors,
  noteId,
  tags,
}: SavedNoteTagStackPanelProps) {
  return (
    <div className="relative min-h-[10.75rem] px-1">
      {TASTING_SECTIONS.map((section) => (
        <div
          key={`${noteId}-stack-column-${section.key}`}
          className="absolute bottom-0 -translate-x-1/2"
          style={{
            left: `${anchors[section.key]}%`,
            width: "min(27%, 6rem)",
          }}
        >
          <div className="flex min-h-[10.75rem] flex-col justify-end">
            <div className="flex flex-1 flex-col-reverse gap-px">
              {tags[section.key].length === 0 && (
                <span className="w-full rounded-[0.5rem] border border-dashed border-black/10 bg-white/80 px-2 py-2 text-center text-[11px] leading-4 text-neutral-400">
                  태그 없음
                </span>
              )}

              {tags[section.key].map((tag) => (
                <span
                  key={`${noteId}-stack-chip-${section.key}-${tag}`}
                  className="flex w-full items-center gap-1 overflow-hidden rounded-[0.5rem] border px-1.5 py-0.5 text-xs leading-5"
                  style={getTastingTagStyle(tag, "stack")}
                  title={tag}
                >
                  <span className="shrink-0">{getTastingTagEmoji(tag)}</span>
                  <span className="min-w-0 truncate">
                    {getTastingTagCompactLabel(tag)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type SavedNoteCardProps = {
  deletingNoteId: string | null;
  note: TastingNote;
  onDelete: (note: TastingNote) => void;
};

function SavedNoteCard({
  deletingNoteId,
  note,
  onDelete,
}: SavedNoteCardProps) {
  const [activePanel, setActivePanel] = useState<SavedNotePanel>("graph");
  const appearanceColor = parseAppearanceColor(note.appearance_color);
  const noteEnvelope = parseTastingEnvelope(note.envelope);
  const tags = parseTastingNoteTags(note.note_tags);
  const anchors = getTastingSectionAnchorPercentages();

  return (
    <article className="rounded-[1.75rem] border border-black/8 bg-neutral-50 p-5">
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="xl:w-[21rem] xl:min-w-[21rem]">
          <div className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-3">
            <div className="flex justify-center">
              <div className="inline-flex rounded-full border border-black/8 bg-white/80 p-1">
                {[
                  { key: "graph", label: "그래프" },
                  { key: "notes", label: "노트" },
                ].map((item) => (
                  <button
                    key={item.key}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      activePanel === item.key
                        ? "bg-neutral-900 !text-white"
                        : "text-neutral-600 hover:bg-white"
                    }`}
                    onClick={() => setActivePanel(item.key as SavedNotePanel)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2.5 min-h-[10.75rem]">
              {activePanel === "graph" ? (
                <TastingEnvelopeChart
                  appearanceColor={appearanceColor}
                  className="h-[10.75rem]"
                  showBottomAxis={false}
                  showSectionLabels={false}
                  surface="plain"
                  value={noteEnvelope}
                  variant="preview"
                />
              ) : (
                <SavedNoteTagStackPanel
                  anchors={anchors}
                  noteId={note.id}
                  tags={tags}
                />
              )}
            </div>

            <div className="mt-1.5">
              <SavedNotePanelAxis anchors={anchors} />
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-neutral-950">
                {note.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                {getSavedNoteMeta(note)}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-400">
                {formatNoteDate(note.created_at)}
              </p>
            </div>

            <SavedNoteActions
              deletingNoteId={deletingNoteId}
              note={note}
              onDelete={onDelete}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-neutral-600">
              <span
                className="h-3 w-3 rounded-full border border-black/10"
                style={{ backgroundColor: appearanceColor }}
              />
              와인 컬러 {appearanceColor.toUpperCase()}
            </span>
          </div>

          {note.memo && (
            <div className="mt-5 rounded-[1.25rem] border border-black/8 bg-white p-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                {note.memo}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function NotesPage() {
  const { isLoading, user } = useAuthSession();
  const [notes, setNotes] = useState<TastingNote[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [noteQuery, setNoteQuery] = useState("");

  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<WineCatalogEntry[]>([]);
  const [catalogSearchMessage, setCatalogSearchMessage] = useState("");
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [selectedWine, setSelectedWine] = useState<WineCatalogEntry | null>(null);

  const [envelope, setEnvelope] = useState<TastingEnvelope>(
    createDefaultTastingEnvelope(),
  );
  const [noteTags, setNoteTags] = useState<TastingNoteTags>(
    createDefaultTastingNoteTags(),
  );
  const [appearanceColor, setAppearanceColor] = useState(DEFAULT_APPEARANCE_COLOR);
  const [memo, setMemo] = useState("");
  const [tagInputs, setTagInputs] = useState<TagInputMap>(createEmptyTagInputs());

  const deferredCatalogQuery = useDeferredValue(catalogQuery);
  const deferredNoteQuery = useDeferredValue(noteQuery);
  const normalizedCatalogQuery = deferredCatalogQuery.trim();
  const normalizedNoteQuery = deferredNoteQuery.trim().toLowerCase();
  const appearanceGradient = getAppearanceGradientColors(appearanceColor);
  const selectedLabel = selectedWine ? getCatalogSelectionLabel(selectedWine) : "";
  const noteCountLabel = `${notes.length}개의 기록`;
  const filteredNotes = notes.filter((note) => {
    if (!normalizedNoteQuery) {
      return true;
    }

    return getNoteSearchText(note).includes(normalizedNoteQuery);
  });

  useEffect(() => {
    if (!user) {
      setNotes([]);
      return;
    }

    const userId = user.id;
    let isMounted = true;

    async function loadNotes() {
      setIsLoadingNotes(true);
      const { data, error } = await fetchTastingNotes(userId);

      if (!isMounted) {
        return;
      }

      if (error) {
        setNotes([]);
        setMessage(error.message);
        setIsLoadingNotes(false);
        return;
      }

      setNotes(data);
      setMessage("");
      setIsLoadingNotes(false);
    }

    void loadNotes();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!isComposerOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        setIsComposerOpen(false);
        setMessage("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isComposerOpen, isSaving]);

  useEffect(() => {
    if (!user) {
      setCatalogResults([]);
      setCatalogSearchMessage("");
      setIsSearchingCatalog(false);
      return;
    }

    if (!normalizedCatalogQuery) {
      setCatalogResults([]);
      setCatalogSearchMessage("");
      setIsSearchingCatalog(false);
      return;
    }

    if (selectedWine && normalizedCatalogQuery === selectedLabel) {
      setCatalogResults([]);
      setCatalogSearchMessage("");
      setIsSearchingCatalog(false);
      return;
    }

    let isMounted = true;

    async function searchCatalog() {
      setIsSearchingCatalog(true);
      setCatalogSearchMessage("");

      const { data, error } = await fetchWineCatalog(
        normalizedCatalogQuery,
        CATALOG_RESULT_LIMIT,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setCatalogResults([]);
        setCatalogSearchMessage("카탈로그 검색 중 문제가 생겼어요.");
        setIsSearchingCatalog(false);
        return;
      }

      setCatalogResults(data);
      setCatalogSearchMessage(
        data.length === 0
          ? "일치하는 와인이 없어요. 먼저 카탈로그에 추가해 주세요."
          : "",
      );
      setIsSearchingCatalog(false);
    }

    void searchCatalog();

    return () => {
      isMounted = false;
    };
  }, [normalizedCatalogQuery, selectedLabel, selectedWine, user]);

  function resetDraft(clearSelection = true) {
    setEnvelope(createDefaultTastingEnvelope());
    setNoteTags(createDefaultTastingNoteTags());
    setAppearanceColor(
      clearSelection || !selectedWine
        ? DEFAULT_APPEARANCE_COLOR
        : getCatalogSuggestedAppearanceColor(selectedWine),
    );
    setMemo("");
    setTagInputs(createEmptyTagInputs());
    setMessage("");

    if (clearSelection) {
      setSelectedWine(null);
      setCatalogQuery("");
      setCatalogResults([]);
      setCatalogSearchMessage("");
    }
  }

  function handleOpenComposer() {
    setIsComposerOpen(true);
    setMessage("");
  }

  function handleCloseComposer() {
    if (isSaving) {
      return;
    }

    setIsComposerOpen(false);
    setMessage("");
  }

  function handleCatalogQueryChange(value: string) {
    setCatalogQuery(value);
    setSelectedWine(null);
    setMessage("");
  }

  function handleSelectWine(entry: WineCatalogEntry) {
    setSelectedWine(entry);
    setCatalogQuery(getCatalogSelectionLabel(entry));
    setCatalogResults([]);
    setCatalogSearchMessage("");
    setAppearanceColor(getCatalogSuggestedAppearanceColor(entry));
    setMessage("");
  }

  function handleResetSelection() {
    setSelectedWine(null);
    setCatalogQuery("");
    setCatalogResults([]);
    setCatalogSearchMessage("");
    setAppearanceColor(DEFAULT_APPEARANCE_COLOR);
    setMessage("");
  }

  function handleTagInputChange(section: TastingSectionKey, value: string) {
    setTagInputs((current) => ({
      ...current,
      [section]: value,
    }));
  }

  function handleAddTag(section: TastingSectionKey) {
    const candidates = normalizeTagTokens(tagInputs[section]);

    if (candidates.length === 0) {
      return;
    }

    setNoteTags((current) => ({
      ...current,
      [section]: mergeUniqueTags(current[section], candidates),
    }));
    setTagInputs((current) => ({
      ...current,
      [section]: "",
    }));
  }

  function handleRemoveTag(section: TastingSectionKey, tag: string) {
    setNoteTags((current) => ({
      ...current,
      [section]: current[section].filter((item) => item !== tag),
    }));
  }

  function handleToggleSuggestedTag(section: TastingSectionKey, tag: string) {
    setNoteTags((current) => {
      const exists = hasMatchingTag(current[section], tag);

      return {
        ...current,
        [section]: exists
          ? current[section].filter(
              (item) => normalizeTagValue(item) !== normalizeTagValue(tag),
            )
          : mergeUniqueTags(current[section], [tag]),
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setMessage("로그인이 필요해요.");
      return;
    }

    const userId = user.id;

    if (!selectedWine) {
      setMessage("카탈로그에서 와인을 먼저 선택해주세요.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const payload = buildTastingNoteInputFromCatalog(selectedWine, {
      envelope,
      noteTags,
      appearanceColor,
    });
    const { error } = await insertTastingNote(userId, {
      ...payload,
      memo: memo.trim(),
    });

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    const refreshed = await fetchTastingNotes(userId);

    if (refreshed.error) {
      setMessage(refreshed.error.message);
      setIsSaving(false);
      return;
    }

    setNotes(refreshed.data);
    resetDraft();
    setIsComposerOpen(false);
    setMessage("테이스팅 envelope과 태그를 저장했어요.");
    setIsSaving(false);
  }

  async function handleDeleteNote(note: TastingNote) {
    if (!user) {
      setMessage("로그인이 필요해요.");
      return;
    }

    const userId = user.id;

    const shouldDelete = window.confirm(
      `"${note.name}" 노트를 삭제할까요? 이 작업은 되돌릴 수 없어요.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingNoteId(note.id);
    setMessage("");

    const { error } = await deleteTastingNote(userId, note.id);

    if (error) {
      setMessage(error.message);
      setDeletingNoteId(null);
      return;
    }

    setNotes((current) => current.filter((item) => item.id !== note.id));
    setMessage("노트를 삭제했어요.");
    setDeletingNoteId(null);
  }

  const showCatalogResults =
    !selectedWine &&
    catalogQuery.trim().length > 0 &&
    (isSearchingCatalog ||
      catalogResults.length > 0 ||
      Boolean(catalogSearchMessage));

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <section className="rounded-[1.75rem] border border-black/8 bg-white p-6 text-sm text-neutral-600 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
          로그인 상태를 확인하고 있어요...
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <section className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <article className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-950">
              여기는 내 와인 기록 공간이에요
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">
              이 페이지는 로그인한 사용자만 자신의 테이스팅 노트를 저장하고
              볼 수 있도록 분리했습니다. 이제 기록하기 모달에서 aroma,
              palate, finish envelope과 태그를 남기고, 각 기록 카드 안에서
              그래프와 노트를 전환해 보게 됩니다.
            </p>

            <Link
              href="/discover"
              className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
            >
              와인 정보 페이지 먼저 보기
            </Link>
          </article>

          <AuthCard
            title="노트를 남기려면 로그인"
            description="카탈로그에서 병을 고르고, 기록하기 버튼으로 모달을 열어 envelope과 태그를 저장하는 흐름이에요."
          />
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <section className="rounded-[1.5rem] border border-black/8 bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold !text-white transition hover:bg-neutral-800 hover:!text-white focus-visible:!text-white active:!text-white"
                onClick={handleOpenComposer}
                type="button"
              >
                기록하기
              </button>

              <div className="rounded-full border border-black/10 bg-neutral-50 px-4 py-2 text-sm text-neutral-600">
                {noteCountLabel}
              </div>

              {normalizedNoteQuery && (
                <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-neutral-500">
                  검색 결과 {filteredNotes.length}개
                </div>
              )}
            </div>

            <label className="block w-full xl:max-w-md">
              <span className="mb-2 block text-sm font-medium text-neutral-500">
                내 기록 검색
              </span>
              <input
                className="w-full rounded-xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 transition focus:border-neutral-400"
                placeholder="와인 이름, 지역, 품종, 태그로 검색"
                value={noteQuery}
                onChange={(event) => setNoteQuery(event.target.value)}
              />
            </label>
          </div>
        </section>

        {message && (
          <p className="mt-6 rounded-[1.5rem] border border-black/8 bg-white px-5 py-4 text-sm text-neutral-600 shadow-[0_16px_48px_rgba(15,23,42,0.05)]">
            {message}
          </p>
        )}

        <section className="mt-8 rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-neutral-950">
                내가 남긴 와인 기록
              </h2>
              {normalizedNoteQuery && (
                <p className="mt-2 text-sm text-neutral-500">
                  "{deferredNoteQuery.trim()}" 검색 결과예요.
                </p>
              )}
            </div>
          </div>

          {isLoadingNotes && (
            <div className="mt-6 rounded-[1.5rem] border border-black/8 bg-neutral-50 p-6 text-sm text-neutral-600">
              내 노트를 불러오고 있어요...
            </div>
          )}

          {!isLoadingNotes && notes.length === 0 && (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-black/10 bg-neutral-50 p-6 text-sm leading-6 text-neutral-600">
              아직 기록된 와인이 없어요. 기록하기를 눌러 첫 envelope 노트를
              남겨보세요.
            </div>
          )}

          {!isLoadingNotes && notes.length > 0 && filteredNotes.length === 0 && (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-black/10 bg-neutral-50 p-6 text-sm leading-6 text-neutral-600">
              검색어와 일치하는 기록이 없어요. 다른 이름이나 태그로 다시
              찾아보세요.
            </div>
          )}

          {!isLoadingNotes && filteredNotes.length > 0 && (
            <div className="mt-6 grid gap-4">
              {filteredNotes.map((note) => (
                <SavedNoteCard
                  key={note.id}
                  deletingNoteId={deletingNoteId}
                  note={note}
                  onDelete={(target) => void handleDeleteNote(target)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {isComposerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4"
          onClick={handleCloseComposer}
        >
          <div className="flex min-h-full items-center justify-center">
            <div
              className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-black/8 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.2)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-[min(90vh,58rem)] max-h-[calc(100vh-1.5rem)] min-h-0 sm:min-h-[46rem] flex-col">
                <div className="border-b border-black/8 bg-white px-6 py-5 sm:px-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-3xl font-semibold text-neutral-950">
                        테이스팅 기록하기
                      </h2>
                    </div>

                    <button
                      className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60"
                      disabled={isSaving}
                      onClick={handleCloseComposer}
                      type="button"
                    >
                      닫기
                    </button>
                  </div>
                </div>

                <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
                  <div className="relative z-20 shrink-0 border-b border-black/8 bg-white px-6 pb-4 pt-4 sm:px-8">
                    <div className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-4">
                      <input
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-lg text-neutral-950 outline-none placeholder:text-neutral-400 transition focus:border-neutral-400"
                        placeholder="생산자, 와인 이름, 지역, 품종으로 검색"
                        value={catalogQuery}
                        onChange={(event) =>
                          handleCatalogQueryChange(event.target.value)
                        }
                      />
                    </div>

                    {showCatalogResults && (
                      <div className="absolute inset-x-6 top-full z-30 mt-3 max-h-[min(42vh,24rem)] overflow-y-auto rounded-[1.25rem] border border-black/8 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] sm:inset-x-8">
                        {isSearchingCatalog && (
                          <p className="px-4 py-4 text-sm text-neutral-500">
                            카탈로그를 검색하고 있어요...
                          </p>
                        )}

                        {!isSearchingCatalog && catalogResults.length > 0 && (
                          <div className="divide-y divide-black/6">
                            {catalogResults.map((entry, index) => {
                              const title = getCatalogTitle(entry);
                              const subtitle = getCatalogSubtitle(entry);
                              const meta = getCatalogMeta(entry);

                              return (
                                <button
                                  key={getCatalogKey(entry, index)}
                                  className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left transition hover:bg-neutral-50"
                                  onClick={() => handleSelectWine(entry)}
                                  type="button"
                                >
                                  <p className="text-base font-semibold text-neutral-950">
                                    {title}
                                  </p>
                                  {subtitle && (
                                    <p className="text-sm text-neutral-600">
                                      {subtitle}
                                    </p>
                                  )}
                                  {meta && (
                                    <p className="text-sm text-neutral-500">
                                      {meta}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {!isSearchingCatalog && catalogSearchMessage && (
                          <p className="px-4 py-4 text-sm text-neutral-500">
                            {catalogSearchMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
                    <div className="space-y-6">
                      {selectedWine && (
                        <>
                          <article className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <h3 className="text-2xl font-semibold text-neutral-950">
                                  {getCatalogTitle(selectedWine)}
                                </h3>
                                {getCatalogSubtitle(selectedWine) && (
                                  <p className="mt-2 text-sm font-medium text-neutral-600">
                                    {getCatalogSubtitle(selectedWine)}
                                  </p>
                                )}
                                {getCatalogMeta(selectedWine) && (
                                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                                    {getCatalogMeta(selectedWine)}
                                  </p>
                                )}
                              </div>

                              <button
                                className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-white"
                                onClick={handleResetSelection}
                                type="button"
                              >
                                다른 와인 선택
                              </button>
                            </div>
                          </article>

                          <section className="rounded-[1.5rem] border border-black/8 bg-white p-5">
                            <TastingEnvelopeChart
                              appearanceColor={appearanceColor}
                              onChange={(nextValue) => setEnvelope(nextValue)}
                              value={envelope}
                            />

                            <div className="mt-5 rounded-[1.25rem] border border-black/8 bg-neutral-50 p-4">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-semibold text-neutral-900">
                                  와인 컬러
                                </p>

                                <div className="flex items-center gap-3">
                                  <input
                                    aria-label="와인 컬러 선택"
                                    className="h-12 w-16 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                                    type="color"
                                    value={appearanceColor}
                                    onChange={(event) =>
                                      setAppearanceColor(
                                        parseAppearanceColor(event.target.value),
                                      )
                                    }
                                  />

                                  <div className="min-w-[7rem]">
                                    <div
                                      className="h-6 rounded-full border border-black/10"
                                      style={{
                                        background: `linear-gradient(90deg, ${
                                          appearanceGradient.base
                                        } 0%, ${
                                          appearanceGradient.isLight
                                            ? "#ffffff"
                                            : appearanceGradient.end
                                        } 100%)`,
                                      }}
                                    />
                                    <p className="mt-2 text-xs text-neutral-500">
                                      {appearanceColor.toUpperCase()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </section>

                          <div className="grid gap-4 lg:grid-cols-3">
                            {TASTING_SECTIONS.map((section) => (
                              <SectionTagEditor
                                key={section.key}
                                inputValue={tagInputs[section.key]}
                                onAddTag={handleAddTag}
                                onChangeInput={handleTagInputChange}
                                onRemoveTag={handleRemoveTag}
                                onToggleSuggestedTag={handleToggleSuggestedTag}
                                section={section.key}
                                tags={noteTags[section.key]}
                                title={section.title}
                              />
                            ))}
                          </div>

                          <section className="rounded-[1.5rem] border border-black/8 bg-white p-5">
                            <textarea
                              className="min-h-[6.5rem] w-full resize-none rounded-[1.1rem] border border-black/10 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-950 outline-none transition focus:border-neutral-400"
                              maxLength={240}
                              placeholder="짧게 메모를 남겨보세요. 예: 산뜻하고 레몬 껍질 느낌, 피니시가 깔끔함"
                              value={memo}
                              onChange={(event) => setMemo(event.target.value)}
                            />
                            <p className="mt-2 text-xs text-neutral-400">
                              {memo.trim().length}/240
                            </p>
                          </section>

                          {message && (
                            <p className="rounded-[1.25rem] border border-black/8 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                              {message}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 border-t border-black/8 pt-2">
                            <button
                              className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold !text-white transition hover:bg-neutral-800 hover:!text-white focus-visible:!text-white active:!text-white disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={!selectedWine || isSaving}
                              type="submit"
                            >
                              {isSaving ? "저장 중..." : "기록 저장"}
                            </button>

                            <button
                              className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
                              onClick={() => resetDraft(false)}
                              type="button"
                            >
                              envelope 초기화
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { AuthCard } from "@/app/_components/auth-card";
import { TastingEnvelopeChart } from "@/app/_components/tasting-envelope-chart";
import { useAuthSession } from "@/app/_components/auth-provider";
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
  getCatalogKey,
  getCatalogMeta,
  getCatalogReference,
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
    description: "아로마가 얼마나 강했는지와 떠오른 향 노트를 남겨주세요.",
  },
  {
    key: "palate",
    title: "팔레트",
    description: "입안에서의 밀도와 인상을 팔레트 태그로 기록해주세요.",
  },
  {
    key: "finish",
    title: "피니시",
    description:
      "피니시의 강도와 지속감을 envelope로 표시하고 태그도 덧붙여주세요.",
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

function formatRatioLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getSavedNoteMeta(note: TastingNote) {
  return (
    [note.vintage, note.region, note.grape].filter(Boolean).join(" · ") ||
    "추가 정보 없음"
  );
}

function getEnvelopeSummary(envelope: TastingEnvelope) {
  return [
    {
      label: "아로마 강도",
      value: formatRatioLabel(envelope.aroma.y),
    },
    {
      label: "팔레트 강도",
      value: formatRatioLabel(envelope.palate.y),
    },
    {
      label: "피니시 길이",
      value: formatRatioLabel(envelope.finish.x),
    },
    {
      label: "피니시 강도",
      value: formatRatioLabel(envelope.finish.y),
    },
  ];
}

type SectionTagEditorProps = {
  description: string;
  inputValue: string;
  onAddTag: (section: TastingSectionKey) => void;
  onChangeInput: (section: TastingSectionKey, value: string) => void;
  onRemoveTag: (section: TastingSectionKey, tag: string) => void;
  section: TastingSectionKey;
  tags: string[];
  title: string;
};

function SectionTagEditor({
  description,
  inputValue,
  onAddTag,
  onChangeInput,
  onRemoveTag,
  section,
  tags,
  title,
}: SectionTagEditorProps) {
  return (
    <section className="rounded-[1.5rem] border border-black/8 bg-white p-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="text-sm leading-6 text-neutral-500">{description}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.length === 0 && (
          <p className="text-sm text-neutral-400">아직 추가된 태그가 없어요.</p>
        )}

        {tags.map((tag) => (
          <button
            key={`${section}-${tag}`}
            className="rounded-full border border-black/10 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
            onClick={() => onRemoveTag(section, tag)}
            type="button"
          >
            {tag} x
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
      {(note.catalog_source || note.catalog_external_id) && (
        <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-neutral-500">
          {[note.catalog_source, note.catalog_external_id]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

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
  noteId: string;
  tags: TastingNoteTags;
};

function SavedNoteTagStackPanel({
  noteId,
  tags,
}: SavedNoteTagStackPanelProps) {
  return (
    <div className="relative overflow-hidden rounded-[1.25rem] border border-black/8 bg-neutral-50 px-3 pb-3 pt-4">
      <div className="pointer-events-none absolute inset-x-4 bottom-[3.35rem] h-px bg-black/10" />

      <div className="grid grid-cols-3 gap-3">
        {TASTING_SECTIONS.map((section) => (
          <div
            key={`${noteId}-stack-column-${section.key}`}
            className="relative flex min-h-[14.5rem] flex-col justify-end"
          >
            <div className="flex min-h-[10.5rem] flex-col-reverse gap-2 pb-5">
              {tags[section.key].length === 0 && (
                <span className="w-full rounded-[0.5rem] border border-dashed border-black/10 bg-white/80 px-2 py-2 text-center text-[11px] leading-4 text-neutral-400">
                  태그 없음
                </span>
              )}

              {tags[section.key].map((tag) => (
                <span
                  key={`${noteId}-stack-chip-${section.key}-${tag}`}
                  className="w-full rounded-[0.5rem] border border-black/10 bg-white px-1 py-0.5 text-center text-xs leading-5 text-neutral-700 break-words"
                >
                  {tag}
                </span>
              ))}
            </div>

            <span className="mx-auto h-2.5 w-2.5 rounded-full border border-black/8 bg-white" />

            <div className="pt-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                {section.title}
              </p>
              <p className="mt-1 text-[11px] text-neutral-400">
                {tags[section.key].length} tags
              </p>
            </div>
          </div>
        ))}
      </div>
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
  const envelopeSummary = getEnvelopeSummary(noteEnvelope);

  return (
    <article className="rounded-[1.75rem] border border-black/8 bg-neutral-50 p-5">
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="xl:w-[21rem] xl:min-w-[21rem]">
          <div className="overflow-hidden rounded-[1.5rem] border border-black/8 bg-white">
            <div className="border-b border-black/8 px-4 py-3">
              <div className="inline-flex rounded-full border border-black/8 bg-neutral-50 p-1">
                {[
                  { key: "graph", label: "그래프" },
                  { key: "notes", label: "노트" },
                ].map((item) => (
                  <button
                    key={item.key}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      activePanel === item.key
                        ? "bg-neutral-900 text-white"
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

            <div className="p-4">
              {activePanel === "graph" ? (
                <TastingEnvelopeChart
                  appearanceColor={appearanceColor}
                  value={noteEnvelope}
                  variant="preview"
                />
              ) : (
                <SavedNoteTagStackPanel noteId={note.id} tags={tags} />
              )}
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
            {envelopeSummary.map((item) => (
              <span
                key={`${note.id}-${item.label}`}
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-neutral-600"
              >
                {item.label} {item.value}
              </span>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-black/8 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Stack Layout
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              노트 탭에서는 아로마, 팔레트, 피니시를 가로축처럼 두고 각 섹션
              태그가 위로 한 칸씩 쌓이도록 정리했습니다.
            </p>
          </div>

          {(note.rating !== null || note.memo) && (
            <div className="mt-5 rounded-[1.25rem] border border-black/8 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                이전 기록 필드
              </p>
              {note.rating !== null && (
                <p className="mt-2 text-sm text-neutral-600">
                  rating: {note.rating}
                </p>
              )}
              {note.memo && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-600">
                  {note.memo}
                </p>
              )}
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
  const [tagInputs, setTagInputs] = useState<TagInputMap>(createEmptyTagInputs());

  const deferredCatalogQuery = useDeferredValue(catalogQuery);
  const normalizedCatalogQuery = deferredCatalogQuery.trim();
  const selectedLabel = selectedWine ? getCatalogSelectionLabel(selectedWine) : "";
  const noteCountLabel = `${notes.length}개의 기록`;

  useEffect(() => {
    if (!user) {
      setNotes([]);
      return;
    }

    let isMounted = true;

    async function loadNotes() {
      setIsLoadingNotes(true);
      const { data, error } = await fetchTastingNotes(user.id);

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
      [section]: Array.from(new Set([...current[section], ...candidates])),
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setMessage("로그인이 필요해요.");
      return;
    }

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
    const { error } = await insertTastingNote(user.id, payload);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    const refreshed = await fetchTastingNotes(user.id);

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

    const shouldDelete = window.confirm(
      `"${note.name}" 노트를 삭제할까요? 이 작업은 되돌릴 수 없어요.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingNoteId(note.id);
    setMessage("");

    const { error } = await deleteTastingNote(user.id, note.id);

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
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
              Private Notes
            </p>
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
        <section className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
                Private Notes
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
                기록은 팝업에서 남기고,
                <br />
                지난 노트는 카드 안에서 전환해봅니다.
              </h1>
              <p className="text-base leading-7 text-neutral-600 sm:text-lg">
                카탈로그에서 와인을 찾은 뒤 기록하기를 눌러 노트를 남기고,
                아래 기록 카드 안에서 그래프와 노트를 같은 위치에서 바꿔가며
                과거 기록을 살펴볼 수 있어요.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="rounded-full border border-black/10 bg-neutral-50 px-4 py-2 text-sm text-neutral-600">
                {noteCountLabel}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                  onClick={handleOpenComposer}
                  type="button"
                >
                  기록하기
                </button>

                <Link
                  href="/discover"
                  className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
                >
                  와인 정보 찾기
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <article className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                기록 방식
              </p>
              <p className="mt-3 text-lg font-semibold text-neutral-950">
                카탈로그 선택 후 팝업 저장
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                수기 입력 대신 카탈로그에서 병을 고른 뒤 엔벨로프와 태그를
                바로 쌓는 흐름으로 정리했습니다.
              </p>
            </article>

            <article className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                보기 방식
              </p>
              <p className="mt-3 text-lg font-semibold text-neutral-950">
                한 카드 안에서 그래프와 노트 전환
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                왼쪽 패널 상단의 탭으로 그래프와 노트를 같은 자리에서 바꿔보는
                구조로 정리했습니다.
              </p>
            </article>

            <article className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                현재 상태
              </p>
              <p className="mt-3 text-lg font-semibold text-neutral-950">
                {noteCountLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                새 기록을 저장하면 모달이 닫히고, 아래 목록에 바로 추가되는
                흐름으로 연결됩니다.
              </p>
            </article>
          </div>
        </section>

        {message && (
          <p className="mt-6 rounded-[1.5rem] border border-black/8 bg-white px-5 py-4 text-sm text-neutral-600 shadow-[0_16px_48px_rgba(15,23,42,0.05)]">
            {message}
          </p>
        )}

        <section className="mt-8 rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                Saved Notes
              </p>
              <h2 className="text-3xl font-semibold text-neutral-950">
                내가 남긴 와인 기록
              </h2>
              <p className="text-sm leading-6 text-neutral-500">
                각 기록 카드의 왼쪽 패널 탭에서 그래프와 노트를 전환해보세요.
              </p>
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

          {!isLoadingNotes && notes.length > 0 && (
            <div className="mt-6 grid gap-4">
              {notes.map((note) => (
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
          className="fixed inset-0 z-50 bg-black/30 px-4 py-6 backdrop-blur-sm sm:px-6"
          onClick={handleCloseComposer}
        >
          <div className="flex min-h-full items-center justify-center">
            <div
              className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-black/8 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.2)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="max-h-[calc(100vh-3rem)] overflow-y-auto">
                <div className="border-b border-black/8 bg-white px-6 py-5 sm:px-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                        New Note
                      </p>
                      <h2 className="text-3xl font-semibold text-neutral-950">
                        테이스팅 기록하기
                      </h2>
                      <p className="max-w-2xl text-sm leading-6 text-neutral-600">
                        카탈로그에서 병을 고른 뒤 엔벨로프와 태그를 저장하면,
                        아래 기록 목록에 바로 추가됩니다.
                      </p>
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

                <form className="px-6 py-6 sm:px-8 sm:py-8" onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    <div className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-neutral-700">
                          카탈로그에서 와인 선택
                        </span>
                        <input
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-lg text-neutral-950 outline-none placeholder:text-neutral-400 transition focus:border-neutral-400"
                          placeholder="생산자, 와인 이름, 지역, 품종으로 검색"
                          value={catalogQuery}
                          onChange={(event) =>
                            handleCatalogQueryChange(event.target.value)
                          }
                        />
                      </label>
                      <p className="mt-3 text-sm text-neutral-500">
                        병을 직접 입력하는 대신, 카탈로그에서 선택한 와인을
                        기준으로 기록이 저장됩니다.
                      </p>
                    </div>

                    {showCatalogResults && (
                      <div className="rounded-[1.5rem] border border-black/8 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
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

                    {selectedWine ? (
                      <article className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                              선택한 와인
                            </p>
                            <h3 className="mt-2 text-2xl font-semibold text-neutral-950">
                              {getCatalogTitle(selectedWine)}
                            </h3>
                            {getCatalogSubtitle(selectedWine) && (
                              <p className="mt-2 text-sm font-medium text-neutral-600">
                                {getCatalogSubtitle(selectedWine)}
                              </p>
                            )}
                            <p className="mt-3 text-sm leading-6 text-neutral-600">
                              {getCatalogMeta(selectedWine) || "추가 메타 정보 없음"}
                            </p>
                            {getCatalogReference(selectedWine) && (
                              <p className="mt-2 text-xs text-neutral-400">
                                {getCatalogReference(selectedWine)}
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
                    ) : (
                      <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-neutral-50 p-5 text-sm leading-6 text-neutral-500">
                        카탈로그에서 먼저 와인을 하나 선택해주세요. 선택된 병을
                        기준으로 envelope과 태그가 저장됩니다.
                      </div>
                    )}

                    <section className="rounded-[1.5rem] border border-black/8 bg-white p-5">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-neutral-900">
                          엔벨로프 편집
                        </p>
                        <p className="text-sm leading-6 text-neutral-500">
                          aroma와 palate는 위아래로, finish는 위아래와 좌우로
                          움직입니다. 위로 갈수록 강하고, finish는 오른쪽으로 갈수록
                          길게 유지됩니다.
                        </p>
                      </div>

                      <div className="mt-5">
                        <TastingEnvelopeChart
                          appearanceColor={appearanceColor}
                          onChange={(nextValue) => setEnvelope(nextValue)}
                          value={envelope}
                        />
                      </div>

                      <div className="mt-5 rounded-[1.25rem] border border-black/8 bg-neutral-50 p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">
                              와인 컬러 선택
                            </p>
                            <p className="mt-1 text-sm leading-6 text-neutral-500">
                              그래프 아래 면적에 적용할 색을 골라주세요.
                            </p>
                          </div>

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
                                  background: `linear-gradient(90deg, ${appearanceColor} 0%, ${appearanceColor}cc 100%)`,
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
                          description={section.description}
                          inputValue={tagInputs[section.key]}
                          onAddTag={handleAddTag}
                          onChangeInput={handleTagInputChange}
                          onRemoveTag={handleRemoveTag}
                          section={section.key}
                          tags={noteTags[section.key]}
                          title={section.title}
                        />
                      ))}
                    </div>

                    {message && (
                      <p className="rounded-[1.25rem] border border-black/8 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                        {message}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 border-t border-black/8 pt-2">
                      <button
                        className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
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

                      <Link
                        href="/discover"
                        className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
                      >
                        와인 정보 다시 찾기
                      </Link>
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

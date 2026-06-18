"use client";
import { useDeferredValue, useEffect, useState } from "react";
import { fetchWineCatalog } from "@/app/_lib/wine-data";
import {
  getCatalogKey,
  getCatalogMeta,
  getCatalogSubtitle,
  getCatalogTitle,
  type WineCatalogEntry,
} from "@/app/_lib/wine";

type CatalogStatus = "idle" | "ready" | "error";

export function DiscoverPage() {
  const [catalog, setCatalog] = useState<WineCatalogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CatalogStatus>("idle");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim();

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      const { data, error } = await fetchWineCatalog(
        normalizedQuery,
        normalizedQuery ? 80 : 60,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setCatalog([]);
        setIsLoading(false);
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setCatalog(data);
      setStatus("ready");
      setMessage("");
      setIsLoading(false);
    }

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [normalizedQuery]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="rounded-[1rem] border border-black/8 bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
        <div className="mx-auto max-w-3xl">
          <label className="block rounded-[0.8rem] border border-black/10 bg-neutral-50 p-4 text-center">
            <span className="mb-3 block text-sm font-medium text-neutral-600">
              이름, 생산자, 지역, 품종, 출처로 검색
            </span>
            <input
              className="w-full bg-transparent text-center text-lg text-neutral-950 outline-none placeholder:text-neutral-400"
              placeholder="예: Dom Perignon, Napa, Pinot Noir, Vivino"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {message && (
          <div className="mt-6 rounded-[0.8rem] border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {message}
          </div>
        )}

        {isLoading && (
          <div className="mt-8 rounded-[0.8rem] border border-black/8 bg-neutral-50 p-6 text-sm text-neutral-600">
            와인 데이터베이스를 불러오고 있어요...
          </div>
        )}

        {!isLoading && status === "error" && (
          <div className="mt-8 rounded-[0.8rem] border border-red-200 bg-red-50 p-6">
            <h3 className="text-xl font-semibold text-neutral-950">
              와인 검색 데이터를 아직 읽지 못했어요
            </h3>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              테이블 권한이나 컬럼 이름을 확인한 뒤 다시 시도해보세요.
            </p>
          </div>
        )}

        {!isLoading && status === "ready" && (
          <>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-neutral-600">
                {normalizedQuery
                  ? `"${normalizedQuery}" 검색 결과 ${catalog.length}개`
                  : `${catalog.length}개의 와인 정보를 보여주고 있어요`}
              </p>
              <p className="text-sm text-neutral-500">
                {normalizedQuery
                  ? "검색어가 바뀌면 바로 다시 조회합니다."
                  : "검색어를 입력하면 바로 찾습니다."}
              </p>
            </div>

            {catalog.length === 0 && (
              <div className="mt-4 rounded-[0.8rem] border border-black/8 bg-neutral-50 p-6 text-sm leading-6 text-neutral-600">
                {normalizedQuery
                  ? "검색어와 맞는 와인이 없어요. 생산자, 산지, 포도 품종으로 다시 찾아보세요."
                  : "아직 표시할 와인 정보가 없어요. 데이터가 있으면 여기에 나타납니다."}
              </div>
            )}

            <div className="mt-4 grid gap-2.5">
              {catalog.map((entry, index) => {
                const title = getCatalogTitle(entry);
                const subtitle = getCatalogSubtitle(entry);
                const meta = getCatalogMeta(entry);

                return (
                  <article
                    key={getCatalogKey(entry, index)}
                    className="rounded-[0.7rem] border border-black/8 bg-neutral-50 px-4 py-3 transition hover:border-black/12 hover:bg-white"
                  >
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                          <h3 className="text-base font-semibold tracking-tight text-neutral-950">
                            {title}
                          </h3>
                          {subtitle && (
                            <p className="text-sm font-medium text-neutral-500">
                              {subtitle}
                            </p>
                          )}
                        </div>

                        {meta && (
                          <p className="mt-0.5 text-sm leading-5 text-neutral-600">
                            {meta}
                          </p>
                        )}
                      </div>

                      {entry.color && (
                        <div className="shrink-0 rounded-md border border-black/10 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600">
                          {String(entry.color)}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

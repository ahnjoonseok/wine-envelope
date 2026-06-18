"use client";

import Link from "next/link";
import { AuthCard } from "@/app/_components/auth-card";
import { useAuthSession } from "@/app/_components/auth-provider";
import {
  TASTING_NOTES_TABLE,
  WINE_CATALOG_TABLE,
} from "@/app/_lib/wine";

const areas = [
  {
    href: "/discover",
    eyebrow: "Wine database",
    title: "와인 정보 탐색",
    description:
      "검색 중심의 정보 페이지예요. 생산자, 지역, 원산지명, 품종, 색상을 기준으로 와인을 찾아보는 용도로 분리했어요.",
  },
  {
    href: "/notes",
    eyebrow: "Personal notebook",
    title: "내 테이스팅 노트",
    description:
      "카탈로그에서 와인을 고른 뒤 aroma, palate, finish envelope과 태그를 남기는 개인 공간이에요. 저장은 계속 `wines` 테이블에 사용자별로 쌓입니다.",
  },
];

export function HomePage() {
  const { isLoading, user } = useAuthSession();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
              Wine App Structure
            </p>
            <h2 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
              와인 정보는 찾는 페이지로,
              <br />
              내 기록은 남기는 페이지로 분리했습니다.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg">
              이제 이 앱은 공용 와인 데이터와 개인 테이스팅 노트를 다른
              역할로 다룹니다. 찾기와 기록을 섞지 않고, 각각의 흐름을 따로
              관리할 수 있게 기준을 세웠어요.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {areas.map((area) => (
              <Link
                key={area.href}
                href={area.href}
                className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5 transition hover:-translate-y-0.5 hover:border-black/12 hover:bg-white"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                  {area.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-neutral-950">
                  {area.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  {area.description}
                </p>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
                현재 테이스팅 노트
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-neutral-950">
                `{TASTING_NOTES_TABLE}`
              </h3>
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                로그인한 사용자의 개인 기록만 저장하는 테이블이에요. 이 페이지는
                `/notes`에서 계속 사용합니다.
              </p>
            </article>

            <article className="rounded-[1.5rem] border border-black/8 bg-neutral-50 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
                새 와인 정보 DB
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-neutral-950">
                `{WINE_CATALOG_TABLE}`
              </h3>
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                공용 와인 정보는 이쪽에서 검색합니다. `wine_name`, `producer`,
                `appellation`, `grape` 같은 기준 정보를 분리해서 관리해요.
              </p>
            </article>
          </div>
        </div>

        <div className="space-y-6">
          {isLoading && (
            <section className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
              <p className="text-sm text-neutral-600">
                로그인 상태를 확인하고 있어요...
              </p>
            </section>
          )}

          {!isLoading && user && (
            <section className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                Logged in
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-neutral-950">
                {user.email}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                검색 페이지에서 와인을 먼저 찾고, 내 노트에서는 카탈로그에서
                병을 골라 envelope과 태그를 빠르게 남겨보세요.
              </p>

              <div className="mt-5 grid gap-3">
                <Link
                  href="/discover"
                  className="rounded-2xl bg-neutral-900 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  와인 정보 보러 가기
                </Link>
                <Link
                  href="/notes"
                  className="rounded-2xl border border-black/10 px-4 py-3 text-center text-sm font-semibold text-neutral-900"
                >
                  내 테이스팅 노트 열기
                </Link>
              </div>
            </section>
          )}

          {!isLoading && !user && (
            <AuthCard
              title="내 노트를 쓰려면 로그인"
              description="와인 정보 검색은 분리된 페이지에서 둘러보고, 카탈로그에서 병을 선택한 뒤 envelope과 태그를 로그인 후 별도 노트 공간에 저장하세요."
            />
          )}
        </div>
      </section>
    </main>
  );
}

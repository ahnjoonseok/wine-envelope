"use client";

import Link from "next/link";
import { AuthCard } from "@/app/_components/auth-card";
import { useAuthSession } from "@/app/_components/auth-provider";

export function HomePage() {
  const { isLoading, user } = useAuthSession();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl items-center px-6 py-12">
      <div className="w-full">
        {isLoading && (
          <section className="rounded-[1.25rem] border border-black/8 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-neutral-600">
              로그인 상태를 확인하고 있어요...
            </p>
          </section>
        )}

        {!isLoading && user && (
          <section className="rounded-[1.25rem] border border-black/8 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
              Logged in
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-950">
              {user.email}
            </h1>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/discover"
                className="rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm font-semibold !text-white transition hover:bg-neutral-800 hover:!text-white focus-visible:!text-white active:!text-white"
              >
                와인 정보 보러 가기
              </Link>
              <Link
                href="/notes"
                className="rounded-xl border border-black/10 px-4 py-3 text-center text-sm font-semibold text-neutral-900"
              >
                내 테이스팅 노트 열기
              </Link>
            </div>
          </section>
        )}

        {!isLoading && !user && (
          <AuthCard
            title="로그인"
            description="로그인하면 내 테이스팅 노트를 저장하고 관리할 수 있어요."
          />
        )}
      </div>
    </main>
  );
}

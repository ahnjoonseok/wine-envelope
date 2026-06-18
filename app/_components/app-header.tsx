"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthSession } from "@/app/_components/auth-provider";

const navigation = [
  { href: "/", label: "홈" },
  { href: "/discover", label: "와인 찾기" },
  { href: "/notes", label: "내 노트" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { isLoading, signOut, user } = useAuthSession();
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSignOutError("");
    const error = await signOut();

    if (error) {
      setSignOutError(error);
    }
  }

  return (
    <header className="relative z-20 border-b border-black/8 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="space-y-1">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
              Wine Envelope
            </p>
            <h1 className="text-lg font-semibold text-neutral-950">
              Search and log your bottles
            </h1>
          </Link>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <nav className="flex flex-wrap gap-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    isActive
                      ? "bg-neutral-900 !text-white"
                      : "border border-black/10 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            {isLoading && <p>세션을 확인하고 있어요...</p>}

            {!isLoading && !user && (
              <p>내 테이스팅 노트는 로그인 후 `/notes`에서 관리할 수 있어요.</p>
            )}

            {!isLoading && user && (
              <>
                <p className="rounded-full border border-black/10 bg-neutral-100 px-3 py-1.5">
                  {user.email}
                </p>
                <button
                  className="rounded-full border border-black/10 px-3 py-1.5 text-neutral-900 transition hover:bg-neutral-100"
                  onClick={handleSignOut}
                  type="button"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>

          {signOutError && <p className="text-sm text-red-600">{signOutError}</p>}
        </div>
      </div>
    </header>
  );
}

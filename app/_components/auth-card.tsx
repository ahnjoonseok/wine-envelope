"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthCardProps = {
  description: string;
  title: string;
};

export function AuthCard({ description, title }: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeAction, setActiveAction] = useState<"sign-in" | "sign-up" | null>(
    null,
  );
  const [message, setMessage] = useState("");

  async function handleAuth(mode: "sign-in" | "sign-up") {
    setActiveAction(mode);
    setMessage("");

    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력해주세요.");
      setActiveAction(null);
      return;
    }

    const { error } =
      mode === "sign-up"
        ? await supabase.auth.signUp({
            email,
            password,
          })
        : await supabase.auth.signInWithPassword({
            email,
            password,
          });

    if (error) {
      setMessage(error.message);
      setActiveAction(null);
      return;
    }

    setMessage(
      mode === "sign-up"
        ? "회원가입이 완료됐어요. 이메일 확인이 필요할 수 있어요."
        : "로그인됐어요. 이제 개인 테이스팅 노트를 기록할 수 있어요.",
    );
    setActiveAction(null);
  }

  return (
    <section className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
          Personal Notes
        </p>
        <h2 className="text-2xl font-semibold text-neutral-950">{title}</h2>
        <p className="text-sm leading-6 text-neutral-600">{description}</p>
      </div>

      <div className="mt-6 space-y-3">
        <input
          className="w-full rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
          placeholder="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          className="w-full rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
          placeholder="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={activeAction !== null}
          onClick={() => handleAuth("sign-up")}
          type="button"
        >
          {activeAction === "sign-up" ? "가입 중..." : "회원가입"}
        </button>

        <button
          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={activeAction !== null}
          onClick={() => handleAuth("sign-in")}
          type="button"
        >
          {activeAction === "sign-in" ? "로그인 중..." : "로그인"}
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-2xl border border-black/8 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {message}
        </p>
      )}
    </section>
  );
}

"use client";

import { useActionState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-[#35403a]" htmlFor="email">
          Email
        </label>
        <input
          className="h-12 w-full rounded-md border border-[#c8d1cb] bg-white px-3 text-base shadow-sm outline-none transition focus:border-[#16372c] focus:ring-2 focus:ring-[#16372c]/15"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
        {state.errors?.email?.map((error) => (
          <p className="mt-2 text-sm text-[#a23833]" key={error}>{error}</p>
        ))}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[#35403a]" htmlFor="password">
          Password
        </label>
        <input
          className="h-12 w-full rounded-md border border-[#c8d1cb] bg-white px-3 text-base shadow-sm outline-none transition focus:border-[#16372c] focus:ring-2 focus:ring-[#16372c]/15"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.errors?.password?.map((error) => (
          <p className="mt-2 text-sm text-[#a23833]" key={error}>{error}</p>
        ))}
      </div>

      {state.message && (
        <p className="rounded-md border border-[#e7c8c5] bg-[#fff6f5] px-3 py-2 text-sm text-[#8c302b]" role="alert">
          {state.message}
        </p>
      )}

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#16372c] px-4 font-semibold text-white transition hover:bg-[#0e2a21] disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        <LockKeyhole aria-hidden="true" size={18} />
        {pending ? "Signing in..." : "Sign in"}
        {!pending && <ArrowRight aria-hidden="true" size={18} />}
      </button>
    </form>
  );
}

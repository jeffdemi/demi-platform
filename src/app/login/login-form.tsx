"use client";

import { useActionState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <input name="next" type="hidden" value={nextPath} />
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="email">
          Email
        </label>
        <input
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 text-base shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
        />
        {state.errors?.email?.map((error) => (
          <p className="mt-2 text-sm text-danger" key={error}>{error}</p>
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="block text-sm font-semibold text-muted-strong" htmlFor="password">
            Password
          </label>
          <Link className="text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <input
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 text-base shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.errors?.password?.map((error) => (
          <p className="mt-2 text-sm text-danger" key={error}>{error}</p>
        ))}
      </div>

      {state.message && (
        <p className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-strong" role="alert">
          {state.message}
        </p>
      )}

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand transition hover:bg-brand-strong disabled:cursor-wait disabled:opacity-65"
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

"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function AdminLogin() {
  const [error, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mx-auto mt-16 max-w-sm space-y-4 rounded-xl border border-line bg-card p-6">
      <h1 className="text-xl font-semibold">Operator login</h1>
      <label className="block text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          required
          autoFocus
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-full bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        Log in
      </button>
    </form>
  );
}

"use client";

// Restores the seed register (deletes every proposal, report, date change and review made since).
// Used before recording the demo. Needs the server's RESET_TOKEN, so a casual visitor cannot wipe it.

import { useState } from "react";
import { api } from "@/lib/api";
import { ErrorNote, inputClass, labelClass, secondaryButtonClass } from "./ui";

export function ResetDemo() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function reset() {
    if (
      !window.confirm(
        "Delete every change made since the seed data (proposals, reports, date changes, reviews)?",
      )
    )
      return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.reset(token.trim());
      setDone(true);
      setToken("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset the demo data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="max-w-md space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (token.trim() && !busy) void reset();
      }}
    >
      <label htmlFor="reset-token" className={labelClass}>
        Reset token
      </label>
      <input
        id="reset-token"
        type="password"
        autoComplete="off"
        className={inputClass}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <button type="submit" className={secondaryButtonClass} disabled={!token.trim() || busy}>
        {busy ? "Resetting…" : "Reset demo data"}
      </button>
      {error && <ErrorNote>{error}</ErrorNote>}
      {done && (
        <p role="status" className="text-sm text-emerald-800">
          Demo data restored to the seed. Reload any open pages.
        </p>
      )}
    </form>
  );
}

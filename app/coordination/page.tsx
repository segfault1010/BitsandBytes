"use client";

// Coordination shell (owner: C, using B's ConflictCard). Lists every flag and the works that could not be checked.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Conflict, Review, UncheckedProject } from "@/lib/types";

export default function CoordinationPage() {
  const [data, setData] = useState<{
    conflicts: (Conflict & { review: Review | null })[];
    unchecked: UncheckedProject[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.conflicts().then(setData, (e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p>Loading flags…</p>;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Coordination flags</h1>
      <ul className="space-y-3">
        {data.conflicts.map((c) => (
          <li key={c.id} className="border border-black/10 rounded p-3 text-sm">
            <div className="font-medium">
              {c.rule} · {c.severity} · confidence {c.confidence}
            </div>
            <p>{c.explanation}</p>
            <p className="text-black/70">Suggested: {c.suggestedAction}</p>
            {c.caveats.length > 0 && (
              <p className="text-black/60">Caveats: {c.caveats.join(" ")}</p>
            )}
          </li>
        ))}
      </ul>
      {data.unchecked.length > 0 && (
        <p className="text-sm text-black/70">
          Not checked: {data.unchecked.map((u) => `${u.projectId} (${u.reason})`).join("; ")}
        </p>
      )}
    </section>
  );
}

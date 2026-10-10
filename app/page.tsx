"use client";

// Registry shell (owner: C). Proves the API works end to end; replace with ProjectTable + filters + MapView.

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { ProjectSummary } from "@/lib/types";

export default function RegistryPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.projects().then(setProjects, (e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-700">Could not load projects: {error}</p>;
  if (!projects) return <p>Loading projects…</p>;

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Public works register</h1>
      <ul className="divide-y divide-black/10">
        {projects.map((p) => (
          <li key={p.id} className="py-2 flex flex-wrap gap-x-3 items-baseline">
            <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
              {p.id} · {p.title}
            </Link>
            <span className="text-sm text-black/60">
              {p.status} · {formatDate(p.plannedStart)} to {formatDate(p.plannedEnd)}
            </span>
            {p.overdue.overdue && (
              <span className="text-xs bg-red-100 text-red-800 px-1.5 rounded">
                OVERDUE {p.overdue.daysLate}d
              </span>
            )}
            {p.conflictCount > 0 && (
              <span className="text-xs bg-orange-100 text-orange-900 px-1.5 rounded">
                {p.conflictCount} flag(s)
              </span>
            )}
            {p.reportCount > 0 && (
              <span className="text-xs bg-blue-100 text-blue-900 px-1.5 rounded">
                {p.reportCount} report(s)
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

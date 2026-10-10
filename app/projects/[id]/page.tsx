"use client";

// Project page shell (owner: C). Replace with the full layout: details, HistoryTimeline, ReportForm, flags, small map.

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { ProjectDetail } from "@/lib/types";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.project(id).then(setDetail, (e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!detail) return <p>Loading…</p>;
  const { project, department, road, overdue, history, conflicts } = detail;

  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {project.id} · {project.title}
      </h1>
      <p>{project.purpose}</p>
      <p className="text-sm">
        {department?.name} · {road?.name} {project.location.fromM}–{project.location.toM} m ·{" "}
        {project.status} · {formatDate(project.plannedStart)} to {formatDate(project.plannedEnd)}
        {overdue.overdue && (
          <strong className="text-red-700"> · OVERDUE by {overdue.daysLate} days</strong>
        )}
      </p>
      <h2 className="font-semibold">Flags</h2>
      <ul className="list-disc pl-5 text-sm">
        {conflicts.map((c) => (
          <li key={c.id}>{c.explanation}</li>
        ))}
        {conflicts.length === 0 && <li>No coordination flags.</li>}
      </ul>
      <h2 className="font-semibold">History</h2>
      <ul className="list-disc pl-5 text-sm">
        {history.map((e) => (
          <li key={e.id}>
            {e.createdAt.slice(0, 10)} · {e.type}
            {e.type === "DATES_CHANGED" && ` · ${e.payload.reason}`}
            {e.type === "REPORT_ADDED" && ` · ${e.payload.description}`}
          </li>
        ))}
      </ul>
    </article>
  );
}

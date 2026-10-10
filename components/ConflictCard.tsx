"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatRange } from "@/lib/dates";
import { DRAFT_ID } from "@/lib/engine";
import { CONFIDENCE_CLASS, REVIEW_LABEL, RULE_LABEL, SEVERITY_CLASS } from "@/lib/labels";
import type { Conflict, Review } from "@/lib/types";
import { Badge, secondaryButtonClass } from "./ui";

interface Props {
  conflict: Conflict & { review?: Review | null };
  /** Project titles by id, for the links under the card. */
  titles?: Record<string, string>;
  /** Shown as a "Join window" button when the flag offers one (propose page). */
  onJoin?: (window: NonNullable<Conflict["joinWindow"]>) => void;
  /** Extra page-specific actions, e.g. review controls on the coordination page. */
  children?: ReactNode;
}

const SEVERITY_TEXT = { HIGH: "High", MEDIUM: "Medium", LOW: "Low", INFO: "Info" } as const;
const CONFIDENCE_TEXT = { HIGH: "high", MEDIUM: "medium", LOW: "low" } as const;

export function ConflictCard({ conflict: c, titles = {}, onJoin, children }: Props) {
  const coordinated = c.kind === "COORDINATED";
  const linked = c.projectIds.filter((id) => id !== DRAFT_ID);
  return (
    <article
      className={`rounded-lg border p-4 text-sm [overflow-wrap:anywhere] ${coordinated ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"}`}
      data-conflict-id={c.id}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">{RULE_LABEL[c.rule]}</h3>
        {coordinated ? (
          <Badge className="bg-blue-600 text-white border-blue-600">Coordinated</Badge>
        ) : (
          <Badge className={SEVERITY_CLASS[c.severity]}>{SEVERITY_TEXT[c.severity]} severity</Badge>
        )}
        <Badge className={CONFIDENCE_CLASS[c.confidence]}>
          Confidence: {CONFIDENCE_TEXT[c.confidence]}
        </Badge>
        {c.review && (
          <Badge className="bg-white text-slate-700 border-slate-300">
            {/* A stored OPEN review means someone reopened a reviewed flag. */}
            {c.review.status === "OPEN" ? "Reopened" : REVIEW_LABEL[c.review.status]}
          </Badge>
        )}
      </header>

      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-slate-700">
        <div>
          <dt className="inline text-slate-500">Shared stretch: </dt>
          <dd className="inline font-medium">
            {c.overlapM.fromM}–{c.overlapM.toM} m ({c.overlapM.lengthM} m)
          </dd>
        </div>
        {c.overlapDates && (
          <div>
            <dt className="inline text-slate-500">Overlapping dates: </dt>
            <dd className="inline font-medium">
              {formatRange(c.overlapDates.start, c.overlapDates.end)} ({c.overlapDates.days}{" "}
              {c.overlapDates.days === 1 ? "day" : "days"})
            </dd>
          </div>
        )}
        {c.gapDays !== undefined && (
          <div>
            <dt className="inline text-slate-500">Gap: </dt>
            <dd className="inline font-medium">
              {c.gapDays} {c.gapDays === 1 ? "day" : "days"}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-2 text-slate-800">{c.explanation}</p>
      <p className="mt-2 text-slate-700">
        <span className="font-medium">Suggested: </span>
        {c.suggestedAction}
      </p>

      {c.caveats.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
          {c.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      )}

      {c.review?.note && (
        <p className="mt-2 text-xs text-slate-600">
          Reviewer note: <q>{c.review.note}</q>
        </p>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-3">
        {linked.map((id) => (
          <Link key={id} href={`/projects/${id}`} className="text-sky-700 hover:underline">
            {id}
            {titles[id] ? ` · ${titles[id]}` : ""}
          </Link>
        ))}
        {onJoin && c.joinWindow && (
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => onJoin(c.joinWindow!)}
          >
            Join {c.joinWindow.projectId}&apos;s window (
            {formatRange(c.joinWindow.start, c.joinWindow.end)})
          </button>
        )}
        {children}
      </footer>
    </article>
  );
}

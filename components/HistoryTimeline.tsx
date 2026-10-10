"use client";

// The public, append-only history of one work: proposals, date changes, reports and reviews.

import { formatDate } from "@/lib/dates";
import { REPORT_CATEGORY_LABEL, RULE_LABEL } from "@/lib/labels";
import type { CivicEvent, ConflictRule, ISODate, ReviewStatus } from "@/lib/types";

const range = (start: ISODate | null, end: ISODate | null) =>
  `${formatDate(start, true)} – ${formatDate(end, true)}`;

const DOT: Record<CivicEvent["type"], string> = {
  PROJECT_PROPOSED: "bg-violet-500",
  DATES_CHANGED: "bg-amber-500",
  REPORT_ADDED: "bg-blue-500",
  CONFLICT_REVIEWED: "bg-slate-500",
};

const REVIEW_VERB: Record<ReviewStatus, string> = {
  OPEN: "reopened",
  ACKNOWLEDGED: "acknowledged",
  DISMISSED: "dismissed",
};

function EventText({ event: e }: { event: CivicEvent }) {
  switch (e.type) {
    case "PROJECT_PROPOSED":
      return (
        <>
          <p className="font-medium text-slate-900">Proposed to the register</p>
          {e.payload.justification && (
            <p className="text-slate-700">
              Justification: <q>{e.payload.justification}</q>
            </p>
          )}
        </>
      );
    case "DATES_CHANGED":
      return (
        <>
          <p className="font-medium text-slate-900">
            Dates changed: {range(e.payload.oldStart, e.payload.oldEnd)} →{" "}
            {range(e.payload.newStart, e.payload.newEnd)}
          </p>
          <p className="text-slate-700">
            Reason: <q>{e.payload.reason}</q>
          </p>
        </>
      );
    case "REPORT_ADDED":
      return (
        <p className="text-slate-800">
          <span className="font-medium text-slate-900">Citizen report (unverified): </span>
          {REPORT_CATEGORY_LABEL[e.payload.category]}: {e.payload.description}
          {e.payload.name && <span className="text-slate-500"> (from {e.payload.name})</span>}
        </p>
      );
    case "CONFLICT_REVIEWED": {
      const rule = e.payload.conflictId.split(":")[0] as ConflictRule;
      return (
        <>
          <p className="font-medium text-slate-900">
            Flag {REVIEW_VERB[e.payload.status]}
            {RULE_LABEL[rule] && (
              <span className="font-normal text-slate-600"> ({RULE_LABEL[rule]})</span>
            )}
          </p>
          {e.payload.note && (
            <p className="text-slate-700">
              Note: <q>{e.payload.note}</q>
            </p>
          )}
        </>
      );
    }
  }
}

export function HistoryTimeline({ events }: { events: CivicEvent[] }) {
  if (events.length === 0)
    return (
      <p className="text-sm text-slate-600">No changes have been recorded for this work yet.</p>
    );

  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <ol className="ml-1.5 border-l border-slate-200 text-sm [overflow-wrap:anywhere]">
      {sorted.map((e) => (
        <li key={e.id} className="relative pb-4 pl-5 last:pb-0">
          <span
            aria-hidden="true"
            className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${DOT[e.type]}`}
          />
          <time dateTime={e.createdAt} className="block text-xs text-slate-500">
            {formatDate(e.createdAt.slice(0, 10), true)}
          </time>
          <EventText event={e} />
        </li>
      ))}
    </ol>
  );
}

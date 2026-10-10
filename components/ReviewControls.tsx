"use client";

// Review of one coordination flag. Officers get Acknowledge / Dismiss / Reopen; residents see
// the current review status read-only.

import { useId, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { REVIEW_LABEL } from "@/lib/labels";
import type { Conflict, Review, ReviewStatus } from "@/lib/types";
import { ErrorNote, inputClass, labelClass, secondaryButtonClass } from "./ui";

type ReviewedConflict = Conflict & { review: Review | null };

const MIN_DISMISS_NOTE = 10;
const ACTION_LABEL: Record<ReviewStatus, string> = {
  ACKNOWLEDGED: "Acknowledge",
  DISMISSED: "Dismiss",
  OPEN: "Reopen",
};
const DONE_LABEL: Record<ReviewStatus, string> = {
  ACKNOWLEDGED: "Saved: flag acknowledged.",
  DISMISSED: "Saved: flag dismissed.",
  OPEN: "Saved: flag reopened.",
};

/** Read-only line for residents. */
export function ReviewStatusNote({ conflict }: { conflict: ReviewedConflict }) {
  if (conflict.kind === "COORDINATED") return null;
  const r = conflict.review;
  return (
    <p className="w-full text-xs text-slate-600">
      Review status:{" "}
      <span className="font-medium text-slate-800">
        {r && r.status !== "OPEN" ? REVIEW_LABEL[r.status] : "Waiting for an officer to review"}
      </span>
      {r && r.status !== "OPEN" && ` on ${formatDate(r.reviewedAt.slice(0, 10), true)}`}
    </p>
  );
}

interface Props {
  conflict: ReviewedConflict;
  /** Called after a review is saved, to re-fetch the list. Should not throw. */
  onReviewed: () => Promise<void>;
}

export function ReviewControls({ conflict, onReviewed }: Props) {
  const id = useId();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (conflict.kind === "COORDINATED") return null;
  const current = conflict.review?.status ?? "OPEN";
  const actions = (["ACKNOWLEDGED", "DISMISSED", "OPEN"] as const).filter((s) => s !== current);

  async function review(status: ReviewStatus) {
    setDone(null);
    if (status === "DISMISSED" && note.trim().length < MIN_DISMISS_NOTE) {
      setError(`To dismiss, explain why in the note (at least ${MIN_DISMISS_NOTE} characters).`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.review(conflict.id, { status, note });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the review. Please try again.");
      setSubmitting(false);
      return;
    }
    setNote("");
    setDone(DONE_LABEL[status]);
    await onReviewed();
    setSubmitting(false);
  }

  return (
    <div className="w-full space-y-2 border-t border-slate-200 pt-3">
      <p className="text-xs text-slate-600">
        Review status: <span className="font-medium text-slate-800">{REVIEW_LABEL[current]}</span>
      </p>
      <div>
        <label htmlFor={`${id}-note`} className={labelClass}>
          Reviewer note
        </label>
        <input
          id={`${id}-note`}
          className={inputClass}
          maxLength={500}
          value={note}
          aria-describedby={`${id}-hint`}
          onChange={(e) => setNote(e.target.value)}
        />
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          Public and kept in the history. Required to dismiss (at least {MIN_DISMISS_NOTE}{" "}
          characters).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((status) => (
          <button
            key={status}
            type="button"
            className={secondaryButtonClass}
            disabled={submitting}
            onClick={() => review(status)}
          >
            {ACTION_LABEL[status]}
          </button>
        ))}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {done && (
        <p role="status" className="text-xs text-emerald-800">
          {done}
        </p>
      )}
    </div>
  );
}

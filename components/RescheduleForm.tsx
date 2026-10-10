"use client";

// Officer-only: change a work's planned dates. The reason is public and kept in the history.

import { useId, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";
import { ErrorNote, buttonClass, inputClass, labelClass } from "./ui";

const MIN_REASON = 10;
const MAX_REASON = 500;

interface Props {
  project: Project;
  /** Called after the dates are saved, to re-fetch the page. Should not throw. */
  onRescheduled: () => Promise<void>;
}

export function RescheduleForm({ project, onRescheduled }: Props) {
  const id = useId();
  const [newStart, setNewStart] = useState(project.plannedStart ?? "");
  const [newEnd, setNewEnd] = useState(project.plannedEnd ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Saving the current dates again would add a meaningless "X → X" entry to the public history.
  const unchanged =
    newStart === (project.plannedStart ?? "") && newEnd === (project.plannedEnd ?? "");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await api.reschedule(project.id, { newStart, newEnd: newEnd || null, reason });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the new dates. Please try again.",
      );
      setSubmitting(false);
      return;
    }
    setReason("");
    setSaved(true);
    await onRescheduled();
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p id={`${id}-note`} className="text-sm text-slate-600">
        The reason is public: residents see it on this page, and it stays in the history.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-start`} className={labelClass}>
            New start date
          </label>
          <input
            id={`${id}-start`}
            type="date"
            className={inputClass}
            required
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className={labelClass}>
            New end date
          </label>
          <input
            id={`${id}-end`}
            type="date"
            className={inputClass}
            min={newStart || undefined}
            value={newEnd}
            aria-describedby={`${id}-end-hint`}
            onChange={(e) => setNewEnd(e.target.value)}
          />
          <p id={`${id}-end-hint`} className="mt-1 text-xs text-slate-500">
            Leave empty if the end date is not known yet.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-reason`} className={labelClass}>
          Reason for the change
        </label>
        <textarea
          id={`${id}-reason`}
          className={inputClass}
          rows={3}
          required
          minLength={MIN_REASON}
          maxLength={MAX_REASON}
          value={reason}
          aria-describedby={`${id}-note ${id}-reason-hint`}
          onChange={(e) => setReason(e.target.value)}
        />
        <p id={`${id}-reason-hint`} className="mt-1 text-xs text-slate-500">
          At least {MIN_REASON} characters, for example what caused the delay.
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {saved && (
        <p
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          Dates updated. The change and its reason are now in the history.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass} disabled={submitting || unchanged}>
          {submitting ? "Saving…" : "Save new dates"}
        </button>
        {unchanged && !saved && (
          <span className="text-xs text-slate-500">Change a date to save.</span>
        )}
      </div>
    </form>
  );
}

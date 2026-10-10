"use client";

// Lets anyone add a public, unverified report about a work. No account or personal details needed.

import { useId, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { REPORT_CATEGORY_LABEL } from "@/lib/labels";
import type { ReportCategory } from "@/lib/types";
import { ErrorNote, buttonClass, inputClass, labelClass } from "./ui";

const CATEGORIES = Object.keys(REPORT_CATEGORY_LABEL) as ReportCategory[];
const MIN = 10;
const MAX = 1000;

interface Props {
  projectId: string;
  /** Called after a report is saved, to re-fetch the page. Should not throw. */
  onSubmitted: () => Promise<void>;
}

export function ReportForm({ projectId, onSubmitted }: Props) {
  const id = useId();
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  const length = description.trim().length;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) return setError("Choose what the report is about.");
    setSubmitting(true);
    setError(null);
    setThanks(false);
    try {
      await api.addReport(projectId, {
        category,
        description,
        ...(name.trim() ? { name: name.trim() } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the report. Please try again.");
      setSubmitting(false);
      return;
    }
    setCategory("");
    setDescription("");
    setName("");
    setThanks(true);
    await onSubmitted();
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p id={`${id}-note`} className="text-sm text-slate-600">
        Reports are public and unverified: they appear on this page for everyone to read. Personal
        details are not needed, so please leave out phone numbers and addresses.
      </p>

      <div>
        <label htmlFor={`${id}-category`} className={labelClass}>
          What is the report about?
        </label>
        <select
          id={`${id}-category`}
          className={inputClass}
          value={category}
          required
          onChange={(e) => setCategory(e.target.value as ReportCategory | "")}
        >
          <option value="">Choose a category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {REPORT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-description`} className={labelClass}>
          What did you see?
        </label>
        <textarea
          id={`${id}-description`}
          className={inputClass}
          rows={4}
          required
          minLength={MIN}
          maxLength={MAX}
          value={description}
          aria-describedby={`${id}-count ${id}-note`}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p
          id={`${id}-count`}
          className={`mt-1 text-xs ${length > 0 && length < MIN ? "text-red-700" : "text-slate-500"}`}
        >
          {length}/{MAX} characters (at least {MIN})
        </p>
      </div>

      <div>
        <label htmlFor={`${id}-name`} className={labelClass}>
          Your name (optional)
        </label>
        <input
          id={`${id}-name`}
          className={inputClass}
          maxLength={60}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {thanks && (
        <p
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          Thanks, your report is now on this page.
        </p>
      )}

      <button type="submit" className={buttonClass} disabled={submitting}>
        {submitting ? "Sending…" : "Add report"}
      </button>
    </form>
  );
}

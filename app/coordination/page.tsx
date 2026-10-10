"use client";

// Coordination: every flag the engine raises across the register, with officer review controls,
// plus the works that could not be checked because data is missing.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConflictCard } from "@/components/ConflictCard";
import { ReviewControls, ReviewStatusNote } from "@/components/ReviewControls";
import { useRole } from "@/components/RoleToggle";
import { ErrorNote, Loading, inputClass, labelClass } from "@/components/ui";
import { api } from "@/lib/api";
import { RULE_LABEL } from "@/lib/labels";
import type { Conflict, ConflictRule, Review, UncheckedProject } from "@/lib/types";

type ReviewedConflict = Conflict & { review: Review | null };
type ReviewFilter = "" | "NEEDS_REVIEW" | "REVIEWED";

const RULES = Object.keys(RULE_LABEL) as ConflictRule[];

const isReviewed = (c: ReviewedConflict) => !!c.review && c.review.status !== "OPEN";
/** A real conflict (not coordinated, not emergency info) that nobody has reviewed yet. */
const needsReview = (c: ReviewedConflict) =>
  c.kind === "CONFLICT" && c.severity !== "INFO" && !isReviewed(c);

export default function CoordinationPage() {
  const role = useRole();
  const [data, setData] = useState<{
    conflicts: ReviewedConflict[];
    unchecked: UncheckedProject[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [rule, setRule] = useState<ConflictRule | "">("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("");

  const requestSeq = useRef(0);

  /** Fetches the flags. Never rejects: errors go into `error`. Only the latest request wins. */
  const load = useCallback(() => {
    const seq = ++requestSeq.current;
    return api.conflicts().then(
      (d) => {
        if (seq !== requestSeq.current) return;
        setData(d);
        setError(null);
      },
      (e: Error) => {
        if (seq === requestSeq.current) setError(e.message);
      },
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.projects().then(
      (ps) => setTitles(Object.fromEntries(ps.map((p) => [p.id, p.title]))),
      () => {},
    );
  }, []);

  const shown = useMemo(
    () =>
      (data?.conflicts ?? []).filter(
        (c) =>
          (!rule || c.rule === rule) &&
          (reviewFilter === "" ||
            (reviewFilter === "NEEDS_REVIEW" && needsReview(c)) ||
            (reviewFilter === "REVIEWED" && isReviewed(c))),
      ),
    [data, rule, reviewFilter],
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Coordination</h1>
        <p className="mt-1 max-w-3xl text-slate-700">
          Possible coordination conflicts between works on the same stretch of road. A flag is a
          prompt for human review, not a finding of fault.{" "}
          <Link href="/about" className="text-sky-700 hover:underline">
            How flags work: method and limits
          </Link>
          .
        </p>
      </header>

      {!data && error && <ErrorNote>Could not load the flags: {error}</ErrorNote>}
      {!data && !error && <Loading label="Loading flags…" />}

      {data && (
        <>
          {error && <ErrorNote>Could not refresh the flags: {error}</ErrorNote>}

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Count
              label="Open conflicts, need review"
              value={data.conflicts.filter(needsReview).length}
            />
            <Count label="Reviewed" value={data.conflicts.filter(isReviewed).length} />
            <Count
              label="Coordinated works"
              value={data.conflicts.filter((c) => c.kind === "COORDINATED").length}
            />
            <Count label="Not checked (missing data)" value={data.unchecked.length} />
          </dl>

          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div>
              <label htmlFor="filter-rule" className={labelClass}>
                Rule
              </label>
              <select
                id="filter-rule"
                className={inputClass}
                value={rule}
                onChange={(e) => setRule(e.target.value as ConflictRule | "")}
              >
                <option value="">All rules</option>
                {RULES.map((r) => (
                  <option key={r} value={r}>
                    {RULE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-review" className={labelClass}>
                Review
              </label>
              <select
                id="filter-review"
                className={inputClass}
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value as ReviewFilter)}
              >
                <option value="">All flags</option>
                <option value="NEEDS_REVIEW">Needs review</option>
                <option value="REVIEWED">Reviewed</option>
              </select>
            </div>
          </div>

          {role === "resident" && (
            <p className="text-sm text-slate-600">
              Officers acknowledge or dismiss flags. Switch to the Officer view in the header to try
              it (demo only).
            </p>
          )}

          <p className="text-sm text-slate-600" aria-live="polite">
            Showing {shown.length} of {data.conflicts.length} flags.
          </p>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              {data.conflicts.length === 0
                ? "No coordination flags in the register right now."
                : "No flags match these filters."}
            </p>
          ) : (
            <ul className="space-y-3">
              {shown.map((c) => (
                <li key={c.id}>
                  <ConflictCard conflict={c} titles={titles}>
                    {role === "officer" ? (
                      <ReviewControls conflict={c} onReviewed={load} />
                    ) : (
                      <ReviewStatusNote conflict={c} />
                    )}
                  </ConflictCard>
                </li>
              ))}
            </ul>
          )}

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Not checked (missing data)</h2>
            {data.unchecked.length === 0 ? (
              <p className="text-sm text-slate-600">Every work in the register could be checked.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  These works could not be compared with others until the missing data is added.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {data.unchecked.map((u) => (
                    <li key={u.projectId}>
                      <Link
                        href={`/projects/${u.projectId}`}
                        className="text-sky-700 hover:underline"
                      >
                        {u.projectId}
                        {titles[u.projectId] ? ` · ${titles[u.projectId]}` : ""}
                      </Link>
                      : {u.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="text-2xl font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

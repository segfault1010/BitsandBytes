"use client";

// Propose a work: every change re-checks the draft against the register (nothing is saved),
// shows explained flags and the shared stretch on the map, and offers "join the other window".

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConflictCard } from "@/components/ConflictCard";
import { RoadMap } from "@/components/RoadMap";
import { RoadStrip } from "@/components/RoadStrip";
import { setRole, useRole } from "@/components/RoleToggle";
import { overlapSegments, projectSegments } from "@/components/segments";
import {
  buttonClass,
  ErrorNote,
  inputClass,
  labelClass,
  Loading,
  secondaryButtonClass,
} from "@/components/ui";
import { useMeta } from "@/components/useMeta";
import { api, ApiRequestError } from "@/lib/api";
import { DEFAULT_CONFIG, DRAFT_ID, intervalOf } from "@/lib/engine";
import { MAP_COLOR, WORK_TYPE_LABEL } from "@/lib/labels";
import { isOpenFlag } from "@/lib/registry";
import { addDays, daysBetween, formatDate, isISODate, toDay } from "@/lib/dates";
import type { CheckResult, Project, ProjectDraft, ProjectSummary, WorkType } from "@/lib/types";

interface FormState {
  title: string;
  purpose: string;
  departmentId: string;
  contractor: string;
  workType: WorkType;
  roadId: string;
  fromM: string;
  toM: string;
  plannedStart: string;
  plannedEnd: string;
  locationApproximate: boolean;
  datesTentative: boolean;
  isEmergency: boolean;
  coordinatedWith: string[];
}

const EMPTY: FormState = {
  title: "",
  purpose: "",
  departmentId: "",
  contractor: "",
  workType: "EXCAVATION",
  roadId: "",
  fromM: "",
  toM: "",
  plannedStart: "",
  plannedEnd: "",
  locationApproximate: false,
  datesTentative: false,
  isEmergency: false,
  coordinatedWith: [],
};

/** The scenario from the demo script: a cable dig on a recently resurfaced road. */
const DEMO_EXAMPLE: FormState = {
  ...EMPTY,
  title: "Underground power cable laying",
  purpose: "Lay a new 11 kV cable to relieve an overloaded feeder before the next monsoon.",
  departmentId: "D-POWER",
  contractor: "Demo Electricals (fictional)",
  roadId: "R1",
  fromM: "500",
  toM: "1000",
  plannedStart: "2026-10-25",
  plannedEnd: "2026-11-05",
};

/** The latest check response, tagged with the draft it was for. */
interface Checked {
  key: string;
  result?: CheckResult;
  error?: string;
}

type CheckStatus = "idle" | "checking" | "done" | "error";

/** Turns the form into a draft once the fields the engine needs are filled in. */
function toDraft(f: FormState): ProjectDraft | null {
  const fromM = Number(f.fromM);
  const toM = Number(f.toM);
  if (f.title.trim().length < 3 || !f.departmentId || !f.roadId || !f.plannedStart) return null;
  // Date inputs accept 5–6 digit years while typing; only check once both dates are real ISO dates.
  if (!isISODate(f.plannedStart) || (f.plannedEnd && !isISODate(f.plannedEnd))) return null;
  if (f.fromM === "" || f.toM === "" || !Number.isFinite(fromM) || !Number.isFinite(toM))
    return null;
  return {
    title: f.title.trim(),
    purpose: f.purpose.trim() || "Not stated",
    departmentId: f.departmentId,
    contractor: f.contractor.trim() || "To be appointed",
    contactName: "Not stated",
    contactPhone: "Not stated",
    workType: f.workType,
    location: { roadId: f.roadId, fromM, toM },
    plannedStart: f.plannedStart,
    plannedEnd: f.plannedEnd || null,
    locationApproximate: f.locationApproximate,
    datesTentative: f.datesTentative,
    isEmergency: f.isEmergency,
    coordinatedWith: f.coordinatedWith,
  };
}

export default function ProposePage() {
  const role = useRole();
  const { meta, error: metaError } = useMeta();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Project | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    api.projects().then(setProjects, () => setProjects([]));
  }, [saved]);

  const draft = useMemo(() => toDraft(form), [form]);
  const draftKey = draft ? JSON.stringify(draft) : "";

  // Live check: debounced, and responses for an older draft are ignored.
  useEffect(() => {
    if (!draftKey) return;
    const seq = ++requestSeq.current;
    const timer = setTimeout(() => {
      api.checkDraft(JSON.parse(draftKey) as ProjectDraft).then(
        (result) => seq === requestSeq.current && setChecked({ key: draftKey, result }),
        (e: Error) => seq === requestSeq.current && setChecked({ key: draftKey, error: e.message }),
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [draftKey]);

  const current = draftKey && checked?.key === draftKey ? checked : null;
  const status: CheckStatus = !draftKey
    ? "idle"
    : !current
      ? "checking"
      : current.error
        ? "error"
        : "done";
  // While re-checking, keep showing the previous flags so the page does not flicker.
  const result = draftKey ? checked?.result : undefined;
  const conflicts = result?.conflicts ?? [];
  const openFlags = conflicts.filter(isOpenFlag);
  const titles = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.title])),
    [projects],
  );
  const road = meta?.roads.find((r) => r.id === form.roadId);
  const needsJustification = openFlags.length > 0;
  const canSubmit =
    !!draft &&
    status === "done" &&
    !submitting &&
    (!needsJustification || justification.trim().length >= 10);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaved(null);
    setSubmitError(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const joinWindow = (w: { projectId: string; start: string; end: string }) => {
    // Never move a proposal into the past: start the shared window no earlier than the demo date.
    const start = meta && w.start < meta.asOf ? meta.asOf : w.start;
    setSaved(null);
    setSubmitError(null);
    setForm((f) => ({
      ...f,
      plannedStart: start,
      plannedEnd: w.end,
      coordinatedWith: f.coordinatedWith.includes(w.projectId)
        ? f.coordinatedWith
        : [...f.coordinatedWith, w.projectId],
    }));
  };

  /**
   * Moves the proposal to the suggested start, keeping its duration. Coordination links to works
   * whose dates no longer overlap the new window are dropped, so the record stays truthful.
   */
  const applySuggestedStart = (start: string) => {
    setSaved(null);
    setSubmitError(null);
    setForm((f) => {
      const end =
        f.plannedEnd && f.plannedStart
          ? addDays(start, daysBetween(f.plannedStart, f.plannedEnd))
          : f.plannedEnd;
      const newStart = toDay(start);
      const newEnd = toDay(end || start);
      const stillShared = (id: string) => {
        const other = projects.find((p) => p.id === id);
        const iv = other && intervalOf(other, meta?.config ?? DEFAULT_CONFIG);
        return !!iv && toDay(iv.start) <= newEnd && toDay(iv.end) >= newStart;
      };
      return {
        ...f,
        plannedStart: start,
        plannedEnd: end,
        coordinatedWith: f.coordinatedWith.filter(stillShared),
      };
    });
  };

  async function submit() {
    if (!draft) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { project } = await api.submitDraft(
        draft,
        needsJustification ? justification.trim() : undefined,
      );
      setSaved(project);
      setForm(EMPTY);
      setJustification("");
    } catch (e) {
      // The register changed since the last check (e.g. another officer added a work): show the
      // fresh flags so the justification box appears.
      if (e instanceof ApiRequestError && e.code === "JUSTIFICATION_REQUIRED" && draftKey) {
        const fresh = e.body.conflicts as CheckResult["conflicts"] | undefined;
        if (fresh)
          setChecked({
            key: draftKey,
            result: {
              conflicts: fresh,
              unchecked: [],
              suggestedStart: (e.body.suggestedStart as string | null | undefined) ?? null,
            },
          });
      }
      setSubmitError(
        e instanceof ApiRequestError ? e.message : "Could not submit. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (metaError) return <ErrorNote>Could not load the register: {metaError}</ErrorNote>;
  if (!meta) return <Loading />;

  if (role !== "officer") {
    return (
      <section className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-semibold">Propose a work</h1>
        <p className="text-slate-700">
          Department officers use this page to check a planned dig against everything already on the
          register, before it is approved.
        </p>
        <button type="button" className={buttonClass} onClick={() => setRole("officer")}>
          Switch to Officer view (demo)
        </button>
      </section>
    );
  }

  const roadSegments = road
    ? [
        ...projectSegments(
          projects.filter((p) => p.location.roadId === road.id),
          { flaggedIds: new Set(openFlags.flatMap((c) => c.projectIds)) },
        ),
        ...(draft && draft.location.toM > draft.location.fromM
          ? [
              {
                key: "draft",
                roadId: road.id,
                fromM: draft.location.fromM,
                toM: Math.min(draft.location.toM, road.lengthM),
                color: MAP_COLOR.draft,
                weight: 5,
                dashArray: "8 6",
                tooltip: "Proposed work",
              },
            ]
          : []),
        ...overlapSegments(conflicts),
      ]
    : [];

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Propose a work</h1>
          <p className="text-slate-600 text-sm">
            Check before you dig: every change is checked against the register. Nothing is saved
            until you submit.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setSaved(null);
            setJustification("");
            setForm(DEMO_EXAMPLE);
          }}
        >
          Fill in demo example
        </button>
      </header>

      {saved && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Submitted as <strong>{saved.id}</strong> with status Proposed.{" "}
          <Link href={`/projects/${saved.id}`} className="font-medium underline">
            Open its public page
          </Link>{" "}
          or see it on the{" "}
          <Link href="/coordination" className="font-medium underline">
            coordination page
          </Link>
          .
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) void submit();
          }}
        >
          <div>
            <label className={labelClass} htmlFor="title">
              Work title
            </label>
            <input
              id="title"
              className={inputClass}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Water main replacement"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="department">
                Department
              </label>
              <select
                id="department"
                className={inputClass}
                value={form.departmentId}
                onChange={(e) => set("departmentId", e.target.value)}
              >
                <option value="">Choose…</option>
                {meta.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="workType">
                Type of work
              </label>
              <select
                id="workType"
                className={inputClass}
                value={form.workType}
                onChange={(e) => set("workType", e.target.value as WorkType)}
              >
                {(Object.keys(WORK_TYPE_LABEL) as WorkType[]).map((w) => (
                  <option key={w} value={w}>
                    {WORK_TYPE_LABEL[w]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className={labelClass}>Location</legend>
            <select
              aria-label="Road"
              className={inputClass}
              value={form.roadId}
              onChange={(e) => set("roadId", e.target.value)}
            >
              <option value="">Choose a road…</option>
              {meta.roads.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.lengthM} m)
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1" htmlFor="fromM">
                  From (metres along the road)
                </label>
                <input
                  id="fromM"
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  value={form.fromM}
                  onChange={(e) => set("fromM", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" htmlFor="toM">
                  To (metres)
                </label>
                <input
                  id="toM"
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  value={form.toM}
                  onChange={(e) => set("toM", e.target.value)}
                />
              </div>
            </div>
            {road && (
              <p className="text-xs text-slate-500">
                {road.name} runs from 0 m to {road.lengthM} m.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.locationApproximate}
                onChange={(e) => set("locationApproximate", e.target.checked)}
              />
              Location is approximate
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className={labelClass}>Dates</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1" htmlFor="start">
                  Start
                </label>
                <input
                  id="start"
                  type="date"
                  className={inputClass}
                  value={form.plannedStart}
                  onChange={(e) => set("plannedStart", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" htmlFor="end">
                  End (optional)
                </label>
                <input
                  id="end"
                  type="date"
                  className={inputClass}
                  value={form.plannedEnd}
                  onChange={(e) => set("plannedEnd", e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.datesTentative}
                  onChange={(e) => set("datesTentative", e.target.checked)}
                />
                Dates are tentative
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isEmergency}
                  onChange={(e) => set("isEmergency", e.target.checked)}
                />
                Emergency work
              </label>
            </div>
            {form.coordinatedWith.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-600">Coordinated with:</span>
                {form.coordinatedWith.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-900"
                  >
                    {id}
                    <button
                      type="button"
                      aria-label={`Remove coordination with ${id}`}
                      className="text-blue-700 hover:text-blue-950"
                      onClick={() =>
                        set(
                          "coordinatedWith",
                          form.coordinatedWith.filter((x) => x !== id),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="purpose">
                Purpose (shown to residents)
              </label>
              <textarea
                id="purpose"
                rows={2}
                className={inputClass}
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
                placeholder="Why is this work needed?"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="contractor">
                Contractor (optional)
              </label>
              <input
                id="contractor"
                className={inputClass}
                value={form.contractor}
                onChange={(e) => set("contractor", e.target.value)}
              />
            </div>
          </div>

          {needsJustification && (
            <div>
              <label className={labelClass} htmlFor="justification">
                Justification for going ahead despite {openFlags.length} open{" "}
                {openFlags.length === 1 ? "flag" : "flags"}
              </label>
              <textarea
                id="justification"
                rows={3}
                className={inputClass}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why can this not wait or be combined? This is kept in the public history."
              />
              <p className="mt-1 text-xs text-slate-500">
                At least 10 characters. Kept in the project&apos;s public history.
              </p>
            </div>
          )}

          {submitError && <ErrorNote>{submitError}</ErrorNote>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClass} disabled={!canSubmit}>
              {submitting ? "Submitting…" : "Submit to register"}
            </button>
            {!draft && (
              <span className="text-xs text-slate-500">
                Fill in title, department, road, metres and a valid start date to check.
              </span>
            )}
          </div>
        </form>

        <div className="space-y-4">
          {road ? (
            <>
              <RoadMap
                roads={meta.roads}
                segments={roadSegments}
                focusRoadIds={[road.id]}
                height={300}
              />
              <RoadStrip
                road={road}
                projects={projects.filter((p) => p.location.roadId === road.id)}
                conflicts={conflicts}
                asOf={meta.asOf}
                draft={
                  draft && draft.location.roadId === road.id
                    ? {
                        ...draft,
                        id: DRAFT_ID,
                        status: "PROPOSED",
                        actualStart: null,
                        actualEnd: null,
                      }
                    : null
                }
                height={220}
              />
            </>
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
              Choose a road to see it on the map.
            </div>
          )}
          <CheckSummary
            status={status}
            error={current?.error}
            openCount={openFlags.length}
            total={conflicts.length}
            hasDraft={!!draft}
          />
          {status === "done" && openFlags.length > 0 && (
            <SuggestedStart start={result?.suggestedStart ?? null} onUse={applySuggestedStart} />
          )}
          {result?.unchecked.map((u) => (
            <p key={u.projectId} className="text-sm text-slate-600">
              {u.reason}
            </p>
          ))}
          {conflicts.map((c) => (
            <ConflictCard
              key={c.id}
              // A window that has already ended cannot be joined.
              conflict={
                c.joinWindow && c.joinWindow.end < meta.asOf ? { ...c, joinWindow: undefined } : c
              }
              titles={titles}
              onJoin={joinWindow}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CheckSummary({
  status,
  error,
  openCount,
  total,
  hasDraft,
}: {
  status: CheckStatus;
  error?: string;
  openCount: number;
  total: number;
  hasDraft: boolean;
}) {
  if (!hasDraft)
    return <p className="text-sm text-slate-500">Flags appear here as you fill in the form.</p>;
  if (status === "error") return <ErrorNote>{error}</ErrorNote>;
  const checking = status !== "done";
  return (
    <p className="text-sm font-medium text-slate-800" aria-live="polite">
      {checking && <span className="mr-2 text-slate-500">Checking…</span>}
      {!checking &&
        total === 0 &&
        "No flags: nothing else is planned on this stretch in an overlapping or nearby window."}
      {!checking &&
        total > 0 &&
        openCount === 0 &&
        `All ${total} ${total === 1 ? "match is" : "matches are"} coordinated or for information only.`}
      {!checking &&
        openCount > 0 &&
        `${openCount} ${openCount === 1 ? "flag needs" : "flags need"} attention before this work goes ahead.`}
    </p>
  );
}

function SuggestedStart({
  start,
  onUse,
}: {
  start: string | null;
  onUse: (start: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      {start ? (
        <>
          <span>
            Earliest start with no open flags on this stretch:{" "}
            <strong>{formatDate(start, true)}</strong>
          </span>
          <button type="button" className={secondaryButtonClass} onClick={() => onUse(start)}>
            Use this start date
          </button>
        </>
      ) : (
        <span className="text-slate-600">
          No start date in the two years after the proposed start clears every flag here.
          Coordinate, or record a justification.
        </span>
      )}
    </div>
  );
}

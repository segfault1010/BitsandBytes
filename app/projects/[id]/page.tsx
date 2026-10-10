"use client";

// Project page: everything public about one work, its coordination flags, its history of
// changes, and the citizen report form. Officers can also reschedule it.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ConflictCard } from "@/components/ConflictCard";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { ReportForm } from "@/components/ReportForm";
import { RescheduleForm } from "@/components/RescheduleForm";
import { RoadMap } from "@/components/RoadMap";
import { useRole } from "@/components/RoleToggle";
import { overlapSegments, projectSegments } from "@/components/segments";
import { ErrorNote, Loading, OverdueBadge, StatusBadge } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { WORK_TYPE_LABEL } from "@/lib/labels";
import type { ProjectDetail } from "@/lib/types";

interface LoadError {
  id: string;
  message: string;
  notFound: boolean;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const role = useRole();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const requestSeq = useRef(0);

  /** Fetches the project. Never rejects: errors go into `error`. Only the latest request wins. */
  const load = useCallback(() => {
    const seq = ++requestSeq.current;
    return api.project(id).then(
      (d) => {
        if (seq !== requestSeq.current) return;
        setDetail(d);
        setError(null);
      },
      (e: Error) => {
        if (seq !== requestSeq.current) return;
        setError({
          id,
          message: e.message,
          notFound: e instanceof ApiRequestError && e.status === 404,
        });
      },
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Titles for the links under each flag. Optional: without them the cards show ids only.
  useEffect(() => {
    api.projects().then(
      (ps) => setTitles(Object.fromEntries(ps.map((p) => [p.id, p.title]))),
      () => {},
    );
  }, []);

  // Ignore results that belong to a previous id while the new one loads.
  const current = detail?.project.id === id ? detail : null;
  const currentError = error?.id === id ? error : null;

  if (!current) {
    if (currentError?.notFound)
      return (
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">Work not found</h1>
          <p className="text-slate-700">
            There is no work with the id <strong>{id}</strong> in the register. It may have been
            mistyped.
          </p>
          <Link href="/" className="text-sky-700 hover:underline">
            Back to the register
          </Link>
        </section>
      );
    if (currentError)
      return <ErrorNote>Could not load this work: {currentError.message}</ErrorNote>;
    return <Loading label="Loading work…" />;
  }

  const { project, road, overdue, history, conflicts, reports } = current;
  const canReschedule =
    role === "officer" && project.status !== "COMPLETED" && project.status !== "CANCELLED";

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-sky-700 hover:underline">
          ← Back to the register
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          <span className="text-slate-500">{project.id} · </span>
          {project.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={project.status} />
          {overdue.overdue && (
            <>
              <OverdueBadge daysLate={overdue.daysLate} />
              <span className="text-slate-700">
                Planned end was {formatDate(project.plannedEnd, true)}.
              </span>
            </>
          )}
        </div>
        {currentError && <ErrorNote>Could not refresh this page: {currentError.message}</ErrorNote>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Details detail={current} />
        {road && (
          <div>
            <RoadMap
              roads={[road]}
              segments={[
                ...overlapSegments(conflicts),
                ...projectSegments([project], { link: false }),
              ]}
              focusRoadIds={[road.id]}
              height={260}
            />
            <p className="mt-2 text-xs text-slate-600">
              Coloured line: this work.
              {conflicts.length > 0 &&
                " Wide red band: stretch shared with a flagged work. Wide blue band: shared with a coordinated work."}
            </p>
          </div>
        )}
      </div>

      <Section title="Coordination flags">
        {conflicts.length === 0 ? (
          <p className="text-sm text-slate-600">No coordination flags for this work.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              A flag is a prompt for human review, not a finding of fault. Officers review flags on
              the{" "}
              <Link href="/coordination" className="text-sky-700 hover:underline">
                Coordination page
              </Link>
              .
            </p>
            {conflicts.map((c) => (
              <ConflictCard key={c.id} conflict={c} titles={titles} />
            ))}
          </div>
        )}
      </Section>

      <Section title="History">
        <HistoryTimeline events={history} />
      </Section>

      {canReschedule && (
        <Section title="Change dates (officer)">
          <RescheduleForm project={project} onRescheduled={load} />
        </Section>
      )}

      <Section title="Citizen reports">
        <p className="mb-3 text-sm text-slate-700">
          {reports.length === 0
            ? "No reports yet."
            : `${reports.length} ${reports.length === 1 ? "report" : "reports"} so far, shown in the history above.`}{" "}
          Seen something at this site? Tell the register.
        </p>
        <div className="max-w-xl">
          <ReportForm projectId={project.id} onSubmitted={load} />
        </div>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function Details({ detail }: { detail: ProjectDetail }) {
  const { project: p, department, road } = detail;
  const notes = [
    p.isEmergency && "Emergency work: it may have started without the usual notice.",
    p.locationApproximate && "The location is approximate; the exact stretch may differ.",
    p.datesTentative && "The dates are tentative and may change.",
  ].filter((n): n is string => Boolean(n));

  return (
    <dl className="grid content-start gap-x-6 gap-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <Item label="Purpose" wide>
        {p.purpose}
      </Item>
      <Item label="Department">
        {department ? (
          <>
            {department.name}
            <br />
            <a href={`mailto:${department.contactEmail}`} className="text-sky-700 hover:underline">
              {department.contactEmail}
            </a>
          </>
        ) : (
          p.departmentId
        )}
      </Item>
      <Item label="Contractor">{p.contractor}</Item>
      <Item label="Site contact">
        {p.contactName}
        <br />
        {p.contactPhone}
      </Item>
      <Item label="Road and stretch">
        {road ? road.name : p.location.roadId}, {p.location.fromM}–{p.location.toM} m (
        {p.location.toM - p.location.fromM} m)
        {road?.ward && <span className="text-slate-500"> · {road.ward}</span>}
      </Item>
      <Item label="Work type">{WORK_TYPE_LABEL[p.workType]}</Item>
      <Item label="Planned dates">
        {formatDate(p.plannedStart, true)} – {formatDate(p.plannedEnd, true)}
      </Item>
      {(p.actualStart || p.actualEnd) && (
        <Item label="Actual dates">
          {p.actualStart ? `Started ${formatDate(p.actualStart, true)}` : "Not started"}
          {p.actualEnd ? `, finished ${formatDate(p.actualEnd, true)}` : ", not finished yet"}
        </Item>
      )}
      <Item label="Surface restored by">{p.restorationBy ?? "Not stated"}</Item>
      {p.coordinatedWith.length > 0 && (
        <Item label="Coordinated with">
          {p.coordinatedWith.map((cid, i) => (
            <span key={cid}>
              {i > 0 && ", "}
              <Link href={`/projects/${cid}`} className="text-sky-700 hover:underline">
                {cid}
              </Link>
            </span>
          ))}
        </Item>
      )}
      {notes.length > 0 && (
        <Item label="Notes" wide>
          <ul className="list-disc pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Item>
      )}
    </dl>
  );
}

"use client";

// Registry: the "my street" view. Every work in the register, filterable by road, department
// and status, on a map and in a list.

import { useEffect, useMemo, useState } from "react";
import { ProjectTable } from "@/components/ProjectTable";
import { RoadMap } from "@/components/RoadMap";
import { projectSegments } from "@/components/segments";
import { ErrorNote, Loading, inputClass, labelClass, secondaryButtonClass } from "@/components/ui";
import { useMeta } from "@/components/useMeta";
import { api } from "@/lib/api";
import { MAP_COLOR, STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";
import type { ProjectSummary, Status } from "@/lib/types";

const STATUSES = Object.keys(STATUS_LABEL) as Status[];

export default function RegistryPage() {
  const { meta, error: metaError } = useMeta();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roadId, setRoadId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.projects().then(setProjects, (e: Error) => setError(e.message));
  }, []);

  const filtered = useMemo(
    () =>
      (projects ?? []).filter(
        (p) =>
          (!roadId || p.location.roadId === roadId) &&
          (!departmentId || p.departmentId === departmentId) &&
          (!status || p.status === status),
      ),
    [projects, roadId, departmentId, status],
  );

  const segments = useMemo(
    () =>
      projectSegments(filtered, {
        flaggedIds: new Set(filtered.filter((p) => p.conflictCount > 0).map((p) => p.id)),
      }),
    [filtered],
  );

  const filtering = Boolean(roadId || departmentId || status);
  const clearFilters = () => {
    setRoadId("");
    setDepartmentId("");
    setStatus("");
  };

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Public works register</h1>
        <p className="mt-1 text-slate-700">
          Every planned and ongoing road work in one place: pick your street to see what is
          happening, when, and who to contact.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="filter-road" className={labelClass}>
            Road
          </label>
          <select
            id="filter-road"
            className={inputClass}
            value={roadId}
            onChange={(e) => setRoadId(e.target.value)}
          >
            <option value="">All roads</option>
            {meta?.roads.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-dept" className={labelClass}>
            Department
          </label>
          <select
            id="filter-dept"
            className={inputClass}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">All departments</option>
            {meta?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-status" className={labelClass}>
            Status
          </label>
          <select
            id="filter-status"
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {metaError && <ErrorNote>Could not load roads and departments: {metaError}</ErrorNote>}

      {meta && (
        <div>
          <RoadMap
            roads={meta.roads}
            segments={segments}
            focusRoadIds={roadId ? [roadId] : undefined}
            height={380}
          />
          <MapLegend />
        </div>
      )}

      {error ? (
        <ErrorNote>Could not load the register: {error}</ErrorNote>
      ) : !projects ? (
        <Loading label="Loading works…" />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <p aria-live="polite">
              Showing {filtered.length} of {projects.length} works.
            </p>
            {filtering && (
              <button type="button" className={secondaryButtonClass} onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              No works match these filters. Try another road, department or status.
            </p>
          ) : (
            <ProjectTable projects={filtered} departments={meta?.departments} roads={meta?.roads} />
          )}
        </div>
      )}
    </section>
  );
}

function MapLegend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Map key">
      {STATUSES.filter((s) => s !== "CANCELLED").map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-5 rounded"
            style={{ backgroundColor: STATUS_COLOR[s] }}
          />
          {STATUS_LABEL[s]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-3 w-5 rounded opacity-40"
          style={{ backgroundColor: MAP_COLOR.flagHalo }}
        />
        Red halo = open coordination flag
      </li>
      <li>Cancelled works are listed but not drawn. Click a stretch to open it.</li>
    </ul>
  );
}

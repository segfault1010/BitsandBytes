"use client";

// The registry list: a table on wide screens, stacked cards on phones (so nothing overflows).

import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { Department, ProjectSummary, Road } from "@/lib/types";
import { Badge, OverdueBadge, StatusBadge } from "./ui";

interface Props {
  projects: ProjectSummary[];
  departments?: Department[];
  roads?: Road[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Signals({ p }: { p: ProjectSummary }) {
  return (
    <div className="flex flex-wrap gap-1">
      <StatusBadge status={p.status} />
      {p.overdue.overdue && <OverdueBadge daysLate={p.overdue.daysLate} />}
      {p.conflictCount > 0 && (
        <Badge className="bg-orange-100 text-orange-900 border-orange-200">
          {plural(p.conflictCount, "flag")}
        </Badge>
      )}
      {p.reportCount > 0 && (
        <Badge className="bg-blue-100 text-blue-900 border-blue-200">
          {plural(p.reportCount, "report")}
        </Badge>
      )}
    </div>
  );
}

export function ProjectTable({ projects, departments = [], roads = [] }: Props) {
  const deptName = new Map(departments.map((d) => [d.id, d.shortName]));
  const roadName = new Map(roads.map((r) => [r.id, r.name]));

  const rows = projects.map((p) => ({
    p,
    href: `/projects/${p.id}`,
    dept: deptName.get(p.departmentId) ?? p.departmentId,
    where: `${roadName.get(p.location.roadId) ?? p.location.roadId}, ${p.location.fromM}–${p.location.toM} m`,
    when: `${formatDate(p.plannedStart)} – ${formatDate(p.plannedEnd)}`,
  }));

  return (
    <>
      {/* Phones: one card per work. */}
      <ul className="space-y-3 md:hidden">
        {rows.map(({ p, href, dept, where, when }) => (
          <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <Link href={href} className="font-medium text-sky-700 hover:underline">
              {p.id} · {p.title}
            </Link>
            <p className="mt-1 text-slate-700">{dept}</p>
            <p className="text-slate-700">{where}</p>
            <p className="text-slate-700">{when}</p>
            <div className="mt-2">
              <Signals p={p} />
            </div>
          </li>
        ))}
      </ul>

      {/* Wider screens: a table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Work
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Department
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Road and stretch
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Planned dates
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Status and flags
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map(({ p, href, dept, where, when }) => (
              <tr key={p.id} className="align-top">
                <td className="px-3 py-2">
                  <Link href={href} className="font-medium text-sky-700 hover:underline">
                    {p.id} · {p.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-700">{dept}</td>
                <td className="px-3 py-2 text-slate-700">{where}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{when}</td>
                <td className="px-3 py-2">
                  <Signals p={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

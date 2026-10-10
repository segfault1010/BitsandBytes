import { apiError, guardWrite, json, readJson } from "@/lib/http";
import { appendEvent, getState } from "@/lib/store";
import { validateReport } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** A citizen report about a project. Shown publicly as "unverified". */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { state } = await getState();
  if (!state.projects.some((p) => p.id === id))
    return apiError(404, "NOT_FOUND", `No project with id ${id}.`);
  const report = validateReport(await readJson(request));
  if (!report.ok) return apiError(400, "INVALID_REPORT", report.message);
  return guardWrite(async () =>
    json({ event: await appendEvent("REPORT_ADDED", id, report.value) }, 201),
  );
}

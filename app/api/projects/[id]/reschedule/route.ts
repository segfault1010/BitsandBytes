import { apiError, guardWrite, json, readJson } from "@/lib/http";
import { appendEvent, getState } from "@/lib/store";
import { validateReschedule } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Changes a project's planned dates. A public reason is required and kept in its history. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { state } = await getState();
  const project = state.projects.find((p) => p.id === id);
  if (!project) return apiError(404, "NOT_FOUND", `No project with id ${id}.`);
  if (project.status === "COMPLETED" || project.status === "CANCELLED")
    return apiError(409, "NOT_ACTIVE", "Finished or cancelled works cannot be rescheduled.");
  const change = validateReschedule(await readJson(request));
  if (!change.ok) return apiError(400, "INVALID_RESCHEDULE", change.message);
  if (change.value.newStart === project.plannedStart && change.value.newEnd === project.plannedEnd)
    return apiError(400, "UNCHANGED", "The new dates are the same as the current ones.");

  return guardWrite(async () => {
    const event = await appendEvent("DATES_CHANGED", id, {
      oldStart: project.plannedStart,
      oldEnd: project.plannedEnd,
      newStart: change.value.newStart,
      newEnd: change.value.newEnd,
      reason: change.value.reason,
    });
    return json({
      project: { ...project, plannedStart: change.value.newStart, plannedEnd: change.value.newEnd },
      event,
    });
  });
}

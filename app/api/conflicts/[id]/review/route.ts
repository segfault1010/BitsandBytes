import { apiError, guardWrite, json, readJson } from "@/lib/http";
import { allConflicts } from "@/lib/registry";
import { appendEvent, getState } from "@/lib/store";
import { validateReview } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** A reviewer acknowledges or dismisses a flag. The decision is kept in the public history. */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const conflictId = decodeURIComponent((await ctx.params).id);
  const { state } = await getState();
  const conflict = allConflicts(state).conflicts.find((c) => c.id === conflictId);
  if (!conflict) return apiError(404, "NOT_FOUND", `No current flag with id ${conflictId}.`);
  const review = validateReview(await readJson(request));
  if (!review.ok) return apiError(400, "INVALID_REVIEW", review.message);
  return guardWrite(async () =>
    json({
      event: await appendEvent("CONFLICT_REVIEWED", conflict.projectIds[0], {
        conflictId,
        ...review.value,
      }),
    }),
  );
}

import { apiError, json } from "@/lib/http";
import { projectDetail } from "@/lib/registry";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { state } = await getState();
  const detail = projectDetail(state, id);
  return detail ? json(detail) : apiError(404, "NOT_FOUND", `No project with id ${id}.`);
}

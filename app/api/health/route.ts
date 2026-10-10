import { AS_OF } from "@/lib/config";
import { json } from "@/lib/http";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { state, mode } = await getState();
  return json({
    ok: true,
    mode,
    asOf: AS_OF,
    projects: state.projects.length,
    events: state.events.length,
  });
}

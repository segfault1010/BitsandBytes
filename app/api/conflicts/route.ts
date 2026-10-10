import { DEFAULT_CONFIG } from "@/lib/engine";
import { json } from "@/lib/http";
import { allConflicts, withReview } from "@/lib/registry";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { state } = await getState();
  const { conflicts, unchecked } = allConflicts(state);
  return json({
    conflicts: conflicts.map((c) => withReview(state, c)),
    unchecked,
    config: DEFAULT_CONFIG,
  });
}

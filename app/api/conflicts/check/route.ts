import { apiError, json, readJson } from "@/lib/http";
import { checkDraft } from "@/lib/registry";
import { getState } from "@/lib/store";
import { validateDraft } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Checks a proposed work against the register. Never saves anything. */
export async function POST(request: Request) {
  const body = (await readJson(request)) as { draft?: unknown } | undefined;
  const { state } = await getState();
  const draft = validateDraft(body?.draft, state);
  if (!draft.ok) return apiError(400, "INVALID_DRAFT", draft.message);
  return json(checkDraft(state, draft.value));
}

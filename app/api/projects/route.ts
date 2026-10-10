import { apiError, guardWrite, json, readJson } from "@/lib/http";
import { checkDraft, isOpenFlag, nextProjectId, projectSummaries } from "@/lib/registry";
import { appendEvent, getState } from "@/lib/store";
import type { Project } from "@/lib/types";
import { validateDraft, validateJustification } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { state } = await getState();
  return json(
    projectSummaries(state, {
      roadId: params.get("roadId"),
      departmentId: params.get("departmentId"),
      status: params.get("status"),
    }),
  );
}

/** Submits a proposed work to the register. A justification is required while open flags remain. */
export async function POST(request: Request) {
  const body = (await readJson(request)) as
    { draft?: unknown; justification?: unknown } | undefined;
  const { state } = await getState();
  const draft = validateDraft(body?.draft, state);
  if (!draft.ok) return apiError(400, "INVALID_DRAFT", draft.message);
  const justification = validateJustification(body?.justification);
  if (!justification.ok) return apiError(400, "INVALID_JUSTIFICATION", justification.message);

  const { conflicts } = checkDraft(state, draft.value);
  const open = conflicts.filter(isOpenFlag);
  if (open.length > 0 && !justification.value) {
    return apiError(
      422,
      "JUSTIFICATION_REQUIRED",
      `This work has ${open.length} open coordination flag(s). Add a written justification to submit it.`,
      { conflicts },
    );
  }

  return guardWrite(async () => {
    const project: Project = {
      ...draft.value,
      id: nextProjectId(state),
      status: "PROPOSED",
      actualStart: null,
      actualEnd: null,
    };
    await appendEvent("PROJECT_PROPOSED", project.id, {
      project,
      ...(justification.value ? { justification: justification.value } : {}),
    });
    return json({ project, conflicts }, 201);
  });
}

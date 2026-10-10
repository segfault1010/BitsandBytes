// Small helpers shared by the API route handlers.

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return json({ error: { code, message }, ...extra }, status);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Wraps a write so a database outage becomes a clear 503 instead of a crash. */
export async function guardWrite(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api] write failed:", err);
    return apiError(
      503,
      "STORE_UNAVAILABLE",
      "Could not save right now. Please try again in a moment.",
    );
  }
}

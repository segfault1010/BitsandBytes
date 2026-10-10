import { apiError, guardWrite, json } from "@/lib/http";
import { resetEvents } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Restores the seed by deleting every event. Needs the x-reset-token header to match RESET_TOKEN. */
export async function POST(request: Request) {
  const expected = process.env.RESET_TOKEN;
  if (!expected) return apiError(403, "RESET_DISABLED", "Set RESET_TOKEN to enable demo resets.");
  if (request.headers.get("x-reset-token") !== expected)
    return apiError(401, "BAD_TOKEN", "Wrong reset token.");
  return guardWrite(async () => {
    await resetEvents();
    return json({ ok: true });
  });
}

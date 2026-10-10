import { AS_OF, DATA_NOTICE } from "@/lib/config";
import { DEFAULT_CONFIG } from "@/lib/engine";
import { json } from "@/lib/http";
import { getState } from "@/lib/store";
import type { MetaResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { state, mode } = await getState();
  const body: MetaResponse = {
    departments: state.departments,
    roads: state.roads,
    config: DEFAULT_CONFIG,
    asOf: AS_OF,
    dataNotice: DATA_NOTICE,
    mode,
  };
  return json(body);
}

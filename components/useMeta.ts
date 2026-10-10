"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MetaResponse } from "@/lib/types";

let cached: Promise<MetaResponse> | null = null;

/** Departments, roads, engine config and demo date. Fetched once per page load. */
export function useMeta(): { meta: MetaResponse | null; error: string | null } {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cached ??= api.meta();
    cached.then(setMeta, (e: Error) => {
      cached = null;
      setError(e.message);
    });
  }, []);
  return { meta, error };
}

// Persistence: the seed lives in the repo; every change is an append-only row in one table.
// Without DATABASE_URL the same code keeps events in memory, so the app runs with no setup.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { SEED } from "./seed";
import { buildState } from "./state";
import type { CivicEvent, CivicState, EventType, StoreMode } from "./types";

interface EventRow {
  id: string | number;
  type: EventType;
  project_id: string | null;
  payload: unknown;
  created_at: string | Date;
}

const memoryEvents: CivicEvent[] = [];
let memorySeq = 0;
let tableReady: Promise<unknown> | null = null;

function db(): NeonQueryFunction<false, false> | null {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : null;
}

async function ensureTable(sql: NeonQueryFunction<false, false>): Promise<void> {
  tableReady ??= sql`
    CREATE TABLE IF NOT EXISTS civic_events (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      project_id TEXT,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  try {
    await tableReady;
  } catch (err) {
    tableReady = null; // retry on the next request
    throw err;
  }
}

function fromRow(row: EventRow): CivicEvent {
  return {
    id: `ev-${row.id}`,
    type: row.type,
    projectId: row.project_id,
    payload: row.payload,
    createdAt: new Date(row.created_at).toISOString(),
  } as CivicEvent;
}

export function storeMode(): Exclude<StoreMode, "degraded"> {
  return process.env.DATABASE_URL ? "db" : "memory";
}

/** Loads the current state. If the database is unreachable, serves the seed alone ("degraded"). */
export async function getState(): Promise<{ state: CivicState; mode: StoreMode }> {
  const sql = db();
  if (!sql) return { state: buildState(SEED, memoryEvents), mode: "memory" };
  try {
    await ensureTable(sql);
    const rows =
      (await sql`SELECT id, type, project_id, payload, created_at FROM civic_events ORDER BY id`) as EventRow[];
    return { state: buildState(SEED, rows.map(fromRow)), mode: "db" };
  } catch (err) {
    console.error("[store] database read failed, serving seed only:", err);
    return { state: buildState(SEED, []), mode: "degraded" };
  }
}

/** Appends one event. Throws if the database is configured but unreachable (routes return 503). */
export async function appendEvent<T extends CivicEvent>(
  type: T["type"],
  projectId: string | null,
  payload: T["payload"],
): Promise<T> {
  const sql = db();
  if (!sql) {
    memorySeq += 1;
    const event = {
      id: `mem-${memorySeq}`,
      type,
      projectId,
      payload,
      createdAt: new Date().toISOString(),
    } as T;
    memoryEvents.push(event);
    return event;
  }
  await ensureTable(sql);
  const rows = (await sql`
    INSERT INTO civic_events (type, project_id, payload)
    VALUES (${type}, ${projectId}, ${JSON.stringify(payload)}::jsonb)
    RETURNING id, type, project_id, payload, created_at`) as EventRow[];
  return fromRow(rows[0]) as T;
}

/** Deletes every event, restoring the seed. Used before recording the demo. */
export async function resetEvents(): Promise<void> {
  const sql = db();
  if (!sql) {
    memoryEvents.length = 0;
    return;
  }
  await ensureTable(sql);
  await sql`DELETE FROM civic_events`;
}

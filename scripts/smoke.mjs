// Smoke test for a running CivicTrack instance (local or deployed). Read-only: nothing is saved.
// Usage: npm run smoke -- https://your-app.vercel.app     (defaults to http://localhost:3000)

import { readFileSync } from "node:fs";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const expected = JSON.parse(
  readFileSync(new URL("../data/seed/expected-conflicts.json", import.meta.url), "utf8"),
);
let failures = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`ok   ${name}${detail ? `  (${detail})` : ""}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL ${name}: ${err.message}`);
  }
}

async function getJson(path, init) {
  const res = await fetch(base + path, init);
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

await check("GET /api/health", async () => {
  const h = await getJson("/api/health");
  assert(h.ok, "not ok");
  if (h.mode !== "db")
    console.log(`     note: store mode is "${h.mode}" (expected "db" in production)`);
  return `mode=${h.mode}, projects=${h.projects}`;
});

await check("GET /api/projects has the seeded register", async () => {
  const projects = await getJson("/api/projects");
  assert(projects.length >= 13, `only ${projects.length} projects`);
  return `${projects.length} projects`;
});

await check("GET /api/conflicts includes every expected seed flag", async () => {
  const { conflicts } = await getJson("/api/conflicts");
  const ids = new Set(conflicts.map((c) => c.id));
  const missing = expected.filter((id) => !ids.has(id));
  assert(missing.length === 0, `missing ${missing.join(", ")}`);
  return `${conflicts.length} flags`;
});

await check("POST /api/conflicts/check reproduces the brief's example (4 days)", async () => {
  const meta = await getJson("/api/meta");
  const draft = (start, end, workType, roadId, fromM, toM) => ({
    title: "Smoke test draft",
    purpose: "Smoke test",
    departmentId: meta.departments[0].id,
    workType,
    location: { roadId, fromM, toM },
    plannedStart: start,
    plannedEnd: end,
  });
  // The brief: works on 12–20 Oct and 17–25 Oct overlap for 4 days. P04 is seeded on R2 for 12–20 Oct,
  // so a 17–25 Oct draft on the same stretch must overlap it by exactly 4 days.
  const result = await getJson("/api/conflicts/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draft: draft("2026-10-17", "2026-10-25", "EXCAVATION", "R2", 600, 900),
    }),
  });
  const withP04 = result.conflicts.find(
    (c) => c.projectIds.includes("P04") && c.rule === "CONCURRENT_WORKS",
  );
  assert(
    withP04?.overlapDates?.days === 4,
    `expected 4 days, got ${JSON.stringify(withP04?.overlapDates)}`,
  );
  return "17–20 Oct, 4 days";
});

await check("GET / serves HTML", async () => {
  const res = await fetch(base + "/");
  const text = await res.text();
  assert(res.ok && text.includes("CivicTrack"), `status ${res.status}`);
});

console.log(
  failures
    ? `\n${failures} check(s) failed against ${base}`
    : `\nAll checks passed against ${base}`,
);
process.exit(failures ? 1 : 0);

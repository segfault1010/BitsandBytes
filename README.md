# CivicTrack: check before you dig

**A shared register of public works that flags coordination conflicts before a road is dug, and explains every delay.**

> Real streets; all works in this demo are **fictional demonstration data**. Department names are generic. No real agency's plans are shown.

- Live app: _TODO: Vercel URL_
- Demo video: [`demo/civictrack-demo.mp4`](demo/civictrack-demo.mp4) (backup link: _TODO_)
- Team: _TODO: names and roles_

## The problem

From the official problem statement (CivicTech: Improving Transparency and Coordination in Public Works Projects):

- Residents see roads dug up, drains repaired and pipelines laid by many different departments and contractors. They can't tell what the work is, who is responsible, how long it will take, or why it is delayed.
- Departments often work without knowing what others have planned, so **the same road can be dug up several times in a few months**.
- When work stalls there is no simple way to follow up, and deadlines slip without explanation.

The cost is traffic, safety hazards, lost business, wasted public money that goes unnoticed, and falling trust.

The problem is real in Indian cities, and it is current. In July 2026 a newly asphalted service lane on Bengaluru's Outer Ring Road was found cut open, and none of the agencies present knew who had dug it ([The News Minute](https://www.thenewsminute.com/karnataka/who-dug-up-the-road-bengaluru-agencies-clueless-during-krishna-byre-gowdas-inspection)). Karnataka then announced a "Road History Platform" for agencies to share their plans in advance ([South First](https://thesouthfirst.com/karnataka/karnataka-govt-to-set-up-gba-executive-committee-to-curb-repeat-road-digging-improve-civic-coordination/)). In 2023 Chennai barred utilities from cutting newly relaid roads for a year ([DT Next](https://www.dtnext.in/city/2023/05/01/corpn-bars-utilities-from-digging-up-re-laid-roads-for-a-yr)).

## Our solution

CivicTrack is one record of planned and ongoing works, used by both departments and residents.

1. **Check before you dig.** A department enters a proposed work. Before it is saved, a deterministic engine checks it against every planned or recent work on the same stretch of road. It explains each flag, offers to join the other job's window so both can share one trench ("dig once"), and suggests the earliest start date with no open flags. Going ahead anyway needs a written justification, which is kept in the public history.
2. **Re-dig rules.** It flags excavation on a recently resurfaced stretch, and two separate digs close together. These are exactly the "dug up several times" cases.
3. **Explain when you're late.** Every date change needs a public reason and is kept in the project's history. Overdue works are flagged automatically.
4. **Residents in the loop.** Anyone can look up their street, see who is responsible and until when, and attach a report (no work seen, hazard, poor quality, traffic) to the specific project.

A flag always means _possible coordination conflict, flagged for review_. It is never a finding of fault. Officers acknowledge or dismiss flags on the coordination page, with a public note.

**Where to see it:**

- `/`: the register, with a map and filters by road, department and status.
- `/projects/[id]`: one work, with its map, flags, road timeline, history and report form.
- `/propose`: the live check (officer view).
- `/coordination`: every flag in the ward.
- `/about`: the method, its limits, and the demo reset.

The demo walkthrough is in [`docs/demo-script.md`](docs/demo-script.md).

## How the engine works

Code: [`lib/engine.ts`](lib/engine.ts). Tests: [`lib/engine.test.ts`](lib/engine.test.ts), [`lib/seed.test.ts`](lib/seed.test.ts) and [`lib/registry.test.ts`](lib/registry.test.ts).

Every work is a **stretch of one road**, measured in metres from the start of the road ("chainage"), plus its dates. For every pair of works on the same road, the engine compares two intervals: metres and days.

| Rule                   | Fires when                                                                        | Severity                                                                   |
| ---------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `CONCURRENT_WORKS`     | The stretches overlap **and** the dates overlap (both end days count)             | High if both dig, or one digs while the other resurfaces; otherwise medium |
| `RESURFACE_PROTECTION` | A dig starts within **365 days** after resurfacing of an overlapping stretch ends | High                                                                       |
| `REPEAT_EXCAVATION`    | Two separate digs on an overlapping stretch, **within 90 days** of each other     | Medium if 30 days or less apart, otherwise low                             |

- **Joint works:** linked works are shown as `COORDINATED`, not as a conflict.
- **Emergency works:** shown for awareness, not flagged as violations.
- **Correct order:** dig first, then resurface, is never flagged.
- **Explanations:** each flag gives the overlap in metres, the overlap dates or the gap in days, a plain-language explanation and a suggested action.
- **Confidence:** starts at High and drops one level for each caveat (approximate location, tentative dates, assumed end date).
- **Missing data:** works with no start date are listed as _unchecked_ rather than silently skipped.
- **Earliest clear start:** `suggestStart` scans forward day by day for up to two years, starting from the proposed start (or the demo date, if that is later). It keeps the proposal's duration and returns the first start with no open flags.

Thresholds live in `DEFAULT_CONFIG`. They are illustrative defaults informed by Chennai's one-year rule; they are not official policy. The engine has no I/O, no clock and no randomness, so the same input always gives the same output.

**Limitations:**

- Approximate locations are widened by 100 m on each side, which can cause false positives.
- A missing end date is assumed to be 60 days after the start.
- Each work covers one road stretch.
- The data is fictional.
- Adoption needs departments to enter their plans.

## Architecture

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**. Pages are client components that call our own `/api/*` routes.
- **Data:** the seed register lives in [`data/seed/`](data/seed). Every change is an **append-only event** in one Postgres table (`civic_events`) on **Neon**: a proposal, a report, a date change or a review.
  - Current state = seed + events, replayed in order ([`lib/state.ts`](lib/state.ts)). Changes are never edited in place, which is the accountability trail.
  - Without `DATABASE_URL` the same code keeps events in memory, so the app runs locally with no setup.
- **Map:** Leaflet with OpenStreetMap tiles, display only. [`lib/geo.ts`](lib/geo.ts) turns a chainage range into a segment of the street's polyline. The engine never reads coordinates, so a map failure cannot break conflict detection.

### API

| Method | Path                                          | Purpose                                                                                                       |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`                                 | Status, store mode (`db` / `memory` / `degraded`), counts                                                     |
| GET    | `/api/meta`                                   | Departments, roads, engine config, demo date                                                                  |
| GET    | `/api/projects?roadId=&departmentId=&status=` | Register with flag count, report count, overdue                                                               |
| GET    | `/api/projects/:id`                           | Project, history, reports, flags                                                                              |
| POST   | `/api/projects`                               | Submit a proposed work `{ draft, justification? }`; returns 422 if flags remain and there is no justification |
| POST   | `/api/projects/:id/reports`                   | Citizen report `{ category, description, name? }`                                                             |
| POST   | `/api/projects/:id/reschedule`                | New dates plus a required public `reason`                                                                     |
| GET    | `/api/conflicts`                              | Every flag (with review status) and the unchecked works                                                       |
| POST   | `/api/conflicts/check`                        | Check a `{ draft }` without saving; includes `suggestedStart` when flags remain                               |
| PUT    | `/api/conflicts/:id/review`                   | Acknowledge or dismiss a flag, with a note                                                                    |
| POST   | `/api/admin/reset`                            | Restore the seed (header `x-reset-token` must match `RESET_TOKEN`)                                            |

## Setup

Requires Node 20 or newer (developed on Node 24).

```bash
npm ci
npm run dev        # http://localhost:3000, memory mode
npm test           # engine, geometry, read-model and seed-consistency tests
npm run build      # runs the tests, then the production build
npm run smoke -- http://localhost:3000   # API smoke test against a running instance
```

**Optional database:** copy `.env.example` to `.env.local` and set `DATABASE_URL` to a Neon Postgres connection string. The table is created automatically on first use. On Vercel, add Neon from the Marketplace, which sets `DATABASE_URL`, and set `RESET_TOKEN`. The token enables **Reset demo data** on `/about`, which restores the seed before a recording.

## Open-source libraries, APIs and data (disclosure)

| What                                                                                        | Use                                                         | Licence                       |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| [Next.js](https://nextjs.org), [React](https://react.dev)                                   | Web framework and UI                                        | MIT                           |
| [Tailwind CSS](https://tailwindcss.com)                                                     | Styling                                                     | MIT                           |
| [@neondatabase/serverless](https://github.com/neondatabase/serverless)                      | Postgres driver for Neon                                    | MIT                           |
| [Leaflet](https://leafletjs.com), [react-leaflet](https://react-leaflet.js.org)             | Map display                                                 | BSD-2-Clause, Hippocratic-2.1 |
| [OpenStreetMap](https://www.openstreetmap.org/copyright)                                    | Map tiles and street geometry, © OpenStreetMap contributors | ODbL                          |
| [geojson.io](https://geojson.io)                                                            | Tracing street polylines for the seed                       | Tool                          |
| [Vitest](https://vitest.dev), [Prettier](https://prettier.io), [ESLint](https://eslint.org) | Tests, formatting, linting                                  | MIT                           |
| [Vercel](https://vercel.com), [Neon](https://neon.com)                                      | Hosting and database (free tiers)                           | Services                      |

All code in this repository was written during the hackathon (10 Oct 2026). Research sources are linked in "The problem" above.

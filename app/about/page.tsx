// How it works: the rules, thresholds and limits in plain language, plus the demo reset control.

import Link from "next/link";
import { ResetDemo } from "@/components/ResetDemo";
import { AS_OF, DATA_NOTICE } from "@/lib/config";
import { formatDate } from "@/lib/dates";
import { DEFAULT_CONFIG } from "@/lib/engine";

const linkClass = "text-sky-700 hover:underline";

export default function AboutPage() {
  const c = DEFAULT_CONFIG;
  return (
    <article className="max-w-3xl space-y-6 text-slate-800">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">How CivicTrack checks works</h1>
        <p>
          Every work is recorded as a stretch of one road, measured in metres from the start of the
          road, plus its dates. For every pair of works on the same road, CivicTrack compares the
          two stretches and the two date ranges using three fixed rules. There is no AI or
          prediction: the same register always gives the same flags, and each flag says exactly why
          it was raised.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">The three rules</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Same stretch, same time:</strong> the stretches overlap and the dates overlap
            (both end days count). Two digs at once is a chance to share one trench.
          </li>
          <li>
            <strong>Dig on a recently resurfaced road:</strong> excavation starts within{" "}
            {c.protectionDays} days after resurfacing of an overlapping stretch ends. Digging first
            and resurfacing afterwards is the right order and is never flagged.
          </li>
          <li>
            <strong>Same stretch dug twice:</strong> two separate digs on an overlapping stretch
            within {c.repeatGapDays} days of each other.
          </li>
        </ul>
        <p>
          Each flag shows the shared stretch in metres, the overlapping dates or the gap in days, a
          plain-language explanation and a suggested action. When an officer proposes a work, the
          check runs before anything is saved. The officer can join the other work&apos;s window
          (the flag then shows as <em>coordinated</em>) or move to the earliest start date with no
          open flags. Going ahead anyway needs a written justification, which is kept in the public
          history.
        </p>
        <p>
          A flag means <em>possible coordination conflict, needs human review</em>. It is not a
          finding that anyone did anything wrong. Reviewers can acknowledge or dismiss each flag,
          with a public note.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">Confidence and limits</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Confidence starts high and drops for each uncertainty in the two works.</li>
          <li>
            Approximate locations are widened by {c.approxToleranceM} m on each side, which can
            cause false positives.
          </li>
          <li>
            A missing end date is assumed to be {c.assumedDurationDays} days after the start; such
            flags get lower confidence.
          </li>
          <li>Works with no start date cannot be checked and are listed as unchecked.</li>
          <li>Emergency works are shown for awareness, not flagged as violations.</li>
          <li>
            Thresholds are illustrative defaults informed by Chennai&apos;s one-year rule on cutting
            relaid roads (
            <a
              className={linkClass}
              href="https://www.dtnext.in/city/2023/05/01/corpn-bars-utilities-from-digging-up-re-laid-roads-for-a-yr"
            >
              DT Next
            </a>
            ). They are not official policy.
          </li>
          <li>
            {DATA_NOTICE} The demo date is fixed at {formatDate(AS_OF, true)}, so overdue counts
            read the same whenever you look.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">Why this matters</h2>
        <p>
          In July 2026 a newly asphalted service lane on Bengaluru&apos;s Outer Ring Road was found
          cut open, and none of the agencies present knew who had dug it (
          <a
            className={linkClass}
            href="https://www.thenewsminute.com/karnataka/who-dug-up-the-road-bengaluru-agencies-clueless-during-krishna-byre-gowdas-inspection"
          >
            The News Minute
          </a>
          ). Karnataka then announced a shared &quot;Road History Platform&quot; for agencies to
          publish their plans in advance (
          <a
            className={linkClass}
            href="https://thesouthfirst.com/karnataka/karnataka-govt-to-set-up-gba-executive-committee-to-curb-repeat-road-digging-improve-civic-coordination/"
          >
            South First
          </a>
          ). CivicTrack is a small, working take on that idea: one register, checked before anyone
          digs, open to residents.
        </p>
        <p>
          Start with the{" "}
          <Link href="/" className={linkClass}>
            register
          </Link>
          , or{" "}
          <Link href="/propose" className={linkClass}>
            propose a work
          </Link>{" "}
          as an officer.
        </p>
      </section>

      <section className="space-y-2 border-t border-slate-200 pt-4">
        <h2 className="text-lg font-semibold text-slate-900">Demo controls</h2>
        <p className="text-sm text-slate-600">
          Restores the register to its seed data before a demo. Needs the reset token set on the
          server.
        </p>
        <ResetDemo />
      </section>
    </article>
  );
}

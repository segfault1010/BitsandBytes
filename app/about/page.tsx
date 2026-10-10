// How it works (owner: D for wording). Explains the rules, thresholds and limits in plain language.

import { DATA_NOTICE } from "@/lib/config";
import { DEFAULT_CONFIG } from "@/lib/engine";

export default function AboutPage() {
  const c = DEFAULT_CONFIG;
  return (
    <article className="prose max-w-3xl space-y-3">
      <h1 className="text-2xl font-semibold">How CivicTrack flags works</h1>
      <p>
        Every work is recorded as a stretch of one road, measured in metres from the start of the
        road, plus its dates. CivicTrack compares every pair of works on the same road with three
        fixed rules. It does not use AI.
      </p>
      <ul className="list-disc pl-5">
        <li>
          <strong>Concurrent works:</strong> the stretches overlap and the dates overlap.
        </li>
        <li>
          <strong>Resurface protection:</strong> a dig on a stretch within {c.protectionDays} days
          after it was resurfaced.
        </li>
        <li>
          <strong>Repeat excavation:</strong> two separate digs on the same stretch within{" "}
          {c.repeatGapDays} days.
        </li>
      </ul>
      <p>
        A flag means <em>possible coordination conflict, needs human review</em>. It is not a
        finding that anyone did anything wrong.
      </p>
      <h2 className="text-xl font-semibold">Limits</h2>
      <ul className="list-disc pl-5">
        <li>
          Approximate locations are widened by {c.approxToleranceM} m on each side, which can cause
          false positives.
        </li>
        <li>
          A missing end date is assumed to be {c.assumedDurationDays} days after the start; such
          flags get lower confidence.
        </li>
        <li>Works with no start date cannot be checked and are listed as unchecked.</li>
        <li>
          Thresholds are illustrative defaults informed by Chennai&apos;s one-year rule on cutting
          relaid roads, not official policy.
        </li>
        <li>{DATA_NOTICE}</li>
      </ul>
    </article>
  );
}

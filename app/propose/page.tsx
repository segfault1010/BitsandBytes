// Propose-work shell (owner: B). Build: form -> api.checkDraft() on change -> ConflictCard list ->
// "Join window" (sets dates from conflict.joinWindow + coordinatedWith) -> justification -> api.submitDraft().

export default function ProposePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-2">Propose a work</h1>
      <p className="text-black/70">
        Coming soon: check a proposed dig against the register before it is approved.
      </p>
    </section>
  );
}

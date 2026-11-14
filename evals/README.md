# Evidence Lens usefulness pilot

The question is whether the product helps someone inspect evidence and avoid confusing events, not whether its unit tests pass.

## Reproduce

1. Use the existing ignored `.dev.vars` configuration.
2. Run `npm run eval:pilot`. This runs three cases once, no automatic retries, at most nine model calls (two production calls plus one baseline per case) and fifteen Telem search requests plus up to twelve fetch batches in the default Broad overview mode. Search provider fan-out is selected by Telem. Results do not enter the user's Neo4j history.
3. Read both outputs alongside the exact retrieved evidence and predeclared official reference links in `report.html`.
4. Complete `review.json`: every criterion needs `pass`, `fail` or `unassessable`, plus an explanation identifying the relevant output claim and source. Identify the reviewer and whether the review was human, assistant-assisted, or blinded. Do not mark assistant review as a human user study.
5. Regenerate with `npm run eval:report -- /absolute/path/to/the/run-directory`.

The case file is written before model calls. Keep all cases and failures. Never silently replace a losing case or rerun until it wins. A later run is a separate dated experiment.

## Comparison

The baseline receives the same `modelSources()` text as Evidence Lens. It uses the same model, low reasoning and 10,000-token per-call output cap. It is instructed to answer accurately with exact citations, distinguish plans from outcomes, and state uncertainty. Its prompt and schema are visible in `run.mjs`. The baseline has no graph, forecast or multi-part analysis requirements. The production workflow can now make a second analysis call after up to six supplemental page reads; total production tokens and time include both calls. It is no longer an equal-model-call-budget comparison. This is a comparison of the complete analysis workflows under a shared retrieval pool, not a retrieval-engine comparison or equal-output-length experiment.

The production result is captured after server-side grounding validation. Baseline quotations are measured as emitted, without silently repairing them. This difference is part of the evaluated product pipeline and must be disclosed.

Automatic metrics: exact quotation matches against the actually supplied, truncated text; claims with at least one matched quote; source/page counts; model token usage; request elapsed time. An empty set of citations has no match rate, not 100%. A quote match checks text presence, never entailment or truth.

Reviewed metrics: each case has three fact criteria with independent NASA reference pages. Record missed facts, incorrect facts, unsupported additional assertions and useful qualifications. A quotation from a snippet is still a snippet. Side-by-side assistant review is not independent, blinded human evaluation. Report the small numerator and denominator rather than implying population accuracy.

## What this pilot cannot establish

Three selected historical aerospace cases do not represent every topic or the intended customer population. They may be present in model training data. A shared retrieval pool cannot isolate the benefit of Telem routing. These tasks cannot validate forecasts, longitudinal monitoring, or business demand. Model latency is not user task-completion time. Costs remain unknown unless verified provider billing is available; token counts are not dollar costs.

## Small user study to run next

Recruit at least three target users for formative feedback. Use matched, different tasks and counterbalance interface order to reduce learning effects. Ask each user to answer the fact questions, identify a supporting original passage and flag unresolved evidence. Record start/end time, correctness, missed information, confidence and qualitative comments. Do not include the model generation wait in one condition but omit it in the other. Preserve failures and record any assistance. Three users can expose usability problems; they do not establish statistically reliable speed or accuracy gains.

For change tracking, collect two genuinely dated snapshots of the same question. Ask users to identify what changed and why, including a no-change control. Do not manufacture a source update for a live demonstration; clearly label any controlled fixture.

## Source-overlap counterfactual

Run `npm run eval:source-overlap` without API credentials. The clearly synthetic fixture holds article text constant while increasing the number of publication URLs from 1 to 2, 5 and 10. The proposed multi-source label is deliberately injected into the actual production validator. Expected: one overlap group for 2–10 copies, and independence remains unverified. The guardrail withholds all unverified corroboration labels, even for ungrouped pages; this is not evidence that independence has been established.

Unit controls include unrelated reports on one domain, snippet-only similarity, common hyperlinks, explicit common attribution, ambiguous attribution and near-copies. Original texts are preserved for subsequent date/entity/negation checks. Semantic entailment and automated follow-up search are not implemented by this experiment.

The first live pilot (2026-11-14T22-50-45.162Z) predates the source-group implementation. Its DART question incorrectly specified February instead of March 2023. That measurement criterion is excluded for both systems; the original inputs, erratum and assistant review are retained. Eight remaining fact criteria pass in both systems. This does not demonstrate an accuracy advantage.

The default scope now retains up to 40 pages across five query angles, reads up to 16 pages and permits 12 claims / 16 events. Historical reports remain snapshots of the code used then; their three-page retrieval and six-claim limits should not be presented as results for the expanded implementation.

# Evidence Lens
English SearchHack demo: Telem retrieval and GPT-6.1 Sol analysis, in a simple, function-first web interface.

## Implemented
- Default **Broad overview**: five search angles (developments, official records, timeline/background, participants/impacts, findings/corrections), `auto_routing: "accuracy"`, eight results per selected provider, and up to 40 canonical-URL-deduplicated pages. Selection prioritizes visible topic matches and specific documents, then balances search angles and publisher domains. Generic homepages, personal profiles and feeds are down-ranked; this is a relevance heuristic, not fact verification. Ten initial page reads cover those angles and known publication-date extremes; up to six additional reads prioritize claim citations and relevant snippets. Fetch calls are split into concurrent batches of at most five URLs, per the hackathon API contract. **Quick check** retains the smaller two-search / ten-page / six-read budget.
- The news library is separate from the model's summary: browse all retained titles and excerpts, filter by publisher or reading status, search article text, and sort known publication dates. Overlap groups never remove articles. Coverage records raw returned results, URL duplicates, invalid links, retained/omitted pages, actual successful reads and failed/empty search angles. Counts do not establish completeness or independence.
- One initial Responses API call and at most one refreshed analysis after additional page text is retrieved (`gpt-6.1-sol`, low reasoning, 10,000 output-token cap per call, `store:false`). No automatic retry. Provider failure preserves retrieval and reports the limitation. If refreshed analysis fails, newly fetched sources are retained and stale snippet-based analysis is withheld. Usage totals include both completed analysis calls.
- Live claim extraction with exact quoted spans and server-side quotation/source-ID validation. This checks text presence, not truth or semantic entailment.
- Deterministic source overlap groups identify matching fetched text, near-copies (five-word shingle Jaccard ≥ 0.9), and explicit republication URLs. Grouping uses the first 8,000 characters, retains all source texts, and leaves independence unverified. Shared domains, common links and identical snippets do not establish a group. Unverified `corroborated` labels are downgraded to `reported`; older snapshots receive the same conservative display treatment.
- Model-inferred source relationships, scoped conflicts, claim-specific directness ratings (0–3, not truth probabilities), and conditional wider effects.
- An event-centered graph: events carry dates, participants, grounding claim IDs and optional forecast links. Directed relationships are typed as precedes, responds to, clarifies, contradicts, triggers, enables, blocks or may lead to. Each relationship carries exact source quotes and a reported/inferred/hypothetical basis. Invalid endpoints and unverifiable quotations are removed.
- Drag nodes, pan the background, zoom, fit/reset, filter relation types, and inspect both events and relationship explanations. Keyboard users can select with Enter and move focused nodes with arrow keys. Old saved runs show a rerun prompt, not invented event edges.
- Up to three uncalibrated binary event estimates with deadlines and resolution rules. Missing quoted full-page evidence withholds a number. Guilt/private-misconduct probabilities are prohibited by the model instructions.
- Same-topic reruns preserve forecast definitions, expose prior/new probabilities and evidence-linked rationales. Identical retrieved-text fingerprints preserve prior estimates. Expired questions require resolution and do not get new estimates.
- Telem monitor is optional, hourly, four-hour TTL; start/pause/resume/end show immediate progress and inline errors. Refresh status exposes plan preparation, attention and next-check state. Check updates reads changes already found and triggers Search → Fetch → analysis if changes arrive; it does not force an immediate Telem crawl. No background model scheduler is installed.
- Last five research sessions, manual annotations and snapshots persist in this browser; JSON export includes source text, analysis, usage and revisions.
- Optional Neo4j Aura persistence in local development: new research runs save their full snapshots, source text, claims, dated events, typed event edges, exact citation provenance, forecasts and previous-run links. Startup restores up to 50 recent snapshots; browser history remains available if Neo4j is unavailable.

## Boundaries
The homepage opens directly to the topic input. Analysis shows the News library first, below the coverage counts and concise assessment. Evidence, Graph and Forecasts are separate views. The model can extract up to 12 distinct claims and 16 events; these limits are ceilings, not targets. All retained sources (up to 40) enter model context; there is no hidden ten-source cutoff. Monitoring, saved-run selection, source inspection, manual notes and JSON export remain available. The prior scripted replay is no longer shown in the interface; its data file remains as a development fixture.

Source relationships and conflict labels are model interpretations, not validated findings. Different domains do not imply independent evidence. Source snippets are discovery leads. Source-independence copy reports actual retrieved-page coverage and keeps unread pages unassessed. Null probabilities say “No probability estimate”, explain the reason and explicitly distinguish this from 0%. Fetched text is capped at 8,000 characters per page for analysis and snippets at 800. No forecasting calibration evaluation has been performed; estimates are not financial advice or probabilities of guilt. Historical analogies are not invented when absent from evidence.

Previous snapshots are continuity context. Neo4j snapshots are created once per run ID, but a database administrator can edit them; this is not a tamper-proof audit log or multi-user database. The rate limit is per Worker isolate, not a global spending cap. Optional manual page reads consume extra retrieval budget.

## Configuration and security
Telem uses the hackathon endpoint `https://hack.telem.ai/api` by default. Local `.dev.vars` sets `TELEM_BASE_URL` explicitly; restart the development server after changing its URL or key. Search, Fetch and Monitor share this base. Use the key issued by the hackathon platform.

Server-only secrets: `TELEM_API_KEY`, `OPENAI_API_KEY` and optional Neo4j credentials. Real `.dev.vars`, `.env*` and `api_key*` files are ignored and must never be included in Git, client bundles or exports. Only the blank `.dev.vars.example` is committed. Preserve the Telem `User-Agent` required for hosted requests.

Use Node.js 22.13 or newer. Run `npm ci`, copy `.dev.vars.example` to `.dev.vars` if you have no local configuration yet, fill in your own keys, then run `npm run dev`. Open the loopback URL printed in Terminal (default `http://127.0.0.1:5173`). Do not overwrite an existing `.dev.vars`. Run `npm run build` to verify the production build. The inherited `.openai/hosting.json` is build metadata, not a credential; publishing this repository does not deploy a website.

## Local Neo4j setup

Copy `.dev.vars.example` to `.dev.vars` if you have no local configuration yet. Add your Aura connection URI (`neo4j+s://<instance>.databases.neo4j.io` or its HTTPS origin), username, password and database name. Restart the dev server after configuration changes. The `.dev.vars` file is ignored by Git; credentials are read only by the Worker and are never included in snapshots, exports or browser responses.

The integration uses the [Neo4j HTTPS Query API](https://neo4j.com/docs/aura/connecting-applications/query-api/), with parameterized queries and no additional driver. It creates one application-specific uniqueness constraint on `EvidenceLensEntity.key`. Each graph entity is scoped by namespace and run ID so repeated event/source IDs cannot overwrite older evidence. All graph records for a run are written in one transaction. Query failures, including errors in HTTP 202 responses, are handled as storage failures.

`NEO4J_NAMESPACE` defaults to `evidence-lens-local`. Use a separate namespace for another local project sharing the same database. This is a grouping mechanism, not user authentication. History reads and automatic persistence are restricted to localhost requests. Keep the dev server bound to loopback; public deployment would require authenticated per-user access before enabling history.

The UI reports storage status and provides **Refresh saved history**. It keeps five runs in browser storage and restores the latest 50 database snapshots. Existing browser-only runs are not automatically uploaded. Notes, monitors and extra manual page reads remain browser-local; failed database saves are not automatically retried. Use Export to retain these results.

Run `npm run check:neo4j` to test the configured Aura instance. This creates synthetic runs in a unique test namespace, verifies restoration, typed relationships, quotations, revision links and duplicate protection, then deletes only those test records. It does not call Telem or OpenAI.

## Checks
`npm test`

`npx tsc --noEmit`

Tests cover invented quotes, invalid references, duplicate evidence stability, snippet-only/expired estimates, quota-error redaction, retrieval budget, canonical deduplication, partial failures and request-origin checks.

## Usefulness evaluation

`npm run eval:pilot` explicitly runs a small live pilot with three predeclared NASA historical fact-check tasks. It uses the production research handler and compares its output with a citation-enabled summary using the exact same retrieved text, model, reasoning effort and output-token cap. The run makes at most three production research calls and three baseline model calls, with no automatic retry, database persistence or monitors. Telem auto-routing can select multiple providers. See `evals/README.md` for the protocol and limits.

Each dated `outputs/evaluation/` directory contains complete outputs, source snapshots, request timings, mechanical quotation checks, an explicit review worksheet and a self-contained HTML report. Fact scores require a completed review; empty outputs are not treated as perfect scores. This pilot cannot establish human time savings, general accuracy or forecast calibration.

`npm run eval:source-overlap` runs a synthetic counterfactual with 1, 2, 5 and 10 copies of the same article. It asserts that added copies form a single overlap group and never produce independent-corroboration labels. Results are saved to `outputs/source-overlap-results.json`. This validates a conservative label guardrail, not semantic entailment or complete source-chain discovery.

## Sources
- https://hack.telem.ai/doc/quickstart/
- https://hack.telem.ai/doc/resources/search-parameters/
- https://hack.telem.ai/doc/resources/fetch-parameters/
- https://hack.telem.ai/doc/resources/monitors/
- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/guides/structured-outputs
- Case primary sources: `lib/case-data.ts` and each replay evidence card.

## Design reference
MiroFish (https://github.com/666ghj/MiroFish) was reviewed for its graph-before-simulation workflow. This implementation is independently written and does not import MiroFish code or its multi-agent simulation engine. An event graph here organizes evidence and hypotheses; it is not a validated causal model.

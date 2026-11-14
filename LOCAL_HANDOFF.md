# Continue Evidence Lens locally

Read README.md for the current architecture, setup and limitations.

## Start
1. Install Node.js 22.13 or newer and run `npm ci`.
2. If `.dev.vars` does not exist, copy `.dev.vars.example` to it and add your own credentials. Preserve existing configuration. Never commit real keys or database passwords.
3. Run `npm run dev` and open the loopback URL printed in Terminal (default port 5173).

## Current implementation
The English interface uses Telem Search, Fetch and optional Monitor, OpenAI analysis, and optional local Neo4j Aura persistence. Telem uses the dedicated hackathon API with automatic routing and no pinned search provider.

Broad overview searches five angles, retains a configurable 5–100 canonical URLs (default 40), and reads up to 16 pages. The news library exposes every retained article separately from the model summary. Source overlap groups preserve articles and never imply verified independence. Exact quotation validation checks text presence, not semantic entailment. Missing full-page support produces “No probability estimate” with an explanation.

Neo4j stores full snapshots and evidence graphs and restores up to 50 runs. Browser history, notes and monitor state remain available locally. History endpoints are restricted to localhost; public multi-user deployment requires additional authorization design. This repository upload does not deploy the original Sites website.

## Validation
As of 2026-11-14, 50 unit tests, TypeScript checking and the production build passed. Local browser checks covered research results, expanded news coverage, source inspection, forecast explanations and monitor controls. Real Telem/OpenAI research and isolated Neo4j round-trip checks succeeded; synthetic database records were cleaned up.

Use `npm test`, `npx tsc --noEmit` and `npm run build` for routine checks. `npm run check:neo4j` uses configured database credentials and temporary synthetic records. Live evaluation calls incur provider usage; see `evals/README.md`. Existing pilot evidence does not establish a general accuracy advantage or forecasting calibration.

## Data and security
Real configuration, API key files, dependencies, builds, runtime caches and `outputs/` are excluded from Git. Only blank configuration examples belong in the repository. Use the UI Export action to retain research history separately; there is no history-import interface. Preserve inspectable source references and quotations, and distinguish reported events, inference and hypothetical outcomes.

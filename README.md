# Evidence Lens

**Track a topic. See what changed—and the evidence behind it.**

Built for SearchHack with Telem AI, OpenAI and Neo4j.

## What it does

- **Research broadly:** search five angles, collect up to 40 pages and read up to 16.
- **Inspect evidence:** trace claims to original quotations and flag matching or republished content.
- **Explore events:** navigate an interactive graph of events, responses and unresolved questions.
- **Follow changes:** monitor a topic, compare research runs and save evidence history in Neo4j.

Quotation checks verify that text exists in a source, not that a claim is true. Source independence can remain unknown; forecasts are experimental.

## Run locally

Requires Node.js 22.13+.

```bash
npm ci
# First setup only; keep an existing .dev.vars:
cp .dev.vars.example .dev.vars
```

Add `TELEM_API_KEY` and `OPENAI_API_KEY` to `.dev.vars`. The Telem hackathon endpoint is preconfigured. Neo4j credentials are optional.

```bash
npm run dev
```

Open [localhost:5173](http://127.0.0.1:5173). Real credentials stay in the ignored `.dev.vars` file. Neo4j history access is local-only.

**Try:** `November 13, 2026 FAA nationwide ground stop: timeline, causes, recovery, and unresolved questions`

## Checks

```bash
npm test
npx tsc --noEmit
npm run build
```

Evaluation protocol and limitations: [evals/README.md](evals/README.md).

**Stack:** React · TypeScript · Vite/vinext · Cloudflare Workers · Telem Search/Fetch/Monitor · OpenAI Responses API · Neo4j Aura

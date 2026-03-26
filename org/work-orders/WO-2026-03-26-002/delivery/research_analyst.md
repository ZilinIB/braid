# Repository Review — Research Analyst

## Summary

I performed a read-only review of `git@github.com:MantaDigital/stingray-mono.git` by cloning the repository into a temporary workspace and inspecting top-level structure, representative service manifests, README/docs, CI/CD files, migrations, and selected codebase shape indicators. No repository changes were made.

At a high level, this is a substantial multi-service monorepo for an AI-powered crypto research / market intelligence platform. The repository appears to combine user-facing chat and web product surfaces, market/news ingestion and enrichment pipelines, an internal knowledge graph, alerting, a social publishing/reply system, and an internal tool-execution sidecar for agent workflows.

Confidence is **high** on the broad system map, service boundaries, major technologies, and several operational risks because those are explicitly documented in-repo and reflected in manifests/layout. Confidence is **moderate** on overall code health and maintainability because this was a bounded high-level review rather than a deep implementation audit.

## Methodology

### Sources reviewed
- Canonical repo overview and top-level docs:
  - `README.md`
  - `CLAUDE.md`
  - `Makefile`
  - `docs/monorepo/README.md`
  - `docs/monorepo/SERVICE_DEPENDENCY_GRAPH.md`
  - `docs/monorepo/SCALING_SAFETY.md`
  - `docs/monorepo/DECISION_LOG.md`
- Representative service manifests / READMEs:
  - `apps/agent-server/package.json`
  - `apps/frontend/package.json`
  - `apps/alerts/README.md`, `pyproject.toml`
  - `apps/news/README.md`, `pyproject.toml`
  - `apps/knowledge-graph/README.md`, `pyproject.toml`
  - `apps/social-publisher/README.md`, `pyproject.toml`
  - `apps/tool-host/README.md`, `pyproject.toml`
  - `apps/cryptofeed/README.md`, `pyproject.toml`
  - `apps/skills/README.md`
- Repo governance / quality signals:
  - `.pre-commit-config.yaml`
  - migration trees
  - CI/CD directory layout
  - rough source/test/doc counts and selected large-file indicators

### Limitations
- This was a **high-level** pass, not a full code audit.
- I did not execute services, tests, builds, or deployments.
- I did not inspect secrets, infrastructure state, runtime dashboards, or production configs.
- Some repo documentation may include planned/transitional states rather than current deployed reality; where possible I distinguished explicit evidence from interpretation.

## Findings

## 1) What the monorepo appears to be

### Observed facts
- Root `README.md` describes the repository as the **“Stingray platform — AI-powered crypto research and market intelligence.”**
- The root app inventory lists 9 app directories:
  - `agent-server`
  - `tool-host`
  - `frontend`
  - `alerts`
  - `news`
  - `cryptofeed`
  - `knowledge-graph`
  - `social-publisher`
  - `skills`
- Root and monorepo docs consistently describe the repo as a **consolidated monorepo** with independently deployable services and service-specific migrations/CI.

### Interpretation / inference
- This appears to be the company’s central product/backend platform rather than a single application. It likely underpins both end-user product experiences and internal operational/AI workflows.
- The system seems optimized around a crypto intelligence loop: ingest market + news data → resolve entities / context → expose insights through chat/web/UI → trigger alerts / publish content.

### Confidence
- **High**

---

## 2) Monorepo structure and major domains

### Observed facts
Top-level structure includes:
- `apps/` — service/application code
- `migrations/` — per-service SQL migrations
- `cicd/` — per-service CI/CD configuration
- `docs/` — cross-cutting architecture and policy docs
- `tests/agent-e2e/` — cross-service smoke/E2E scripts
- `scripts/` — utility scripts

Service/domain mapping from repo evidence:
- **User product surfaces**
  - `apps/frontend` — Next.js web app
  - `apps/agent-server` — chat backend / Telegram webhook / billing / identity / watchlists / portfolio / alerts API surface
- **Agent/tooling layer**
  - `apps/tool-host` — Python HTTP tool sidecar for agent-server
  - `apps/skills` — QA/validation assets for public Stingray skill packages
- **Data/market intelligence layer**
  - `apps/news` — news ingest, clustering, enrichment, streaming, delivery
  - `apps/cryptofeed` — Binance market data gateway / 1-second candle cache
  - `apps/knowledge-graph` — entity store / relationship graph / search / asset metadata
- **Action/output layer**
  - `apps/alerts` — alert evaluation + Telegram notifications
  - `apps/social-publisher` — X/Twitter + Telegram publishing and reply automation

The service dependency graph documents the major communication paths:
- frontend ↔ agent-server / news
- agent-server ↔ tool-host / knowledge-graph / alerts / cryptofeed
- news ↔ cryptofeed / knowledge-graph / social-publisher
- alerts ↔ cryptofeed / knowledge-graph / Telegram
- social-publisher ↔ news / knowledge-graph / Telegram / X

### Interpretation / inference
- The repo appears to be organized around **capability-oriented services**, not a shared-library-heavy monolith.
- The major business domains seem to be:
  1. conversational AI product experience,
  2. crypto market/news intelligence,
  3. identity/billing/growth for consumer product surfaces,
  4. outbound alerting/social distribution.

### Confidence
- **High**

---

## 3) Technology stack and tooling

### Observed facts
#### TypeScript / Node services
- `apps/agent-server`:
  - Fastify backend
  - TypeScript 5
  - Node-based build/test scripts
  - dependencies include `fastify`, `pg`, `@google/genai`, `@privy-io/server-auth`, `@sentry/node`, Mixpanel
- `apps/frontend`:
  - Next.js 15
  - React 19
  - extensive UI/testing tooling: Playwright, Storybook, Jest, Vitest, ESLint, ts-prune, madge
  - analytics/monitoring/auth dependencies include Mixpanel, Sentry, Privy

#### Python services
- `alerts`, `news`, `knowledge-graph`, `cryptofeed`, `tool-host`, `social-publisher` use **FastAPI**
- Dependency management is per-service via `pyproject.toml`; docs mention **uv** as the Python package manager convention
- Python versions are not uniform:
  - `news`: `>=3.14`
  - `alerts`: `==3.13.*`
  - `knowledge-graph`: `==3.13.*`
  - `social-publisher`: `>=3.13`
  - `cryptofeed`: `>=3.12`
  - `tool-host`: `>=3.11`

#### Datastores / infra conventions
- PostgreSQL appears to be the main persistent datastore family
- `knowledge-graph` uses PostgreSQL with `pgvector`
- `cryptofeed` is documented as in-memory only
- docs reference Google Cloud / Cloud Run / Cloud Build / Cloud Deploy / Cloud SQL heavily
- root Makefile includes GCP Cloud Build trigger management commands

#### Quality / workflow tools
- root `.pre-commit-config.yaml` coordinates Python Ruff formatting/linting and TS frontend/agent checks
- migrations are managed explicitly under `migrations/<service>/`
- docs claim **no cross-service imports**; services communicate over HTTP APIs

### Interpretation / inference
- The stack is **polyglot but intentionally service-isolated**: TypeScript where product and agent orchestration live, Python where ingest/data/worker services dominate.
- The platform is cloud-native and containerized, with each service appearing independently deployable.
- The current infra is still GCP-oriented, though monorepo docs show awareness of future CI/CD migration possibilities.

### Confidence
- **High** on major stack/tooling; **moderate** on the full production deployment picture.

---

## 4) Architecture and system design signals

### Observed facts
- Root/monorepo docs explicitly describe **8 deployable services plus skills**.
- `CLAUDE.md` and service dependency docs identify `knowledge-graph` as the **most consumed internal API** with the largest blast radius.
- `agent-server` and `alerts` share a database, with agent-owned migrations under `migrations/agent/`.
- `agent-server` and `tool-host` are documented as co-deployed in the same container / sidecar pattern.
- `Telegram` bot identity is intentionally shared across `agent-server`, `alerts`, and `social-publisher`; `agent-server` is documented as sole inbound webhook owner.
- Service docs and root docs emphasize that app-specific docs live within service directories, while `docs/` is for cross-cutting guidance.

### Interpretation / inference
- There is meaningful architecture awareness and internal documentation discipline. This is not an ad hoc repo accumulation; it appears actively curated.
- The most strategically important internal systems are probably:
  1. `knowledge-graph` as shared context/entity backbone,
  2. `agent-server` as user interaction/billing/identity hub,
  3. `news` as core ingest/enrichment pipeline,
  4. `frontend` as main web product surface.

### Confidence
- **High**

---

## 5) Code health and maturity signals

### Positive signals observed
- Good top-level documentation and cross-service architecture docs.
- Strong evidence of testing culture in several services:
  - `frontend`: ~255 test files
  - `news`: ~81 test files
  - `knowledge-graph`: ~54 test files
  - `alerts`: ~30 test files
  - `social-publisher`: ~31 test files
  - `cryptofeed`: ~24 test files
- Explicit CI/CD configs per service exist under `cicd/services/*`.
- Forward migration history is substantial, especially for agent, news, KG, and social-publisher, which suggests production evolution rather than a greenfield prototype.
- Lint/typecheck/format hooks are centralized at root, but still target service-specific toolchains.
- Frontend contains additional maintainability tooling (`ts-prune`, `madge`, line-count checks, Storybook coverage checks), which is a good sign of engineering hygiene.

### Strain / caution signals observed
- The repo is materially large and uneven in complexity. Rough file counts from the review:
  - `frontend`: 984 files
  - `agent-server`: 283 files
  - `news`: 214 files
  - `knowledge-graph`: 175 files
  - `social-publisher`: 133 files
- Large source files suggest some concentration of complexity:
  - `apps/social-publisher/src/app/bot.py` ~166 KB
  - `apps/news/src/news/db/repos.py` ~129 KB
  - `apps/social-publisher/src/app/main.py` ~57 KB
  - `apps/news/src/news/enrich/worker.py` ~82 KB
  - `apps/knowledge-graph/src/knowledge_graph/api.py` ~36 KB
  - `apps/agent-server/src/routes/routeManifest.ts` ~38 KB
- `agent-server` appears to have many `*.test.ts` files under `src/`, but the rough directory count showed no top-level `tests/` folder. That is not inherently bad, but it makes test discoverability less uniform than in other services.
- Monorepo docs include some clearly transitional/proposal material (for example CI/CD strategy proposals vs current GCP usage), which increases the chance that documentation lags operational reality in places.
- Python runtime versions differ notably across services, which increases maintenance burden and developer environment complexity.

### Interpretation / inference
- Overall maturity appears **solid but uneven**: some services look heavily engineered and documented; others appear intentionally minimal or in active transition.
- The platform likely has meaningful product traction or internal importance, because the migration history, test inventory, and operational docs are deeper than a prototype.
- However, there are signs of **complexity accumulation** in a few core modules and background-worker services.

### Confidence
- **Moderate to high**

---

## 6) Operational and business risk signals

### Observed facts
The strongest explicit risk evidence comes from `docs/monorepo/SCALING_SAFETY.md`:
- `knowledge-graph`: documented SAFE for horizontal scaling
- `frontend`: SAFE
- `cryptofeed`: SAFE with cap
- `agent-server`: CAUTION (in-memory usage buffer, SSE behavior)
- `alerts`: UNSAFE; background dispatcher causes duplicate notifications if multiple instances run
- `news`: UNSAFE; multiple background workers lack cross-instance coordination
- `social-publisher`: UNSAFE; duplicate posts possible without single-instance control

Additional explicit coupling/risk signals:
- `knowledge-graph` is documented as the most widely consumed internal API.
- Telegram bot token is shared across multiple services and requires coordinated rotation.
- `agent-server` + `alerts` share one database.
- Config variable naming is inconsistent across services for similar concepts (e.g. KG base URL names differ by service).

### Interpretation / inference
Priority operational risks visible from repository structure alone:
1. **Single-instance worker assumptions** in `alerts`, `news`, and `social-publisher` create scale/reliability risk and operational fragility.
2. **Knowledge-graph dependency concentration** creates high blast radius; schema/API changes there could break many systems.
3. **Shared bot identity and shared DB coupling** simplify product behavior but increase incident coupling.
4. **Polyglot / multi-runtime operational overhead** likely raises onboarding and platform maintenance cost.
5. **Documentation vs runtime drift risk** exists because the repo includes both current-state docs and future-state proposals.

### Confidence
- **High** on identified explicit risks; **moderate** on business impact magnitude.

---

## 7) What seems especially important strategically

### Observed facts
- `agent-server` contains modules for auth, billing, credits, guest access, onboarding, referral, notifications, portfolio, watchlist, Telegram, WhatsApp, and X integration.
- `frontend` is by far the largest app by file count and includes comprehensive UI/testing scaffolding.
- `news` and `knowledge-graph` both have substantial docs, migrations, and tests, indicating centrality.
- `social-publisher` contains backtesting, dashboards, reply composition/testing, and webhook/news publishing flows.

### Interpretation / inference
This repo likely captures several core company assets at once:
- the consumer/web/chat product layer,
- the proprietary market/news data processing layer,
- the internal entity-resolution / intelligence backbone,
- the outbound engagement/distribution system.

In other words, this is not just “product code”; it likely embodies both **product surface** and **differentiating internal data/AI workflows**.

### Confidence
- **Moderate to high**

---

## What We Don’t Know

These questions could not be resolved confidently from a bounded repo inspection alone:

1. **Production criticality by service**
   - Which services are user-critical vs experimental vs legacy-adjacent?
2. **Actual deployment topology today**
   - Docs reference current GCP setup and future/proposed alternatives; operational truth should be verified directly.
3. **Runtime health / incident history**
   - Repo inspection cannot confirm uptime, failure rates, queue lag, alert duplication frequency, or deployment pain.
4. **Security posture**
   - Passive review cannot determine secret handling quality in practice, auth hardening quality, dependency exposure, or compliance posture.
5. **Team ownership and on-call clarity**
   - Service docs imply boundaries, but actual ownership/on-call responsibilities are not obvious from the sampled files.
6. **Dead code / stale code extent**
   - Some docs mention proposals and revival/minimal states; a deeper audit is needed to determine how much is active.
7. **Test effectiveness vs test volume**
   - There are many tests, but I did not run them or validate coverage quality/failure rates.
8. **Economic dependencies**
   - The cost profile and rate-limit sensitivity of external dependencies (Binance, Tardis, Telegram, X, Vertex/OpenAI/GenAI) are not measurable from static review alone.

## Prioritized follow-up recommendations

### 1) Validate current production topology and single-instance controls
**Priority: Highest**
- Confirm which services are deployed single-instance by design (`alerts`, `news`, `social-publisher`) and how that is enforced in production.
- Validate runbooks and autoscaling settings against the documented scaling safety guidance.
- This is the most immediate operational risk surfaced explicitly by the repo.

### 2) Perform a focused dependency/blast-radius review of `knowledge-graph`
**Priority: High**
- Map its public/internal API contracts, consumers, change cadence, and ownership.
- Because docs identify it as the most consumed internal API, it is probably the highest-leverage place to reduce platform fragility.

### 3) Audit the `agent-server` / `alerts` shared-database boundary
**Priority: High**
- Confirm schema ownership, migration discipline, and failure/isolation behavior.
- Shared DB ownership is workable but often becomes a long-term coordination hotspot.

### 4) Review large hotspot modules for maintainability and bus factor
**Priority: High**
- Start with:
  - `apps/social-publisher/src/app/bot.py`
  - `apps/news/src/news/db/repos.py`
  - `apps/news/src/news/enrich/worker.py`
  - `apps/social-publisher/src/app/main.py`
  - major route manifests in `agent-server`
- Goal: determine whether these are acceptable aggregation points or refactor candidates.

### 5) Normalize platform conventions where practical
**Priority: Medium**
- Areas worth evaluating:
  - config variable naming consistency,
  - Python version convergence,
  - test layout conventions,
  - standardized per-service ops docs/checklists.
- This is less urgent than operational risk, but helpful for scaling the team.

### 6) Run an evidence-based code health audit on a subset of services
**Priority: Medium**
- Suggested first pass: `agent-server`, `knowledge-graph`, `news`, `social-publisher`.
- Include test run results, lint/typecheck status, dependency freshness, and module complexity analysis.

### 7) Establish an “authoritative current state” architecture snapshot
**Priority: Medium**
- Some docs are explicitly current-state, while others are proposals or migration planning artifacts.
- A concise, versioned architecture status document would reduce ambiguity for leadership and engineering.

## Bottom-line assessment

### Observed-fact summary
- This is a real monorepo with multiple deployable services, service-specific migrations/CI, substantial docs, and significant test inventory.
- The repository spans chat/backend, frontend, knowledge graph, news pipeline, market data ingestion, alerts, social publishing, and AI skill/tool infrastructure.
- It uses a mix of TypeScript/Fastify/Next.js and Python/FastAPI services, with PostgreSQL-centered persistence and GCP-oriented deployment artifacts.
- The repo itself explicitly documents several important architectural constraints and risks, especially around multi-instance safety for worker-heavy services.

### Interpretation / inference
- The repository appears to be a **core company asset in substance, not just in label**: it likely contains both the primary product surfaces and much of the proprietary data/AI workflow backbone.
- It looks **mature enough to be strategically important**, but also **complex enough that operational discipline and architecture stewardship matter a lot**, especially around coordination-heavy worker services and dependency concentration in the knowledge graph.

## Confidence
- **High**: repo purpose, service list, major stack, monorepo structure, documented dependency/scaling constraints
- **Moderate**: overall maintainability assessment, degree of architectural strain, relative product criticality of each service
- **Low to moderate**: security posture, runtime reliability, documentation accuracy vs deployed reality in every detail

# Research Findings — social-publisher addendum

## Summary
`apps/social-publisher` in `stingray-mono` is not a blank growth-automation idea bucket; it already appears to be a fairly substantial service for automated social distribution and engagement, especially on X, Telegram, and Polymarket-adjacent surfaces. The strongest evidence is a real FastAPI service, DB-backed queues/ledgers, migrations, Cloud Run CI/CD for development/staging/production, manual operator tooling, many tests, and explicit runbooks/docs for webhook cutover and posting behavior (sources: `apps/social-publisher/README.md`, `src/app/main.py`, `src/news/posting.py`, `src/app/bot.py`, `cicd/services/social-publisher/README.md`).

Implication for roadmap planning: Month 1 should **not** prioritize building another generic X/Telegram/news-posting bot from scratch. Instead, near-term growth work should treat existing `social-publisher` automation as a reusable asset and shift incremental product-growth focus toward the user’s newly stated highest-conviction bet: **group chat bot invite/distribution**, with use cases around alerting, online backtesting, market Q&A, and summarizing news/signals. Awareness looks like the main bottleneck, so roadmap effort should emphasize packaging, channel fit, and user-facing hooks rather than duplicating already-built backend posting automation.

## Methodology
- Read canonical work-order artifacts available for this WO: `request.md`, `brief.md`, and status metadata via workflow tools.
- Inspected `stingray-mono/apps/social-publisher` repository structure, docs, configs, tests, migrations, and deployment config.
- Focused on concrete evidence of implemented behavior rather than aspirational naming.
- Limitations:
  - No live deployment verification or runtime metrics were available in this task.
  - Canonical `plan.md` and `delivery/index.md` were listed in status metadata but not yet present/readable in the work order at time of analysis.
  - Conclusions below infer maturity from code/docs/tests/ops assets, not from production usage volume.

## Findings

### 1) What `social-publisher` appears to do today
- Evidence:
  - README describes it as the home for “Stingray Social Publisher (X/Twitter + Telegram)” and exposes:
    - `GET /health`
    - `POST /run`
    - `POST /news/publish`
    - `POST /news/webhook`
    - `POST /news/process`
    - `POST /replies/process`
    - manual reply operator endpoints/UI (`/ops/manual-replies*`) (`apps/social-publisher/README.md`, `src/app/main.py`).
  - `src/news/posting.py` implements a DB-backed news publishing pipeline with staleness filters, cadence controls, per-channel formatting, dedupe, queue/retry behavior, Telegram updates/edits, X posting, and Polymarket comment posting.
  - `src/app/bot.py` implements a more advanced reply/engagement pipeline: ingest tweets from monitored accounts or mentions, persist candidates, triage with Vertex, resolve entities via KG, pull news context, optionally fetch prediction-market/Polymarket market data, compose replies, run quality gates, slot/rate-limit selection, then post or queue for manual review.
  - The service includes manual-reply operator UI/feed/websocket/RSS endpoints, so it can run semi-automated rather than purely autonomous workflows (`src/app/main.py`).
- Confidence: high
- Implications:
  - The repo already contains a serious social automation substrate.
  - “Growth engineering” should be framed as extending or retargeting this substrate, not inventing a first version.

### 2) Growth channels and loops already covered
- Evidence:
  - **X / Twitter news posting**: implemented through `NewsPublisher`, with cadence, dedupe, importance gating, URL attachment, dry-run/live modes (`src/news/posting.py`, `docs/news-posting.md`).
  - **Telegram publishing**: implemented alongside X, with bot token/chat configuration, message send/edit support, and webhook cutover docs (`README.md`, `src/app/main.py`, `docs/news-webhook-cutover-runbook.md`).
  - **News ingestion → publish loop**: `POST /news/webhook` accepts upstream `stingray-news` payloads and pushes them through the same queue/publish system (`README.md`, `src/app/main.py`, `docs/news-webhook-cutover-runbook.md`).
  - **X reply-hijack / account-reply loop**: active docs and code show monitoring allowlisted accounts such as CoinDesk, KobeissiLetter, Polymarket, Kalshi, jessepollak, armaniferrante, HyperliquidX, then generating and posting replies under guardrails (`docs/reply-hijack.md`, `docs/reply-targets.md`, `src/app/bot.py`).
  - **Manual operator loop for replies**: if autopost is disabled, operators can review queue items via UI/feed/RSS/API and manually post/ack them (`README.md`, `src/app/main.py`).
  - **Polymarket comment loop**: `NewsPublisher` can resolve linked prediction-market slugs and create Polymarket comments; tests cover posting, dedupe, fanout to multiple markets, spacing, and rate-limit deferral (`src/news/posting.py`, `tests/test_polymarket_news_posting.py`).
  - **Backtesting / optimization loop for reply policy**: scripts and analysis modules support historical replay, simulation, funnel reports, and dashboarding (`README.md`, `scripts/reply_backtest_*.py`, `src/analysis/reply_backtesting.py`).
- Confidence: high
- Implications:
  - The user’s earlier candidate ideas like X reply bot and Polymarket comment bot are **already materially present** in the codebase.
  - Reddit is notably **not evidenced** here; neither is Discord/community-group automation as a first-class implemented loop.
  - Telegram exists mainly as a publishing destination, not clearly yet as an invite/distribution/community bot product.

### 3) What looks production-ready vs experimental

#### 3A) More production-ready / operationalized
- Evidence:
  - Cloud Build/Cloud Deploy/Cloud Run setup across development, staging, production with documented service names and promotion flow (`cicd/services/social-publisher/README.md`).
  - Dedicated DB migrations for ledger, queue, x_ingested_tweets, reply_candidates, reply_jobs, ingest_audit (`migrations/social-publisher/*.sql`).
  - HMAC-authenticated webhook flow with tests for valid/invalid signatures and payload validation (`src/app/main.py`, `tests/test_news_webhook_endpoint.py`).
  - Many tests across config, webhook endpoints, posting ledger, reply candidate ingest/filtering/triage/compose/posting, X client/rate coordination, Polymarket and Telegram pathways (`tests/` folder contents).
  - Runbooks for webhook cutover and environment verification (`docs/news-webhook-cutover-runbook.md`).
  - Safety/operational controls: dry-run modes, rate coordination, posting guards, queue leasing/retry, dedupe, spacing, per-day caps, manual fallback UI (`README.md`, `src/news/posting.py`, `src/app/bot.py`).
- Confidence: high
- Implications:
  - News publishing to X/Telegram appears closest to production-grade.
  - The surrounding ops posture is much stronger than “prototype script” level.

#### 3B) Mid-maturity / likely usable but still tuning-heavy
- Evidence:
  - Reply pipeline is sophisticated and deeply instrumented, but it depends on several upstream services/configs: Vertex, knowledge graph, news-context service, optional Polymarket Gamma, and careful tuning of triage and quality gates (`src/app/bot.py`, `.env.example`).
  - README explicitly says the repo is “intentionally minimal for now while the implementation is revived,” which suggests active rework or reactivation despite real code/assets (`apps/social-publisher/README.md`).
  - Reply docs still refer to “NLP API” at a high level, while code is more evolved and Vertex-based; that mismatch suggests docs may lag implementation maturity (`docs/reply-hijack.md` vs `src/app/bot.py`).
  - Heavy emphasis on backtesting, simulation, policy tuning, dry runs, and manual operator mode suggests the team is still optimizing quality/precision before trusting full automation broadly (`README.md`, backtest scripts, manual reply endpoints).
- Confidence: moderate-high
- Implications:
  - The X reply engine is more than experimental, but it still looks like a tuned growth/research system rather than a fully finished “set and forget” acquisition channel.
  - Good candidate for selective extension, not for being the center of Month 1 product roadmap.

#### 3C) More experimental / less evidenced as mature product-growth surfaces
- Evidence:
  - No strong evidence in `social-publisher` of Reddit bot support.
  - No strong evidence of Discord-native community growth loops.
  - Telegram appears strongly supported for outbound publishing, but I found less evidence of a user-facing **group-chat product bot** with onboarding/invite mechanics, conversational Q&A, alert subscriptions, or backtest execution flows inside group chats.
  - Polymarket support is real, but production Polymarket comment posting is noted as relying on a rotatable browser-session credential, which usually implies some operational fragility relative to standard API-backed channels (`cicd/services/social-publisher/README.md`).
- Confidence: moderate
- Implications:
  - The missing surface relative to the user’s latest guidance is not “another X bot”; it is the **community/group-distribution product surface**.
  - If awareness is the bottleneck, group invite loops and chat-native utility appear more incremental-to-net-new than duplicating existing social-publisher work.

### 4) How this should change the Month 1 roadmap
- Evidence basis:
  - Existing social-publisher already covers X reply automation, X news posting, Telegram publishing, and Polymarket comment automation.
  - User’s updated guidance says:
    - highest near-term bet is likely **group chat bot invite**
    - killer use cases are **alerting, online backtesting, market Q&A, summarizing news/signals**
    - biggest bottleneck is **awareness**
- Confidence: moderate-high
- Implications:
  - Month 1 should shift from “build growth bots” toward **productized distribution and awareness loops**.
  - Recommended roadmap adjustment (interpretive, not final strategy decision):
    1. **Do not prioritize a new generic X reply bot or generic Polymarket comment bot as a fresh initiative.** Those areas already appear covered enough that net-new Month 1 work should be framed as tuning/instrumentation/reuse if needed.
    2. **Elevate group-chat distribution/invite mechanics as the primary new growth-product bet.** This looks less redundant with existing automation and aligns with awareness as the bottleneck.
    3. **Use existing social-publisher as content/alert plumbing feeding the group experience.** The repo already suggests a usable backend for pushing news/signals/market updates to Telegram/X; Month 1 should leverage that rather than replace it.
    4. **Focus user-facing chat utility on the four named wedges:**
       - alerting
       - online backtesting
       - market Q&A
       - summarizing news/signals
       These are more likely to make a group bot invite-worthy than another outbound posting bot.
    5. **Treat outbound growth automation as secondary optimization work in Month 1.** The higher-ROI question seems to be packaging/placement/distribution of product value, not adding another posting channel abstraction.

### 5) Concrete roadmap interpretation: what to build vs what to reuse
- Evidence:
  - Existing infra already includes queueing, auth, background workers, rate limits, posting rails, and Telegram support.
- Confidence: moderate
- Implications:
  - **Reuse / lightly extend:**
    - Telegram outbound publishing rail
    - news/signals webhook/publish path
    - X reply/news automation if still valuable for awareness capture
    - backtesting/reporting infrastructure mindset for evaluating channel quality
  - **Net-new / likely underbuilt relative to the latest strategy:**
    - group-chat invite mechanics
    - chat-native onboarding to useful workflows
    - bot behavior designed for shared/group use, not just outbound broadcast
    - clear measurement of invite → activation → retained usage in group contexts
    - user-facing flows for alerting, backtesting, market Q&A, and summarized signals inside chat

## What We Don’t Know
- Whether `social-publisher` is currently active in production at meaningful volume, or merely deployable.
- Current performance/ROI by channel: X reply bot, X news posting, Telegram publishing, Polymarket comments.
- Whether there is already a separate repo/service for a group chat bot beyond `social-publisher`.
- Whether Telegram is the intended group-chat venue versus Discord/other chat surfaces.
- Whether the existing Telegram integration is already close to the desired invite-driven group experience but undocumented here.

## Recommendation
Interpretation for roadmap owners: treat `social-publisher` as an existing automation platform, not as a blank-slate Month 1 workstream. In the next month, avoid duplicating generic social posting/reply automation and instead concentrate new effort on the awareness bottleneck through **invite-worthy group chat product experiences**. The most leverage likely comes from combining existing outbound automation/publishing rails with a sharper group-chat wedge around alerts, online backtesting, market Q&A, and concise news/signal summaries.

## Source Notes
Primary sources inspected:
- `apps/social-publisher/README.md`
- `apps/social-publisher/.env.example`
- `apps/social-publisher/src/app/main.py`
- `apps/social-publisher/src/app/bot.py`
- `apps/social-publisher/src/news/posting.py`
- `apps/social-publisher/docs/news-posting.md`
- `apps/social-publisher/docs/reply-hijack.md`
- `apps/social-publisher/docs/reply-targets.md`
- `apps/social-publisher/docs/news-webhook-cutover-runbook.md`
- `apps/social-publisher/tests/test_news_webhook_endpoint.py`
- `apps/social-publisher/tests/test_polymarket_news_posting.py`
- `apps/social-publisher/tests/test_reply_posting.py`
- `cicd/services/social-publisher/README.md`

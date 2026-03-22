# Daily Reporting

Daily reporting is a separate system from work orders. Work orders track active
execution. Daily reports track the operational posture of the company.

## Why Daily Reports Are Separate

Daily reports answer different questions:

- What did each lane do today?
- What is blocked?
- What decisions were made?
- What needs human attention tomorrow?

They should not be reconstructed by scraping work-order chat history.

## Why Cron, Not Heartbeat

Braid should use cron-style scheduled jobs for formal daily reporting.

Reasons:

- Daily reports are explicit and scheduled
- They should be logged and predictable
- They should run in a fresh reporting context
- They should not depend on ambient conversational history

Heartbeat remains useful later for lightweight intraday checks, but not as the
formal reporting channel.

## Daily Reports Do Not Carry Urgent Alerts

Daily reports summarize operational posture. They do not replace the urgent
escalation path in the work-order protocol.

That means:

- blocked work should update `status.yaml` immediately
- critical `qa_guard` findings should notify `chief_of_staff` immediately
- `critical` incidents or `needs_human_attention: true` should reach the human without waiting for end-of-day reporting

## Report Store Layout

```text
org/reports/daily/YYYY-MM-DD/
  chief_of_staff.md
  product_lead.md
  tech_lead.md
  growth_hacker.md
  research_analyst.md
  design_lead.md
  frontend_engineer.md
  backend_engineer.md
  platform_engineer.md
  qa_guard.md
org/reports/daily/YYYY-MM-DD-summary.md
```

## Per-Role Daily Report Contract

Every role writes the same sections:

- Completed
- In Progress
- Blockers
- Decisions
- Next Actions
- Metrics

Suggested report shape:

```md
---
date: 2026-03-22
role: tech_lead
status: on_track
---

## Completed

## In Progress

## Blockers

## Decisions

## Next Actions

## Metrics
```

## Role-Specific Metric Examples

- `growth_hacker`
  - channel output
  - experiment results
  - SEO movement
  - audience or traffic signals
- `tech_lead`
  - work orders advanced
  - integration risks
  - major technical decisions
- `qa_guard`
  - reviews passed
  - reviews failed
  - critical findings
- `platform_engineer`
  - deployments
  - incidents
  - uptime or reliability concerns

## Executive Summary Contract

`chief_of_staff` writes the only cross-company summary by default:

- Company Snapshot
- Key Wins
- Risks And Blockers
- Missing Reports
- What Needs Human Attention
- Tomorrow

Suggested shape:

```md
---
date: 2026-03-22
type: executive_summary
---

## Company Snapshot

## Key Wins

## Risks And Blockers

## Missing Reports

## What Needs Human Attention

## Tomorrow
```

## Reporting Rules

- Every role reports only its own lane
- No role summarizes peers except `chief_of_staff`
- Missing reports must be called out explicitly
- "Nothing material changed" is a valid report, but silence is not
- Reports should be generated from fresh isolated turns, not long-lived chat state
- Urgent escalation always takes precedence over the scheduled reporting loop

## Recommended Ordering

Stagger the jobs so synthesis happens last:

1. leaf roles
2. lane owners
3. `chief_of_staff`

Suggested order:

1. `research_analyst`
2. `design_lead`
3. `frontend_engineer`
4. `backend_engineer`
5. `platform_engineer`
6. `qa_guard`
7. `product_lead`
8. `tech_lead`
9. `growth_hacker`
10. `chief_of_staff`

## Delivery Policy

Default policy:

- role reports stay in the report store
- `chief_of_staff` reads all available role reports
- `chief_of_staff` sends one executive summary to the human

This keeps the human channel high-signal.

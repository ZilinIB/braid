# Work-Order Protocol

Work orders are the canonical record of active company work in Braid. Chat
transcripts are not the source of truth.

## Work-Order Types

Braid v1 supports:

- `build`
- `research`
- `growth`
- `ops`

`ops` supports these modes:

- `planned_change`
- `incident`
- `maintenance`

## Directory Layout

Each work order lives in a fixed directory shape:

```text
org/work-orders/WO-YYYY-MM-DD-###/
  status.yaml
  request.md
  brief.md
  plan.md
  spec/
    index.md
  delivery/
    index.md
  review/
    index.md
```

Not every file must exist immediately, but the schema is fixed.

The fixed roots stay small and canonical. The expandable families allow one work
order to hold multiple domain-specific outputs without forcing everything into
one flat file.

## Artifact Model

### `request.md`

Purpose:

- raw request from the user
- initial framing and constraints

Owner:

- `chief_of_staff`

### `brief.md`

Purpose:

- problem framing
- scope boundaries
- constraints
- success criteria

Owner:

- `product_lead` for `build` and `research`
- `growth_hacker` for `growth`
- `tech_lead` for `ops`

### `plan.md`

Purpose:

- ordered execution steps
- lane routing
- dependencies
- explicit deliverables

Owner:

- `product_lead` for `research`
- `tech_lead` for `build` and `ops`
- `growth_hacker` for `growth`

### `spec/`

Purpose:

- canonical implementation, design, research, or campaign specification
- optional sub-specs such as `frontend.md`, `backend.md`, or `api.md`

Owner:

- canonical owner depends on work-order type
- `index.md` is the authoritative summary file for the family

Note:

- delegated roles may contribute sub-files, but they do not own the canonical family summary

### `delivery/`

Purpose:

- produced output
- implementation summary
- research findings
- campaign deliverable
- execution notes
- optional role-scoped contributions such as `frontend_engineer.md`

Owner:

- lane owner owns `delivery/index.md`
- delegated roles may author scoped contribution files within the family

### `review/`

Purpose:

- quality verdict
- findings
- evidence
- pass/fail or go/no-go outcome
- optional review slices such as `security.md` or `post-incident.md`

Owner:

- `qa_guard` owns `review/index.md`

### `status.yaml`

Purpose:

- machine-readable source of work-order state

Owner:

- workflow system, not freeform chat

## Artifact Ownership Rules

- Every canonical singleton or family summary has exactly one owner at a time
- `spec/index.md`, `delivery/index.md`, and `review/index.md` are the canonical files for their families
- Delegated roles may author scoped sub-artifacts inside a family, but those files do not override the family summary
- `status.yaml` is treated as system-owned
- Work advances through artifact creation or update, not by conversational claims

## Review Policies

Each work-order type carries a review policy:

- `required`
  review must pass through `qa_guard` before approval
- `optional`
  lane owner may approve directly, but can still request `qa_guard` review
- `expedited`
  review still routes through `qa_guard`, but with incident-style urgency

## State Machine

States:

- `opened`
- `briefed`
- `planned`
- `in_execution`
- `in_review`
- `approved`
- `done`
- `blocked`
- `cancelled`

## Transition Table

| From | To | Requested By | Required Condition |
| --- | --- | --- | --- |
| none | `opened` | `chief_of_staff` | `request.md` exists |
| `opened` | `briefed` | brief owner | `brief.md` exists |
| `briefed` | `planned` | plan owner | `plan.md` exists |
| `planned` | `in_execution` | lane owner | executable scope exists |
| `in_execution` | `in_review` | lane owner | `delivery/index.md` exists and review policy is `required` or `expedited` |
| `in_execution` | `approved` | lane owner | `delivery/index.md` exists and review policy is `optional` |
| `in_review` | `approved` | `qa_guard` | `review/index.md` exists and passes |
| `in_review` | `planned` | `qa_guard` | `review/index.md` exists and requires rework |
| any active state | `blocked` | `chief_of_staff` or lane owner | blocker recorded |
| `blocked` | `planned` | lane owner | blocker cleared |
| `approved` | `done` | `chief_of_staff` | final summary ready |
| any non-final state | `cancelled` | `chief_of_staff` | cancellation reason recorded |

## Lane Ownership

Lane owner by work-order type:

- `build` -> `tech_lead`
- `research` -> `product_lead`
- `growth` -> `growth_hacker`
- `ops` -> `tech_lead`

Important nuance:

- For `build`, `product_lead` usually owns the `brief`, but `tech_lead` owns the
  lane once planning begins.
- `chief_of_staff` remains the cross-lane coordinator and the closer.

Review policy by type:

- `build` -> `required`
- `research` -> `optional`
- `growth` -> `required`
- `ops/planned_change` -> `required`
- `ops/maintenance` -> `required`
- `ops/incident` -> `expedited`

## Controlled Baton Transfers

Allowed baton transfers:

- `product_lead -> tech_lead` for `build`
- `growth_hacker -> tech_lead` for `growth` when implementation is required

Protocol rules:

- baton transfers are recorded in `status.yaml`
- baton transfers change lane ownership without broadening the chat graph
- baton transfers are validated by the workflow layer, which then notifies `chief_of_staff`
- `chief_of_staff` performs the actual spawn of the receiving role
- baton transfers are not executed by freeform peer messaging

## Ops Modes

### Planned Change

Examples:

- infrastructure updates
- deployment process changes
- observability improvements
- migrations and scheduled maintenance work

Typical flow:

`chief_of_staff -> tech_lead -> platform_engineer -> qa_guard -> chief_of_staff`

### Incident

Examples:

- outage response
- degraded deploy rollback
- urgent reliability or security response

Typical flow:

`chief_of_staff -> tech_lead -> platform_engineer -> qa_guard -> chief_of_staff`

Incident notes:

- `brief.md` captures impact, affected systems, and immediate response goal
- `plan.md` captures mitigation and response sequencing
- `delivery/` records actions taken and current system posture
- `review/` captures expedited validation and post-incident review
- `status.yaml` should default severity to at least `high`

## Urgent Escalations

Urgent signaling is separate from daily reports.

Severity levels:

- `normal`
- `high`
- `critical`

Typical escalation triggers:

- work order moved to `blocked`
- `qa_guard` records a critical finding
- `ops` work order enters `incident` mode
- a lane owner marks `needs_human_attention: true`

Required effects:

- update `status.yaml` immediately
- notify `chief_of_staff` immediately for `high` and `critical`
- notify the human immediately for `critical` or `needs_human_attention: true` through `chief_of_staff`'s user-facing session
- keep the escalation attached to the active work order rather than waiting for a daily report

## Example `status.yaml`

```yaml
id: WO-2026-03-22-001
title: Launch landing page refresh
type: build
state: in_review
priority: high
owner: chief_of_staff
lane_owner: tech_lead
review_policy: required
severity: normal
needs_human_attention: false
opened_at: 2026-03-22T10:00:00Z
updated_at: 2026-03-22T14:30:00Z
current_lane: quality
current_role: qa_guard
approved: false
blocked_by: []
baton_history:
  - from: product_lead
    to: tech_lead
    reason: implementation_required
artifacts:
  request: request.md
  brief: brief.md
  plan: plan.md
  spec: spec/index.md
  delivery: delivery/index.md
  review: review/index.md
```

## Protocol Rules

- Canonical files beat chat transcripts
- Family `index.md` files beat family sub-artifacts when they disagree
- Lane owners integrate worker output into canonical progress
- Leaf roles do not advance the state machine by themselves unless their contribution is complete and handed back through the lane owner
- `qa_guard` may pass, fail, or return a work order to planning, but does not directly coordinate with implementers as the default path
- Cross-lane changes use `chief_of_staff` or the approved baton-transfer rules
- Daily reports never substitute for urgent escalation handling

# Roles And Graph

Braid models a company as lanes, not a flat chat. Each role owns a lane, and
only a small set of roles may move work between lanes.

## Naming

- Repo ids use snake_case
- Display names stay simple and human-readable
- Only `chief_of_staff` is user-facing by default

## Company Roster

### `chief_of_staff`

Mission:
Own intake, clarification, routing, final summaries, and daily executive rollup.

Canonical ownership:

- `request.md`
- final closeout to the human
- daily executive summary

Can spawn:

- `product_lead`
- `tech_lead`
- `growth_hacker`
- `research_analyst`
- `qa_guard`

Must not do:

- deep domain execution except trivial requests
- bypass canonical artifacts when routing work

### `product_lead`

Mission:
Turn requests into clear scope, priorities, constraints, and success criteria.

Canonical ownership:

- `brief.md` for `build` and `research`
- `plan.md` for `research`
- `spec/index.md` and `delivery/index.md` for `research`

Can author:

- scoped `spec/` and `delivery/` contributions when coordinating research output

Can spawn:

- `research_analyst`
- `design_lead`
- `qa_guard`

Must not do:

- delegate directly to engineers
- redefine architecture
- answer the user directly
- bypass the baton-transfer protocol when handing `build` work to `tech_lead`

### `tech_lead`

Mission:
Own the technical lane from execution planning through integration and review.

Canonical ownership:

- `plan.md` for `build` and `ops`
- `spec/index.md` and `delivery/index.md` for `build` and `ops`

Can author:

- sub-specs and delivery summaries inside `spec/` and `delivery/`

Can spawn:

- `research_analyst`
- `design_lead`
- `frontend_engineer`
- `backend_engineer`
- `platform_engineer`
- `qa_guard`

Must not do:

- redefine product scope
- answer the user directly

### `growth_hacker`

Mission:
Own distribution, audience growth, SEO, social execution, experiments, and launch planning.

Canonical ownership:

- `brief.md`, `plan.md`, `spec/index.md`, and `delivery/index.md` for `growth`

Can author:

- scoped `spec/` and `delivery/` contributions for campaign work

Can spawn:

- `research_analyst`
- `design_lead`
- `qa_guard`

Must not do:

- delegate directly to engineers
- redefine product or technical scope
- answer the user directly
- bypass the baton-transfer protocol when implementation is required

### `research_analyst`

Mission:
Gather evidence: market, user, competitive, technical, topical, or SEO research.

Can author:

- scoped `delivery/` research artifacts
- delegated `spec/` contributions when a lane owner needs evidence in spec form

Can spawn:

- none

Must not do:

- make final product, technical, or growth decisions
- write canonical summary files they do not own

### `design_lead`

Mission:
Own UX/UI and communication design execution within the active lane.

Can author:

- scoped `delivery/` design artifacts
- delegated `spec/` contributions for UX, UI, and communication design

Can spawn:

- none

Must not do:

- own scope
- own technical architecture
- answer the user directly
- write canonical summary files they do not own

### `frontend_engineer`

Mission:
Implement client-side interfaces and frontend behavior.

Can author:

- scoped `delivery/` frontend implementation artifacts

Can spawn:

- none

Must not do:

- redefine requirements
- bypass review

### `backend_engineer`

Mission:
Implement APIs, data models, integrations, and server-side behavior.

Can author:

- scoped `delivery/` backend implementation artifacts

Can spawn:

- none

Must not do:

- redefine requirements
- bypass review

### `platform_engineer`

Mission:
Own environments, CI/CD, observability, deployment, and reliability execution.

Can author:

- scoped `delivery/` platform and reliability artifacts

Can spawn:

- none

Must not do:

- redefine feature behavior
- bypass review

### `qa_guard`

Mission:
Own evidence-based validation, quality gates, risk findings, and release readiness.

Canonical ownership:

- `review/index.md`

Can author:

- scoped files inside `review/` for findings, security slices, or post-incident review

Can spawn:

- none

Must not do:

- silently fix implementation work
- redefine scope
- bypass the lane owner

## Authority Model

- Human-facing authority: `chief_of_staff`
- Scope authority: `product_lead`
- Technical authority: `tech_lead`
- Distribution authority: `growth_hacker`
- Quality gate authority: `qa_guard`

## Allowed Communication Graph

The default graph is spawn-first:

```text
chief_of_staff -> product_lead
chief_of_staff -> tech_lead
chief_of_staff -> growth_hacker
chief_of_staff -> research_analyst
chief_of_staff -> qa_guard

product_lead -> research_analyst
product_lead -> design_lead
product_lead -> qa_guard

tech_lead -> research_analyst
tech_lead -> design_lead
tech_lead -> frontend_engineer
tech_lead -> backend_engineer
tech_lead -> platform_engineer
tech_lead -> qa_guard

growth_hacker -> research_analyst
growth_hacker -> design_lead
growth_hacker -> qa_guard
```

## Controlled Baton Transfers

Cross-lane handoffs inside an already-open work order may use protocol-controlled
baton transfers.

Allowed baton transfers:

```text
product_lead -> tech_lead   on build work orders
growth_hacker -> tech_lead  on growth work orders with implementation_required
```

Rules:

- a baton transfer is recorded in `status.yaml`
- the transfer is executed by the workflow layer, not by raw peer chat
- the transfer changes lane ownership without reopening intake through the user path
- `chief_of_staff` remains the closer and the only user-facing summary role

## Forbidden Edges

These are first-class protocol rules, not suggestions:

- user -> any role except `chief_of_staff`
- worker -> worker
- reviewer -> implementer direct loop
- `growth_hacker` -> engineers
- `product_lead` -> engineers
- orchestrator -> orchestrator peer handoff outside the approved baton-transfer rules
- cross-agent `sessions_send` as the default communication mechanism

## Cross-Lane Rule

New work enters through `chief_of_staff`. Existing work orders may change lanes
through `chief_of_staff` or an approved baton transfer.

Examples:

- If `product_lead` decides a `build` work order needs engineering execution, it
  records the baton transfer to `tech_lead` instead of routing through freeform chat.
- If `growth_hacker` decides a campaign needs implementation work, it does not
  spawn engineers directly. It requests a baton transfer into the tech lane.
- If a lane wants to open brand-new work rather than continue the current work order,
  it still routes back through `chief_of_staff`.

## Example Flows

### Build Request

```text
User
  -> chief_of_staff
  -> product_lead
  -> tech_lead
  -> frontend_engineer/backend_engineer/platform_engineer
  -> qa_guard
  -> chief_of_staff
  -> User
```

### Research Request

```text
User
  -> chief_of_staff
  -> product_lead
  -> research_analyst
  -> qa_guard (optional)
  -> chief_of_staff
  -> User
```

### Growth Request

```text
User
  -> chief_of_staff
  -> growth_hacker
  -> research_analyst/design_lead
  -> tech_lead (only when implementation_required)
  -> frontend_engineer/backend_engineer/platform_engineer (optional)
  -> qa_guard
  -> chief_of_staff
  -> User
```

### Planned Ops Change

```text
User
  -> chief_of_staff
  -> tech_lead
  -> platform_engineer
  -> qa_guard
  -> chief_of_staff
  -> User
```

### Ops Incident

```text
User or monitoring signal
  -> chief_of_staff
  -> tech_lead
  -> platform_engineer
  -> qa_guard (expedited review / post-incident validation)
  -> chief_of_staff
  -> User
```

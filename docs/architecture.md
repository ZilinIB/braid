# Architecture

Braid is a thin but opinionated organization layer on top of OpenClaw. It does
not replace OpenClaw's runtime. It constrains and productizes how OpenClaw is
used to operate a software product company.

## System Overview

```text
                +----------------------+
                |      The Human       |
                +----------+-----------+
                           |
                           v
                +----------------------+
                |   chief_of_staff     |
                |  user-facing intake  |
                +----------+-----------+
                           |
                           v
                +----------------------+
                |   Braid Workflow     |
                |   protocol layer     |
                +----+------+------+---+
                     |      |      |
                     v      v      v
              +----------+  +----------+  +----------+
              | product  |  |  tech    |  | growth   |
              |  lane    |  |  lane    |  |  lane    |
              +----------+  +----------+  +----------+
                     \         |         /
                      \        |        /
                       v       v       v
                     +--------------------+
                     |   leaf workers     |
                     +--------------------+
                               |
                               v
                        +-------------+
                        |  qa_guard   |
                        +-------------+
```

## Major Components

### 1. Org Manifest

The org manifest is the single source of truth for:

- role definitions
- allowed spawn edges
- allowed baton transfers
- default models
- workspace paths
- artifact ownership
- escalation policy
- reporting configuration

See [manifest-schema.md](/home/zilinwang/developer/braid/docs/manifest-schema.md) and the default manifest at [software-product-company.yaml](/home/zilinwang/developer/braid/manifests/software-product-company.yaml).

### 2. Config And Persona Generator

The generator should produce:

- OpenClaw agent configuration
- per-role `SOUL.md`
- per-role `AGENTS.md`
- per-role `IDENTITY.md`
- workflow policy data

The goal is to avoid duplicated truth across config, personas, and docs.

### 3. OpenClaw Agent Topology

OpenClaw remains the substrate for:

- isolated agents
- routing bindings
- session and subagent execution
- role workspaces
- scheduling
- sandboxing

Braid relies on OpenClaw's existing strengths instead of replacing them.

### 4. Workflow And Ledger Layer

Braid needs a narrow protocol layer that owns:

- work-order creation
- artifact writes
- state transitions
- controlled baton transfers
- review gating
- urgent escalations
- daily report writes
- executive summary generation

This layer should be implemented as a small plugin or tool surface, not as
freeform file writes from every role.

### 5. Role Workspaces And Memory

Each role gets its own workspace and durable role memory.

Memory hierarchy:

- work-order ledger: canonical shared execution state
- daily report store: canonical operational reporting state
- role workspace memory: private durable role knowledge
- session transcripts: local conversational state, never authoritative

## Session Model

Braid is spawn-first.

Default rules:

- `sessions_spawn` is the normal delegation mechanism
- `sessions_send` is restricted and not part of the default workflow
- `chief_of_staff` is the only role that should stay user-bound and long-lived in v1
- lane owners and workers are usually invoked as fresh spawned sessions
- `max_spawn_depth: 2` is deliberate in v1 to preserve `chief_of_staff -> lane owner -> leaf worker`
- cross-lane baton transfers are protocol actions, not raw peer chat

Why:

- a spawned session creates a clean transcript boundary
- role memory still persists in the workspace
- work-order artifacts remain the shared truth
- the system avoids hidden drift across long-lived lateral chats

## Lane Transfer Model

`chief_of_staff` remains the front door and the closer, but Braid no longer
forces every cross-lane handoff through a human-facing round-trip.

Rules:

- new work orders are always opened by `chief_of_staff`
- final closeout still returns through `chief_of_staff`
- lane changes inside an already-open work order may use approved baton transfers
- baton transfers are recorded in workflow state and validated by the protocol layer
- once validated, the workflow layer notifies `chief_of_staff`
- `chief_of_staff` performs the actual spawn of the receiving role
- baton transfers do not imply unrestricted cross-agent `sessions_send`

This keeps prioritization centralized without making `chief_of_staff` the only
possible serialization point for active execution.

## Source Of Truth Hierarchy

From highest to lowest:

1. work-order ledger
2. daily report store
3. role workspace memory
4. session transcript state

If two layers disagree, the higher layer wins.

Urgent escalation signals are part of the work-order ledger and should not be
deferred into the daily reporting layer.

When escalation reaches the human, it should still be delivered through
`chief_of_staff`'s user-facing session rather than by a direct plugin message.

## Security And Trust Notes

Braid's first goal is workflow separation, not hard credential isolation.

That means:

- roles are separated by protocol and topology first
- permissions should still be narrowed by OpenClaw tool policy and spawn allowlists
- claims about strong secret isolation should wait until implementation proves them

## Non-Goals For V1

- no control UI
- no generic marketplace story
- no broad lateral agent chat
- no multi-org product surface yet
- no giant catalog of specialist roles

V1 is one company shape, one protocol, one reporting loop.

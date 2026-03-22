# Braid

Braid is an OpenClaw-native organization runtime for a software product company.
It is not a theme pack and not a generic prompt library. It defines a company
shape, a delegation graph, a work-order protocol, a reporting loop, and the
OpenClaw configuration needed to run that organization with real agent lanes.

## What Braid Is

- A role graph with explicit authority boundaries
- A spawn-first execution model on top of OpenClaw sessions and subagents
- A shared work-order ledger for active execution
- A per-role workspace memory model
- A scheduled daily reporting chain that rolls up through Chief of Staff

## What Braid Is Not

- A flat multi-agent group chat
- A GUI-first control plane
- A giant catalog of unrelated agents
- A replacement for OpenClaw

## Core Principles

- Persona and protocol are separate concerns
- External requests enter through one front door: `chief_of_staff`
- Delegation uses `sessions_spawn` by default
- Shared execution state lives in artifacts, not chat transcripts
- Role memory is durable, but private to the role workspace
- New work enters and closes through `chief_of_staff`
- Existing work orders may change lanes only through `chief_of_staff` or an approved baton transfer
- Progress is made by producing owned artifacts, not by freeform chat

## Default Company

The default Braid company is a lean software product company:

- `chief_of_staff`
- `product_lead`
- `tech_lead`
- `growth_hacker`
- `research_analyst`
- `design_lead`
- `frontend_engineer`
- `backend_engineer`
- `platform_engineer`
- `qa_guard`

See [roles-and-graph.md](/home/zilinwang/developer/braid/docs/roles-and-graph.md) for exact boundaries and the communication graph.

## Workflow Lanes

Braid v1 supports four work-order types:

- `build`
- `research`
- `growth`
- `ops`

`ops` further distinguishes:

- `planned_change`
- `incident`
- `maintenance`

Each work order moves through a small state machine and a fixed artifact model.
The protocol keeps `request.md`, `brief.md`, `plan.md`, and `status.yaml` as
fixed roots, while `spec/`, `delivery/`, and `review/` expand into artifact
families when work needs multiple domain-specific outputs. See
[work-order-protocol.md](/home/zilinwang/developer/braid/docs/work-order-protocol.md).

## Reporting Loop

Braid separates execution from operational reporting.

- Work orders track active company work
- Daily reports track each role's operational posture
- Urgent blockers and critical findings escalate immediately through the workflow protocol
- `chief_of_staff` produces the only executive summary by default

See [daily-reporting.md](/home/zilinwang/developer/braid/docs/daily-reporting.md).

## Architecture

Braid is designed as a thin but opinionated layer on top of OpenClaw:

- org manifest
- config and persona generator
- OpenClaw agent topology
- workflow and ledger plugin
- per-role workspaces and memory
- scheduled reporting jobs

See [architecture.md](/home/zilinwang/developer/braid/docs/architecture.md).

## Manifest

The default company shape is defined as a manifest, which future tooling should
use as the single source of truth for generation and runtime policy:

- Schema: [manifest-schema.md](/home/zilinwang/developer/braid/docs/manifest-schema.md)
- Default manifest: [software-product-company.yaml](/home/zilinwang/developer/braid/manifests/software-product-company.yaml)

## Status

This repository starts with protocol and design docs first. Phase 0 is revised
and ready for final lock review after the baton-transfer, artifact-family,
escalation, and `ops` updates landed in the protocol set. See
[roadmap.md](/home/zilinwang/developer/braid/docs/roadmap.md).

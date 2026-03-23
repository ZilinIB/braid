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

## Getting Started

### Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed and running
- Node.js 22+ and pnpm
- A messaging channel configured in OpenClaw (Telegram, Discord, Slack, etc.)

### Workspace Setup

Braid and OpenClaw live as sibling packages in a pnpm workspace. On a fresh
machine:

```bash
mkdir workspace && cd workspace
git clone git@github.com:ZilinIB/braid.git braid
./braid/scripts/setup-workspace.sh
```

This clones OpenClaw, creates the workspace config, and installs dependencies.

If you already have both repos cloned as siblings:

```bash
cd /path/to/parent-of-both-repos
./braid/scripts/setup-workspace.sh
```

The resulting directory structure:

```text
workspace/
  package.json              workspace root (not a git repo)
  pnpm-workspace.yaml
  openclaw/                 independent git repo
  braid/                    independent git repo
```

Both repos keep their own git history and remotes. The workspace config is
local development convenience — two small files that the setup script creates.

### Initialize Braid

```bash
cd braid
pnpm braid init --channel telegram
```

This validates the manifest, generates OpenClaw config + workspace files,
creates org directories, and produces a cron setup script.

### Integrate with OpenClaw

After `braid init`, you need to merge Braid's generated agent config into your
OpenClaw installation:

1. Copy the agent list, bindings, and plugin entry from
   `generated/braid/openclaw.json` into your OpenClaw config
2. Add the plugin path: `plugins.load.paths = ["/path/to/braid/src/plugin/openclaw"]`
3. Run `./generated/braid/setup-cron.sh` to create daily reporting cron jobs
4. Start OpenClaw and message `chief_of_staff`

### CLI Commands

```text
braid validate                  Validate the manifest
braid generate --channel <ch>   Generate config and workspace files
braid setup --channel <ch>      Generate + create org directories
braid init --channel <ch>       Full setup including cron script
braid setup-cron                Generate daily reporting cron jobs
```

All commands accept `--manifest <path>` (default: `manifests/software-product-company.yaml`).

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

See [docs/roles-and-graph.md](docs/roles-and-graph.md) for exact boundaries
and the communication graph.

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
[docs/work-order-protocol.md](docs/work-order-protocol.md).

## Reporting Loop

Braid separates execution from operational reporting.

- Work orders track active company work
- Daily reports track each role's operational posture
- Urgent blockers and critical findings escalate immediately through the workflow protocol
- `chief_of_staff` produces the only executive summary by default

See [docs/daily-reporting.md](docs/daily-reporting.md).

## Architecture

Braid is designed as a thin but opinionated layer on top of OpenClaw:

- org manifest
- config and persona generator
- OpenClaw agent topology
- workflow and ledger plugin
- per-role workspaces and memory
- scheduled reporting jobs

See [docs/architecture.md](docs/architecture.md).

## Manifest

The default company shape is defined as a manifest, which tooling uses as the
single source of truth for generation and runtime policy:

- Schema: [docs/manifest-schema.md](docs/manifest-schema.md)
- Default manifest: [manifests/software-product-company.yaml](manifests/software-product-company.yaml)

## Examples

- [examples/sample-build-wo/](examples/sample-build-wo/) — a complete build
  work order with all artifacts
- [examples/sample-daily-reports/](examples/sample-daily-reports/) — daily role
  report and executive summary

## Repo Structure

```text
manifests/           company manifest (source of truth)
docs/                protocol and design docs
src/
  manifest/          parser, schema, validator
  generator/         OpenClaw config + workspace + cron generators
  plugin/
    engine/          state machine, ownership, baton, escalation
    store/           work order and report file I/O
    tools/           10 workflow tool functions
    openclaw/        OpenClaw plugin entry point
  templates/
    personas/        per-role persona content
  cli/               CLI commands
examples/            sample work orders and reports
scripts/             workspace setup
generated/           output (gitignored)
```

## Roadmap

See [docs/roadmap.md](docs/roadmap.md).

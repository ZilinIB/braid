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

## Quick Start

### Step 1: Set up the workspace

Braid and OpenClaw live as sibling repos in a shared workspace.

```bash
mkdir clawspace && cd clawspace
git clone git@github.com:ZilinIB/braid.git braid
./braid/scripts/setup-workspace.sh
```

This clones OpenClaw, creates workspace config, and installs dependencies.
If you already have both repos, just run the setup script from the parent
directory.

### Step 2: Set up OpenClaw

If you haven't already, initialize OpenClaw and configure your model and
channel:

```bash
cd openclaw
openclaw setup
```

Make sure you have an API key for your model provider:

```bash
export OPENAI_API_KEY=sk-...
```

Configure a messaging channel (Telegram, Discord, Slack, etc.) through the
OpenClaw setup wizard or by editing `~/.openclaw/openclaw.json`.

### Step 3: Initialize Braid

```bash
cd ../braid
npm run braid -- init --channel telegram
```

Replace `telegram` with your configured channel. This:
- validates the manifest
- generates OpenClaw agent config with absolute paths
- generates per-role workspace files (SOUL.md, AGENTS.md, IDENTITY.md)
- creates org directories for work orders and reports
- generates a cron setup script for daily reporting

### Step 4: Integrate into OpenClaw

```bash
npm run braid -- integrate --channel telegram
```

This patches your `~/.openclaw/openclaw.json` to add:
- 10 Braid agents with workspace paths and spawn allowlists
- channel binding for `chief_of_staff`
- the `braid-workflow` plugin with 10 workflow tools
- the plugin load path

A backup of your original config is created automatically.

### Step 5: Set up daily reporting (optional)

```bash
./generated/braid/setup-cron.sh
```

This creates 10 staggered cron jobs in OpenClaw — one per role — for daily
operational reporting, with the executive summary last.

### Step 6: Start and talk

```bash
cd ../openclaw
openclaw gateway run
```

Message `chief_of_staff` on your configured channel. Try:

> "Build a landing page for our new product. Focus on conversion — we need
> a hero section, social proof, and a clear CTA."

Chief of Staff will open a `build` work order, spawn Product Lead to write
the brief, baton-transfer to Tech Lead for planning and execution, route
through QA Guard for review, and report back to you with the outcome.

## CLI Commands

```text
braid validate                  Validate the manifest
braid generate --channel <ch>   Generate config and workspace files
braid setup --channel <ch>      Generate + create org directories
braid init --channel <ch>       Full setup including cron script
braid integrate --channel <ch>  Patch Braid into OpenClaw config
braid setup-cron                Generate daily reporting cron jobs
```

All commands accept `--manifest <path>` (default: `manifests/software-product-company.yaml`).

The `integrate` command accepts `--openclaw-config <path>` to target a
non-default config location, and `--no-backup` to skip the automatic backup.

## Moving to a New Machine

```bash
mkdir clawspace && cd clawspace
git clone git@github.com:ZilinIB/braid.git braid
./braid/scripts/setup-workspace.sh
cd braid
npm run braid -- init --channel telegram
npm run braid -- integrate --channel telegram
```

Five commands from zero to running.

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

- `chief_of_staff` — intake, routing, summaries, escalation
- `product_lead` — scope, priorities, success criteria
- `tech_lead` — planning, execution, integration
- `growth_hacker` — distribution, SEO, experiments
- `research_analyst` — evidence gathering
- `design_lead` — UX/UI execution
- `frontend_engineer` — client-side implementation
- `backend_engineer` — APIs, data models, integrations
- `platform_engineer` — deployment, CI/CD, reliability
- `qa_guard` — review, quality gates, release readiness

See [docs/roles-and-graph.md](docs/roles-and-graph.md) for the full
communication graph and authority boundaries.

## How It Works

1. You message `chief_of_staff` with a request
2. CoS opens a work order and spawns the appropriate role
3. Roles produce canonical artifacts (brief, plan, spec, delivery, review)
4. The work order moves through a state machine: opened → briefed → planned → in_execution → in_review → approved → done
5. Artifact ownership is enforced — only the designated owner can write each file
6. Cross-lane handoffs use baton transfers recorded in the work order
7. QA Guard reviews against the brief's success criteria before approval
8. CoS closes the work order and reports the outcome to you

## Workflow Lanes

Braid v1 supports four work-order types:

- `build` — new features, bug fixes, implementation work
- `research` — investigations, market analysis, evidence gathering
- `growth` — distribution, campaigns, SEO, audience experiments
- `ops` — infrastructure, incidents, maintenance (with `planned_change`, `incident`, `maintenance` modes)

See [docs/work-order-protocol.md](docs/work-order-protocol.md).

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Manifest

The company shape is defined as a single YAML manifest:

- Schema: [docs/manifest-schema.md](docs/manifest-schema.md)
- Default: [manifests/software-product-company.yaml](manifests/software-product-company.yaml)

## Examples

- [examples/sample-build-wo/](examples/sample-build-wo/) — complete build work order with all artifacts
- [examples/sample-daily-reports/](examples/sample-daily-reports/) — daily role report and executive summary

## Repo Structure

```text
manifests/           company manifest (source of truth)
docs/                protocol and design docs
src/
  manifest/          parser, schema, validator
  generator/         config, workspace, cron, and integrate generators
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

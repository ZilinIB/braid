# Roadmap

The roadmap is intentionally phased so protocol is fixed before implementation
surface area expands.

## Phase 0: Protocol Lock

Goal:

- lock the org model, communication graph, work-order protocol, and reporting loop

Deliverables:

- `README.md`
- `docs/architecture.md`
- `docs/manifest-schema.md`
- `docs/roles-and-graph.md`
- `docs/work-order-protocol.md`
- `docs/daily-reporting.md`
- `docs/roadmap.md`
- `manifests/software-product-company.yaml`

Exit criteria:

- baton-transfer rules are explicit
- artifact families are documented
- urgent escalation rules are documented
- `ops` modes and flows are documented
- manifest and docs agree on review policy and ownership rules

Anti-goals:

- no generator yet
- no plugin yet
- no GUI

Status:

- revised and ready for final lock review

## Phase 1: Org Manifest And Generator

Goal:

- turn the existing manifest into generated runtime artifacts

Deliverables:

- config generator
- persona generator
- generated OpenClaw config and workspace bootstrap files

Anti-goals:

- no broad multi-company support
- no runtime policy engine yet

## Phase 2: Workflow And Ledger Plugin

Goal:

- enforce the protocol through a narrow tool surface

Deliverables:

- work-order open/read/write tools
- artifact ownership rules
- state transition enforcement
- review gating
- baton-transfer enforcement
- escalation handling

Anti-goals:

- no uncontrolled file-based workflow editing
- no open-ended cross-agent chat protocol

## Phase 3: Default Company Pack

Goal:

- make the default software-product-company org runnable end to end

Deliverables:

- role definitions
- spawn allowlists
- model and sandbox defaults
- role workspaces and memory defaults

Anti-goals:

- no giant role catalog
- no secondary org templates yet

## Phase 4: Scheduled Reporting

Goal:

- make daily reporting a first-class operational loop

Deliverables:

- per-role daily report jobs
- chief-of-staff executive summary job
- report storage conventions

Anti-goals:

- no noisy direct delivery from every role
- no heartbeat-based formal reporting

## Phase 5: Packaging And Examples

Goal:

- make Braid usable by others without changing the core model

Deliverables:

- example manifests
- install/bootstrap scripts
- sample work orders
- sample report outputs

Anti-goals:

- no control UI by default
- no overextended product surface

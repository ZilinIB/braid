# Manifest Schema

Braid uses a single manifest as the canonical source of truth for the company
model. Generators and runtime tooling should derive OpenClaw config, personas,
and workflow policy from this manifest instead of duplicating those rules across
multiple files.

## Goals

- Define the company shape in one place
- Keep role names, graph rules, and workflow ownership consistent
- Make generated OpenClaw config and bootstrap files deterministic
- Keep the manifest readable by humans before it is consumed by tooling

## Top-Level Structure

The manifest is YAML and uses this top-level shape:

```yaml
version: 1
org: {}
runtime: {}
roles: {}
graph: {}
protocol: {}
reporting: {}
generation: {}
```

## Top-Level Fields

### `version`

Schema version for the manifest format.

Rules:

- integer
- starts at `1`
- required

### `org`

High-level metadata for the company pack.

Fields:

- `id`
  stable manifest id
- `name`
  display name for the org pack
- `kind`
  company shape, for example `software_product_company`
- `description`
  short description of the org pack

### `runtime`

OpenClaw-facing execution defaults.

Expected fields:

- `substrate`
  current value should be `openclaw`
- `execution`
  high-level execution rules
- `memory`
  role memory and shared-ledger assumptions

Recommended `runtime.execution` fields:

- `delegation`
  default: `spawn_first`
- `cross_agent_send`
  default: `restricted`
- `lane_changes_via`
  normally `chief_of_staff`, with approved baton-transfer exceptions
- `persistent_roles`
  roles that are expected to keep long-lived sessions
- `spawned_roles`
  roles normally invoked as fresh spawned sessions
- `max_spawn_depth`
  default `2` for deliberate orchestrator -> worker patterns in Braid v1
- `dispatch_role`
  normally `chief_of_staff`; performs baton-triggered downstream spawns and outward human-facing interrupts
- `review_role`
  normally `qa_guard`

Recommended `runtime.memory` fields:

- `shared_source_of_truth`
  usually `work_order_ledger`
- `role_memory`
  usually `workspace`
- `reporting_store`
  usually `daily_reports`
- `transcript_authority`
  usually `non_canonical`

### `roles`

Map of role id -> role definition.

Role ids must:

- use snake_case
- be unique
- match the ids used everywhere else in the manifest

Each role definition should include:

- `display_name`
- `mission`
- `user_facing`
- `session_mode`
  one of `persistent` or `spawned`
- `authority`
  freeform tag like `human_facing`, `scope`, `technical`, `distribution`, `quality`, or `execution`
- `owns`
  responsibilities and canonical artifact ownership
- `can_author`
  optional scoped contribution rights inside artifact families
- `can_spawn`
  allowed child roles
- `must_not`
  prohibited actions

Expected `owns` shape:

```yaml
owns:
  artifacts: []
  responsibilities: []
```

Important:

- `owns.artifacts` is a capability summary, not the binding per-type ownership rule
- binding ownership comes from `protocol.work_orders.types` plus `protocol.artifacts`
- leaf roles should use `can_author` instead of synthetic artifact ids like `delivery_contribution`

Recommended `can_author` shape:

```yaml
can_author:
  families: []
```

### `graph`

Explicit communication graph for role-to-role delegation.

Expected fields:

- `default_mechanism`
  normally `sessions_spawn`
- `lane_change_route`
  normally `chief_of_staff`
- `allowed_spawn_edges`
  map of role id -> allowed children
- `allowed_baton_transfers`
  list of approved lane transfers inside an already-open work order
- `forbidden_edges`
  list of string rules for human-readable constraints

Constraints:

- every referenced role must exist in `roles`
- every `can_spawn` list in `roles` should match the graph
- graph edges are directional
- baton-transfer endpoints must reference valid roles

### `protocol`

Defines the shared work-order system.

Expected fields:

- `work_orders`
- `artifacts`
- `states`
- `transitions`
- `escalation`

Recommended `work_orders` shape:

```yaml
work_orders:
  id_pattern: WO-YYYY-MM-DD-###
  directory: org/work-orders
  types:
    build: {}
    research: {}
    growth: {}
    ops: {}
```

Each work-order type should define:

- `brief_owner`
- `lane_owner`
- `plan_owner`
- `spec_owner`
- `delivery_owner`
- `review_owner`
- `review_policy`
- optional `modes` or `mode_overrides`

Recommended `artifacts` shape:

```yaml
artifacts:
  request:
    kind: file
    file: request.md
    owner_mode: fixed
    default_owner: chief_of_staff
```

Useful fields:

- `kind`
  `file` or `family`
- `file`
- `directory`
- `index`
- `purpose`
- `owner_mode`
  `fixed`, `by_work_order_type`, `lane_owner`, or `system`
- `default_owner`
- `owners_by_type`
- `contributor_mode`
  optional policy for scoped family contributions

Recommended `states` list:

- `opened`
- `briefed`
- `planned`
- `in_execution`
- `in_review`
- `approved`
- `done`
- `blocked`
- `cancelled`

Each transition entry should define:

- `from`
- `to`
- `requested_by`
- `requires`

Recommended `escalation` shape:

```yaml
escalation:
  severities:
    - normal
    - high
    - critical
  triggers: []
  notify_roles:
    high: [chief_of_staff]
    critical: [chief_of_staff]
  human_notify_threshold: critical
  notify_human_via: chief_of_staff
```

### `reporting`

Defines the scheduled reporting loop.

Expected fields:

- `daily`

Recommended `daily` fields:

- `enabled`
- `transport`
  normally `cron`
- `isolated_session`
  usually `true`
- `store`
- `summary_role`
- `summary_file`
- `order`
  role execution order for daily report generation
- `sections`
  standard report sections

Constraints:

- every role in `order` must exist
- `summary_role` must exist
- `summary_role` should normally appear last in `order`

### `generation`

Defines outputs that future tooling should generate from the manifest.

Expected fields:

- `targets`

Recommended target:

```yaml
targets:
  openclaw:
    enabled: true
    user_binding_role: chief_of_staff
    output_config: generated/openclaw/openclaw.json
    output_workspaces_dir: generated/openclaw/workspaces
```

This section is forward-looking but should be part of the manifest from the
start so generators have a stable contract.

## Example

See the default manifest at [software-product-company.yaml](/home/zilinwang/developer/braid/manifests/software-product-company.yaml).

## Validation Rules

Minimum validation rules for future tooling:

- all referenced role ids must exist
- all work-order owners must reference valid roles
- all transition roles must reference valid roles
- all artifact owner rules must be coherent
- family artifacts must define both `directory` and `index`
- baton-transfer rules must be compatible with the lane model
- `can_author.families` entries must reference defined family artifacts
- `chief_of_staff` should be the only `user_facing: true` role in the default pack
- graph edges and role `can_spawn` declarations must agree
- reporting order should contain each defined role exactly once
- required work-order types must exist: `build`, `research`, `growth`, `ops`

## Design Bias

The manifest is intentionally explicit. Braid should prefer verbosity in the
source manifest over hidden inference in generators.

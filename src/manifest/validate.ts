import { isAbsolute, normalize } from "node:path";
import type { BraidManifest, ValidationError, ValidationResult } from "./types.js";

type CheckContext = {
  roleIds: Set<string>;
  woTypes: Set<string>;
};

type Check = (manifest: BraidManifest, ctx: CheckContext) => ValidationError[];

function isSafeRelativePath(path: string): boolean {
  if (!path || isAbsolute(path)) return false;
  const normalized = normalize(path);
  return normalized !== "." && !normalized.split(/[/\\]/).some((segment) => segment === "..");
}

function collectRoleRefs(manifest: BraidManifest): Array<{ role: string; path: string }> {
  const refs: Array<{ role: string; path: string }> = [];
  const { runtime, graph, protocol, reporting, generation } = manifest;

  for (const r of runtime.execution.persistent_roles) {
    refs.push({ role: r, path: "runtime.execution.persistent_roles" });
  }
  for (const r of runtime.execution.spawned_roles) {
    refs.push({ role: r, path: "runtime.execution.spawned_roles" });
  }
  refs.push({ role: runtime.execution.dispatch_role, path: "runtime.execution.dispatch_role" });
  refs.push({ role: runtime.execution.review_role, path: "runtime.execution.review_role" });
  refs.push({ role: runtime.execution.lane_changes_via, path: "runtime.execution.lane_changes_via" });

  refs.push({ role: graph.lane_change_route, path: "graph.lane_change_route" });
  for (const [parent, children] of Object.entries(graph.allowed_spawn_edges)) {
    refs.push({ role: parent, path: `graph.allowed_spawn_edges.${parent}` });
    for (const child of children) {
      refs.push({ role: child, path: `graph.allowed_spawn_edges.${parent}` });
    }
  }
  for (const bt of graph.allowed_baton_transfers) {
    refs.push({ role: bt.from, path: "graph.allowed_baton_transfers" });
    refs.push({ role: bt.to, path: "graph.allowed_baton_transfers" });
  }

  for (const [typeName, woType] of Object.entries(protocol.work_orders.types)) {
    const base = `protocol.work_orders.types.${typeName}`;
    refs.push({ role: woType.brief_owner, path: `${base}.brief_owner` });
    refs.push({ role: woType.lane_owner, path: `${base}.lane_owner` });
    refs.push({ role: woType.plan_owner, path: `${base}.plan_owner` });
    refs.push({ role: woType.spec_owner, path: `${base}.spec_owner` });
    refs.push({ role: woType.delivery_owner, path: `${base}.delivery_owner` });
    refs.push({ role: woType.review_owner, path: `${base}.review_owner` });
  }

  for (const [artName, art] of Object.entries(protocol.artifacts)) {
    if (art.default_owner) {
      refs.push({ role: art.default_owner, path: `protocol.artifacts.${artName}.default_owner` });
    }
    if (art.owners_by_type) {
      for (const [, owner] of Object.entries(art.owners_by_type)) {
        refs.push({ role: owner, path: `protocol.artifacts.${artName}.owners_by_type` });
      }
    }
  }

  for (const t of protocol.transitions) {
    for (const r of t.requested_by) {
      refs.push({ role: r, path: `protocol.transitions[to=${t.to}].requested_by` });
    }
  }

  for (const [severity, roles] of Object.entries(protocol.escalation.notify_roles)) {
    for (const r of roles) {
      refs.push({ role: r, path: `protocol.escalation.notify_roles.${severity}` });
    }
  }
  refs.push({ role: protocol.escalation.notify_human_via, path: "protocol.escalation.notify_human_via" });

  refs.push({ role: reporting.daily.summary_role, path: "reporting.daily.summary_role" });
  for (const r of reporting.daily.order) {
    refs.push({ role: r, path: "reporting.daily.order" });
  }

  refs.push({ role: generation.targets.openclaw.user_binding_role, path: "generation.targets.openclaw.user_binding_role" });

  for (const [roleId, role] of Object.entries(manifest.roles)) {
    for (const child of role.can_spawn) {
      refs.push({ role: child, path: `roles.${roleId}.can_spawn` });
    }
  }

  return refs;
}

const allRolesExist: Check = (manifest, ctx) => {
  const { roleIds } = ctx;
  const errors: ValidationError[] = [];
  for (const ref of collectRoleRefs(manifest)) {
    if (!roleIds.has(ref.role)) {
      errors.push({
        rule: "allRolesExist",
        path: ref.path,
        message: `Role "${ref.role}" is referenced but not defined in roles`,
      });
    }
  }
  return errors;
};

const canSpawnMatchesGraph: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  for (const [roleId, role] of Object.entries(manifest.roles)) {
    const graphEdges = manifest.graph.allowed_spawn_edges[roleId];
    if (!graphEdges) continue; // graphRolesComplete handles this
    const roleSet = new Set(role.can_spawn);
    const graphSet = new Set(graphEdges);
    for (const child of roleSet) {
      if (!graphSet.has(child)) {
        errors.push({
          rule: "canSpawnMatchesGraph",
          path: `roles.${roleId}.can_spawn`,
          message: `"${child}" is in can_spawn but not in graph.allowed_spawn_edges.${roleId}`,
        });
      }
    }
    for (const child of graphSet) {
      if (!roleSet.has(child)) {
        errors.push({
          rule: "canSpawnMatchesGraph",
          path: `graph.allowed_spawn_edges.${roleId}`,
          message: `"${child}" is in graph edges but not in roles.${roleId}.can_spawn`,
        });
      }
    }
  }
  return errors;
};

const canAuthorFamiliesExist: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  const familyArtifacts = new Set(
    Object.entries(manifest.protocol.artifacts)
      .filter(([, a]) => a.kind === "family")
      .map(([name]) => name),
  );
  for (const [roleId, role] of Object.entries(manifest.roles)) {
    if (!role.can_author) continue;
    for (const family of role.can_author.families) {
      if (!familyArtifacts.has(family)) {
        errors.push({
          rule: "canAuthorFamiliesExist",
          path: `roles.${roleId}.can_author.families`,
          message: `"${family}" is not a defined family artifact`,
        });
      }
    }
  }
  return errors;
};

const familyArtifactsComplete: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  for (const [name, art] of Object.entries(manifest.protocol.artifacts)) {
    if (art.kind !== "family") continue;
    if (!art.directory) {
      errors.push({
        rule: "familyArtifactsComplete",
        path: `protocol.artifacts.${name}`,
        message: `Family artifact "${name}" is missing "directory"`,
      });
    }
    if (!art.index) {
      errors.push({
        rule: "familyArtifactsComplete",
        path: `protocol.artifacts.${name}`,
        message: `Family artifact "${name}" is missing "index"`,
      });
    }
  }
  return errors;
};

const workOrderOwnerRolesExist: Check = (manifest, ctx) => {
  const { roleIds } = ctx;
  const errors: ValidationError[] = [];
  for (const [typeName, woType] of Object.entries(manifest.protocol.work_orders.types)) {
    const owners = [
      ["brief_owner", woType.brief_owner],
      ["lane_owner", woType.lane_owner],
      ["plan_owner", woType.plan_owner],
      ["spec_owner", woType.spec_owner],
      ["delivery_owner", woType.delivery_owner],
      ["review_owner", woType.review_owner],
    ] as const;
    for (const [field, value] of owners) {
      if (!roleIds.has(value)) {
        errors.push({
          rule: "workOrderOwnerRolesExist",
          path: `protocol.work_orders.types.${typeName}.${field}`,
          message: `Role "${value}" does not exist`,
        });
      }
    }
  }
  return errors;
};

const transitionRolesExist: Check = (manifest, ctx) => {
  const { roleIds } = ctx;
  const errors: ValidationError[] = [];
  for (const t of manifest.protocol.transitions) {
    for (const r of t.requested_by) {
      if (!roleIds.has(r)) {
        errors.push({
          rule: "transitionRolesExist",
          path: `protocol.transitions[to=${t.to}].requested_by`,
          message: `Role "${r}" does not exist`,
        });
      }
    }
  }
  return errors;
};

const artifactOwnerCoherence: Check = (manifest, ctx) => {
  const { roleIds } = ctx;
  const { woTypes } = ctx;
  const errors: ValidationError[] = [];
  for (const [name, art] of Object.entries(manifest.protocol.artifacts)) {
    const base = `protocol.artifacts.${name}`;
    if (art.owner_mode === "fixed" && !art.default_owner) {
      errors.push({ rule: "artifactOwnerCoherence", path: base, message: `Fixed-owner artifact "${name}" is missing default_owner` });
    }
    if (art.owner_mode === "fixed" && art.default_owner && !roleIds.has(art.default_owner)) {
      errors.push({ rule: "artifactOwnerCoherence", path: `${base}.default_owner`, message: `Role "${art.default_owner}" does not exist` });
    }
    if (art.owner_mode === "by_work_order_type") {
      if (!art.owners_by_type) {
        errors.push({ rule: "artifactOwnerCoherence", path: base, message: `Artifact "${name}" has owner_mode "by_work_order_type" but no owners_by_type` });
      } else {
        for (const woType of woTypes) {
          if (!(woType in art.owners_by_type)) {
            errors.push({
              rule: "artifactOwnerCoherence",
              path: `${base}.owners_by_type`,
              message: `Artifact "${name}" is missing an owner for work order type "${woType}"`,
            });
          }
        }
        for (const [woType, owner] of Object.entries(art.owners_by_type)) {
          if (!woTypes.has(woType)) {
            errors.push({ rule: "artifactOwnerCoherence", path: `${base}.owners_by_type.${woType}`, message: `Work order type "${woType}" does not exist` });
          }
          if (!roleIds.has(owner)) {
            errors.push({ rule: "artifactOwnerCoherence", path: `${base}.owners_by_type.${woType}`, message: `Role "${owner}" does not exist` });
          }
        }
      }
    }
  }
  return errors;
};

const singleUserFacingRole: Check = (manifest, ctx) => {
  const userFacing = Object.entries(manifest.roles).filter(([, r]) => r.user_facing);
  if (userFacing.length === 0) {
    return [{ rule: "singleUserFacingRole", path: "roles", message: "No role has user_facing: true" }];
  }
  if (userFacing.length > 1) {
    const names = userFacing.map(([id]) => id).join(", ");
    return [{ rule: "singleUserFacingRole", path: "roles", message: `Multiple user-facing roles: ${names}` }];
  }
  return [];
};

const reportingOrderComplete: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  const { roleIds } = ctx;
  const orderSet = new Set<string>();
  for (const r of manifest.reporting.daily.order) {
    if (orderSet.has(r)) {
      errors.push({ rule: "reportingOrderComplete", path: "reporting.daily.order", message: `Duplicate role "${r}" in reporting order` });
    }
    orderSet.add(r);
  }
  for (const roleId of roleIds) {
    if (!orderSet.has(roleId)) {
      errors.push({ rule: "reportingOrderComplete", path: "reporting.daily.order", message: `Role "${roleId}" is missing from reporting order` });
    }
  }
  for (const r of orderSet) {
    if (!roleIds.has(r)) {
      errors.push({ rule: "reportingOrderComplete", path: "reporting.daily.order", message: `"${r}" in reporting order is not a defined role` });
    }
  }
  return errors;
};

const requiredWorkOrderTypes: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  const required = ["build", "research", "growth", "ops"];
  const defined = new Set(Object.keys(manifest.protocol.work_orders.types));
  for (const t of required) {
    if (!defined.has(t)) {
      errors.push({ rule: "requiredWorkOrderTypes", path: "protocol.work_orders.types", message: `Required work order type "${t}" is missing` });
    }
  }
  return errors;
};

const batonTransfersCoherent: Check = (manifest, ctx) => {
  const { roleIds } = ctx;
  const { woTypes } = ctx;
  const errors: ValidationError[] = [];
  for (const bt of manifest.graph.allowed_baton_transfers) {
    if (!roleIds.has(bt.from)) {
      errors.push({ rule: "batonTransfersCoherent", path: "graph.allowed_baton_transfers", message: `Baton from role "${bt.from}" does not exist` });
    }
    if (!roleIds.has(bt.to)) {
      errors.push({ rule: "batonTransfersCoherent", path: "graph.allowed_baton_transfers", message: `Baton to role "${bt.to}" does not exist` });
    }
    for (const t of bt.work_order_types) {
      if (!woTypes.has(t)) {
        errors.push({ rule: "batonTransfersCoherent", path: "graph.allowed_baton_transfers", message: `Baton work order type "${t}" does not exist` });
      }
    }
  }
  return errors;
};

const sessionModeConsistency: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  const { roleIds } = ctx;
  const persistentSet = new Set(manifest.runtime.execution.persistent_roles);
  const spawnedSet = new Set(manifest.runtime.execution.spawned_roles);

  for (const roleId of roleIds) {
    const role = manifest.roles[roleId]!;
    const inPersistent = persistentSet.has(roleId);
    const inSpawned = spawnedSet.has(roleId);
    if (!inPersistent && !inSpawned) {
      errors.push({ rule: "sessionModeConsistency", path: `roles.${roleId}`, message: `Role "${roleId}" is not in persistent_roles or spawned_roles` });
    }
    if (inPersistent && inSpawned) {
      errors.push({ rule: "sessionModeConsistency", path: `roles.${roleId}`, message: `Role "${roleId}" is in both persistent_roles and spawned_roles` });
    }
    if (inPersistent && role.session_mode !== "persistent") {
      errors.push({ rule: "sessionModeConsistency", path: `roles.${roleId}.session_mode`, message: `Role "${roleId}" is in persistent_roles but session_mode is "${role.session_mode}"` });
    }
    if (inSpawned && role.session_mode !== "spawned") {
      errors.push({ rule: "sessionModeConsistency", path: `roles.${roleId}.session_mode`, message: `Role "${roleId}" is in spawned_roles but session_mode is "${role.session_mode}"` });
    }
  }
  return errors;
};

const escalationNotifyRolesExist: Check = (manifest, ctx) => {
  const { roleIds } = ctx;
  const errors: ValidationError[] = [];
  for (const [severity, roles] of Object.entries(manifest.protocol.escalation.notify_roles)) {
    for (const r of roles) {
      if (!roleIds.has(r)) {
        errors.push({ rule: "escalationNotifyRolesExist", path: `protocol.escalation.notify_roles.${severity}`, message: `Role "${r}" does not exist` });
      }
    }
  }
  if (!roleIds.has(manifest.protocol.escalation.notify_human_via)) {
    errors.push({ rule: "escalationNotifyRolesExist", path: "protocol.escalation.notify_human_via", message: `Role "${manifest.protocol.escalation.notify_human_via}" does not exist` });
  }
  return errors;
};

const modeOverridesCoherent: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  for (const [typeName, woType] of Object.entries(manifest.protocol.work_orders.types)) {
    if (!woType.mode_overrides) continue;
    if (!woType.modes || woType.modes.length === 0) {
      errors.push({
        rule: "modeOverridesCoherent",
        path: `protocol.work_orders.types.${typeName}.mode_overrides`,
        message: `Work order type "${typeName}" defines mode_overrides but has no modes`,
      });
      continue;
    }

    const modes = new Set(woType.modes);
    for (const mode of Object.keys(woType.mode_overrides)) {
      if (!modes.has(mode)) {
        errors.push({
          rule: "modeOverridesCoherent",
          path: `protocol.work_orders.types.${typeName}.mode_overrides.${mode}`,
          message: `Mode override "${mode}" is not declared in protocol.work_orders.types.${typeName}.modes`,
        });
      }
    }
  }
  return errors;
};

const artifactPathsSafe: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  for (const [name, art] of Object.entries(manifest.protocol.artifacts)) {
    const base = `protocol.artifacts.${name}`;

    if (art.kind === "file") {
      if (!art.file) {
        errors.push({
          rule: "artifactPathsSafe",
          path: base,
          message: `File artifact "${name}" is missing "file"`,
        });
      } else if (!isSafeRelativePath(art.file)) {
        errors.push({
          rule: "artifactPathsSafe",
          path: `${base}.file`,
          message: `Artifact path "${art.file}" must be a safe relative path`,
        });
      }
      continue;
    }

    if (art.directory && !isSafeRelativePath(art.directory)) {
      errors.push({
        rule: "artifactPathsSafe",
        path: `${base}.directory`,
        message: `Artifact directory "${art.directory}" must be a safe relative path`,
      });
    }
    if (art.index && !isSafeRelativePath(art.index)) {
      errors.push({
        rule: "artifactPathsSafe",
        path: `${base}.index`,
        message: `Artifact index "${art.index}" must be a safe relative path`,
      });
    }
  }
  return errors;
};

const graphRolesComplete: Check = (manifest, ctx) => {
  const { roleIds } = ctx;
  const graphRoles = new Set(Object.keys(manifest.graph.allowed_spawn_edges));
  const errors: ValidationError[] = [];
  for (const roleId of roleIds) {
    if (!graphRoles.has(roleId)) {
      errors.push({ rule: "graphRolesComplete", path: "graph.allowed_spawn_edges", message: `Role "${roleId}" has no entry in allowed_spawn_edges` });
    }
  }
  return errors;
};

const sandboxConfigValid: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  const sandbox = manifest.sandbox;
  if (!sandbox) return errors;

  for (let i = 0; i < sandbox.project_dirs.length; i++) {
    const mount = sandbox.project_dirs[i]!;
    const base = `sandbox.project_dirs[${i}]`;

    if (!isAbsolute(mount.host_path)) {
      errors.push({
        rule: "sandboxConfigValid",
        path: `${base}.host_path`,
        message: `Host path "${mount.host_path}" must be absolute`,
      });
    }
    if (!isAbsolute(mount.container_path)) {
      errors.push({
        rule: "sandboxConfigValid",
        path: `${base}.container_path`,
        message: `Container path "${mount.container_path}" must be absolute`,
      });
    }

    const blocked = ["/etc", "/proc", "/sys", "/dev", "/root", "/boot", "/run"];
    for (const bp of blocked) {
      if (mount.container_path === bp || mount.container_path.startsWith(bp + "/")) {
        errors.push({
          rule: "sandboxConfigValid",
          path: `${base}.container_path`,
          message: `Container path "${mount.container_path}" targets a blocked system directory`,
        });
      }
    }
  }

  return errors;
};

const codingConfigCoherent: Check = (manifest, ctx) => {
  const errors: ValidationError[] = [];
  const coding = manifest.coding;
  if (!coding) return errors;

  const { roleIds } = ctx;

  // default_agent must exist in agents
  if (!coding.agents[coding.default_agent]) {
    errors.push({
      rule: "codingConfigCoherent",
      path: "coding.default_agent",
      message: `Default agent "${coding.default_agent}" is not defined in coding.agents`,
    });
  }

  // allowed_roles must reference valid role IDs
  for (const role of coding.allowed_roles) {
    if (!roleIds.has(role)) {
      errors.push({
        rule: "codingConfigCoherent",
        path: "coding.allowed_roles",
        message: `Role "${role}" in allowed_roles does not exist`,
      });
    }
  }

  return errors;
};

const ALL_CHECKS: Check[] = [
  allRolesExist,
  canSpawnMatchesGraph,
  canAuthorFamiliesExist,
  familyArtifactsComplete,
  workOrderOwnerRolesExist,
  transitionRolesExist,
  artifactOwnerCoherence,
  singleUserFacingRole,
  reportingOrderComplete,
  requiredWorkOrderTypes,
  batonTransfersCoherent,
  sessionModeConsistency,
  escalationNotifyRolesExist,
  modeOverridesCoherent,
  artifactPathsSafe,
  graphRolesComplete,
  sandboxConfigValid,
  codingConfigCoherent,
];

export function validateManifest(manifest: BraidManifest): ValidationResult {
  const ctx: CheckContext = {
    roleIds: new Set(Object.keys(manifest.roles)),
    woTypes: new Set(Object.keys(manifest.protocol.work_orders.types)),
  };
  const errors: ValidationError[] = [];
  for (const check of ALL_CHECKS) {
    errors.push(...check(manifest, ctx));
  }
  return { ok: errors.length === 0, errors };
}

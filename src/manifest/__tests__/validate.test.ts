import { describe, it, expect, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import { parseManifest } from "../schema.js";
import { validateManifest } from "../validate.js";
import type { BraidManifest } from "../types.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "fixtures/valid-manifest.yaml");

async function loadValidManifest(): Promise<BraidManifest> {
  const raw = await readFile(FIXTURE_PATH, "utf-8");
  return parseManifest(parseYaml(raw));
}

// Deep clone helper
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

describe("validateManifest", () => {
  let manifest: BraidManifest;

  beforeEach(async () => {
    manifest = await loadValidManifest();
  });

  it("passes on valid manifest", () => {
    const result = validateManifest(manifest);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("allRolesExist: catches dangling role reference in can_spawn", () => {
    manifest.roles.chief_of_staff!.can_spawn.push("nonexistent_role");
    manifest.graph.allowed_spawn_edges.chief_of_staff!.push("nonexistent_role");
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "allRolesExist" && e.message.includes("nonexistent_role"))).toBe(true);
  });

  it("canSpawnMatchesGraph: catches mismatch", () => {
    manifest.roles.chief_of_staff!.can_spawn.push("design_lead");
    // graph doesn't include design_lead for chief_of_staff
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "canSpawnMatchesGraph")).toBe(true);
  });

  it("canAuthorFamiliesExist: catches nonexistent family", () => {
    manifest.roles.research_analyst!.can_author = { families: ["nonexistent_family"] };
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "canAuthorFamiliesExist" && e.message.includes("nonexistent_family"))).toBe(true);
  });

  it("familyArtifactsComplete: catches missing directory", () => {
    const m = clone(manifest);
    delete (m.protocol.artifacts.spec as Record<string, unknown>).directory;
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "familyArtifactsComplete" && e.message.includes("directory"))).toBe(true);
  });

  it("familyArtifactsComplete: catches missing index", () => {
    const m = clone(manifest);
    delete (m.protocol.artifacts.spec as Record<string, unknown>).index;
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "familyArtifactsComplete" && e.message.includes("index"))).toBe(true);
  });

  it("workOrderOwnerRolesExist: catches nonexistent owner", () => {
    manifest.protocol.work_orders.types.build!.brief_owner = "ghost_role";
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "workOrderOwnerRolesExist")).toBe(true);
  });

  it("transitionRolesExist: catches nonexistent transition role", () => {
    manifest.protocol.transitions[0]!.requested_by.push("ghost_role");
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "transitionRolesExist")).toBe(true);
  });

  it("artifactOwnerCoherence: catches missing default_owner on fixed artifact", () => {
    const m = clone(manifest);
    delete (m.protocol.artifacts.request as Record<string, unknown>).default_owner;
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "artifactOwnerCoherence")).toBe(true);
  });

  it("artifactOwnerCoherence: catches missing owners_by_type on by_work_order_type", () => {
    const m = clone(manifest);
    delete (m.protocol.artifacts.brief as Record<string, unknown>).owners_by_type;
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "artifactOwnerCoherence")).toBe(true);
  });

  it("singleUserFacingRole: catches no user-facing role", () => {
    manifest.roles.chief_of_staff!.user_facing = false;
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "singleUserFacingRole")).toBe(true);
  });

  it("singleUserFacingRole: catches multiple user-facing roles", () => {
    manifest.roles.tech_lead!.user_facing = true;
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "singleUserFacingRole" && e.message.includes("Multiple"))).toBe(true);
  });

  it("reportingOrderComplete: catches missing role in order", () => {
    manifest.reporting.daily.order = manifest.reporting.daily.order.filter((r) => r !== "qa_guard");
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "reportingOrderComplete" && e.message.includes("qa_guard"))).toBe(true);
  });

  it("reportingOrderComplete: catches duplicate in order", () => {
    manifest.reporting.daily.order.push("chief_of_staff");
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "reportingOrderComplete" && e.message.includes("Duplicate"))).toBe(true);
  });

  it("requiredWorkOrderTypes: catches missing required type", () => {
    delete manifest.protocol.work_orders.types.ops;
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "requiredWorkOrderTypes" && e.message.includes("ops"))).toBe(true);
  });

  it("batonTransfersCoherent: catches nonexistent baton role", () => {
    manifest.graph.allowed_baton_transfers[0]!.from = "ghost";
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "batonTransfersCoherent")).toBe(true);
  });

  it("sessionModeConsistency: catches role in both persistent and spawned", () => {
    manifest.runtime.execution.persistent_roles.push("tech_lead");
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "sessionModeConsistency")).toBe(true);
  });

  it("sessionModeConsistency: catches mode mismatch", () => {
    manifest.roles.chief_of_staff!.session_mode = "spawned";
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "sessionModeConsistency" && e.message.includes("persistent_roles"))).toBe(true);
  });

  it("escalationNotifyRolesExist: catches nonexistent notify role", () => {
    manifest.protocol.escalation.notify_roles.high = ["ghost_role"];
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "escalationNotifyRolesExist")).toBe(true);
  });

  it("graphRolesComplete: catches missing graph entry", () => {
    delete manifest.graph.allowed_spawn_edges.qa_guard;
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "graphRolesComplete" && e.message.includes("qa_guard"))).toBe(true);
  });
});

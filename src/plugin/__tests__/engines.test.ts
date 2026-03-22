import { describe, it, expect, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import { parseManifest } from "../../manifest/schema.js";
import type { BraidManifest } from "../../manifest/types.js";
import type { WorkOrderStatus } from "../store/work-order-store.js";
import { checkTransition } from "../engine/state-machine.js";
import { checkOwnership, resolveArtifactPath } from "../engine/ownership.js";
import { checkBatonTransfer } from "../engine/baton.js";
import { applyEscalation } from "../engine/escalation.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "../../manifest/__tests__/fixtures/valid-manifest.yaml");

async function loadManifest(): Promise<BraidManifest> {
  const raw = await readFile(FIXTURE_PATH, "utf-8");
  return parseManifest(parseYaml(raw));
}

function makeStatus(overrides: Partial<WorkOrderStatus> = {}): WorkOrderStatus {
  return {
    id: "WO-2026-03-22-001",
    title: "Test",
    type: "build",
    state: "opened",
    priority: "normal",
    owner: "chief_of_staff",
    lane_owner: "tech_lead",
    review_policy: "required",
    severity: "normal",
    needs_human_attention: false,
    opened_at: "2026-03-22T10:00:00Z",
    updated_at: "2026-03-22T10:00:00Z",
    current_lane: "build",
    current_role: "chief_of_staff",
    approved: false,
    blocked_by: [],
    baton_history: [],
    artifacts: {},
    ...overrides,
  };
}

describe("state machine", () => {
  let manifest: BraidManifest;
  beforeEach(async () => { manifest = await loadManifest(); });
  const yes = () => true;

  it("allows opened -> briefed by product_lead", () => {
    const status = makeStatus({ state: "opened" });
    const result = checkTransition(manifest, status, "briefed", "product_lead", yes);
    expect(result.allowed).toBe(true);
  });

  it("rejects opened -> briefed by frontend_engineer", () => {
    const status = makeStatus({ state: "opened" });
    const result = checkTransition(manifest, status, "briefed", "frontend_engineer", yes);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("frontend_engineer");
  });

  it("allows in_review -> approved by qa_guard", () => {
    const status = makeStatus({ state: "in_review" });
    const result = checkTransition(manifest, status, "approved", "qa_guard", yes);
    expect(result.allowed).toBe(true);
  });

  it("allows in_review -> planned (rework) by qa_guard", () => {
    const status = makeStatus({ state: "in_review" });
    const result = checkTransition(manifest, status, "planned", "qa_guard", yes);
    expect(result.allowed).toBe(true);
  });

  it("rejects invalid state", () => {
    const status = makeStatus({ state: "opened" });
    const result = checkTransition(manifest, status, "nonexistent", "chief_of_staff", yes);
    expect(result.allowed).toBe(false);
  });

  it("rejects invalid transition path", () => {
    const status = makeStatus({ state: "opened" });
    const result = checkTransition(manifest, status, "done", "chief_of_staff", yes);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("No transition");
  });

  it("allows any active -> blocked by chief_of_staff", () => {
    const status = makeStatus({ state: "in_execution", blocked_by: ["dependency"] });
    const result = checkTransition(manifest, status, "blocked", "chief_of_staff", yes);
    expect(result.allowed).toBe(true);
  });

  it("allows approved -> done by chief_of_staff with reason", () => {
    const status = makeStatus({ state: "approved" });
    const result = checkTransition(manifest, status, "done", "chief_of_staff", yes, { reason: "Work complete" });
    expect(result.allowed).toBe(true);
  });

  it("rejects approved -> done without reason", () => {
    const status = makeStatus({ state: "approved" });
    const result = checkTransition(manifest, status, "done", "chief_of_staff", yes);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("final summary reason");
  });

  it("allows cancellation by chief_of_staff with reason", () => {
    const status = makeStatus({ state: "planned" });
    const result = checkTransition(manifest, status, "cancelled", "chief_of_staff", yes, { reason: "No longer needed" });
    expect(result.allowed).toBe(true);
  });

  it("rejects cancellation without reason", () => {
    const status = makeStatus({ state: "planned" });
    const result = checkTransition(manifest, status, "cancelled", "chief_of_staff", yes);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("cancellation reason");
  });

  it("rejects cancellation by non-CoS", () => {
    const status = makeStatus({ state: "planned" });
    const result = checkTransition(manifest, status, "cancelled", "tech_lead", yes);
    expect(result.allowed).toBe(false);
  });
});

describe("ownership", () => {
  let manifest: BraidManifest;
  beforeEach(async () => { manifest = await loadManifest(); });

  it("allows product_lead to write brief for build", () => {
    const r = checkOwnership(manifest, "build", "brief", "product_lead");
    expect(r.allowed).toBe(true);
  });

  it("rejects tech_lead writing brief for build", () => {
    const r = checkOwnership(manifest, "build", "brief", "tech_lead");
    expect(r.allowed).toBe(false);
  });

  it("allows tech_lead to write plan for build", () => {
    const r = checkOwnership(manifest, "build", "plan", "tech_lead");
    expect(r.allowed).toBe(true);
  });

  it("allows tech_lead to write spec/index.md for build", () => {
    const r = checkOwnership(manifest, "build", "spec", "tech_lead");
    expect(r.allowed).toBe(true);
  });

  it("allows frontend_engineer to write delivery sub-file", () => {
    const r = checkOwnership(manifest, "build", "delivery", "frontend_engineer", "frontend_engineer.md");
    expect(r.allowed).toBe(true);
  });

  it("rejects frontend_engineer writing delivery/index.md", () => {
    const r = checkOwnership(manifest, "build", "delivery", "frontend_engineer");
    expect(r.allowed).toBe(false);
  });

  it("rejects writing status.yaml (system-owned)", () => {
    const r = checkOwnership(manifest, "build", "status", "chief_of_staff");
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("system-owned");
  });

  it("allows qa_guard to write review/index.md", () => {
    const r = checkOwnership(manifest, "build", "review", "qa_guard");
    expect(r.allowed).toBe(true);
  });

  it("rejects tech_lead writing review/index.md", () => {
    const r = checkOwnership(manifest, "build", "review", "tech_lead");
    expect(r.allowed).toBe(false);
  });

  it("allows growth_hacker to write brief for growth", () => {
    const r = checkOwnership(manifest, "growth", "brief", "growth_hacker");
    expect(r.allowed).toBe(true);
  });

  it("allows research_analyst to write spec sub-file", () => {
    const r = checkOwnership(manifest, "research", "spec", "research_analyst", "market_analysis.md");
    expect(r.allowed).toBe(true);
  });
});

describe("resolveArtifactPath", () => {
  let manifest: BraidManifest;
  beforeEach(async () => { manifest = await loadManifest(); });

  it("resolves file artifact", () => {
    expect(resolveArtifactPath(manifest, "request")).toBe("request.md");
    expect(resolveArtifactPath(manifest, "brief")).toBe("brief.md");
  });

  it("resolves family artifact index", () => {
    expect(resolveArtifactPath(manifest, "spec")).toBe("spec/index.md");
    expect(resolveArtifactPath(manifest, "delivery")).toBe("delivery/index.md");
  });

  it("resolves family sub-file", () => {
    expect(resolveArtifactPath(manifest, "delivery", "frontend.md")).toBe("delivery/frontend.md");
  });

  it("returns null for unknown artifact", () => {
    expect(resolveArtifactPath(manifest, "nonexistent")).toBeNull();
  });
});

describe("baton transfer", () => {
  let manifest: BraidManifest;
  beforeEach(async () => { manifest = await loadManifest(); });

  it("allows product_lead -> tech_lead for build", () => {
    const status = makeStatus({ type: "build", lane_owner: "product_lead", current_role: "product_lead" });
    const r = checkBatonTransfer(manifest, status, "product_lead", "tech_lead", "implementation_required");
    expect(r.allowed).toBe(true);
  });

  it("rejects product_lead -> growth_hacker (not allowed)", () => {
    const status = makeStatus({ type: "build", lane_owner: "product_lead", current_role: "product_lead" });
    const r = checkBatonTransfer(manifest, status, "product_lead", "growth_hacker", "test");
    expect(r.allowed).toBe(false);
  });

  it("rejects product_lead -> tech_lead for research (wrong type)", () => {
    const status = makeStatus({ type: "research", lane_owner: "product_lead", current_role: "product_lead" });
    const r = checkBatonTransfer(manifest, status, "product_lead", "tech_lead", "test");
    expect(r.allowed).toBe(false);
  });

  it("allows growth_hacker -> tech_lead for growth", () => {
    const status = makeStatus({ type: "growth", lane_owner: "growth_hacker", current_role: "growth_hacker" });
    const r = checkBatonTransfer(manifest, status, "growth_hacker", "tech_lead", "implementation_required");
    expect(r.allowed).toBe(true);
  });
});

describe("escalation", () => {
  let manifest: BraidManifest;
  beforeEach(async () => { manifest = await loadManifest(); });

  it("applies severity and determines notifications", () => {
    const status = makeStatus();
    const effect = applyEscalation(manifest, status, "high");
    expect(status.severity).toBe("high");
    expect(effect.notifyRoles).toContain("chief_of_staff");
    expect(effect.notifyHuman).toBe(false);
  });

  it("critical severity triggers human notification", () => {
    const status = makeStatus();
    const effect = applyEscalation(manifest, status, "critical");
    expect(effect.notifyHuman).toBe(true);
  });

  it("needs_human_attention triggers human notification even at normal", () => {
    const status = makeStatus();
    const effect = applyEscalation(manifest, status, "normal", true);
    expect(status.needs_human_attention).toBe(true);
    expect(effect.notifyHuman).toBe(true);
  });

  it("rejects invalid severity", () => {
    const status = makeStatus();
    expect(() => applyEscalation(manifest, status, "invalid")).toThrow("Invalid severity");
  });
});

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import { parseManifest } from "../../manifest/schema.js";
import { generateWorkspaceFiles } from "../workspace-bootstrap.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "../../manifest/__tests__/fixtures/valid-manifest.yaml");

async function loadManifest() {
  const raw = await readFile(FIXTURE_PATH, "utf-8");
  return parseManifest(parseYaml(raw));
}

describe("generateWorkspaceFiles", () => {
  it("generates 3 files per role", async () => {
    const manifest = await loadManifest();
    for (const roleId of Object.keys(manifest.roles)) {
      const files = generateWorkspaceFiles(manifest, roleId);
      expect(files).toHaveLength(3);
      expect(files.map((f) => f.relativePath).sort()).toEqual(["AGENTS.md", "IDENTITY.md", "SOUL.md"]);
    }
  });

  it("IDENTITY.md contains display name and mission", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "tech_lead");
    const identity = files.find((f) => f.relativePath === "IDENTITY.md")!;
    expect(identity.content).toContain("Tech Lead");
    expect(identity.content).toContain("technical planning");
  });

  it("SOUL.md contains must_not rules", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "product_lead");
    const soul = files.find((f) => f.relativePath === "SOUL.md")!;
    expect(soul.content).toContain("delegate directly to engineers");
    expect(soul.content).toContain("NEVER");
  });

  it("SOUL.md marks chief_of_staff as user-facing", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "chief_of_staff");
    const soul = files.find((f) => f.relativePath === "SOUL.md")!;
    expect(soul.content).toContain("user-facing role");
  });

  it("SOUL.md marks non-CoS roles as not user-facing", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "backend_engineer");
    const soul = files.find((f) => f.relativePath === "SOUL.md")!;
    expect(soul.content).toContain("do not communicate directly with the human");
  });

  it("AGENTS.md contains spawn list for orchestrators", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "tech_lead");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("frontend_engineer");
    expect(agents.content).toContain("backend_engineer");
    expect(agents.content).toContain("platform_engineer");
  });

  it("AGENTS.md marks leaf roles as non-spawning", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "frontend_engineer");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("leaf role");
    expect(agents.content).toContain("do not spawn");
  });

  it("AGENTS.md includes artifact ownership for tech_lead", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "tech_lead");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("**build**");
    expect(agents.content).toContain("plan");
    expect(agents.content).toContain("spec");
    expect(agents.content).toContain("delivery");
  });

  it("AGENTS.md includes authoring rights", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "research_analyst");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("Authoring Rights");
    expect(agents.content).toContain("delivery");
    expect(agents.content).toContain("spec");
  });

  it("AGENTS.md includes red lines", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "qa_guard");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("silently fix work");
    expect(agents.content).toContain("redefine scope");
  });

  // ── Enriched persona content tests ──

  it("SOUL.md includes persona identity hook", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "chief_of_staff");
    const soul = files.find((f) => f.relativePath === "SOUL.md")!;
    expect(soul.content).toContain("switchboard");
    expect(soul.content).toContain("Philosophy");
    expect(soul.content).toContain("Experience");
  });

  it("SOUL.md includes example phrases", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "qa_guard");
    const soul = files.find((f) => f.relativePath === "SOUL.md")!;
    expect(soul.content).toContain("How You Sound");
    expect(soul.content).toContain("Verdict: PASS");
  });

  it("AGENTS.md includes deliverable quality guide with templates", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "product_lead");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("Deliverable Quality Guide");
    expect(agents.content).toContain("Problem Statement");
    expect(agents.content).toContain("Success Criteria");
  });

  it("AGENTS.md includes success metrics", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "tech_lead");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("Success Metrics");
    expect(agents.content).toContain("interface contracts");
  });

  it("AGENTS.md includes learning instructions", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "frontend_engineer");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("Learning And Memory");
    expect(agents.content).toContain("Remember");
  });

  it("QA guard AGENTS.md includes review template with verdict format", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "qa_guard");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("PASS / FAIL / REWORK REQUIRED");
    expect(agents.content).toContain("Blockers (must fix");
    expect(agents.content).toContain("Good Work");
  });

  it("tech_lead AGENTS.md includes plan and spec templates", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "tech_lead");
    const agents = files.find((f) => f.relativePath === "AGENTS.md")!;
    expect(agents.content).toContain("Execution Phases");
    expect(agents.content).toContain("Interface Contracts");
    expect(agents.content).toContain("Architecture Overview");
  });

  it("growth_hacker SOUL.md includes hypothesis-driven philosophy", async () => {
    const manifest = await loadManifest();
    const files = generateWorkspaceFiles(manifest, "growth_hacker");
    const soul = files.find((f) => f.relativePath === "SOUL.md")!;
    expect(soul.content).toContain("hypothesize");
    expect(soul.content).toContain("measure");
  });

  it("throws for nonexistent role", async () => {
    const manifest = await loadManifest();
    expect(() => generateWorkspaceFiles(manifest, "nonexistent")).toThrow("not found");
  });

  it("is idempotent", async () => {
    const manifest = await loadManifest();
    const files1 = generateWorkspaceFiles(manifest, "chief_of_staff");
    const files2 = generateWorkspaceFiles(manifest, "chief_of_staff");
    for (let i = 0; i < files1.length; i++) {
      expect(files1[i]!.content).toBe(files2[i]!.content);
    }
  });
});

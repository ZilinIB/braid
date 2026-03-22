/**
 * Regression tests for code review findings.
 *
 * 1. Reject path traversal in family artifact writes
 * 2. Assert transitions fail when required artifacts are absent
 * 3. Assert generated config honors non-default --manifest and --org-dir
 * 4. Verify generated cron script is valid bash
 * 5. Verify executive summaries can be read back through report API
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseManifest } from "../../manifest/schema.js";
import { createWorkflowRuntime, type WorkflowRuntime } from "../index.js";
import { isSafeSubFile } from "../engine/ownership.js";
import { generateOpenClawConfig } from "../../generator/openclaw-config.js";
import { generateCronJobs, generateCronScript } from "../../generator/cron-jobs.js";
import type { BraidManifest } from "../../manifest/types.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "../../manifest/__tests__/fixtures/valid-manifest.yaml");

async function loadManifest(): Promise<BraidManifest> {
  const raw = await readFile(FIXTURE_PATH, "utf-8");
  return parseManifest(parseYaml(raw));
}

// ── Finding 1: Path traversal ──

describe("path traversal prevention", () => {
  let runtime: WorkflowRuntime;
  let tmpDir: string;
  let woId: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "braid-reg-"));
    const manifest = await loadManifest();
    runtime = createWorkflowRuntime(manifest, tmpDir);
    const result = await runtime.callTool("chief_of_staff", "wo_open", {
      title: "Test", type: "build", request_content: "test",
    });
    woId = result.match(/WO-\d{4}-\d{2}-\d{2}-\d{3}/)![0];
  });

  it("rejects ../brief.md traversal via delivery family", async () => {
    const result = await runtime.callTool("frontend_engineer", "wo_write", {
      wo_id: woId,
      artifact: "delivery",
      content: "pwned",
      file: "../brief.md",
    });
    expect(result).toContain("Error");
    expect(result).toContain("Unsafe");
  });

  it("rejects absolute path sub-file", async () => {
    const result = await runtime.callTool("frontend_engineer", "wo_write", {
      wo_id: woId,
      artifact: "delivery",
      content: "pwned",
      file: "/etc/passwd",
    });
    expect(result).toContain("Error");
  });

  it("rejects ../../status.yaml traversal", async () => {
    const result = await runtime.callTool("frontend_engineer", "wo_write", {
      wo_id: woId,
      artifact: "delivery",
      content: "pwned",
      file: "../../status.yaml",
    });
    expect(result).toContain("Error");
  });

  it("allows legitimate sub-file name", async () => {
    const result = await runtime.callTool("frontend_engineer", "wo_write", {
      wo_id: woId,
      artifact: "delivery",
      content: "my work",
      file: "frontend_engineer.md",
    });
    expect(result).toContain("delivery/frontend_engineer.md");
  });
});

describe("isSafeSubFile", () => {
  it("rejects ..", () => expect(isSafeSubFile("..")).toBe(false));
  it("rejects ../file", () => expect(isSafeSubFile("../brief.md")).toBe(false));
  it("rejects absolute", () => expect(isSafeSubFile("/etc/passwd")).toBe(false));
  it("rejects nested traversal", () => expect(isSafeSubFile("foo/../../bar.md")).toBe(false));
  it("accepts plain file", () => expect(isSafeSubFile("frontend.md")).toBe(true));
  it("accepts nested file", () => expect(isSafeSubFile("sub/file.md")).toBe(true));
  it("rejects empty", () => expect(isSafeSubFile("")).toBe(false));
});

// ── Finding 2: Transition prerequisites ──

describe("transition prerequisite enforcement", () => {
  let runtime: WorkflowRuntime;
  let tmpDir: string;
  let woId: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "braid-reg-"));
    const manifest = await loadManifest();
    runtime = createWorkflowRuntime(manifest, tmpDir);
    const result = await runtime.callTool("chief_of_staff", "wo_open", {
      title: "Test", type: "build", request_content: "test",
    });
    woId = result.match(/WO-\d{4}-\d{2}-\d{2}-\d{3}/)![0];
  });

  it("rejects opened -> briefed without brief.md", async () => {
    const result = await runtime.callTool("product_lead", "wo_transition", {
      wo_id: woId, to: "briefed",
    });
    expect(result).toContain("Error");
    expect(result).toContain("brief.md");
  });

  it("allows opened -> briefed after writing brief.md", async () => {
    await runtime.callTool("product_lead", "wo_write", {
      wo_id: woId, artifact: "brief", content: "# Brief\n\nTest brief",
    });
    const result = await runtime.callTool("product_lead", "wo_transition", {
      wo_id: woId, to: "briefed",
    });
    expect(result).toContain("briefed");
  });

  it("rejects approved -> done without reason", async () => {
    // Fast-track to approved state by writing all required artifacts
    await runtime.callTool("product_lead", "wo_write", { wo_id: woId, artifact: "brief", content: "brief" });
    await runtime.callTool("product_lead", "wo_transition", { wo_id: woId, to: "briefed" });
    await runtime.callTool("tech_lead", "wo_write", { wo_id: woId, artifact: "plan", content: "plan" });
    await runtime.callTool("tech_lead", "wo_transition", { wo_id: woId, to: "planned" });
    await runtime.callTool("tech_lead", "wo_transition", { wo_id: woId, to: "in_execution" });
    await runtime.callTool("tech_lead", "wo_write", { wo_id: woId, artifact: "delivery", content: "delivery" });
    await runtime.callTool("tech_lead", "wo_transition", { wo_id: woId, to: "in_review" });
    await runtime.callTool("qa_guard", "wo_write", { wo_id: woId, artifact: "review", content: "pass" });
    await runtime.callTool("qa_guard", "wo_transition", { wo_id: woId, to: "approved" });

    const result = await runtime.callTool("chief_of_staff", "wo_transition", {
      wo_id: woId, to: "done",
    });
    expect(result).toContain("Error");
    expect(result).toContain("final summary reason");
  });
});

// ── Finding 3: Config path agreement ──

describe("generated config honors options", () => {
  it("uses provided manifestPath in plugin config", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(
      manifest,
      { channel: "telegram" },
      { manifestPath: "custom/path/manifest.yaml" },
    );
    expect(config.plugins.entries["braid-workflow"]!.config!.manifestPath).toBe("custom/path/manifest.yaml");
  });

  it("uses provided orgBaseDir in plugin config", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(
      manifest,
      { channel: "telegram" },
      { orgBaseDir: "/data/braid" },
    );
    expect(config.plugins.entries["braid-workflow"]!.config!.orgBaseDir).toBe("/data/braid");
  });

  it("defaults manifestPath when not provided", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, { channel: "telegram" });
    expect(config.plugins.entries["braid-workflow"]!.config!.manifestPath).toBe("manifests/software-product-company.yaml");
  });
});

// ── Finding 4: Valid bash cron script ──

describe("generated cron script", () => {
  it("passes bash -n syntax check", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest);
    const script = generateCronScript(jobs);

    // bash -n does a syntax check without executing
    expect(() => {
      execSync("bash -n", { input: script, encoding: "utf-8" });
    }).not.toThrow();
  });

  it("does not contain literal ${jobs.length}", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest);
    const script = generateCronScript(jobs);
    expect(script).not.toContain("${jobs.length}");
    expect(script).toContain("All 10 daily reporting cron jobs created.");
  });
});

// ── Finding 5: Executive summary readback ──

describe("executive summary readback", () => {
  let runtime: WorkflowRuntime;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "braid-reg-"));
    const manifest = await loadManifest();
    runtime = createWorkflowRuntime(manifest, tmpDir);
  });

  it("summary is readable after writing", async () => {
    await runtime.callTool("tech_lead", "report_write", {
      content: "## Completed\n\n- Built APIs",
    });

    await runtime.callTool("chief_of_staff", "report_write", {
      content: "## Company Snapshot\n\nAll on track.",
    });

    // Read all reports — should include the summary
    const allReports = await runtime.callTool("chief_of_staff", "report_read", {});
    expect(allReports).toContain("Company Snapshot");
    expect(allReports).toContain("tech_lead");
  });

  it("summary is discoverable in readAllReports", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await runtime.callTool("chief_of_staff", "report_write", {
      content: "## Summary content",
    });

    const reports = await runtime.reportStore.readAllReports(today);
    expect(Object.keys(reports).length).toBeGreaterThan(0);
    const summaryContent = Object.values(reports).find((v) => v.includes("Summary content"));
    expect(summaryContent).toBeDefined();
  });
});

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import { parseManifest } from "../../manifest/schema.js";
import { generateCronJobs, generateCronScript, generateCronCommands } from "../cron-jobs.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "../../manifest/__tests__/fixtures/valid-manifest.yaml");

async function loadManifest() {
  const raw = await readFile(FIXTURE_PATH, "utf-8");
  return parseManifest(parseYaml(raw));
}

describe("generateCronJobs", () => {
  it("generates one job per role in reporting order", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest);
    expect(jobs).toHaveLength(10);
    expect(jobs[0]!.agentId).toBe("research_analyst");
    expect(jobs[9]!.agentId).toBe("chief_of_staff");
  });

  it("staggers jobs by interval", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest, { baseHour: 17, intervalMinutes: 2 });
    expect(jobs[0]!.cron).toBe("0 17 * * *");
    expect(jobs[1]!.cron).toBe("2 17 * * *");
    expect(jobs[4]!.cron).toBe("8 17 * * *");
    expect(jobs[9]!.cron).toBe("18 17 * * *");
  });

  it("all jobs use isolated sessions", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest);
    for (const job of jobs) {
      expect(job.session).toBe("isolated");
    }
  });

  it("summary role gets different prompt", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest);
    const cosJob = jobs.find((j) => j.agentId === "chief_of_staff")!;
    expect(cosJob.message).toContain("executive summary");
    expect(cosJob.message).toContain("report_read");

    const techJob = jobs.find((j) => j.agentId === "tech_lead")!;
    expect(techJob.message).toContain("daily operational report");
    expect(techJob.message).toContain("report_write");
  });

  it("role prompts include standard sections", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest);
    const techJob = jobs.find((j) => j.agentId === "tech_lead")!;
    expect(techJob.message).toContain("Completed");
    expect(techJob.message).toContain("Blockers");
    expect(techJob.message).toContain("Metrics");
  });

  it("returns empty for disabled reporting", async () => {
    const manifest = await loadManifest();
    manifest.reporting.daily.enabled = false;
    const jobs = generateCronJobs(manifest);
    expect(jobs).toHaveLength(0);
  });
});

describe("generateCronScript", () => {
  it("generates a bash script", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest);
    const script = generateCronScript(jobs);
    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("openclaw cron add");
    expect(script).toContain("set -e");
  });
});

describe("generateCronCommands", () => {
  it("generates one command per job", async () => {
    const manifest = await loadManifest();
    const jobs = generateCronJobs(manifest);
    const commands = generateCronCommands(jobs);
    expect(commands).toHaveLength(10);
    for (const cmd of commands) {
      expect(cmd).toContain("openclaw cron add");
    }
  });
});

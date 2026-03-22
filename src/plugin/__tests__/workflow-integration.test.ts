import { describe, it, expect, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseManifest } from "../../manifest/schema.js";
import { createWorkflowRuntime, type WorkflowRuntime } from "../index.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "../../manifest/__tests__/fixtures/valid-manifest.yaml");

describe("workflow integration", () => {
  let runtime: WorkflowRuntime;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "braid-test-"));
    const raw = await readFile(FIXTURE_PATH, "utf-8");
    const manifest = parseManifest(parseYaml(raw));
    runtime = createWorkflowRuntime(manifest, tmpDir);
  });

  // Full build workflow: open -> brief -> plan -> execute -> review -> approve -> done
  it("runs a full build work order lifecycle", async () => {
    // 1. CoS opens the work order
    const openResult = await runtime.callTool("chief_of_staff", "wo_open", {
      title: "Add user dashboard",
      type: "build",
      request_content: "# Request\n\nBuild a user dashboard with analytics.",
    });
    expect(openResult).toContain("opened");
    const woId = openResult.match(/WO-\d{4}-\d{2}-\d{2}-\d{3}/)![0];

    // 2. product_lead writes the brief
    const briefResult = await runtime.callTool("product_lead", "wo_write", {
      wo_id: woId,
      artifact: "brief",
      content: "# Brief\n\nDashboard with key metrics.",
    });
    expect(briefResult).toContain("brief.md");

    // 3. product_lead tries to transition to briefed
    const briefTransition = await runtime.callTool("product_lead", "wo_transition", {
      wo_id: woId,
      to: "briefed",
    });
    expect(briefTransition).toContain("briefed");

    // 4. product_lead requests baton transfer to tech_lead
    const batonResult = await runtime.callTool("product_lead", "wo_baton", {
      wo_id: woId,
      to: "tech_lead",
      reason: "implementation_required",
    });
    expect(batonResult).toContain("Baton transferred");

    // 5. Verify baton is recorded in status
    const statusAfterBaton = await runtime.callTool("chief_of_staff", "wo_status", { wo_id: woId });
    const parsedStatus = JSON.parse(statusAfterBaton);
    expect(parsedStatus.lane_owner).toBe("tech_lead");
    expect(parsedStatus.baton_history).toHaveLength(1);

    // 6. tech_lead writes plan
    const planResult = await runtime.callTool("tech_lead", "wo_write", {
      wo_id: woId,
      artifact: "plan",
      content: "# Plan\n\n1. Build API\n2. Build UI",
    });
    expect(planResult).toContain("plan.md");

    // 7. tech_lead transitions to planned
    await runtime.callTool("tech_lead", "wo_transition", { wo_id: woId, to: "planned" });

    // 8. tech_lead writes spec
    await runtime.callTool("tech_lead", "wo_write", {
      wo_id: woId,
      artifact: "spec",
      content: "# Spec\n\nAPI spec here.",
    });

    // 9. tech_lead transitions to in_execution
    await runtime.callTool("tech_lead", "wo_transition", { wo_id: woId, to: "in_execution" });

    // 10. frontend_engineer writes a delivery contribution
    const feDelivery = await runtime.callTool("frontend_engineer", "wo_write", {
      wo_id: woId,
      artifact: "delivery",
      content: "# Frontend Delivery\n\nDashboard components built.",
      file: "frontend_engineer.md",
    });
    expect(feDelivery).toContain("delivery/frontend_engineer.md");

    // 11. frontend_engineer tries to write delivery/index.md (should fail)
    const feIndexFail = await runtime.callTool("frontend_engineer", "wo_write", {
      wo_id: woId,
      artifact: "delivery",
      content: "Should not work",
    });
    expect(feIndexFail).toContain("Error");

    // 12. tech_lead writes delivery/index.md
    await runtime.callTool("tech_lead", "wo_write", {
      wo_id: woId,
      artifact: "delivery",
      content: "# Delivery Summary\n\nDashboard complete.",
    });

    // 13. tech_lead transitions to in_review
    const reviewTransition = await runtime.callTool("tech_lead", "wo_transition", {
      wo_id: woId,
      to: "in_review",
    });
    expect(reviewTransition).toContain("in_review");

    // 14. qa_guard writes review
    await runtime.callTool("qa_guard", "wo_write", {
      wo_id: woId,
      artifact: "review",
      content: "# Review\n\nPassed. All criteria met.",
    });

    // 15. qa_guard approves
    const approveResult = await runtime.callTool("qa_guard", "wo_transition", {
      wo_id: woId,
      to: "approved",
    });
    expect(approveResult).toContain("approved");

    // 16. CoS closes
    const doneResult = await runtime.callTool("chief_of_staff", "wo_transition", {
      wo_id: woId,
      to: "done",
    });
    expect(doneResult).toContain("done");

    // 17. Verify final status
    const finalStatus = JSON.parse(await runtime.callTool("chief_of_staff", "wo_status", { wo_id: woId }));
    expect(finalStatus.state).toBe("done");
    expect(finalStatus.approved).toBe(true);
  });

  it("enforces that only CoS can open work orders", async () => {
    const result = await runtime.callTool("tech_lead", "wo_open", {
      title: "Nope",
      type: "build",
      request_content: "test",
    });
    expect(result).toContain("Error");
    expect(result).toContain("chief_of_staff");
  });

  it("enforces ownership on artifact writes", async () => {
    // Open a WO first
    const openResult = await runtime.callTool("chief_of_staff", "wo_open", {
      title: "Test",
      type: "build",
      request_content: "test",
    });
    const woId = openResult.match(/WO-\d{4}-\d{2}-\d{2}-\d{3}/)![0];

    // tech_lead tries to write brief (should fail — product_lead owns brief for build)
    const result = await runtime.callTool("tech_lead", "wo_write", {
      wo_id: woId,
      artifact: "brief",
      content: "nope",
    });
    expect(result).toContain("Error");
    expect(result).toContain("product_lead");
  });

  it("handles escalation", async () => {
    const openResult = await runtime.callTool("chief_of_staff", "wo_open", {
      title: "Critical issue",
      type: "ops",
      mode: "incident",
      request_content: "Production down",
    });
    const woId = openResult.match(/WO-\d{4}-\d{2}-\d{2}-\d{3}/)![0];

    const escalateResult = await runtime.callTool("tech_lead", "wo_escalate", {
      wo_id: woId,
      severity: "critical",
      needs_human_attention: true,
    });
    expect(escalateResult).toContain("critical");
    expect(escalateResult).toContain("Human notification required");

    const status = JSON.parse(await runtime.callTool("chief_of_staff", "wo_status", { wo_id: woId }));
    expect(status.severity).toBe("critical");
    expect(status.needs_human_attention).toBe(true);
  });

  it("lists work orders with filters", async () => {
    await runtime.callTool("chief_of_staff", "wo_open", {
      title: "WO 1", type: "build", request_content: "test",
    });
    await runtime.callTool("chief_of_staff", "wo_open", {
      title: "WO 2", type: "research", request_content: "test",
    });

    const allResult = await runtime.callTool("tech_lead", "wo_list", {});
    expect(allResult).toContain("WO 1");
    expect(allResult).toContain("WO 2");

    const buildOnly = await runtime.callTool("tech_lead", "wo_list", { type: "build" });
    expect(buildOnly).toContain("WO 1");
    expect(buildOnly).not.toContain("WO 2");
  });

  it("handles daily reporting", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await runtime.callTool("tech_lead", "report_write", {
      content: "## Completed\n\n- Finished API work\n\n## Blockers\n\nNone",
    });

    await runtime.callTool("qa_guard", "report_write", {
      content: "## Completed\n\n- Reviewed 2 PRs\n\n## Blockers\n\nNone",
    });

    const techReport = await runtime.callTool("chief_of_staff", "report_read", {
      role: "tech_lead",
    });
    expect(techReport).toContain("Finished API work");

    const allReports = await runtime.callTool("chief_of_staff", "report_read", {});
    expect(allReports).toContain("tech_lead");
    expect(allReports).toContain("qa_guard");

    // CoS writes executive summary
    await runtime.callTool("chief_of_staff", "report_write", {
      content: "## Company Snapshot\n\nAll on track.",
    });
  });

  it("reads artifacts correctly", async () => {
    const openResult = await runtime.callTool("chief_of_staff", "wo_open", {
      title: "Test Read",
      type: "build",
      request_content: "# Request\n\nTest content here.",
    });
    const woId = openResult.match(/WO-\d{4}-\d{2}-\d{2}-\d{3}/)![0];

    const requestContent = await runtime.callTool("tech_lead", "wo_read", {
      wo_id: woId,
      artifact: "request",
    });
    expect(requestContent).toContain("Test content here");
  });

  it("handles ops incident mode with expedited review and default high severity", async () => {
    const openResult = await runtime.callTool("chief_of_staff", "wo_open", {
      title: "Outage",
      type: "ops",
      mode: "incident",
      request_content: "Production outage",
    });
    const woId = openResult.match(/WO-\d{4}-\d{2}-\d{2}-\d{3}/)![0];

    const status = JSON.parse(await runtime.callTool("chief_of_staff", "wo_status", { wo_id: woId }));
    expect(status.review_policy).toBe("expedited");
    expect(status.severity).toBe("high");
  });
});

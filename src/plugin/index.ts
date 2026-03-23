/**
 * Braid Workflow Plugin for OpenClaw
 *
 * This module exports the plugin definition and a standalone factory
 * for creating the workflow runtime without OpenClaw.
 *
 * When loaded by OpenClaw via definePluginEntry:
 *   - Reads the manifest from pluginConfig.manifestPath
 *   - Registers 10 workflow tools
 *   - Registers a before_prompt_build hook for context injection
 *
 * For standalone/testing use:
 *   - Use createWorkflowRuntime() with a manifest and base directory
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { parseManifest } from "../manifest/schema.js";
import { validateManifest } from "../manifest/validate.js";
import type { BraidManifest } from "../manifest/types.js";
import { WorkOrderStore } from "./store/work-order-store.js";
import { buildArtifactPathMap } from "./engine/ownership.js";
import { ReportStore } from "./store/report-store.js";
import {
  woOpen, woStatus, woRead, woWrite, woList,
  woTransition, woBaton, woEscalate,
  reportWrite, reportRead,
  type ToolContext,
} from "./tools/workflow-tools.js";

export type WorkflowRuntime = {
  manifest: BraidManifest;
  woStore: WorkOrderStore;
  reportStore: ReportStore;
  callTool: (roleId: string, toolName: string, args: Record<string, unknown>) => Promise<string>;
};

export function createWorkflowRuntime(
  manifest: BraidManifest,
  baseDir: string,
): WorkflowRuntime {
  const validation = validateManifest(manifest);
  if (!validation.ok) {
    const messages = validation.errors.map((e) => `  [${e.rule}] ${e.path}: ${e.message}`);
    throw new Error(`Manifest validation failed:\n${messages.join("\n")}`);
  }

  const artifactPathMap = buildArtifactPathMap(manifest);
  const woStore = new WorkOrderStore(
    `${baseDir}/${manifest.protocol.work_orders.directory}`,
    artifactPathMap.status ?? "status.yaml",
  );
  const reportStore = new ReportStore(
    `${baseDir}/${manifest.reporting.daily.store}`,
  );

  function makeCtx(roleId: string): ToolContext {
    return { callingRole: roleId, manifest, woStore, reportStore, artifactPathMap };
  }

  async function callTool(
    roleId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const ctx = makeCtx(roleId);
    switch (toolName) {
      case "wo_open":
        return woOpen(ctx, args as Parameters<typeof woOpen>[1]);
      case "wo_status":
        return woStatus(ctx, args as Parameters<typeof woStatus>[1]);
      case "wo_read":
        return woRead(ctx, args as Parameters<typeof woRead>[1]);
      case "wo_write":
        return woWrite(ctx, args as Parameters<typeof woWrite>[1]);
      case "wo_list":
        return woList(ctx, args as Parameters<typeof woList>[1]);
      case "wo_transition":
        return woTransition(ctx, args as Parameters<typeof woTransition>[1]);
      case "wo_baton":
        return woBaton(ctx, args as Parameters<typeof woBaton>[1]);
      case "wo_escalate":
        return woEscalate(ctx, args as Parameters<typeof woEscalate>[1]);
      case "report_write":
        return reportWrite(ctx, args as Parameters<typeof reportWrite>[1]);
      case "report_read":
        return reportRead(ctx, args as Parameters<typeof reportRead>[1]);
      default:
        return `Error: unknown tool "${toolName}"`;
    }
  }

  return { manifest, woStore, reportStore, callTool };
}

export function loadManifestSync(path: string): BraidManifest {
  const raw = readFileSync(path, "utf-8");
  const manifest = parseManifest(parseYaml(raw));
  const validation = validateManifest(manifest);
  if (!validation.ok) {
    const messages = validation.errors.map((e) => `  [${e.rule}] ${e.path}: ${e.message}`);
    throw new Error(`Manifest validation failed:\n${messages.join("\n")}`);
  }
  return manifest;
}

/**
 * Tool definitions for OpenClaw registration.
 * Each entry describes a tool that can be registered via api.registerTool().
 */
export const TOOL_DEFINITIONS = [
  {
    name: "wo_open",
    description: "Open a new work order. Only chief_of_staff may call this.",
    parameters: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Title of the work order" },
        type: { type: "string", description: "Work order type: build, research, growth, or ops" },
        mode: { type: "string", description: "Optional mode for ops: planned_change, incident, or maintenance" },
        request_content: { type: "string", description: "The raw request content for request.md" },
      },
      required: ["title", "type", "request_content"],
    },
  },
  {
    name: "wo_status",
    description: "Read the current status of a work order.",
    parameters: {
      type: "object" as const,
      properties: {
        wo_id: { type: "string", description: "Work order ID (e.g. WO-2026-03-22-001)" },
      },
      required: ["wo_id"],
    },
  },
  {
    name: "wo_read",
    description: "Read an artifact from a work order.",
    parameters: {
      type: "object" as const,
      properties: {
        wo_id: { type: "string", description: "Work order ID" },
        artifact: { type: "string", description: "Artifact name: request, brief, plan, spec, delivery, or review" },
        file: { type: "string", description: "Optional sub-file for family artifacts (e.g. frontend.md)" },
      },
      required: ["wo_id", "artifact"],
    },
  },
  {
    name: "wo_write",
    description: "Write content to a work order artifact. Ownership is enforced.",
    parameters: {
      type: "object" as const,
      properties: {
        wo_id: { type: "string", description: "Work order ID" },
        artifact: { type: "string", description: "Artifact name: brief, plan, spec, delivery, or review" },
        content: { type: "string", description: "The content to write" },
        file: { type: "string", description: "Optional sub-file for family artifacts" },
      },
      required: ["wo_id", "artifact", "content"],
    },
  },
  {
    name: "wo_list",
    description: "List work orders, optionally filtered by state or type.",
    parameters: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "Filter by state" },
        type: { type: "string", description: "Filter by type" },
      },
      required: [],
    },
  },
  {
    name: "wo_transition",
    description: "Request a state transition on a work order. Validates against the state machine.",
    parameters: {
      type: "object" as const,
      properties: {
        wo_id: { type: "string", description: "Work order ID" },
        to: { type: "string", description: "Target state" },
        blocker: { type: "string", description: "Blocker description (for blocked transitions)" },
        reason: { type: "string", description: "Reason for cancellation or other transitions" },
      },
      required: ["wo_id", "to"],
    },
  },
  {
    name: "wo_baton",
    description: "Request a baton transfer to hand lane ownership to another role.",
    parameters: {
      type: "object" as const,
      properties: {
        wo_id: { type: "string", description: "Work order ID" },
        to: { type: "string", description: "Target role for the baton transfer" },
        reason: { type: "string", description: "Reason for the transfer" },
      },
      required: ["wo_id", "to", "reason"],
    },
  },
  {
    name: "wo_escalate",
    description: "Escalate a work order's severity or mark it as needing human attention.",
    parameters: {
      type: "object" as const,
      properties: {
        wo_id: { type: "string", description: "Work order ID" },
        severity: { type: "string", description: "Severity level: normal, high, or critical" },
        reason: { type: "string", description: "Reason for escalation" },
        needs_human_attention: { type: "boolean", description: "Whether human attention is needed immediately" },
      },
      required: ["wo_id", "severity"],
    },
  },
  {
    name: "report_write",
    description: "Write your daily report. If you are the summary role, this writes the executive summary.",
    parameters: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "Report content in markdown" },
        date: { type: "string", description: "Date in YYYY-MM-DD format (defaults to today)" },
      },
      required: ["content"],
    },
  },
  {
    name: "report_read",
    description: "Read daily reports. Omit role to read all available reports for the date.",
    parameters: {
      type: "object" as const,
      properties: {
        role: { type: "string", description: "Role ID to read report for" },
        date: { type: "string", description: "Date in YYYY-MM-DD format (defaults to today)" },
      },
      required: [],
    },
  },
] as const;

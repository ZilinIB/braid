/**
 * OpenClaw plugin entry point for Braid Workflow.
 *
 * This file is loaded by OpenClaw's plugin system. It registers all
 * workflow tools and the context injection hook.
 *
 * To use: add this plugin's directory to OpenClaw's plugins.load.paths
 * and enable it in plugins.entries.
 */

// NOTE: This file imports from openclaw/plugin-sdk which is only available
// when loaded inside the OpenClaw runtime. For standalone testing, use
// createWorkflowRuntime() from ../index.ts instead.

import { join } from "node:path";
import { homedir } from "node:os";
import { loadManifestSync, createWorkflowRuntime, TOOL_DEFINITIONS } from "../index.js";

/**
 * Plugin registration function.
 * Called by OpenClaw when the plugin is loaded.
 */
export function register(api: {
  pluginConfig?: Record<string, unknown>;
  registerTool: (tool: unknown, opts?: { name?: string }) => void;
  registerHook: (event: string, handler: (...args: unknown[]) => unknown) => void;
  resolvePath: (p: string) => string;
}) {
  const manifestPath = api.resolvePath(
    (api.pluginConfig?.manifestPath as string) ?? "manifests/software-product-company.yaml",
  );
  const defaultOrgBase = join(homedir(), ".openclaw", "braid");
  const baseDir = api.resolvePath(
    (api.pluginConfig?.orgBaseDir as string) ?? defaultOrgBase,
  );

  const manifest = loadManifestSync(manifestPath);
  const runtime = createWorkflowRuntime(manifest, baseDir);

  // Register each tool
  for (const def of TOOL_DEFINITIONS) {
    const toolName = def.name;
    api.registerTool(
      (ctx: { agentId?: string }) => ({
        name: toolName,
        description: def.description,
        parameters: def.parameters,
        async execute(_toolCallId: string, args: Record<string, unknown>) {
          const roleId = ctx.agentId ?? "unknown";
          return runtime.callTool(roleId, toolName, args);
        },
      }),
      { name: toolName },
    );
  }

  // Context injection: give each agent awareness of active work orders
  api.registerHook("before_prompt_build", async (...args: unknown[]) => {
    const event = (args[0] ?? {}) as { agentId?: string };
    const roleId = event.agentId;
    if (!roleId || !manifest.roles[roleId]) return {};

    try {
      const items = await runtime.woStore.list();
      const relevant = items.filter(
        (i) =>
          i.status.current_role === roleId ||
          i.status.lane_owner === roleId ||
          i.status.owner === roleId,
      );

      if (relevant.length === 0) return {};

      const summary = relevant
        .map((i) => `- ${i.id}: "${i.status.title}" [${i.status.state}] (${i.status.type}) severity: ${i.status.severity}`)
        .join("\n");

      return {
        prependContext: `## Active Work Orders\n\n${summary}\n\nUse wo_status and wo_read to get details.\n`,
      };
    } catch {
      return {};
    }
  });
}

export default { register };

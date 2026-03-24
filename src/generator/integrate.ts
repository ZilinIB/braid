import { readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { OpenClawConfigOutput } from "./openclaw-config.js";

export type IntegrateOptions = {
  openclawConfigPath?: string;
  braidConfig: OpenClawConfigOutput;
  pluginPath: string;
  backup?: boolean;
};

export type IntegrateResult = {
  configPath: string;
  backupPath?: string;
  agentsAdded: number;
  bindingsAdded: number;
  pluginRegistered: boolean;
  pluginPathAdded: boolean;
};

function defaultConfigPath(): string {
  return resolve(homedir(), ".openclaw", "openclaw.json");
}

export async function integrateIntoOpenClaw(options: IntegrateOptions): Promise<IntegrateResult> {
  const configPath = options.openclawConfigPath ?? defaultConfigPath();

  let existing: Record<string, unknown>;
  try {
    const raw = await readFile(configPath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    throw new Error(`Cannot read OpenClaw config at ${configPath}. Run 'openclaw setup' first.`);
  }

  // Backup
  let backupPath: string | undefined;
  if (options.backup !== false) {
    backupPath = `${configPath}.braid-backup.${Date.now()}`;
    await copyFile(configPath, backupPath);
  }

  const braid = options.braidConfig;

  // Patch agents
  const agents = (existing.agents ?? {}) as Record<string, unknown>;
  const defaults = (agents.defaults ?? {}) as Record<string, unknown>;
  const defaultSubagents = (defaults.subagents ?? {}) as Record<string, unknown>;
  defaultSubagents.maxSpawnDepth = braid.agents.defaults.subagents.maxSpawnDepth;
  defaults.subagents = defaultSubagents;
  agents.defaults = defaults;

  // Merge agent list: remove any existing Braid agents, then add new ones
  const braidAgentIds = new Set(braid.agents.list.map((a) => a.id));
  const existingList = (agents.list ?? []) as Array<Record<string, unknown>>;
  const filteredList = existingList.filter((a) => !braidAgentIds.has(a.id as string));
  agents.list = [...filteredList, ...braid.agents.list];
  existing.agents = agents;

  // Patch bindings: remove existing Braid bindings, add new ones
  const braidBindingAgents = new Set(braid.bindings.map((b) => b.agentId));
  const existingBindings = (existing.bindings ?? []) as Array<Record<string, unknown>>;
  const filteredBindings = existingBindings.filter((b) => !braidBindingAgents.has(b.agentId as string));
  existing.bindings = [...filteredBindings, ...braid.bindings];

  // Patch plugins.entries
  const plugins = (existing.plugins ?? {}) as Record<string, unknown>;
  const entries = (plugins.entries ?? {}) as Record<string, unknown>;
  Object.assign(entries, braid.plugins.entries);
  plugins.entries = entries;

  // Add plugin load path
  const load = (plugins.load ?? {}) as Record<string, unknown>;
  const paths = (load.paths ?? []) as string[];
  const absPluginPath = resolve(options.pluginPath);
  if (!paths.includes(absPluginPath)) {
    paths.push(absPluginPath);
  }
  load.paths = paths;
  plugins.load = load;
  existing.plugins = plugins;

  // Patch tools: set global profile to "coding" so all agents have exec/Bash
  // access (needed for skills like agent-browser). Per-agent deny lists
  // still restrict spawn/send for leaf roles.
  const tools = (existing.tools ?? {}) as Record<string, unknown>;
  tools.profile = "coding";
  const sessions = (tools.sessions ?? {}) as Record<string, unknown>;
  sessions.visibility = braid.tools.sessions.visibility;
  tools.sessions = sessions;
  existing.tools = tools;

  // Remove stale root-level sandbox key if a previous Braid integration added one.
  // OpenClaw only supports sandbox config per-agent, not at root.
  if ("sandbox" in existing) {
    delete existing.sandbox;
  }

  await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");

  return {
    configPath,
    backupPath,
    agentsAdded: braid.agents.list.length,
    bindingsAdded: braid.bindings.length,
    pluginRegistered: true,
    pluginPathAdded: true,
  };
}

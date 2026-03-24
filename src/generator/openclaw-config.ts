import { resolve } from "node:path";
import type { BraidManifest, RoleConfig, RoleModel, SandboxMountConfig } from "../manifest/types.js";

export type ChannelBindingInput = {
  channel: string;
  accountId?: string;
  peer?: { kind: string; id: string };
};

export type GenerateConfigOptions = {
  manifestPath?: string;
  orgBaseDir?: string;
  /** Resolve workspace/plugin paths as absolute. Needed for OpenClaw integration. */
  absolutePaths?: boolean;
  /** Base directory to resolve relative paths against (defaults to cwd). */
  baseDir?: string;
};

type AgentEntry = {
  id: string;
  name: string;
  default?: boolean;
  workspace: string;
  model?: string;
  identity: { name: string };
  subagents?: { allowAgents?: string[] };
  sandbox?: { mode: string; workspaceAccess: string; docker?: { binds: string[]; dangerouslyAllowExternalBindSources?: boolean } };
  tools?: { profile?: string; deny?: string[] };
};

type BindingEntry = {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: { kind: string; id: string };
  };
};

export type OpenClawConfigOutput = {
  agents: {
    defaults: {
      subagents: { maxSpawnDepth: number };
    };
    list: AgentEntry[];
  };
  bindings: BindingEntry[];
  plugins: {
    entries: Record<string, {
      enabled: boolean;
      config?: Record<string, unknown>;
    }>;
  };
  tools: {
    sessions: { visibility: string };
  };
};

function resolveModelString(model?: RoleModel): string | undefined {
  if (!model) return undefined;
  if (typeof model === "string") return model;
  return model.primary;
}

function formatBindMount(mount: SandboxMountConfig): string {
  return `${mount.host_path}:${mount.container_path}:${mount.mode}`;
}

function buildAgentEntry(
  roleId: string,
  role: RoleConfig,
  workspacesDir: string,
  isDefault: boolean,
  projectDirs: SandboxMountConfig[],
): AgentEntry {
  const entry: AgentEntry = {
    id: roleId,
    name: role.display_name,
    workspace: `${workspacesDir}/${roleId}`,
    identity: { name: role.display_name },
  };

  if (isDefault) entry.default = true;

  const model = resolveModelString(role.model);
  if (model) entry.model = model;

  if (role.can_spawn.length > 0) {
    entry.subagents = { allowAgents: [...role.can_spawn] };
  }

  const sandbox: AgentEntry["sandbox"] = {
    mode: role.user_facing ? "non-main" : "all",
    workspaceAccess: "rw",
  };
  if (projectDirs.length > 0) {
    sandbox.docker = {
      binds: projectDirs.map(formatBindMount),
      dangerouslyAllowExternalBindSources: true,
    };
  }
  entry.sandbox = sandbox;

  // All roles get "coding" profile for Bash/exec access (needed for
  // skills like agent-browser and coding tools). Leaf roles deny
  // sessions_spawn and sessions_send since they only produce artifacts
  // and return. Orchestrators deny nothing.
  if (role.can_spawn.length > 0) {
    entry.tools = { profile: "coding" };
  } else if (!role.user_facing) {
    entry.tools = { profile: "coding", deny: ["sessions_spawn", "sessions_send"] };
  } else {
    entry.tools = { profile: "coding" };
  }

  return entry;
}

export function generateOpenClawConfig(
  manifest: BraidManifest,
  channelBinding: ChannelBindingInput,
  options?: GenerateConfigOptions,
): OpenClawConfigOutput {
  const baseDir = options?.baseDir ?? process.cwd();
  const resolvePath = (p: string) => options?.absolutePaths ? resolve(baseDir, p) : p;

  const workspacesDir = resolvePath(manifest.generation.targets.openclaw.output_workspaces_dir);
  const userFacingRole = manifest.generation.targets.openclaw.user_binding_role;
  const projectDirs = manifest.sandbox?.project_dirs ?? [];

  const agents: AgentEntry[] = Object.entries(manifest.roles).map(([roleId, role]) =>
    buildAgentEntry(roleId, role, workspacesDir, roleId === userFacingRole, projectDirs),
  );

  const binding: BindingEntry = {
    agentId: userFacingRole,
    match: {
      channel: channelBinding.channel,
      ...(channelBinding.accountId && { accountId: channelBinding.accountId }),
      ...(channelBinding.peer && { peer: channelBinding.peer }),
    },
  };

  return {
    agents: {
      defaults: {
        subagents: {
          maxSpawnDepth: manifest.runtime.execution.max_spawn_depth,
        },
      },
      list: agents,
    },
    bindings: [binding],
    plugins: {
      entries: {
        "braid-workflow": {
          enabled: true,
          config: {
            manifestPath: resolvePath(options?.manifestPath ?? "manifests/software-product-company.yaml"),
            ...(options?.orgBaseDir && { orgBaseDir: resolvePath(options.orgBaseDir) }),
          },
        },
      },
    },
    tools: {
      sessions: { visibility: "tree" },
    },
  };
}

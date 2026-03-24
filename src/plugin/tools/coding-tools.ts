import { execFile } from "node:child_process";
import type { BraidManifest, CodingConfig } from "../../manifest/types.js";

export type CodingToolContext = {
  callingRole: string;
  manifest: BraidManifest;
};

type ExecResult = { stdout: string; stderr: string; exitCode: number };

function getCodingConfig(manifest: BraidManifest): CodingConfig | null {
  return manifest.coding?.enabled ? manifest.coding : null;
}

function checkCodingAccess(ctx: CodingToolContext): string | null {
  const coding = getCodingConfig(ctx.manifest);
  if (!coding) return "Error: coding is not enabled in this organization";
  if (!coding.allowed_roles.includes(ctx.callingRole)) {
    return `Error: role "${ctx.callingRole}" is not authorized to use coding tools. Allowed: ${coding.allowed_roles.join(", ")}`;
  }
  return null;
}

function resolveAgent(coding: CodingConfig, agent?: string): { name: string; error?: string } {
  const name = agent ?? coding.default_agent;
  if (!coding.agents[name]) {
    return { name, error: `Error: unknown coding agent "${name}". Available: ${Object.keys(coding.agents).join(", ")}` };
  }
  return { name };
}

function buildAcpxArgs(
  coding: CodingConfig,
  agentName: string,
  subArgs: string[],
  opts?: { workdir?: string; format?: string; timeout?: number },
): string[] {
  const args: string[] = [];
  const agentConfig = coding.agents[agentName]!;

  // Global flags
  if (agentConfig.permissions === "approve-all") args.push("--approve-all");
  else if (agentConfig.permissions === "approve-reads") args.push("--approve-reads");
  else if (agentConfig.permissions === "deny-all") args.push("--deny-all");

  if (opts?.workdir) args.push("--cwd", opts.workdir);
  if (opts?.format) args.push("--format", opts.format);
  if (opts?.timeout) args.push("--timeout", String(opts.timeout));

  // Agent name
  const command = agentConfig.command;
  if (command) {
    args.push("--agent", command);
  } else {
    args.push(agentName);
  }

  // Sub-arguments
  args.push(...subArgs);

  return args;
}

function runAcpx(args: string[], timeoutMs: number = 600_000): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile("acpx", args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code === undefined ? 1 : 1 : 0,
      });
    });
  });
}

function parseJsonEvents(stdout: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as Record<string, unknown>);
    } catch {
      // Skip non-JSON lines
    }
  }
  return events;
}

function summarizeJsonEvents(events: Array<Record<string, unknown>>): string {
  const toolCalls: string[] = [];
  let finalText = "";

  for (const event of events) {
    if (event.type === "tool_call" && event.title) {
      const status = event.status ?? "unknown";
      toolCalls.push(`  - [${status}] ${event.title}`);
    }
    if (event.type === "assistant_message" && typeof event.text === "string") {
      finalText = event.text;
    }
    // Also capture the final text from the last text event
    if (event.type === "text" && typeof event.text === "string") {
      finalText = event.text;
    }
  }

  const parts: string[] = [];
  if (toolCalls.length > 0) {
    parts.push(`Tool calls (${toolCalls.length}):\n${toolCalls.join("\n")}`);
  }
  if (finalText) {
    parts.push(`Agent response:\n${finalText}`);
  }
  return parts.join("\n\n") || "(no output)";
}

// ── Tool implementations ──

export async function codeExec(
  ctx: CodingToolContext,
  args: { prompt: string; agent?: string; workdir?: string; timeout?: number },
): Promise<string> {
  const accessError = checkCodingAccess(ctx);
  if (accessError) return accessError;

  const coding = getCodingConfig(ctx.manifest)!;
  const { name: agentName, error: agentError } = resolveAgent(coding, args.agent);
  if (agentError) return agentError;

  const workdir = args.workdir ?? coding.default_workdir;
  if (!workdir) return "Error: workdir is required (no default_workdir configured)";

  const acpxArgs = buildAcpxArgs(coding, agentName, ["exec", args.prompt], {
    workdir,
    format: "json",
    timeout: args.timeout,
  });

  const timeoutMs = (args.timeout ?? 600) * 1000;
  const result = await runAcpx(acpxArgs, timeoutMs);

  if (result.exitCode !== 0) {
    const events = parseJsonEvents(result.stdout);
    const partial = summarizeJsonEvents(events);
    const stderrSnippet = result.stderr.trim() ? `\nstderr: ${result.stderr.slice(0, 2000)}` : "";
    return `Error: coding agent exited with failure.${stderrSnippet}${partial !== "(no output)" ? `\nPartial output:\n${partial}` : ""}`;
  }

  const events = parseJsonEvents(result.stdout);
  return summarizeJsonEvents(events);
}

export async function codeSessionNew(
  ctx: CodingToolContext,
  args: { agent?: string; name?: string; workdir?: string },
): Promise<string> {
  const accessError = checkCodingAccess(ctx);
  if (accessError) return accessError;

  const coding = getCodingConfig(ctx.manifest)!;
  const { name: agentName, error: agentError } = resolveAgent(coding, args.agent);
  if (agentError) return agentError;

  const workdir = args.workdir ?? coding.default_workdir;
  if (!workdir) return "Error: workdir is required (no default_workdir configured)";

  const subArgs = ["sessions", "new"];
  if (args.name) subArgs.push("--name", args.name);

  const acpxArgs = buildAcpxArgs(coding, agentName, subArgs, { workdir });
  const result = await runAcpx(acpxArgs, 30_000);

  if (result.exitCode !== 0) {
    return `Error: failed to create coding session.\nstderr: ${result.stderr.slice(0, 2000)}`;
  }

  const sessionName = args.name ?? "default";
  return `Coding session "${sessionName}" created with ${agentName} in ${workdir}.\n${result.stdout.trim()}`;
}

export async function codePrompt(
  ctx: CodingToolContext,
  args: { prompt: string; agent?: string; session_name?: string; workdir?: string; timeout?: number },
): Promise<string> {
  const accessError = checkCodingAccess(ctx);
  if (accessError) return accessError;

  const coding = getCodingConfig(ctx.manifest)!;
  const { name: agentName, error: agentError } = resolveAgent(coding, args.agent);
  if (agentError) return agentError;

  const workdir = args.workdir ?? coding.default_workdir;
  if (!workdir) return "Error: workdir is required (no default_workdir configured)";

  const subArgs: string[] = [];
  if (args.session_name) subArgs.push("-s", args.session_name);
  subArgs.push("prompt", args.prompt);

  const acpxArgs = buildAcpxArgs(coding, agentName, subArgs, {
    workdir,
    format: "json",
    timeout: args.timeout,
  });

  const timeoutMs = (args.timeout ?? 600) * 1000;
  const result = await runAcpx(acpxArgs, timeoutMs);

  if (result.exitCode !== 0) {
    const events = parseJsonEvents(result.stdout);
    const partial = summarizeJsonEvents(events);
    const stderrSnippet = result.stderr.trim() ? `\nstderr: ${result.stderr.slice(0, 2000)}` : "";
    return `Error: coding prompt failed.${stderrSnippet}${partial !== "(no output)" ? `\nPartial output:\n${partial}` : ""}`;
  }

  const events = parseJsonEvents(result.stdout);
  return summarizeJsonEvents(events);
}

export async function codeStatus(
  ctx: CodingToolContext,
  args: { agent?: string; workdir?: string },
): Promise<string> {
  const accessError = checkCodingAccess(ctx);
  if (accessError) return accessError;

  const coding = getCodingConfig(ctx.manifest)!;
  const { name: agentName, error: agentError } = resolveAgent(coding, args.agent);
  if (agentError) return agentError;

  const workdir = args.workdir ?? coding.default_workdir;
  if (!workdir) return "Error: workdir is required (no default_workdir configured)";
  const acpxArgs = buildAcpxArgs(coding, agentName, ["status"], { workdir });
  const result = await runAcpx(acpxArgs, 15_000);

  return result.stdout.trim() || result.stderr.trim() || "No status available.";
}

export async function codeLog(
  ctx: CodingToolContext,
  args: { agent?: string; session_name?: string; workdir?: string; limit?: number },
): Promise<string> {
  const accessError = checkCodingAccess(ctx);
  if (accessError) return accessError;

  const coding = getCodingConfig(ctx.manifest)!;
  const { name: agentName, error: agentError } = resolveAgent(coding, args.agent);
  if (agentError) return agentError;

  const workdir = args.workdir ?? coding.default_workdir;
  if (!workdir) return "Error: workdir is required (no default_workdir configured)";

  const subArgs: string[] = [];
  if (args.session_name) subArgs.push("-s", args.session_name);
  subArgs.push("sessions", "history");
  if (args.limit) subArgs.push("--limit", String(args.limit));

  const acpxArgs = buildAcpxArgs(coding, agentName, subArgs, { workdir });
  const result = await runAcpx(acpxArgs, 15_000);

  if (result.exitCode !== 0) {
    const stderrSnippet = result.stderr.trim() ? `\nstderr: ${result.stderr.slice(0, 2000)}` : "";
    return `Error: failed to read coding session history.${stderrSnippet}`;
  }

  return result.stdout.trim() || "No history available.";
}

export async function codeCancel(
  ctx: CodingToolContext,
  args: { agent?: string; workdir?: string },
): Promise<string> {
  const accessError = checkCodingAccess(ctx);
  if (accessError) return accessError;

  const coding = getCodingConfig(ctx.manifest)!;
  const { name: agentName, error: agentError } = resolveAgent(coding, args.agent);
  if (agentError) return agentError;

  const workdir = args.workdir ?? coding.default_workdir;
  if (!workdir) return "Error: workdir is required (no default_workdir configured)";
  const acpxArgs = buildAcpxArgs(coding, agentName, ["cancel"], { workdir });
  const result = await runAcpx(acpxArgs, 15_000);

  if (result.exitCode !== 0) {
    return `Error: cancel failed.\nstderr: ${result.stderr.slice(0, 1000)}`;
  }

  return result.stdout.trim() || "Cancel request sent.";
}

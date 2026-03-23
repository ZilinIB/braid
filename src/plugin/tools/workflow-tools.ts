import type { BraidManifest } from "../../manifest/types.js";
import { WorkOrderStore, type WorkOrderStatus } from "../store/work-order-store.js";
import { ReportStore } from "../store/report-store.js";
import { checkTransition } from "../engine/state-machine.js";
import { checkOwnership, resolveArtifactPath, buildArtifactPathMap } from "../engine/ownership.js";
import { checkBatonTransfer, applyBatonTransfer } from "../engine/baton.js";
import { applyEscalation } from "../engine/escalation.js";

export type ToolContext = {
  callingRole: string;
  manifest: BraidManifest;
  woStore: WorkOrderStore;
  reportStore: ReportStore;
};

// ── wo_open ──────────────────────────────────────────────────

export async function woOpen(
  ctx: ToolContext,
  args: { title: string; type: string; mode?: string; request_content: string },
): Promise<string> {
  if (ctx.callingRole !== ctx.manifest.runtime.execution.dispatch_role) {
    return `Error: only ${ctx.manifest.runtime.execution.dispatch_role} can open work orders`;
  }

  const woTypes = ctx.manifest.protocol.work_orders.types;
  const woType = woTypes[args.type];
  if (!woType) {
    return `Error: unknown work order type "${args.type}". Valid: ${Object.keys(woTypes).join(", ")}`;
  }

  if (args.mode && woType.modes && !woType.modes.includes(args.mode)) {
    return `Error: unknown mode "${args.mode}" for type "${args.type}". Valid: ${woType.modes.join(", ")}`;
  }

  const woId = await ctx.woStore.nextId();

  let reviewPolicy = woType.review_policy;
  let severity = "normal";
  if (args.mode && woType.mode_overrides?.[args.mode]) {
    const overrides = woType.mode_overrides[args.mode]!;
    if (overrides.review_policy) reviewPolicy = overrides.review_policy;
    if (overrides.default_severity) severity = overrides.default_severity;
  }

  const status: WorkOrderStatus = {
    id: woId,
    title: args.title,
    type: args.type,
    ...(args.mode && { mode: args.mode }),
    state: "opened",
    priority: "normal",
    owner: ctx.callingRole,
    lane_owner: woType.lane_owner,
    review_policy: reviewPolicy,
    severity,
    needs_human_attention: false,
    opened_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_lane: args.type,
    current_role: ctx.callingRole,
    approved: false,
    blocked_by: [],
    baton_history: [],
    artifacts: buildArtifactPathMap(ctx.manifest),
  };

  await ctx.woStore.create(woId, status);
  await ctx.woStore.writeArtifact(woId, "request.md", args.request_content);

  return `Work order ${woId} opened: "${args.title}" (type: ${args.type}${args.mode ? `, mode: ${args.mode}` : ""})`;
}

// ── wo_status ────────────────────────────────────────────────

export async function woStatus(
  ctx: ToolContext,
  args: { wo_id: string },
): Promise<string> {
  try {
    const status = await ctx.woStore.readStatus(args.wo_id);
    return JSON.stringify(status, null, 2);
  } catch {
    return `Error: work order "${args.wo_id}" not found`;
  }
}

// ── wo_read ──────────────────────────────────────────────────

export async function woRead(
  ctx: ToolContext,
  args: { wo_id: string; artifact: string; file?: string },
): Promise<string> {
  const path = resolveArtifactPath(ctx.manifest, args.artifact, args.file);
  if (!path) {
    return `Error: cannot resolve path for artifact "${args.artifact}"`;
  }
  try {
    return await ctx.woStore.readArtifact(args.wo_id, path);
  } catch {
    return `Error: artifact "${path}" not found in ${args.wo_id}`;
  }
}

// ── wo_write ─────────────────────────────────────────────────

export async function woWrite(
  ctx: ToolContext,
  args: { wo_id: string; artifact: string; content: string; file?: string },
): Promise<string> {
  let status: WorkOrderStatus;
  try {
    status = await ctx.woStore.readStatus(args.wo_id);
  } catch {
    return `Error: work order "${args.wo_id}" not found`;
  }

  const ownership = checkOwnership(
    ctx.manifest,
    status.type,
    args.artifact,
    ctx.callingRole,
    args.file,
  );
  if (!ownership.allowed) {
    return `Error: ${ownership.reason}`;
  }

  const path = resolveArtifactPath(ctx.manifest, args.artifact, args.file);
  if (!path) {
    return `Error: cannot resolve path for artifact "${args.artifact}"`;
  }

  await ctx.woStore.writeArtifact(args.wo_id, path, args.content);
  return `Wrote ${path} in ${args.wo_id}`;
}

// ── wo_list ──────────────────────────────────────────────────

export async function woList(
  ctx: ToolContext,
  args: { state?: string; type?: string },
): Promise<string> {
  let items = await ctx.woStore.list();
  if (args.state) items = items.filter((i) => i.status.state === args.state);
  if (args.type) items = items.filter((i) => i.status.type === args.type);

  if (items.length === 0) return "No work orders found.";

  const lines = items.map(
    (i) => `${i.id}: "${i.status.title}" [${i.status.state}] (${i.status.type}) lane: ${i.status.lane_owner}`,
  );
  return lines.join("\n");
}

// ── wo_transition ────────────────────────────────────────────

export async function woTransition(
  ctx: ToolContext,
  args: { wo_id: string; to: string; blocker?: string; reason?: string },
): Promise<string> {
  let status: WorkOrderStatus;
  try {
    status = await ctx.woStore.readStatus(args.wo_id);
  } catch {
    return `Error: work order "${args.wo_id}" not found`;
  }

  // For blocked transitions, record the blocker
  if (args.to === "blocked" && args.blocker) {
    status.blocked_by.push(args.blocker);
  }

  // For unblock (blocked -> planned), clear blockers
  if (status.state === "blocked" && args.to === "planned") {
    status.blocked_by = [];
  }

  // Pre-check artifact existence on disk using manifest-derived paths
  const artifactPathMap = buildArtifactPathMap(ctx.manifest);
  const artifactExistsCache = new Map<string, boolean>();
  for (const [logicalName, filePath] of Object.entries(artifactPathMap)) {
    artifactExistsCache.set(logicalName, await ctx.woStore.artifactExists(args.wo_id, filePath));
  }

  const result = checkTransition(
    ctx.manifest,
    status,
    args.to,
    ctx.callingRole,
    (logicalName: string) => artifactExistsCache.get(logicalName) ?? false,
    { reason: args.reason, effectiveReviewPolicy: status.review_policy },
  );

  if (!result.allowed) {
    return `Error: ${result.reason}`;
  }

  status.state = args.to;
  if (args.to === "approved") status.approved = true;
  if (args.to === "done") status.current_lane = "closed";

  await ctx.woStore.writeStatus(args.wo_id, status);
  return `${args.wo_id} transitioned to "${args.to}"`;
}

// ── wo_baton ─────────────────────────────────────────────────

export async function woBaton(
  ctx: ToolContext,
  args: { wo_id: string; to: string; reason: string },
): Promise<string> {
  let status: WorkOrderStatus;
  try {
    status = await ctx.woStore.readStatus(args.wo_id);
  } catch {
    return `Error: work order "${args.wo_id}" not found`;
  }

  const result = checkBatonTransfer(
    ctx.manifest,
    status,
    ctx.callingRole,
    args.to,
    args.reason,
  );

  if (!result.allowed) {
    return `Error: ${result.reason}`;
  }

  applyBatonTransfer(status, ctx.callingRole, args.to, args.reason);
  await ctx.woStore.writeStatus(args.wo_id, status);

  return `Baton transferred from "${ctx.callingRole}" to "${args.to}" on ${args.wo_id}. ${ctx.manifest.runtime.execution.dispatch_role} will spawn the receiving role.`;
}

// ── wo_escalate ──────────────────────────────────────────────

export async function woEscalate(
  ctx: ToolContext,
  args: { wo_id: string; severity: string; reason?: string; needs_human_attention?: boolean },
): Promise<string> {
  let status: WorkOrderStatus;
  try {
    status = await ctx.woStore.readStatus(args.wo_id);
  } catch {
    return `Error: work order "${args.wo_id}" not found`;
  }

  try {
    const effect = applyEscalation(ctx.manifest, status, args.severity, args.needs_human_attention);
    await ctx.woStore.writeStatus(args.wo_id, status);

    const parts = [`${args.wo_id} escalated to severity "${args.severity}"`];
    if (effect.notifyRoles.length > 0) {
      parts.push(`Notifying: ${effect.notifyRoles.join(", ")}`);
    }
    if (effect.notifyHuman) {
      parts.push(`Human notification required via ${ctx.manifest.protocol.escalation.notify_human_via}`);
    }
    return parts.join(". ");
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ── report_write ─────────────────────────────────────────────

export async function reportWrite(
  ctx: ToolContext,
  args: { content: string; date?: string },
): Promise<string> {
  const date = args.date ?? new Date().toISOString().slice(0, 10);

  const isSummaryRole = ctx.callingRole === ctx.manifest.reporting.daily.summary_role;
  if (isSummaryRole) {
    await ctx.reportStore.writeSummary(date, args.content, ctx.manifest.reporting.daily.summary_file);
    // Also write as a role report so report_read(role: "chief_of_staff") works
    await ctx.reportStore.writeRoleReport(date, ctx.callingRole, args.content);
    return `Executive summary written for ${date}`;
  }

  await ctx.reportStore.writeRoleReport(date, ctx.callingRole, args.content);
  return `Daily report written for ${ctx.callingRole} on ${date}`;
}

// ── report_read ──────────────────────────────────────────────

export async function reportRead(
  ctx: ToolContext,
  args: { role?: string; date?: string },
): Promise<string> {
  const date = args.date ?? new Date().toISOString().slice(0, 10);

  if (args.role) {
    try {
      return await ctx.reportStore.readRoleReport(date, args.role);
    } catch {
      return `No report found for ${args.role} on ${date}`;
    }
  }

  const reports = await ctx.reportStore.readAllReports(date);
  if (Object.keys(reports).length === 0) {
    return `No reports found for ${date}`;
  }

  const parts = Object.entries(reports).map(
    ([role, content]) => `--- ${role} ---\n${content}`,
  );
  return parts.join("\n\n");
}

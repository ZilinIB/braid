import type { BraidManifest } from "../../manifest/types.js";
import type { WorkOrderStatus } from "../store/work-order-store.js";

export type EscalationEffect = {
  notifyRoles: string[];
  notifyHuman: boolean;
};

export function applyEscalation(
  manifest: BraidManifest,
  status: WorkOrderStatus,
  severity: string,
  needsHumanAttention?: boolean,
): EscalationEffect {
  const { escalation } = manifest.protocol;

  if (!escalation.severities.includes(severity)) {
    throw new Error(`Invalid severity "${severity}". Valid: ${escalation.severities.join(", ")}`);
  }

  status.severity = severity;
  if (needsHumanAttention !== undefined) {
    status.needs_human_attention = needsHumanAttention;
  }

  const notifyRoles: string[] = escalation.notify_roles[severity] ?? [];

  const severityIndex = escalation.severities.indexOf(severity);
  const thresholdIndex = escalation.severities.indexOf(escalation.human_notify_threshold);
  const notifyHuman =
    status.needs_human_attention || (severityIndex >= thresholdIndex && thresholdIndex >= 0);

  return { notifyRoles: [...notifyRoles], notifyHuman };
}

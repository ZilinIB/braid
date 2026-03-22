import type { BraidManifest } from "../../manifest/types.js";
import type { WorkOrderStatus } from "../store/work-order-store.js";

export type TransitionResult = {
  allowed: boolean;
  reason: string;
};

export type TransitionContext = {
  reason?: string;
};

export function checkTransition(
  manifest: BraidManifest,
  status: WorkOrderStatus,
  toState: string,
  requestingRole: string,
  artifactExists: (name: string) => boolean,
  ctx?: TransitionContext,
): TransitionResult {
  const { transitions, states } = manifest.protocol;

  if (!states.includes(toState)) {
    return { allowed: false, reason: `"${toState}" is not a valid state` };
  }

  const currentState = status.state;
  const woType = manifest.protocol.work_orders.types[status.type];
  if (!woType) {
    return { allowed: false, reason: `Unknown work order type "${status.type}"` };
  }

  // Find matching transitions
  const matching = transitions.filter(
    (t) => t.from.includes(currentState) && t.to === toState,
  );

  if (matching.length === 0) {
    return { allowed: false, reason: `No transition from "${currentState}" to "${toState}"` };
  }

  // Check if the requesting role is authorized for any matching transition
  const authorized = matching.filter((t) => t.requested_by.includes(requestingRole));
  if (authorized.length === 0) {
    const allowed = matching.flatMap((t) => t.requested_by);
    return {
      allowed: false,
      reason: `Role "${requestingRole}" cannot request transition to "${toState}". Allowed: ${[...new Set(allowed)].join(", ")}`,
    };
  }

  // Check required conditions
  for (const transition of authorized) {
    const unmet = checkRequires(transition.requires, status, woType, artifactExists, ctx);
    if (unmet.length === 0) {
      return { allowed: true, reason: "ok" };
    }
  }

  // All matching transitions had unmet conditions — report from the first one
  const unmet = checkRequires(authorized[0]!.requires, status, woType, artifactExists, ctx);
  return { allowed: false, reason: `Unmet conditions: ${unmet.join(", ")}` };
}

function checkRequires(
  requires: string[],
  status: WorkOrderStatus,
  woType: { review_policy: string },
  artifactExists: (name: string) => boolean,
  ctx?: TransitionContext,
): string[] {
  const unmet: string[] = [];
  for (const req of requires) {
    switch (req) {
      case "request":
        if (!artifactExists("request.md")) unmet.push("request.md must exist");
        break;
      case "brief":
        if (!artifactExists("brief.md")) unmet.push("brief.md must exist");
        break;
      case "plan":
        if (!artifactExists("plan.md")) unmet.push("plan.md must exist");
        break;
      case "delivery":
        if (!artifactExists("delivery/index.md")) unmet.push("delivery/index.md must exist");
        break;
      case "review":
        if (!artifactExists("review/index.md")) unmet.push("review/index.md must exist");
        break;
      case "executable_scope":
        if (!artifactExists("plan.md")) unmet.push("plan.md must exist for executable scope");
        break;
      case "review_policy_requires_review_or_expedited":
        if (woType.review_policy !== "required" && woType.review_policy !== "expedited") {
          unmet.push("review policy must be required or expedited");
        }
        break;
      case "review_policy_optional":
        if (woType.review_policy !== "optional") {
          unmet.push("review policy must be optional");
        }
        break;
      case "passing_review":
        if (!artifactExists("review/index.md")) unmet.push("review/index.md must exist");
        break;
      case "rework_required":
        if (!artifactExists("review/index.md")) unmet.push("review/index.md must exist");
        break;
      case "blocker_recorded":
        if (status.blocked_by.length === 0) unmet.push("blocker must be recorded");
        break;
      case "blocker_cleared":
        if (status.blocked_by.length > 0) unmet.push("blockers must be cleared");
        break;
      case "final_summary_ready":
        if (!ctx?.reason) unmet.push("final summary reason must be provided");
        break;
      case "cancellation_reason":
        if (!ctx?.reason) unmet.push("cancellation reason must be provided");
        break;
      default:
        unmet.push(`unknown condition: ${req}`);
    }
  }
  return unmet;
}

import type { BraidManifest } from "../../manifest/types.js";
import type { WorkOrderStatus } from "../store/work-order-store.js";

export type BatonResult = {
  allowed: boolean;
  reason: string;
};

export function checkBatonTransfer(
  manifest: BraidManifest,
  status: WorkOrderStatus,
  fromRole: string,
  toRole: string,
  reason: string,
): BatonResult {
  const transfer = manifest.graph.allowed_baton_transfers.find(
    (bt) =>
      bt.from === fromRole &&
      bt.to === toRole &&
      bt.work_order_types.includes(status.type),
  );

  if (!transfer) {
    return {
      allowed: false,
      reason: `No allowed baton transfer from "${fromRole}" to "${toRole}" for "${status.type}" work orders`,
    };
  }

  // The calling role must match the `from` of the allowed transfer.
  // We don't require the calling role to be the current lane_owner because
  // baton transfers happen precisely when a non-lane-owner (e.g., product_lead
  // who owns the brief for build) needs to hand off to the lane_owner (tech_lead).

  return { allowed: true, reason: "ok" };
}

export function applyBatonTransfer(
  status: WorkOrderStatus,
  fromRole: string,
  toRole: string,
  reason: string,
): void {
  status.baton_history.push({ from: fromRole, to: toRole, reason });
  status.lane_owner = toRole;
  status.current_role = toRole;
}

import { z } from "zod";
import type { BraidManifest } from "./types.js";

const reviewPolicySchema = z.enum(["required", "optional", "expedited"]);

const modeOverrideSchema = z.object({
  review_policy: reviewPolicySchema.optional(),
  default_severity: z.string().optional(),
});

const workOrderTypeSchema = z.object({
  brief_owner: z.string(),
  lane_owner: z.string(),
  plan_owner: z.string(),
  spec_owner: z.string(),
  delivery_owner: z.string(),
  review_owner: z.string(),
  review_policy: reviewPolicySchema,
  modes: z.array(z.string()).optional(),
  mode_overrides: z.record(z.string(), modeOverrideSchema).optional(),
});

const artifactSchema = z.object({
  kind: z.enum(["file", "family"]),
  file: z.string().optional(),
  directory: z.string().optional(),
  index: z.string().optional(),
  purpose: z.string(),
  owner_mode: z.enum(["fixed", "by_work_order_type", "lane_owner", "system"]),
  default_owner: z.string().optional(),
  owners_by_type: z.record(z.string(), z.string()).optional(),
  contributor_mode: z.string().optional(),
});

const transitionSchema = z.object({
  from: z.array(z.string()),
  to: z.string(),
  requested_by: z.array(z.string()),
  requires: z.array(z.string()),
});

const escalationSchema = z.object({
  severities: z.array(z.string()),
  triggers: z.array(z.string()),
  notify_roles: z.record(z.string(), z.array(z.string())),
  human_notify_threshold: z.string(),
  notify_human_via: z.string(),
});

const roleModelSchema = z.union([
  z.string(),
  z.object({
    primary: z.string(),
    fallbacks: z.array(z.string()).optional(),
  }),
]);

const ownsSchema = z.object({
  artifacts: z.array(z.string()),
  responsibilities: z.array(z.string()),
});

const canAuthorSchema = z.object({
  families: z.array(z.string()),
});

const roleSchema = z.object({
  display_name: z.string(),
  model: roleModelSchema.optional(),
  mission: z.string(),
  user_facing: z.boolean(),
  session_mode: z.enum(["persistent", "spawned"]),
  authority: z.string(),
  owns: ownsSchema,
  can_author: canAuthorSchema.optional(),
  can_spawn: z.array(z.string()),
  must_not: z.array(z.string()),
});

const batonTransferSchema = z.object({
  from: z.string(),
  to: z.string(),
  work_order_types: z.array(z.string()),
  when: z.string(),
});

const manifestSchema = z.object({
  version: z.number().int().min(1),
  org: z.object({
    id: z.string(),
    name: z.string(),
    kind: z.string(),
    description: z.string(),
  }),
  runtime: z.object({
    substrate: z.string(),
    execution: z.object({
      delegation: z.string(),
      cross_agent_send: z.string(),
      lane_changes_via: z.string(),
      dispatch_role: z.string(),
      persistent_roles: z.array(z.string()),
      spawned_roles: z.array(z.string()),
      max_spawn_depth: z.number().int().min(1),
      review_role: z.string(),
    }),
    memory: z.object({
      shared_source_of_truth: z.string(),
      role_memory: z.string(),
      reporting_store: z.string(),
      transcript_authority: z.string(),
    }),
  }),
  roles: z.record(z.string(), roleSchema),
  graph: z.object({
    default_mechanism: z.string(),
    lane_change_route: z.string(),
    allowed_spawn_edges: z.record(z.string(), z.array(z.string())),
    allowed_baton_transfers: z.array(batonTransferSchema),
    forbidden_edges: z.array(z.string()),
  }),
  protocol: z.object({
    work_orders: z.object({
      id_pattern: z.string(),
      directory: z.string(),
      types: z.record(z.string(), workOrderTypeSchema),
    }),
    artifacts: z.record(z.string(), artifactSchema),
    states: z.array(z.string()),
    transitions: z.array(transitionSchema),
    escalation: escalationSchema,
  }),
  reporting: z.object({
    daily: z.object({
      enabled: z.boolean(),
      transport: z.string(),
      isolated_session: z.boolean(),
      store: z.string(),
      summary_role: z.string(),
      summary_file: z.string(),
      order: z.array(z.string()),
      sections: z.array(z.string()),
    }),
  }),
  generation: z.object({
    targets: z.object({
      openclaw: z.object({
        enabled: z.boolean(),
        user_binding_role: z.string(),
        output_config: z.string(),
        output_workspaces_dir: z.string(),
      }),
    }),
  }),
});

export { manifestSchema };

export function parseManifest(raw: unknown): BraidManifest {
  const result = manifestSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return `  ${path}: ${issue.message}`;
    });
    throw new Error(`Manifest parse errors:\n${messages.join("\n")}`);
  }
  return result.data as BraidManifest;
}

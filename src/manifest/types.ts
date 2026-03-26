export type BraidManifest = {
  version: number;
  org: OrgConfig;
  runtime: RuntimeConfig;
  roles: Record<string, RoleConfig>;
  graph: GraphConfig;
  protocol: ProtocolConfig;
  reporting: ReportingConfig;
  generation: GenerationConfig;
  sandbox?: SandboxConfig;
  coding?: CodingConfig;
};

export type OrgConfig = {
  id: string;
  name: string;
  kind: string;
  description: string;
};

export type RuntimeConfig = {
  substrate: string;
  execution: ExecutionConfig;
  memory: MemoryConfig;
};

export type ExecutionConfig = {
  delegation: string;
  cross_agent_send: string;
  lane_changes_via: string;
  dispatch_role: string;
  persistent_roles: string[];
  spawned_roles: string[];
  max_spawn_depth: number;
  review_role: string;
};

export type MemoryConfig = {
  shared_source_of_truth: string;
  role_memory: string;
  reporting_store: string;
  transcript_authority: string;
};

export type RoleModel = string | { primary: string; fallbacks?: string[] };

export type RoleConfig = {
  display_name: string;
  model?: RoleModel;
  mission: string;
  user_facing: boolean;
  session_mode: "persistent" | "spawned";
  authority: string;
  /** Whether this role needs web browsing access (URLs, pages, research). */
  web_access?: boolean;
  owns: OwnsConfig;
  can_author?: CanAuthorConfig;
  can_spawn: string[];
  must_not: string[];
};

export type OwnsConfig = {
  artifacts: string[];
  responsibilities: string[];
};

export type CanAuthorConfig = {
  families: string[];
};

export type GraphConfig = {
  default_mechanism: string;
  lane_change_route: string;
  allowed_spawn_edges: Record<string, string[]>;
  allowed_baton_transfers: BatonTransfer[];
  forbidden_edges: string[];
};

export type BatonTransfer = {
  from: string;
  to: string;
  work_order_types: string[];
  when: string;
};

export type ProtocolConfig = {
  work_orders: WorkOrdersConfig;
  artifacts: Record<string, ArtifactConfig>;
  states: string[];
  transitions: TransitionConfig[];
  escalation: EscalationConfig;
};

export type WorkOrdersConfig = {
  id_pattern: string;
  directory: string;
  types: Record<string, WorkOrderTypeConfig>;
};

export type WorkOrderTypeConfig = {
  brief_owner: string;
  lane_owner: string;
  plan_owner: string;
  spec_owner: string;
  delivery_owner: string;
  review_owner: string;
  review_policy: "required" | "optional" | "expedited";
  modes?: string[];
  mode_overrides?: Record<string, ModeOverride>;
};

export type ModeOverride = {
  review_policy?: "required" | "optional" | "expedited";
  default_severity?: string;
};

export type ArtifactConfig = {
  kind: "file" | "family";
  file?: string;
  directory?: string;
  index?: string;
  purpose: string;
  owner_mode: "fixed" | "by_work_order_type" | "lane_owner" | "system";
  default_owner?: string;
  owners_by_type?: Record<string, string>;
  contributor_mode?: string;
};

export type TransitionConfig = {
  from: string[];
  to: string;
  requested_by: string[];
  requires: string[];
};

export type EscalationConfig = {
  severities: string[];
  triggers: string[];
  notify_roles: Record<string, string[]>;
  human_notify_threshold: string;
  notify_human_via: string;
};

export type ReportingConfig = {
  daily: DailyReportingConfig;
};

export type DailyReportingConfig = {
  enabled: boolean;
  transport: string;
  isolated_session: boolean;
  store: string;
  summary_role: string;
  summary_file: string;
  order: string[];
  sections: string[];
};

export type SandboxMountConfig = {
  host_path: string;
  container_path: string;
  mode: "ro" | "rw";
};

export type SandboxConfig = {
  project_dirs: SandboxMountConfig[];
};

export type GenerationConfig = {
  targets: {
    openclaw: OpenClawTargetConfig;
  };
};

export type OpenClawTargetConfig = {
  enabled: boolean;
  user_binding_role: string;
  output_config: string;
  output_workspaces_dir: string;
};

export type CodingConfig = {
  enabled: boolean;
  default_agent: string;
  default_workdir?: string;
  agents: Record<string, CodingAgentConfig>;
  allowed_roles: string[];
};

export type CodingAgentConfig = {
  permissions: "approve-all" | "approve-reads" | "deny-all";
  command?: string;
};

export type ValidationError = {
  rule: string;
  path: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationError[];
};

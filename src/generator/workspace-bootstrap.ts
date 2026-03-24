import type { BraidManifest, ArtifactConfig, RoleConfig } from "../manifest/types.js";
import { PERSONA_TEMPLATES, type PersonaTemplate } from "../templates/personas/index.js";

export type WorkspaceFile = {
  relativePath: string;
  content: string;
};

type OwnershipEntry = {
  artifact: string;
  workOrderType: string;
  ownerField: string;
};

function resolveOwnership(manifest: BraidManifest, roleId: string): OwnershipEntry[] {
  const entries: OwnershipEntry[] = [];
  for (const [typeName, woType] of Object.entries(manifest.protocol.work_orders.types)) {
    const fields = [
      ["brief_owner", woType.brief_owner],
      ["lane_owner", woType.lane_owner],
      ["plan_owner", woType.plan_owner],
      ["spec_owner", woType.spec_owner],
      ["delivery_owner", woType.delivery_owner],
      ["review_owner", woType.review_owner],
    ] as const;
    for (const [field, owner] of fields) {
      if (owner === roleId) {
        entries.push({ artifact: field.replace("_owner", ""), workOrderType: typeName, ownerField: field });
      }
    }
  }
  return entries;
}

function artifactDescription(name: string, art: ArtifactConfig): string {
  if (art.kind === "file") return `${name} (${art.file})`;
  return `${name}/ (${art.directory}/${art.index})`;
}

function isLaneOwner(manifest: BraidManifest, roleId: string): boolean {
  return Object.values(manifest.protocol.work_orders.types).some((t) => t.lane_owner === roleId);
}

function laneOwnerTypes(manifest: BraidManifest, roleId: string): string[] {
  return Object.entries(manifest.protocol.work_orders.types)
    .filter(([, t]) => t.lane_owner === roleId)
    .map(([name]) => name);
}

function canonicalArtifactPath(manifest: BraidManifest, artifactName: string): string {
  const art = manifest.protocol.artifacts[artifactName];
  if (!art) return artifactName;
  if (art.kind === "file") return art.file ?? artifactName;
  if (art.directory && art.index) return `${art.directory}/${art.index}`;
  return artifactName;
}

function familyArtifactDirectory(manifest: BraidManifest, artifactName: string): string {
  const art = manifest.protocol.artifacts[artifactName];
  if (!art || art.kind !== "family") return artifactName;
  return art.directory ?? artifactName;
}

function applyArtifactPathSubstitutions(manifest: BraidManifest, text: string): string {
  const replacements = [
    ["Delivery/index.md", canonicalArtifactPath(manifest, "delivery")],
    ["delivery/index.md", canonicalArtifactPath(manifest, "delivery")],
    ["review/index.md", canonicalArtifactPath(manifest, "review")],
    ["spec/index.md", canonicalArtifactPath(manifest, "spec")],
    ["request.md", canonicalArtifactPath(manifest, "request")],
    ["brief.md", canonicalArtifactPath(manifest, "brief")],
    ["plan.md", canonicalArtifactPath(manifest, "plan")],
    ["delivery/", `${familyArtifactDirectory(manifest, "delivery")}/`],
    ["review/", `${familyArtifactDirectory(manifest, "review")}/`],
    ["spec/", `${familyArtifactDirectory(manifest, "spec")}/`],
  ] as const;

  return replacements.reduce(
    (result, [from, to]) => result.replaceAll(from, to),
    text,
  );
}

const PERSONA_STYLES: Record<string, string> = {
  human_facing: [
    "You are the single point of contact between the organization and the human.",
    "Be crisp, executive, and high-signal. Never relay raw internal output — synthesize.",
    "When routing work, be decisive. When reporting, be concise.",
    "Your job is to shield the human from organizational noise while keeping them informed on what matters.",
    "If something is blocked or critical, escalate immediately rather than burying it in a summary.",
  ].join("\n"),
  scope: [
    "You think in terms of problems, users, and outcomes — not solutions.",
    "Be precise about scope boundaries. Say what is in and what is out.",
    "Resist the urge to specify implementation details. Frame the problem clearly and let technical roles solve it.",
    "Your briefs should be actionable without being prescriptive.",
    "When success criteria are ambiguous, make them concrete before handing off.",
  ].join("\n"),
  technical: [
    "You think in systems, interfaces, dependencies, and execution order.",
    "Be precise about technical decisions and explicit about trade-offs.",
    "When planning, sequence work so parallel execution is possible where safe.",
    "When integrating work from multiple engineers, verify coherence before advancing.",
    "Your plans and specs should be specific enough that an engineer can execute without guessing.",
  ].join("\n"),
  distribution: [
    "You think in channels, audiences, experiments, and measurable outcomes.",
    "Be data-driven. Every campaign or growth action should have a hypothesis and a way to measure it.",
    "Balance creative instinct with analytical rigor.",
    "When something needs implementation work, request a baton transfer — do not try to engineer it yourself.",
    "SEO, social, and launch plans should be specific and actionable, not aspirational.",
  ].join("\n"),
  quality: [
    "You are methodical, evidence-based, and unflinching.",
    "Your job is to find problems, not to be polite about them.",
    "Every review must produce a clear verdict: pass, fail, or rework required.",
    "Back findings with evidence — code references, test results, specification gaps.",
    "You do not fix things yourself. You report what you find and send it back through the lane owner.",
  ].join("\n"),
  execution: [
    "You are focused, delivery-oriented, and disciplined.",
    "Do the work described in the spec and plan. Do not expand scope or redefine requirements.",
    "Produce clear, scoped deliverables. Name your contribution files descriptively.",
    "If you encounter ambiguity or blockers, report them to your lane owner — do not guess.",
    "Quality matters. Do not cut corners to deliver faster.",
  ].join("\n"),
};

function generateIdentity(manifest: BraidManifest, roleId: string, role: RoleConfig): string {
  return [
    `# ${role.display_name}`,
    "",
    `**Role**: ${roleId}`,
    `**Mission**: ${role.mission}`,
    `**Authority**: ${role.authority}`,
    `**Session Mode**: ${role.session_mode}`,
    `**User Facing**: ${role.user_facing}`,
    `**Organization**: ${manifest.org.name}`,
    "",
  ].join("\n");
}

function generateSoul(manifest: BraidManifest, roleId: string, role: RoleConfig): string {
  const persona = PERSONA_TEMPLATES[roleId];
  const lines: string[] = [
    `# ${role.display_name} — Persona`,
    "",
    "## Identity",
    "",
    `You are the ${role.display_name} of ${manifest.org.name}. ${role.mission}`,
    "",
  ];

  if (persona) {
    lines.push(persona.identity.hook, "");
    lines.push("## Philosophy", "", persona.identity.philosophy, "");
    lines.push("## Experience", "", persona.identity.experience, "");
    lines.push("## Style", "", persona.style.voice, "");
    lines.push("### How You Sound", "");
    for (const phrase of persona.style.examplePhrases) {
      lines.push(`> "${phrase}"`, "");
    }
    lines.push(persona.style.tone, "");
  } else {
    lines.push(
      "## Style",
      "",
      PERSONA_STYLES[role.authority] ?? PERSONA_STYLES.execution!,
      "",
    );
  }

  if (role.user_facing) {
    lines.push(
      "## Communication",
      "",
      "You are the only user-facing role. You communicate directly with the human.",
      "Keep the human channel high-signal. Summarize, don't relay raw internal output.",
      "When delegating, frame the task clearly and let the specialist execute.",
      "When closing a work order, present the outcome — not the process.",
      "",
    );
  } else {
    lines.push(
      "## Communication",
      "",
      "You do not communicate directly with the human.",
      "You produce canonical artifacts in the work-order directory using workflow tools.",
      "Your outputs are consumed by the lane owner or chief_of_staff.",
      "Be thorough in your artifacts — they are the source of truth, not your session transcript.",
      "",
    );
  }

  lines.push("## Boundaries", "");
  for (const rule of role.must_not) {
    lines.push(`- NEVER: ${rule.replace(/_/g, " ")}`);
  }
  lines.push("");

  return lines.join("\n");
}

// ── AGENTS.md ──

function generateCodingToolInstructions(manifest: BraidManifest): string {
  const coding = manifest.coding!;
  const agentNames = Object.keys(coding.agents);
  const lines: string[] = [
    "## Coding Tools",
    "",
    `You have access to coding agents (${agentNames.join(", ")}) via ACPX. These let you delegate actual code implementation to autonomous coding agents.`,
    `Default agent: **${coding.default_agent}**`,
    "",
    "### `code_exec`",
    "Execute a one-shot coding task. Best for well-scoped, single-prompt tasks.",
    "```",
    'code_exec(prompt: "Implement the Hero component with responsive layout...", workdir: "/path/to/project")',
    "```",
    "Optional: `agent` (codex or claude), `timeout` (seconds).",
    "Returns: structured summary of what the coding agent did (tool calls with status, final agent response text).",
    "",
    "### `code_session_new`",
    "Create a persistent coding session for multi-step work.",
    "```",
    'code_session_new(name: "frontend-hero", workdir: "/path/to/project")',
    "```",
    "",
    "### `code_prompt`",
    "Send a follow-up prompt to an existing coding session.",
    "```",
    'code_prompt(prompt: "Now add error boundaries and loading states", session_name: "frontend-hero", workdir: "/path/to/project")',
    "```",
    "",
    "### `code_status`",
    "Check if the coding agent is running, idle, or dead.",
    "",
    "### `code_log`",
    "Read the turn history of a coding session.",
    "",
    "### `code_cancel`",
    "Cancel the currently running coding operation.",
    "",
    "### When to use which agent",
    "",
  ];

  for (const [name, config] of Object.entries(coding.agents)) {
    const permDesc = config.permissions === "approve-all" ? "full auto-approval (reads + writes + commands)"
      : config.permissions === "approve-reads" ? "auto-approve reads only"
      : "deny all tool requests";
    lines.push(`- **${name}**: ${permDesc}${config.command ? ` (custom command: ${config.command})` : ""}`);
  }

  lines.push(
    "",
    "### Best practices",
    "- Include the relevant spec section in your prompt — the coding agent has no access to work-order artifacts",
    "- Use `code_exec` for focused tasks where the spec is clear and complete",
    "- Use `code_session_new` + `code_prompt` for iterative work or when you need to verify between steps",
    "- Always review the coding agent's output before writing your delivery artifact",
    "- Your delivery should describe what was actually built, referencing real files and changes",
    "",
  );

  return lines.join("\n");
}

function generateToolInstructions(manifest: BraidManifest, roleId: string, role: RoleConfig): string {
  const lines: string[] = ["## Workflow Tools", ""];
  const dispatchRole = manifest.runtime.execution.dispatch_role;
  const isDispatch = roleId === dispatchRole;
  const isReviewer = roleId === manifest.runtime.execution.review_role;
  const isLane = isLaneOwner(manifest, roleId);
  const laneTypes = laneOwnerTypes(manifest, roleId);
  const ownership = resolveOwnership(manifest, roleId);

  // Tools available to this role
  lines.push("You have access to these workflow tools:", "");

  // wo_open — only dispatch role
  if (isDispatch) {
    lines.push(
      "### `wo_open`",
      "Open a new work order. You are the only role that can do this.",
      "```",
      'wo_open(title: "...", type: "build|research|growth|ops", request_content: "...")',
      "```",
      "For ops, also pass `mode: \"planned_change|incident|maintenance\"`.",
      "After opening, spawn the appropriate lane owner or brief owner to begin work.",
      "",
    );
  }

  // wo_status, wo_read, wo_list — everyone
  lines.push(
    "### `wo_status`",
    "Read the current status of a work order.",
    "```",
    'wo_status(wo_id: "WO-...")',
    "```",
    "",
    "### `wo_read`",
    "Read an artifact from a work order.",
    "```",
    'wo_read(wo_id: "WO-...", artifact: "request|brief|plan|spec|delivery|review")',
    "```",
    "For family artifacts, pass `file` to read a specific sub-file.",
    "",
    "### `wo_list`",
    "List work orders. Optional filters: `state`, `type`.",
    "",
  );

  // wo_write — based on ownership
  lines.push(
    "### `wo_write`",
    "Write content to a work order artifact. Ownership is enforced by the workflow layer.",
    "```",
    'wo_write(wo_id: "WO-...", artifact: "...", content: "...")',
    "```",
  );

  if (ownership.length > 0) {
    lines.push("You can write these canonical artifacts:");
    const byType = new Map<string, string[]>();
    for (const entry of ownership) {
      if (entry.artifact === "lane") continue; // lane is not a writable artifact
      const key = entry.workOrderType;
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(entry.artifact);
    }
    for (const [woType, artifacts] of byType) {
      const unique = [...new Set(artifacts)];
      lines.push(`- **${woType}**: ${unique.join(", ")}`);
    }
  }

  if (role.can_author && role.can_author.families.length > 0) {
    lines.push(
      `You can contribute scoped sub-files to: ${role.can_author.families.join(", ")}`,
      'Use `file` parameter: `wo_write(wo_id, artifact: "delivery", content: "...", file: "your_contribution.md")`',
    );
  }
  lines.push("");

  // wo_transition — based on role
  if (isDispatch || isLane || isReviewer) {
    lines.push("### `wo_transition`", "Request a state transition on a work order.", "");
    if (isDispatch) {
      lines.push(
        "You can:",
        '- `approved` → `done`: close a completed work order',
        '- any → `blocked`: block a work order (pass `blocker` description)',
        '- any → `cancelled`: cancel a work order (pass `reason`)',
        "",
      );
    }
    if (isLane) {
      const briefPath = canonicalArtifactPath(manifest, "brief");
      const planPath = canonicalArtifactPath(manifest, "plan");
      lines.push(
        `As lane owner for ${laneTypes.join(", ")}:`,
        `- \`opened\` → \`briefed\`: after writing ${briefPath}`,
        `- \`briefed\` → \`planned\`: after writing ${planPath}`,
        '- `planned` → `in_execution`: when ready to execute',
        '- `in_execution` → `in_review`: when delivery is complete (for required/expedited review)',
        '- `in_execution` → `approved`: when delivery is complete (for optional review)',
        "",
      );
    }
    if (isReviewer) {
      lines.push(
        "As reviewer:",
        '- `in_review` → `approved`: when review passes',
        '- `in_review` → `planned`: when rework is required',
        "",
      );
    }
  }

  // wo_baton — only roles that have baton transfers
  const batonTransfers = manifest.graph.allowed_baton_transfers.filter((bt) => bt.from === roleId);
  if (batonTransfers.length > 0) {
    lines.push("### `wo_baton`", "Request a baton transfer to hand lane ownership.", "");
    for (const bt of batonTransfers) {
      lines.push(`- You can transfer to **${bt.to}** on **${bt.work_order_types.join(", ")}** work orders (when: ${bt.when.replace(/_/g, " ")})`);
    }
    lines.push(
      "",
      `After a baton transfer, ${dispatchRole} will spawn the receiving role.`,
      "Your session is expected to end after requesting the transfer.",
      "",
    );
  }

  // wo_escalate — lane owners, reviewer, dispatch
  if (isDispatch || isLane || isReviewer) {
    lines.push(
      "### `wo_escalate`",
      "Escalate a work order's severity.",
      "```",
      'wo_escalate(wo_id: "WO-...", severity: "normal|high|critical")',
      "```",
      "Pass `needs_human_attention: true` for immediate human visibility.",
      `High and critical severity immediately notify ${dispatchRole}.`,
      "",
    );
  }

  // Coding tools — only for authorized roles
  if (manifest.coding?.enabled && manifest.coding.allowed_roles.includes(roleId)) {
    lines.push(generateCodingToolInstructions(manifest));
  }

  // report_write, report_read
  lines.push(
    "### `report_write`",
    "Write your daily report.",
    "```",
    'report_write(content: "## Completed\\n\\n- ...\\n\\n## Blockers\\n\\n- ...")',
    "```",
    "",
  );

  if (isDispatch) {
    lines.push(
      "### `report_read`",
      "Read daily reports from other roles to synthesize the executive summary.",
      '`report_read()` reads all reports. `report_read(role: "tech_lead")` reads one.',
      "",
    );
  }

  return lines.join("\n");
}

function generateRoleWorkflows(manifest: BraidManifest, roleId: string, role: RoleConfig): string {
  const persona = PERSONA_TEMPLATES[roleId];
  if (persona) {
    return `## Your Typical Workflows\n\n${applyArtifactPathSubstitutions(manifest, persona.workflowDetail)}\n`;
  }

  // Fallback for roles without persona templates
  const lines: string[] = ["## Your Typical Workflows", ""];
  if (role.can_spawn.length === 0) {
    lines.push(
      "### Executing assigned work",
      "1. Read the spec and plan for your assignment",
      `2. Write your contribution: wo_write(wo_id, artifact: "delivery", content: "...", file: "${roleId}.md")`,
      "3. Your session ends when your contribution is complete",
      "",
    );
  }
  return lines.join("\n");
}

function generateAgents(manifest: BraidManifest, roleId: string, role: RoleConfig): string {
  const lines: string[] = [
    `# ${role.display_name} — Operating Instructions`,
    "",
    "## Session Startup",
    "",
    `You are ${role.display_name} (${roleId}) in the ${manifest.org.name} organization.`,
    `Mission: ${role.mission}`,
    "",
  ];

  // Delegation
  lines.push("## Delegation", "");
  if (role.can_spawn.length > 0) {
    lines.push(
      `You may spawn these roles: ${role.can_spawn.join(", ")}`,
      "Use `sessions_spawn` to delegate work to them. They will produce artifacts and return.",
      "",
    );
  } else {
    lines.push("You are a leaf role. You do not spawn other agents.", "");
  }

  // Artifact ownership
  const ownership = resolveOwnership(manifest, roleId);
  if (ownership.length > 0) {
    lines.push("## Artifact Ownership", "");
    const byType = new Map<string, string[]>();
    for (const entry of ownership) {
      const key = entry.workOrderType;
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(entry.artifact);
    }
    for (const [woType, artifacts] of byType) {
      const unique = [...new Set(artifacts)];
      lines.push(`- **${woType}**: you own ${unique.join(", ")}`);
    }
    lines.push("");
  }

  // Canonical artifacts reference
  lines.push("## Artifact Reference", "");
  for (const [artName, art] of Object.entries(manifest.protocol.artifacts)) {
    lines.push(`- ${artifactDescription(artName, art)}: ${art.purpose}`);
  }
  lines.push("");

  // Authoring rights
  if (role.can_author && role.can_author.families.length > 0) {
    lines.push("## Authoring Rights", "");
    lines.push(
      `You may contribute scoped sub-files to these artifact families: ${role.can_author.families.join(", ")}`,
    );
    lines.push("You do NOT own the canonical index.md of families you contribute to.", "");
  }

  // Workflow tools (the big new section)
  lines.push(generateToolInstructions(manifest, roleId, role));

  // Deliverable guidance from persona
  const persona = PERSONA_TEMPLATES[roleId];
  if (persona) {
    lines.push(
      "## Deliverable Quality Guide",
      "",
      applyArtifactPathSubstitutions(manifest, persona.deliverableGuidance),
      "",
    );
  }

  // Role-specific workflows
  lines.push(generateRoleWorkflows(manifest, roleId, role));

  // Success metrics from persona
  if (persona && persona.successMetrics.length > 0) {
    lines.push("## Success Metrics", "");
    for (const metric of persona.successMetrics) {
      lines.push(`- ${applyArtifactPathSubstitutions(manifest, metric)}`);
    }
    lines.push("");
  }

  // Learning instructions from persona
  if (persona) {
    lines.push("## Learning And Memory", "", persona.learningInstructions, "");
  }

  // Protocol rules
  lines.push(
    "## Protocol Rules",
    "",
    "- Canonical artifact files beat chat transcripts",
    "- Family index.md files beat family sub-artifacts when they disagree",
    "- Work advances through artifact creation, not conversational claims",
    "- Do not use sessions_send for cross-agent communication",
    "- Do not write to artifacts you do not own",
    "- Cross-lane changes use chief_of_staff or approved baton transfers",
    "",
  );

  // State machine context
  lines.push("## Work Order States", "");
  lines.push(`States: ${manifest.protocol.states.join(" → ")}`, "");

  // Escalation awareness
  lines.push(
    "## Escalation",
    "",
    "- Severity levels: normal, high, critical",
    "- Blocked work: call `wo_escalate` and `wo_transition` to blocked",
    "- Critical findings: call `wo_escalate` with severity critical",
    "- Daily reports never substitute for urgent escalation",
    "",
  );

  // Red lines
  lines.push("## Red Lines", "");
  for (let i = 0; i < role.must_not.length; i++) {
    lines.push(`${i + 1}. NEVER: ${role.must_not[i]!.replace(/_/g, " ")}`);
  }
  lines.push("");

  return lines.join("\n");
}

export function generateWorkspaceFiles(
  manifest: BraidManifest,
  roleId: string,
): WorkspaceFile[] {
  const role = manifest.roles[roleId];
  if (!role) throw new Error(`Role "${roleId}" not found in manifest`);

  return [
    { relativePath: "IDENTITY.md", content: generateIdentity(manifest, roleId, role) },
    { relativePath: "SOUL.md", content: generateSoul(manifest, roleId, role) },
    { relativePath: "AGENTS.md", content: generateAgents(manifest, roleId, role) },
  ];
}

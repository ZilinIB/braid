import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import { parseManifest } from "../../manifest/schema.js";
import { generateOpenClawConfig } from "../openclaw-config.js";
import type { ChannelBindingInput } from "../openclaw-config.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "../../manifest/__tests__/fixtures/valid-manifest.yaml");

async function loadManifest() {
  const raw = await readFile(FIXTURE_PATH, "utf-8");
  return parseManifest(parseYaml(raw));
}

const defaultBinding: ChannelBindingInput = { channel: "telegram" };

describe("generateOpenClawConfig", () => {
  it("generates 10 agents", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    expect(config.agents.list).toHaveLength(10);
  });

  it("sets maxSpawnDepth to 2", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    expect(config.agents.defaults.subagents.maxSpawnDepth).toBe(2);
  });

  it("marks chief_of_staff as default agent", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    const cos = config.agents.list.find((a) => a.id === "chief_of_staff");
    expect(cos?.default).toBe(true);
  });

  it("sets model for all agents", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    for (const agent of config.agents.list) {
      expect(agent.model).toBe("openai/gpt-5.4");
    }
  });

  it("sets correct spawn allowlists", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    const techLead = config.agents.list.find((a) => a.id === "tech_lead");
    expect(techLead?.subagents?.allowAgents).toEqual([
      "research_analyst", "design_lead", "frontend_engineer",
      "backend_engineer", "platform_engineer", "qa_guard",
    ]);
  });

  it("leaf roles have no subagents.allowAgents", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    const fe = config.agents.list.find((a) => a.id === "frontend_engineer");
    expect(fe?.subagents).toBeUndefined();
  });

  it("leaf roles deny sessions_send", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    const fe = config.agents.list.find((a) => a.id === "frontend_engineer");
    expect(fe?.tools?.deny).toContain("sessions_send");
  });

  it("orchestrator roles do not deny sessions_send", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    const techLead = config.agents.list.find((a) => a.id === "tech_lead");
    expect(techLead?.tools?.deny).toBeUndefined();
    const cos = config.agents.list.find((a) => a.id === "chief_of_staff");
    expect(cos?.tools?.deny).toBeUndefined();
  });

  it("creates binding for chief_of_staff", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    expect(config.bindings).toHaveLength(1);
    expect(config.bindings[0]!.agentId).toBe("chief_of_staff");
    expect(config.bindings[0]!.match.channel).toBe("telegram");
  });

  it("includes peer in binding when provided", async () => {
    const manifest = await loadManifest();
    const binding: ChannelBindingInput = {
      channel: "discord",
      peer: { kind: "group", id: "123" },
    };
    const config = generateOpenClawConfig(manifest, binding);
    expect(config.bindings[0]!.match.peer).toEqual({ kind: "group", id: "123" });
  });

  it("enables braid-workflow plugin", async () => {
    const manifest = await loadManifest();
    const config = generateOpenClawConfig(manifest, defaultBinding);
    expect(config.plugins.entries["braid-workflow"]!.enabled).toBe(true);
  });

  it("is idempotent", async () => {
    const manifest = await loadManifest();
    const config1 = generateOpenClawConfig(manifest, defaultBinding);
    const config2 = generateOpenClawConfig(manifest, defaultBinding);
    expect(JSON.stringify(config1)).toBe(JSON.stringify(config2));
  });
});

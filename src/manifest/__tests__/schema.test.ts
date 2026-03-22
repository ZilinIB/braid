import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { resolve } from "node:path";
import { parseManifest } from "../schema.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "fixtures/valid-manifest.yaml");

async function loadFixture() {
  const raw = await readFile(FIXTURE_PATH, "utf-8");
  return parseYaml(raw);
}

describe("parseManifest", () => {
  it("parses the default manifest successfully", async () => {
    const raw = await loadFixture();
    const manifest = parseManifest(raw);
    expect(manifest.version).toBe(1);
    expect(manifest.org.id).toBe("braid-default");
    expect(Object.keys(manifest.roles)).toHaveLength(10);
  });

  it("rejects missing version", async () => {
    const raw = await loadFixture();
    delete raw.version;
    expect(() => parseManifest(raw)).toThrow("Manifest parse errors");
  });

  it("rejects invalid session_mode", async () => {
    const raw = await loadFixture();
    raw.roles.chief_of_staff.session_mode = "invalid";
    expect(() => parseManifest(raw)).toThrow("Manifest parse errors");
  });

  it("rejects invalid review_policy", async () => {
    const raw = await loadFixture();
    raw.protocol.work_orders.types.build.review_policy = "bogus";
    expect(() => parseManifest(raw)).toThrow("Manifest parse errors");
  });

  it("rejects invalid artifact kind", async () => {
    const raw = await loadFixture();
    raw.protocol.artifacts.request.kind = "invalid";
    expect(() => parseManifest(raw)).toThrow("Manifest parse errors");
  });

  it("accepts string model", async () => {
    const raw = await loadFixture();
    raw.roles.chief_of_staff.model = "openai/gpt-5.4";
    const manifest = parseManifest(raw);
    expect(manifest.roles.chief_of_staff!.model).toBe("openai/gpt-5.4");
  });

  it("accepts object model", async () => {
    const raw = await loadFixture();
    raw.roles.chief_of_staff.model = { primary: "openai/gpt-5.4", fallbacks: ["anthropic/claude-opus-4-6"] };
    const manifest = parseManifest(raw);
    const model = manifest.roles.chief_of_staff!.model;
    expect(typeof model).toBe("object");
    if (typeof model === "object") {
      expect(model.primary).toBe("openai/gpt-5.4");
      expect(model.fallbacks).toEqual(["anthropic/claude-opus-4-6"]);
    }
  });

  it("accepts missing model", async () => {
    const raw = await loadFixture();
    delete raw.roles.chief_of_staff.model;
    const manifest = parseManifest(raw);
    expect(manifest.roles.chief_of_staff!.model).toBeUndefined();
  });
});

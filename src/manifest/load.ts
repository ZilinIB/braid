import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { parseManifest } from "./schema.js";
import { validateManifest } from "./validate.js";
import type { BraidManifest, ValidationResult } from "./types.js";

export type LoadManifestResult = {
  manifest: BraidManifest;
  validation: ValidationResult;
};

export async function loadManifest(manifestPath: string): Promise<LoadManifestResult> {
  const raw = await readFile(manifestPath, "utf-8");
  const parsed = parseYaml(raw);
  const manifest = parseManifest(parsed);
  const validation = validateManifest(manifest);
  return { manifest, validation };
}

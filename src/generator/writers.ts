import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BraidManifest } from "../manifest/types.js";
import type { OpenClawConfigOutput } from "./openclaw-config.js";
import { generateWorkspaceFiles } from "./workspace-bootstrap.js";

export async function writeOpenClawConfig(
  config: OpenClawConfigOutput,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function writeWorkspaces(
  manifest: BraidManifest,
  outputDir: string,
): Promise<string[]> {
  const written: string[] = [];
  for (const roleId of Object.keys(manifest.roles)) {
    const files = generateWorkspaceFiles(manifest, roleId);
    const roleDir = join(outputDir, roleId);
    await mkdir(roleDir, { recursive: true });
    for (const file of files) {
      const filePath = join(roleDir, file.relativePath);
      await writeFile(filePath, file.content, "utf-8");
      written.push(filePath);
    }
  }
  return written;
}

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
  const roleEntries = Object.keys(manifest.roles).map((roleId) => ({
    roleId,
    files: generateWorkspaceFiles(manifest, roleId),
    roleDir: join(outputDir, roleId),
  }));

  const results = await Promise.all(
    roleEntries.map(async ({ files, roleDir }) => {
      await mkdir(roleDir, { recursive: true });
      const paths = files.map((f) => join(roleDir, f.relativePath));
      await Promise.all(files.map((f) => writeFile(join(roleDir, f.relativePath), f.content, "utf-8")));
      return paths;
    }),
  );

  return results.flat();
}

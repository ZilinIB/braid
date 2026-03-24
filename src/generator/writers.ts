import { mkdir, writeFile, readdir, copyFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
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
      // Copy global OpenClaw skills into workspace so they're accessible inside the sandbox
      await copyGlobalSkills(roleDir);
      return paths;
    }),
  );

  return results.flat();
}

async function copyGlobalSkills(roleDir: string): Promise<void> {
  const globalSkillsDir = join(homedir(), ".openclaw", "skills");
  let skillNames: string[];
  try {
    skillNames = await readdir(globalSkillsDir);
  } catch {
    return; // No global skills directory
  }

  for (const name of skillNames) {
    const srcDir = join(globalSkillsDir, name);
    const srcStat = await stat(srcDir).catch(() => null);
    if (!srcStat?.isDirectory()) continue;

    await copyDirRecursive(srcDir, join(roleDir, "skills", name));
  }
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

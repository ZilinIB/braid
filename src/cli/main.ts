#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { loadManifest } from "../manifest/index.js";
import { generateOpenClawConfig } from "../generator/openclaw-config.js";
import { writeOpenClawConfig, writeWorkspaces } from "../generator/writers.js";
import { generateCronJobs, generateCronScript } from "../generator/cron-jobs.js";
import type { BraidManifest } from "../manifest/types.js";
import type { ChannelBindingInput } from "../generator/openclaw-config.js";

// ── Shared helpers ──

type ChannelOpts = {
  channel: string;
  accountId?: string;
  peerId?: string;
  peerKind?: string;
};

async function loadValidatedManifest(manifestPath: string): Promise<BraidManifest> {
  const { manifest, validation } = await loadManifest(resolve(manifestPath));
  if (!validation.ok) {
    console.error("Manifest validation failed:\n");
    for (const err of validation.errors) {
      console.error(`  [${err.rule}] ${err.path}: ${err.message}`);
    }
    process.exit(1);
  }
  return manifest;
}

function buildChannelBinding(opts: ChannelOpts): ChannelBindingInput {
  return {
    channel: opts.channel,
    ...(opts.accountId && { accountId: opts.accountId }),
    ...(opts.peerId && opts.peerKind && { peer: { kind: opts.peerKind, id: opts.peerId } }),
  };
}

async function generateAll(manifest: BraidManifest, channelBinding: ChannelBindingInput, opts: {
  manifestPath: string;
  orgBaseDir?: string;
}): Promise<void> {
  const config = generateOpenClawConfig(manifest, channelBinding, {
    manifestPath: opts.manifestPath,
    orgBaseDir: opts.orgBaseDir,
  });
  const configPath = resolve(manifest.generation.targets.openclaw.output_config);
  await writeOpenClawConfig(config, configPath);
  console.log(`Config: ${configPath}`);

  const workspacesDir = resolve(manifest.generation.targets.openclaw.output_workspaces_dir);
  const written = await writeWorkspaces(manifest, workspacesDir);
  console.log(`Workspaces: ${written.length} files in ${workspacesDir}`);
}

async function createOrgDirs(manifest: BraidManifest, orgBase: string): Promise<void> {
  await Promise.all([
    mkdir(resolve(orgBase, manifest.protocol.work_orders.directory), { recursive: true }),
    mkdir(resolve(orgBase, manifest.reporting.daily.store), { recursive: true }),
  ]);
  console.log(`Org dirs: ${orgBase}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapAction<T extends (...args: any[]) => Promise<void>>(fn: T): T {
  return (async (...args: unknown[]) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }) as T;
}

function addChannelOptions(cmd: Command): Command {
  return cmd
    .requiredOption("-c, --channel <channel>", "Channel to bind chief_of_staff to")
    .option("--account-id <id>", "Channel account ID")
    .option("--peer-id <id>", "Peer ID for binding")
    .option("--peer-kind <kind>", "Peer kind for binding");
}

// ── Commands ──

const program = new Command();
program.name("braid").description("Braid — OpenClaw organization runtime generator").version("0.1.0");

program
  .command("validate")
  .description("Validate a Braid manifest")
  .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
  .action(wrapAction(async (opts: { manifest: string }) => {
    await loadValidatedManifest(opts.manifest);
    console.log("Manifest valid.");
  }));

addChannelOptions(
  program
    .command("generate")
    .description("Generate OpenClaw config and workspace files from a Braid manifest")
    .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml"),
).action(wrapAction(async (opts: { manifest: string } & ChannelOpts) => {
  const manifest = await loadValidatedManifest(opts.manifest);
  await generateAll(manifest, buildChannelBinding(opts), { manifestPath: opts.manifest });
  console.log(`\nGenerated ${Object.keys(manifest.roles).length} agents for ${manifest.org.name}.`);
}));

addChannelOptions(
  program
    .command("setup")
    .description("Full setup: validate, generate config + workspaces, and create org directories")
    .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
    .option("--org-dir <dir>", "Base directory for org data", "."),
).action(wrapAction(async (opts: { manifest: string; orgDir: string } & ChannelOpts) => {
  const manifest = await loadValidatedManifest(opts.manifest);
  const orgBase = resolve(opts.orgDir);
  await generateAll(manifest, buildChannelBinding(opts), { manifestPath: opts.manifest, orgBaseDir: orgBase });
  await createOrgDirs(manifest, orgBase);
  console.log(`\nSetup complete: ${Object.keys(manifest.roles).length} agents for ${manifest.org.name}.`);
  console.log(`\nPlugin path for OpenClaw: src/plugin/openclaw`);
}));

addChannelOptions(
  program
    .command("init")
    .description("Initialize a Braid organization: validate, generate, create org dirs, and generate cron script")
    .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
    .option("--org-dir <dir>", "Base directory for org data", "."),
).action(wrapAction(async (opts: { manifest: string; orgDir: string } & ChannelOpts) => {
  const manifest = await loadValidatedManifest(opts.manifest);
  const orgBase = resolve(opts.orgDir);
  await generateAll(manifest, buildChannelBinding(opts), { manifestPath: opts.manifest, orgBaseDir: orgBase });
  await createOrgDirs(manifest, orgBase);

  const jobs = generateCronJobs(manifest);
  if (jobs.length > 0) {
    const cronPath = resolve("generated/braid/setup-cron.sh");
    await mkdir(resolve(cronPath, ".."), { recursive: true });
    await writeFile(cronPath, generateCronScript(jobs), { mode: 0o755 });
    console.log(`Cron script: ${cronPath} (${jobs.length} jobs)`);
  }

  console.log(`\n--- Braid initialized ---`);
  console.log(`Organization: ${manifest.org.name}`);
  console.log(`Agents: ${Object.keys(manifest.roles).length}`);
  console.log(`Channel: ${opts.channel}`);
  console.log(`\nNext steps:`);
  console.log(`1. Add plugin to OpenClaw: plugins.load.paths = ["${resolve("src/plugin/openclaw")}"]`);
  console.log(`2. Run cron setup: ./generated/braid/setup-cron.sh`);
  console.log(`3. Start OpenClaw and message chief_of_staff`);
}));

program
  .command("setup-cron")
  .description("Generate daily reporting cron job setup script for OpenClaw")
  .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
  .option("--base-hour <hour>", "Hour to start daily reports (24h format)", "17")
  .option("--interval <minutes>", "Minutes between each role's report job", "2")
  .option("-o, --output <path>", "Output script path", "generated/braid/setup-cron.sh")
  .action(wrapAction(async (opts: { manifest: string; baseHour: string; interval: string; output: string }) => {
    const manifest = await loadValidatedManifest(opts.manifest);
    const jobs = generateCronJobs(manifest, {
      baseHour: parseInt(opts.baseHour, 10),
      intervalMinutes: parseInt(opts.interval, 10),
    });
    if (jobs.length === 0) { console.log("Daily reporting is disabled."); return; }

    const outputPath = resolve(opts.output);
    await mkdir(resolve(outputPath, ".."), { recursive: true });
    await writeFile(outputPath, generateCronScript(jobs), { mode: 0o755 });
    console.log(`Cron setup script: ${outputPath}`);
    for (const job of jobs) console.log(`  ${job.cron}  ${job.agentId}`);
  }));

program.parse();

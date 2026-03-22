#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { loadManifest } from "../manifest/index.js";
import { generateOpenClawConfig } from "../generator/openclaw-config.js";
import { writeOpenClawConfig, writeWorkspaces } from "../generator/writers.js";
import { generateCronJobs, generateCronScript } from "../generator/cron-jobs.js";
import type { ChannelBindingInput } from "../generator/openclaw-config.js";

const program = new Command();

program
  .name("braid")
  .description("Braid — OpenClaw organization runtime generator")
  .version("0.1.0");

program
  .command("validate")
  .description("Validate a Braid manifest")
  .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
  .action(async (opts: { manifest: string }) => {
    const manifestPath = resolve(opts.manifest);
    try {
      const { validation } = await loadManifest(manifestPath);
      if (!validation.ok) {
        console.error("Manifest validation failed:\n");
        for (const err of validation.errors) {
          console.error(`  [${err.rule}] ${err.path}: ${err.message}`);
        }
        process.exit(1);
      }
      console.log("Manifest valid.");
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command("generate")
  .description("Generate OpenClaw config and workspace files from a Braid manifest")
  .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
  .requiredOption("-c, --channel <channel>", "Channel to bind chief_of_staff to (e.g. telegram, discord, whatsapp)")
  .option("--account-id <id>", "Channel account ID")
  .option("--peer-id <id>", "Peer ID for binding")
  .option("--peer-kind <kind>", "Peer kind for binding (e.g. group, direct)")
  .action(async (opts: {
    manifest: string;
    channel: string;
    accountId?: string;
    peerId?: string;
    peerKind?: string;
  }) => {
    const manifestPath = resolve(opts.manifest);
    try {
      const { manifest, validation } = await loadManifest(manifestPath);
      if (!validation.ok) {
        console.error("Manifest validation failed:\n");
        for (const err of validation.errors) {
          console.error(`  [${err.rule}] ${err.path}: ${err.message}`);
        }
        process.exit(1);
      }

      const channelBinding: ChannelBindingInput = {
        channel: opts.channel,
        ...(opts.accountId && { accountId: opts.accountId }),
        ...(opts.peerId && opts.peerKind && { peer: { kind: opts.peerKind, id: opts.peerId } }),
      };

      const config = generateOpenClawConfig(manifest, channelBinding, {
        manifestPath: opts.manifest,
      });

      const configPath = resolve(manifest.generation.targets.openclaw.output_config);
      await writeOpenClawConfig(config, configPath);
      console.log(`Config written: ${configPath}`);

      const workspacesDir = resolve(manifest.generation.targets.openclaw.output_workspaces_dir);
      const written = await writeWorkspaces(manifest, workspacesDir);
      console.log(`Workspaces written: ${written.length} files in ${workspacesDir}`);

      const roleCount = Object.keys(manifest.roles).length;
      console.log(`\nGenerated ${roleCount} agents for ${manifest.org.name}.`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command("setup")
  .description("Full setup: validate, generate config + workspaces, and create org directories")
  .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
  .requiredOption("-c, --channel <channel>", "Channel to bind chief_of_staff to")
  .option("--account-id <id>", "Channel account ID")
  .option("--peer-id <id>", "Peer ID for binding")
  .option("--peer-kind <kind>", "Peer kind for binding")
  .option("--org-dir <dir>", "Base directory for org data (work orders, reports)", ".")
  .action(async (opts: {
    manifest: string;
    channel: string;
    accountId?: string;
    peerId?: string;
    peerKind?: string;
    orgDir: string;
  }) => {
    const manifestPath = resolve(opts.manifest);
    try {
      // 1. Validate
      const { manifest, validation } = await loadManifest(manifestPath);
      if (!validation.ok) {
        console.error("Manifest validation failed:\n");
        for (const err of validation.errors) {
          console.error(`  [${err.rule}] ${err.path}: ${err.message}`);
        }
        process.exit(1);
      }
      console.log("Manifest valid.");

      // 2. Generate config
      const channelBinding: ChannelBindingInput = {
        channel: opts.channel,
        ...(opts.accountId && { accountId: opts.accountId }),
        ...(opts.peerId && opts.peerKind && { peer: { kind: opts.peerKind, id: opts.peerId } }),
      };

      const orgBase = resolve(opts.orgDir);
      const config = generateOpenClawConfig(manifest, channelBinding, {
        manifestPath: opts.manifest,
        orgBaseDir: orgBase,
      });
      const configPath = resolve(manifest.generation.targets.openclaw.output_config);
      await writeOpenClawConfig(config, configPath);
      console.log(`Config written: ${configPath}`);

      // 3. Generate workspaces
      const workspacesDir = resolve(manifest.generation.targets.openclaw.output_workspaces_dir);
      const written = await writeWorkspaces(manifest, workspacesDir);
      console.log(`Workspaces written: ${written.length} files in ${workspacesDir}`);

      // 4. Create org directories
      const woDir = resolve(orgBase, manifest.protocol.work_orders.directory);
      const reportDir = resolve(orgBase, manifest.reporting.daily.store);
      await mkdir(woDir, { recursive: true });
      await mkdir(reportDir, { recursive: true });
      console.log(`Org directories created:`);
      console.log(`  Work orders: ${woDir}`);
      console.log(`  Reports: ${reportDir}`);

      // 5. Summary
      const roleCount = Object.keys(manifest.roles).length;
      console.log(`\nSetup complete: ${roleCount} agents for ${manifest.org.name}.`);
      console.log(`\nPlugin path for OpenClaw: src/plugin/openclaw`);
      console.log(`Add to openclaw.json plugins.load.paths or copy to your plugins directory.`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Initialize a Braid organization: validate, generate, create org dirs, and generate cron script")
  .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
  .requiredOption("-c, --channel <channel>", "Channel to bind chief_of_staff to (e.g. telegram, discord, whatsapp)")
  .option("--account-id <id>", "Channel account ID")
  .option("--peer-id <id>", "Peer ID for binding")
  .option("--peer-kind <kind>", "Peer kind for binding")
  .option("--org-dir <dir>", "Base directory for org data", ".")
  .action(async (opts: {
    manifest: string;
    channel: string;
    accountId?: string;
    peerId?: string;
    peerKind?: string;
    orgDir: string;
  }) => {
    const manifestPath = resolve(opts.manifest);
    try {
      const { manifest, validation } = await loadManifest(manifestPath);
      if (!validation.ok) {
        console.error("Manifest validation failed:\n");
        for (const err of validation.errors) {
          console.error(`  [${err.rule}] ${err.path}: ${err.message}`);
        }
        process.exit(1);
      }
      console.log("Manifest valid.\n");

      // Generate config
      const channelBinding: ChannelBindingInput = {
        channel: opts.channel,
        ...(opts.accountId && { accountId: opts.accountId }),
        ...(opts.peerId && opts.peerKind && { peer: { kind: opts.peerKind, id: opts.peerId } }),
      };
      const orgBase = resolve(opts.orgDir);
      const config = generateOpenClawConfig(manifest, channelBinding, {
        manifestPath: opts.manifest,
        orgBaseDir: orgBase,
      });
      const configPath = resolve(manifest.generation.targets.openclaw.output_config);
      await writeOpenClawConfig(config, configPath);
      console.log(`Config: ${configPath}`);

      // Generate workspaces
      const workspacesDir = resolve(manifest.generation.targets.openclaw.output_workspaces_dir);
      const written = await writeWorkspaces(manifest, workspacesDir);
      console.log(`Workspaces: ${written.length} files`);

      // Create org directories
      await mkdir(resolve(orgBase, manifest.protocol.work_orders.directory), { recursive: true });
      await mkdir(resolve(orgBase, manifest.reporting.daily.store), { recursive: true });
      console.log(`Org dirs: ${orgBase}`);

      // Generate cron script
      const jobs = generateCronJobs(manifest);
      if (jobs.length > 0) {
        const cronPath = resolve("generated/braid/setup-cron.sh");
        await mkdir(resolve(cronPath, ".."), { recursive: true });
        await writeFile(cronPath, generateCronScript(jobs), { mode: 0o755 });
        console.log(`Cron script: ${cronPath} (${jobs.length} jobs)`);
      }

      // Summary
      const roleCount = Object.keys(manifest.roles).length;
      console.log(`\n--- Braid initialized ---`);
      console.log(`Organization: ${manifest.org.name}`);
      console.log(`Agents: ${roleCount}`);
      console.log(`Channel: ${opts.channel}`);
      console.log(`\nNext steps:`);
      console.log(`1. Add plugin to OpenClaw: plugins.load.paths = ["${resolve("src/plugin/openclaw")}"]`);
      console.log(`2. Run cron setup: ./generated/braid/setup-cron.sh`);
      console.log(`3. Start OpenClaw and message chief_of_staff`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command("setup-cron")
  .description("Generate daily reporting cron job setup script for OpenClaw")
  .option("-m, --manifest <path>", "Path to manifest YAML", "manifests/software-product-company.yaml")
  .option("--base-hour <hour>", "Hour to start daily reports (24h format)", "17")
  .option("--interval <minutes>", "Minutes between each role's report job", "2")
  .option("-o, --output <path>", "Output script path", "generated/braid/setup-cron.sh")
  .action(async (opts: {
    manifest: string;
    baseHour: string;
    interval: string;
    output: string;
  }) => {
    const manifestPath = resolve(opts.manifest);
    try {
      const { manifest, validation } = await loadManifest(manifestPath);
      if (!validation.ok) {
        console.error("Manifest validation failed:\n");
        for (const err of validation.errors) {
          console.error(`  [${err.rule}] ${err.path}: ${err.message}`);
        }
        process.exit(1);
      }

      const jobs = generateCronJobs(manifest, {
        baseHour: parseInt(opts.baseHour, 10),
        intervalMinutes: parseInt(opts.interval, 10),
      });

      if (jobs.length === 0) {
        console.log("Daily reporting is disabled in the manifest.");
        return;
      }

      const script = generateCronScript(jobs);
      const outputPath = resolve(opts.output);
      await mkdir(resolve(outputPath, ".."), { recursive: true });
      await writeFile(outputPath, script, { mode: 0o755 });
      console.log(`Cron setup script written: ${outputPath}`);
      console.log(`\n${jobs.length} daily reporting jobs:`);
      for (const job of jobs) {
        console.log(`  ${job.cron}  ${job.agentId}`);
      }
      console.log(`\nRun the script to create cron jobs in OpenClaw:`);
      console.log(`  ./${opts.output}`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();

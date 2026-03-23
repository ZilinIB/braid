import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type WorkOrderStatus = {
  id: string;
  title: string;
  type: string;
  mode?: string;
  state: string;
  priority: string;
  owner: string;
  lane_owner: string;
  review_policy: string;
  severity: string;
  needs_human_attention: boolean;
  opened_at: string;
  updated_at: string;
  current_lane: string;
  current_role: string;
  approved: boolean;
  blocked_by: string[];
  baton_history: Array<{ from: string; to: string; reason: string }>;
  artifacts: Record<string, string>;
};

export class WorkOrderStore {
  constructor(
    private baseDir: string,
    private statusFile: string = "status.yaml",
  ) {}

  private woDir(woId: string): string {
    return join(this.baseDir, woId);
  }

  private statusPath(woId: string): string {
    return join(this.woDir(woId), this.statusFile);
  }

  async nextId(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const prefix = `WO-${today}-`;
    let maxNum = 0;
    try {
      const entries = await readdir(this.baseDir);
      for (const entry of entries) {
        if (entry.startsWith(prefix)) {
          const num = parseInt(entry.slice(prefix.length), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    } catch {
      // directory may not exist yet
    }
    return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
  }

  async create(woId: string, status: WorkOrderStatus): Promise<void> {
    const dir = this.woDir(woId);
    await mkdir(dir, { recursive: true });
    await this.writeStatus(woId, status);
  }

  async readStatus(woId: string): Promise<WorkOrderStatus> {
    const path = this.statusPath(woId);
    this.assertWithinBoundary(woId, path);
    const raw = await readFile(path, "utf-8");
    return parseYaml(raw) as WorkOrderStatus;
  }

  async writeStatus(woId: string, status: WorkOrderStatus): Promise<void> {
    status.updated_at = new Date().toISOString();
    const path = this.statusPath(woId);
    this.assertWithinBoundary(woId, path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, stringifyYaml(status), "utf-8");
  }

  private assertWithinBoundary(woId: string, fullPath: string): void {
    const woDir = resolve(this.woDir(woId));
    const resolved = resolve(fullPath);
    const rel = relative(woDir, resolved);
    if (rel.startsWith("..") || resolve(woDir, rel) !== resolved) {
      throw new Error(`Path escapes work order boundary: "${fullPath}"`);
    }
  }

  async writeArtifact(woId: string, relativePath: string, content: string): Promise<void> {
    const fullPath = join(this.woDir(woId), relativePath);
    this.assertWithinBoundary(woId, fullPath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }

  async readArtifact(woId: string, relativePath: string): Promise<string> {
    const fullPath = join(this.woDir(woId), relativePath);
    this.assertWithinBoundary(woId, fullPath);
    return readFile(fullPath, "utf-8");
  }

  async artifactExists(woId: string, relativePath: string): Promise<boolean> {
    try {
      await stat(join(this.woDir(woId), relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<Array<{ id: string; status: WorkOrderStatus }>> {
    let entries: string[];
    try {
      entries = (await readdir(this.baseDir)).filter((e) => e.startsWith("WO-"));
    } catch {
      return [];
    }
    const settled = await Promise.allSettled(
      entries.map(async (id) => ({ id, status: await this.readStatus(id) })),
    );
    return settled
      .filter((r): r is PromiseFulfilledResult<{ id: string; status: WorkOrderStatus }> => r.status === "fulfilled")
      .map((r) => r.value);
  }
}

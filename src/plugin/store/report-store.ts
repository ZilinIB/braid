import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export class ReportStore {
  constructor(private baseDir: string) {}

  private dayDir(date: string): string {
    return join(this.baseDir, date);
  }

  async writeRoleReport(date: string, roleId: string, content: string): Promise<void> {
    const dir = this.dayDir(date);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${roleId}.md`), content, "utf-8");
  }

  async readRoleReport(date: string, roleId: string): Promise<string> {
    return readFile(join(this.dayDir(date), `${roleId}.md`), "utf-8");
  }

  async writeSummary(date: string, content: string, summaryFile: string): Promise<void> {
    const dir = this.dayDir(date);
    await mkdir(dir, { recursive: true });
    // Write into the date directory so readAllReports discovers it
    await writeFile(join(dir, "_summary.md"), content, "utf-8");
    // Also write to the top-level location per the manifest convention
    const fileName = summaryFile.replace("YYYY-MM-DD", date);
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(join(this.baseDir, fileName), content, "utf-8");
  }

  async readSummary(date: string): Promise<string> {
    return readFile(join(this.dayDir(date), "_summary.md"), "utf-8");
  }

  async listReports(date: string): Promise<string[]> {
    try {
      const entries = await readdir(this.dayDir(date));
      return entries.filter((e) => e.endsWith(".md")).map((e) => e.replace(".md", ""));
    } catch {
      return [];
    }
  }

  async readAllReports(date: string): Promise<Record<string, string>> {
    const roles = await this.listReports(date);
    const reports: Record<string, string> = {};
    for (const role of roles) {
      reports[role] = await this.readRoleReport(date, role);
    }
    return reports;
  }
}

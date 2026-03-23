import { normalize, isAbsolute } from "node:path";
import type { BraidManifest, ArtifactConfig } from "../../manifest/types.js";

export type OwnershipResult = {
  allowed: boolean;
  reason: string;
};

/**
 * Resolve the file path for an artifact write.
 * - File artifacts: returns the file name (e.g., "request.md")
 * - Family artifacts: returns "dir/index.md" for canonical writes, or "dir/subfile" for contributions
 */
export function resolveArtifactPath(
  manifest: BraidManifest,
  artifactName: string,
  subFile?: string,
): string | null {
  const art = manifest.protocol.artifacts[artifactName];
  if (!art) return null;

  if (art.kind === "file") {
    return art.file ?? null;
  }

  // Family artifact
  if (!art.directory) return null;
  if (subFile) {
    if (!isSafeSubFile(subFile)) return null;
    return `${art.directory}/${subFile}`;
  }
  return art.index ? `${art.directory}/${art.index}` : null;
}

/**
 * Validate that a sub-file name is safe: no path traversal, no absolute paths,
 * must be a plain filename (optionally with a single subdirectory).
 */
export function isSafeSubFile(subFile: string): boolean {
  if (!subFile || isAbsolute(subFile)) return false;
  const normalized = normalize(subFile);
  return !normalized.split(/[/\\]/).some((seg) => seg === "..");
}

/**
 * Check if a role is allowed to write a specific artifact in a given work order type.
 */
export function checkOwnership(
  manifest: BraidManifest,
  woType: string,
  artifactName: string,
  callingRole: string,
  subFile?: string,
): OwnershipResult {
  const art = manifest.protocol.artifacts[artifactName];
  if (!art) {
    return { allowed: false, reason: `Unknown artifact "${artifactName}"` };
  }

  if (art.owner_mode === "system") {
    return { allowed: false, reason: `Artifact "${artifactName}" is system-owned` };
  }

  const canonicalOwner = resolveCanonicalOwner(art, woType);

  // Writing to the canonical file (singleton or family index.md)
  if (!subFile || (art.kind === "family" && subFile === art.index)) {
    if (callingRole === canonicalOwner) {
      return { allowed: true, reason: "ok" };
    }
    return {
      allowed: false,
      reason: `Role "${callingRole}" does not own "${artifactName}" for "${woType}" work orders. Owner: "${canonicalOwner}"`,
    };
  }

  // Validate sub-file path safety before any authorization check
  if (subFile && !isSafeSubFile(subFile)) {
    return { allowed: false, reason: `Unsafe sub-file path: "${subFile}"` };
  }

  // Writing a sub-file in a family artifact
  if (art.kind !== "family") {
    return { allowed: false, reason: `Artifact "${artifactName}" is not a family — sub-files are not allowed` };
  }

  // Canonical owner can always write sub-files
  if (callingRole === canonicalOwner) {
    return { allowed: true, reason: "ok" };
  }

  // Check can_author permissions
  const role = manifest.roles[callingRole];
  if (!role) {
    return { allowed: false, reason: `Unknown role "${callingRole}"` };
  }

  if (role.can_author?.families?.includes(artifactName)) {
    return { allowed: true, reason: "ok" };
  }

  return {
    allowed: false,
    reason: `Role "${callingRole}" cannot author sub-files in "${artifactName}". Not in can_author.families.`,
  };
}

/**
 * Build a map of artifact logical name -> canonical file path from the manifest.
 * Used by the state machine to check artifact existence without hardcoding paths.
 */
export function buildArtifactPathMap(manifest: BraidManifest): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [name, art] of Object.entries(manifest.protocol.artifacts)) {
    if (art.kind === "file" && art.file) {
      map[name] = art.file;
    } else if (art.kind === "family" && art.directory && art.index) {
      map[name] = `${art.directory}/${art.index}`;
    }
  }
  return map;
}

function resolveCanonicalOwner(art: ArtifactConfig, woType: string): string | null {
  if (art.owner_mode === "fixed") {
    return art.default_owner ?? null;
  }
  if (art.owner_mode === "by_work_order_type" && art.owners_by_type) {
    return art.owners_by_type[woType] ?? null;
  }
  return null;
}

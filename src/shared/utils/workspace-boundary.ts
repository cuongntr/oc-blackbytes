import { realpath } from "node:fs/promises"
import { dirname, normalize, relative, resolve } from "node:path"

/**
 * Validates that a resolved path is within the workspace root.
 * Resolves symlinks when possible; falls back to lexical comparison for non-existent paths.
 * Walks up ancestors to find the nearest existing directory for symlink resolution.
 *
 * @throws {Error} If the path escapes the workspace boundary.
 */
export async function assertWithinWorkspace(
  targetPath: string,
  workspaceRoot: string,
): Promise<void> {
  // Canonicalize workspace root (handles symlinked workspace directories)
  const canonicalRoot =
    (await tryRealpath(normalize(resolve(workspaceRoot)))) ?? normalize(resolve(workspaceRoot))
  const resolvedTarget = normalize(resolve(targetPath))

  // Path equals workspace root — allowed (for grep/glob scanning the whole workspace)
  if (resolvedTarget === canonicalRoot) {
    return
  }

  // Try realpath on the target itself
  const realTarget = await tryRealpath(resolvedTarget)
  if (realTarget !== null) {
    assertContained(realTarget, canonicalRoot, targetPath, realTarget)
    return
  }

  // Target doesn't exist — walk up to find the nearest existing ancestor,
  // realpath it, then reconstruct the full path with the remaining suffix.
  // This prevents escape via symlinked intermediate directories.
  const { canonicalAncestor, suffix } = await findNearestExistingAncestor(resolvedTarget)
  if (canonicalAncestor !== null) {
    const reconstructed = normalize(`${canonicalAncestor}/${suffix}`)
    assertContained(reconstructed, canonicalRoot, targetPath, reconstructed)
    return
  }

  // No ancestor could be resolved — fall back to lexical prefix check
  assertContained(resolvedTarget, canonicalRoot, targetPath, resolvedTarget)
}

/**
 * Check containment using path.relative() — platform-safe.
 * A path is contained if relative(root, target) does not start with '..'.
 */
function assertContained(
  targetCanonical: string,
  rootCanonical: string,
  originalPath: string,
  resolvedDisplay: string,
): void {
  if (targetCanonical === rootCanonical) return
  const rel = relative(rootCanonical, targetCanonical)
  if (rel.startsWith("..") || resolve(rootCanonical, rel) !== targetCanonical) {
    throw new Error(
      `Path "${originalPath}" resolves to "${resolvedDisplay}" which is outside the workspace root "${rootCanonical}"`,
    )
  }
}

/**
 * Walk up from the target path until we find an existing directory,
 * realpath it, and return it along with the remaining path suffix.
 */
async function findNearestExistingAncestor(
  targetPath: string,
): Promise<{ canonicalAncestor: string | null; suffix: string }> {
  let current = dirname(targetPath)
  let suffix = targetPath.slice(current.length)

  // Safety limit to prevent infinite loops
  for (let i = 0; i < 256; i++) {
    const real = await tryRealpath(current)
    if (real !== null) {
      return { canonicalAncestor: real, suffix }
    }
    const parent = dirname(current)
    if (parent === current) break // reached filesystem root
    suffix = current.slice(parent.length) + suffix
    current = parent
  }

  return { canonicalAncestor: null, suffix }
}

async function tryRealpath(p: string): Promise<string | null> {
  try {
    return await realpath(p)
  } catch {
    return null
  }
}

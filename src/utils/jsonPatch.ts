// Minimal RFC 6902 JSON Patch application, enough for baked replay shares.
//
// Shares store a full snapshot per group plus one patch per following position;
// the client walks the patches to reach a position. The patches are produced by
// Python's `jsonpatch` at bake time and are never user-supplied, so this
// implements application only — no diffing, and no `test` op.

export type PatchOp =
  | { op: "add"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "replace"; path: string; value: unknown }
  | { op: "move"; path: string; from: string }
  | { op: "copy"; path: string; from: string };

type Container = Record<string, unknown> | unknown[];

/** "/a/b~1c/0" -> ["a", "b/c", "0"], undoing the ~1 and ~0 escapes. */
function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  return pointer
    .substring(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function resolveParent(root: Container, tokens: string[]): Container {
  let node: unknown = root;
  for (const token of tokens) {
    node = Array.isArray(node)
      ? (node as unknown[])[Number(token)]
      : (node as Record<string, unknown>)[token];
    if (node == null || typeof node !== "object") {
      throw new Error(`JSON Patch path does not resolve: /${tokens.join("/")}`);
    }
  }
  return node as Container;
}

function readAt(root: Container, pointer: string): unknown {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) return root;
  const key = tokens[tokens.length - 1];
  const parent = resolveParent(root, tokens.slice(0, -1));
  return Array.isArray(parent) ? parent[Number(key)] : (parent as Record<string, unknown>)[key];
}

function removeAt(root: Container, pointer: string): void {
  const tokens = parsePointer(pointer);
  const key = tokens[tokens.length - 1];
  const parent = resolveParent(root, tokens.slice(0, -1));
  if (Array.isArray(parent)) parent.splice(Number(key), 1);
  else delete (parent as Record<string, unknown>)[key];
}

function insertAt(root: Container, pointer: string, value: unknown, replace: boolean): void {
  const tokens = parsePointer(pointer);
  const key = tokens[tokens.length - 1];
  const parent = resolveParent(root, tokens.slice(0, -1));
  if (Array.isArray(parent)) {
    const index = key === "-" ? parent.length : Number(key);
    if (replace) parent[index] = value;
    else parent.splice(index, 0, value);
  } else {
    (parent as Record<string, unknown>)[key] = value;
  }
}

/**
 * Apply one patch, mutating `doc`.
 *
 * Mutating is deliberate: reaching the end of a group means applying ~175
 * patches in sequence, and copying a ~120 KB board each time would dominate.
 * Callers own a freshly parsed document, so nothing outside is aliased.
 *
 * Values from the patch are cloned on the way in. A cached group is replayed
 * from its keyframe for every position the user visits, so handing the document
 * a reference into the patch would let a later op mutate the patch itself and
 * silently corrupt every subsequent replay.
 */
export function applyPatch<T>(doc: T, patch: readonly PatchOp[]): T {
  let root = doc as unknown as Container;
  for (const op of patch) {
    if (op.path === "" && (op.op === "add" || op.op === "replace")) {
      root = structuredClone(op.value) as Container;
      continue;
    }
    switch (op.op) {
      case "add":
        insertAt(root, op.path, structuredClone(op.value), false);
        break;
      case "replace":
        insertAt(root, op.path, structuredClone(op.value), true);
        break;
      case "remove":
        removeAt(root, op.path);
        break;
      case "move": {
        const value = readAt(root, op.from);
        removeAt(root, op.from);
        insertAt(root, op.path, value, false);
        break;
      }
      case "copy":
        insertAt(root, op.path, structuredClone(readAt(root, op.from)), false);
        break;
    }
  }
  return root as unknown as T;
}

/** Apply patches in order. */
export function applyPatches<T>(doc: T, patches: readonly (readonly PatchOp[])[]): T {
  let out = doc;
  for (const patch of patches) out = applyPatch(out, patch);
  return out;
}

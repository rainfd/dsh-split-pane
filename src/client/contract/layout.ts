/**
 * The split workspace's layout model: a binary tree of panes addressed by path.
 *
 * The model is pure data plus pure functions so it can be tested without a
 * browser and persisted as JSON. A path is the sequence of child choices from
 * the root (`0` = first, `1` = second), which keeps a pane's identity stable
 * across sibling removals — an index would renumber every later pane.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Which way a split divides its pane. */
export type SplitAxis = 'row' | 'column'

/** One pane: the leaf that renders a Session. */
export interface PaneLeaf {
  readonly kind: 'pane'
  /** Session shown here; `undefined` renders the empty branch. */
  readonly sessionId: SessionId | undefined
}

/** One split: two children sharing an axis, with the first child's share. */
export interface PaneSplit {
  readonly kind: 'split'
  readonly axis: SplitAxis
  /** Share of the axis given to `first`, in (0, 1). */
  readonly ratio: number
  readonly first: PaneNode
  readonly second: PaneNode
}

/** A node of the split tree. */
export type PaneNode = PaneLeaf | PaneSplit

/** Smallest share a divider drag may leave a child. */
export const MIN_PANE_RATIO = 0.15

/** Largest share a divider drag may leave a child. */
export const MAX_PANE_RATIO = 0.85

/** One pane as the renderer sees it: its identity, address, and Session. */
export interface PaneDescriptor {
  /** Child choices from the root; the pane's stable identity. */
  readonly path: readonly number[]
  /** Session shown in this pane, if any. */
  readonly sessionId: SessionId | undefined
  /** The pane's own leaf node. */
  readonly leaf: PaneLeaf
}

/**
 * Build a leaf pane.
 * @param sessionId - Session the pane shows; omit for an empty pane.
 * @returns the leaf node.
 */
export function leaf(sessionId?: SessionId): PaneLeaf {
  return { kind: 'pane', sessionId }
}

/**
 * Build a split node.
 * @param axis - which way the split divides its pane.
 * @param first - child drawn first along the axis.
 * @param second - child drawn second along the axis.
 * @param ratio - share given to `first`; clamped into the allowed band.
 * @returns the split node.
 */
export function split(axis: SplitAxis, first: PaneNode, second: PaneNode, ratio = 0.5): PaneSplit {
  return { kind: 'split', axis, ratio: clampRatio(ratio), first, second }
}

/**
 * Clamp a divider share into the band a drag may leave.
 * @param ratio - candidate share for the first child.
 * @returns the share clamped into the band, or an even split when it is not finite.
 */
export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5
  return Math.min(MAX_PANE_RATIO, Math.max(MIN_PANE_RATIO, ratio))
}

/**
 * Read the node at a path.
 * @param root - tree to walk.
 * @param path - child choices from the root; an empty path selects the root.
 * @returns the node, or `undefined` when the path does not resolve.
 */
export function nodeAt(root: PaneNode, path: readonly number[]): PaneNode | undefined {
  let node: PaneNode = root
  for (const step of path) {
    if (node.kind !== 'split') return undefined
    node = step === 0 ? node.first : node.second
  }
  return node
}

/**
 * Read the leaf at a path.
 * @param root - tree to walk.
 * @param path - child choices from the root.
 * @returns the leaf, or `undefined` when the path resolves to a split or nothing.
 */
export function leafAt(root: PaneNode, path: readonly number[]): PaneLeaf | undefined {
  const node = nodeAt(root, path)
  return node?.kind === 'pane' ? node : undefined
}

/**
 * Replace the node at a path.
 * @param root - tree to rebuild.
 * @param path - child choices from the root; an empty path replaces the root.
 * @param update - pure replacement for the addressed node.
 * @returns the rebuilt tree; the same reference when the path does not resolve.
 */
export function replaceAt(
  root: PaneNode,
  path: readonly number[],
  update: (current: PaneNode) => PaneNode,
): PaneNode {
  if (path.length === 0) return update(root)
  if (root.kind !== 'split') return root
  const [head, ...tail] = path
  const next = head === 0
    ? replaceAt(root.first, tail, update)
    : replaceAt(root.second, tail, update)
  if (next === (head === 0 ? root.first : root.second)) return root
  return head === 0 ? { ...root, first: next } : { ...root, second: next }
}

/**
 * Remove the pane at a path, promoting its sibling into the parent's place.
 * @param root - tree to rebuild.
 * @param path - child choices from the root; an empty path is the root and never removed.
 * @returns the rebuilt tree; the same reference when the path cannot be removed.
 */
export function removeAt(root: PaneNode, path: readonly number[]): PaneNode {
  if (path.length === 0) return root
  if (root.kind !== 'split') return root
  const [head, ...tail] = path
  if (tail.length === 0) return head === 0 ? root.second : root.first
  const next = head === 0 ? removeAt(root.first, tail) : removeAt(root.second, tail)
  if (next === (head === 0 ? root.first : root.second)) return root
  return head === 0 ? { ...root, first: next } : { ...root, second: next }
}

/**
 * Every pane in the tree, in reading order.
 * @param root - tree to walk.
 * @returns one descriptor per pane; never empty for a valid tree.
 */
export function panes(root: PaneNode): readonly PaneDescriptor[] {
  const found: PaneDescriptor[] = []
  const walk = (node: PaneNode, path: readonly number[]): void => {
    if (node.kind === 'pane') {
      found.push({ path, sessionId: node.sessionId, leaf: node })
      return
    }
    walk(node.first, [...path, 0])
    walk(node.second, [...path, 1])
  }
  walk(root, [])
  return found
}

/**
 * Count the panes in a tree.
 * @param root - tree to count.
 * @returns how many panes the tree holds.
 */
export function paneCount(root: PaneNode): number {
  return root.kind === 'pane' ? 1 : paneCount(root.first) + paneCount(root.second)
}

/**
 * Whether a pane may still be added.
 * @param root - tree to test.
 * @param limit - largest pane count allowed; omit for no limit.
 * @returns whether the count stays under the limit.
 */
export function canSplit(root: PaneNode, limit?: number): boolean {
  return limit === undefined ? true : paneCount(root) < limit
}

/**
 * Whether two paths address the same pane.
 * @param a - first path.
 * @param b - second path.
 * @returns whether both paths are equal.
 */
export function samePath(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((step, index) => step === b[index])
}

/**
 * The pane a Session occupies, if it is open anywhere.
 * @param root - tree to search.
 * @param sessionId - Session to find.
 * @returns the pane's path, or `undefined` when the Session is not shown.
 */
export function pathOfSession(root: PaneNode, sessionId: SessionId): readonly number[] | undefined {
  return panes(root).find(pane => pane.sessionId === sessionId)?.path
}

/**
 * Session ids currently shown, in reading order, without duplicates.
 * @param root - tree to read.
 * @returns the shown Session ids.
 */
export function shownSessions(root: PaneNode): readonly SessionId[] {
  return panes(root).flatMap(pane => pane.sessionId === undefined ? [] : [pane.sessionId])
}

/**
 * Validate a persisted tree, repairing what it can.
 *
 * Storage is a durable boundary, so the value arrives untyped: panes are kept
 * only when their shape holds and their Session still exists, and the tree is
 * clamped back to a single leaf when nothing usable remains. A pane whose
 * Session disappeared becomes an empty pane rather than dropping the pane,
 * because the user's layout is the thing being preserved.
 * @param value - parsed storage value.
 * @param known - Sessions that currently exist.
 * @returns a usable tree, or `undefined` when the value is not a tree at all.
 */
export function reviveTree(
  value: unknown,
  known: ReadonlySet<SessionId>,
): PaneNode | undefined {
  const revive = (input: unknown): PaneNode | undefined => {
    if (input === null || typeof input !== 'object') return undefined
    const candidate = input as Record<string, unknown>
    if (candidate.kind === 'pane') {
      const sessionId = candidate.sessionId
      if (sessionId === undefined) return leaf()
      if (typeof sessionId !== 'string') return undefined
      const id = sessionId as SessionId
      return leaf(known.has(id) ? id : undefined)
    }
    if (candidate.kind !== 'split') return undefined
    const axis = candidate.axis
    if (axis !== 'row' && axis !== 'column') return undefined
    const first = revive(candidate.first)
    const second = revive(candidate.second)
    if (first === undefined || second === undefined) return undefined
    const ratio = typeof candidate.ratio === 'number' ? candidate.ratio : 0.5
    return { kind: 'split', axis, ratio: clampRatio(ratio), first, second }
  }
  return revive(value)
}

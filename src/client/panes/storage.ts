/**
 * Per-Session persistence for the split tree.
 *
 * Storage is a durable boundary, so a stored value is untrusted on read: it is
 * validated by `reviveTree`, which drops panes whose shape is wrong and empties
 * panes whose Session no longer exists. The tree is keyed by the Session the
 * workspace was opened on, so each Session keeps its own arrangement.
 */
// Type-only: pulls the declaration merges this file's standard props rely on.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { leaf, reviveTree, type PaneNode } from '../contract/layout.ts'

/** Storage key prefix; one entry per anchoring Session. */
const KEY_PREFIX = 'dsh.split-pane.v1'

/**
 * Storage key for one anchoring Session.
 * @param sessionId - the Session the workspace is anchored on, or none.
 * @returns the localStorage key holding that Session's arrangement.
 */
export function storageKey(sessionId: SessionId | undefined): string {
  return sessionId === undefined ? `${KEY_PREFIX}.none` : `${KEY_PREFIX}.${sessionId}`
}

/**
 * Read the stored tree for one anchoring Session.
 * @param sessionId - the Session the workspace is anchored on.
 * @param known - Sessions that currently exist.
 * @returns the stored tree, or a single pane for the anchoring Session.
 */
export function readTree(sessionId: SessionId | undefined, known: ReadonlySet<SessionId>): PaneNode {
  const fallback = leaf(sessionId)
  try {
    const raw = globalThis.localStorage.getItem(storageKey(sessionId))
    if (raw === null) return fallback
    return reviveTree(JSON.parse(raw) as unknown, known) ?? fallback
  } catch {
    // Unreadable or malformed storage never blocks the workspace: a single pane
    // for the anchoring Session is always a usable arrangement.
    return fallback
  }
}

/**
 * Persist the tree for one anchoring Session.
 * @param sessionId - the Session the workspace is anchored on.
 * @param tree - tree to store.
 */
export function writeTree(sessionId: SessionId | undefined, tree: PaneNode): void {
  try {
    globalThis.localStorage.setItem(storageKey(sessionId), JSON.stringify(tree))
  } catch {
    // A full or unavailable storage leaves the in-memory layout usable.
  }
}

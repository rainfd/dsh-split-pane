/**
 * Shared layout state for the split workspace.
 *
 * The arrangement lives here rather than in the workspace component because two
 * other entry points act on it from outside that component: the conversation
 * header's New split button and the keyboard shortcut. Both create a Session,
 * seat it in a new pane, and select the panel.
 *
 * One instance is created in `apply` and handed to the components through their
 * registration's `inject` face. It is deliberately not a registration's `store`:
 * a store handle may be mounted under exactly one scope, and this plugin's seats
 * sit under two (`main` is root-scoped, the header entry and pane bodies are
 * session-scoped), so a declared handle would be rejected at load.
 *
 * State is keyed by the anchoring Session — the Session the workspace was opened
 * on — so each Session keeps its own arrangement and switching Sessions does not
 * carry one layout into another.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { defineStore } from '@deepseek-ai/dsh-client-store'
import {
  clampRatio, leaf, paneCount, removeAt, replaceAt, split as makeSplit, type PaneNode,
} from './contract/layout.ts'

/** One anchoring Session's arrangement. */
export interface SplitAnchorState {
  /** The split tree. */
  readonly tree: PaneNode
  /** Path of the focused pane; empty means the first pane. */
  readonly focus: readonly number[]
}

/** Root state: one arrangement per anchoring Session. */
export interface SplitPaneState {
  readonly byAnchor: Record<string, SplitAnchorState | undefined>
}

/** Each mutation's draft signature, as authored in the actions table below. */
export interface SplitPaneDraftActions {
  /** Replace one anchor's tree, keeping its focus when that pane still exists. */
  setTree(anchor: SessionId, tree: PaneNode): void
  /** Focus one pane of an anchor's tree. */
  setFocus(anchor: SessionId, focus: readonly number[]): void
  /** Establish an anchor's arrangement; used for the storage read and its repair. */
  seed(anchor: SessionId, tree: PaneNode): void
  /**
   * Split one pane, seating a Session in the new half and focusing it.
   * @param path - the pane to split; omitted uses the anchor's focus.
   */
  addPane(
    anchor: SessionId, path: readonly number[] | undefined,
    sessionId: SessionId | undefined, axis: 'row' | 'column',
  ): void
  /** Show a Session, or none, in one pane. */
  showInPane(anchor: SessionId, path: readonly number[], sessionId: SessionId | undefined): void
  /** Close one pane, promoting its sibling; the last pane stays. */
  closePane(anchor: SessionId, path: readonly number[]): void
  /** Commit a divider drag. */
  setRatio(anchor: SessionId, path: readonly number[], ratio: number): void
}

/** The arrangement for one anchor, or `undefined` before it is seeded. */
function anchorOf(state: SplitPaneState, anchor: SessionId): SplitAnchorState | undefined {
  return state.byAnchor[anchor]
}

/**
 * The baked (curried) action set components call, derived from the store so the
 * two can never drift.
 */
export type SplitPaneActions =
  ReturnType<ReturnType<typeof createSplitPaneStore>['create']>['actions']

/**
 * Create the split workspace store.
 * @returns the store handle; `apply` creates one instance from it.
 */
export function createSplitPaneStore() {
  return defineStore({
    init: (): SplitPaneState => ({ byAnchor: {} }),
    actions: {
      setTree(draft, anchor: SessionId, tree: PaneNode) {
        draft.byAnchor[anchor] = { tree, focus: anchorOf(draft, anchor)?.focus ?? [] }
      },
      setFocus(draft, anchor: SessionId, focus: readonly number[]) {
        const current = anchorOf(draft, anchor)
        if (current !== undefined) draft.byAnchor[anchor] = { tree: current.tree, focus }
      },
      seed(draft, anchor: SessionId, tree: PaneNode) {
        draft.byAnchor[anchor] = { tree, focus: [] }
      },
      addPane(draft, anchor: SessionId, path: readonly number[] | undefined,
        sessionId: SessionId | undefined, axis: 'row' | 'column') {
        const current = anchorOf(draft, anchor) ?? { tree: leaf(anchor), focus: [] }
        const at = path ?? current.focus
        draft.byAnchor[anchor] = {
          tree: replaceAt(current.tree, at, node => makeSplit(axis, node, leaf(sessionId))),
          focus: [...at, 1],
        }
      },
      showInPane(draft, anchor: SessionId, path: readonly number[], sessionId: SessionId | undefined) {
        const current = anchorOf(draft, anchor)
        if (current === undefined) return
        draft.byAnchor[anchor] = {
          tree: replaceAt(current.tree, path, () => leaf(sessionId)),
          focus: path,
        }
      },
      closePane(draft, anchor: SessionId, path: readonly number[]) {
        const current = anchorOf(draft, anchor)
        if (current === undefined || paneCount(current.tree) <= 1) return
        draft.byAnchor[anchor] = { tree: removeAt(current.tree, path), focus: path.slice(0, -1) }
      },
      setRatio(draft, anchor: SessionId, path: readonly number[], ratio: number) {
        const current = anchorOf(draft, anchor)
        if (current === undefined) return
        draft.byAnchor[anchor] = {
          tree: replaceAt(current.tree, path, (node) => {
            if (node.kind !== 'split') return node
            return { ...node, ratio: clampRatio(ratio) }
          }),
          focus: current.focus,
        }
      },
    },
  })
}

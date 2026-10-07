/**
 * The split workspace: the `main` panel that holds several live Sessions at
 * once.
 *
 * This is the plugin's whole visible surface. It owns the split tree, draws one
 * frame and chrome row per pane, hosts one Conversation occurrence per pane, and
 * persists the tree per anchoring Session.
 *
 * Scope note: `main` is a root-scope keyed slot, so this component receives no
 * Session binding for the panel itself. The anchoring Session comes from the
 * Session scope adapter through the injected `current` hook, and every pane
 * re-addresses itself in `PaneHost`, which retains that pane's Session and wraps
 * its body in `SessionProvider`.
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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  HostObservable, InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime,
  SnapshotSelectorHook, StandardSourceBinding,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionProviderComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type { ISessions, SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  clampRatio, leaf, paneCount, panes, removeAt, replaceAt, reviveTree, samePath,
  split as makeSplit, type PaneNode,
} from '../contract/layout.ts'
import type { SplitPaneOwnerProps } from '../contract/slots.ts'
import { PaneChrome } from './PaneChrome.tsx'
import { PaneFrame } from './PaneFrame.tsx'
import { PaneHost } from './PaneHost.tsx'
import { EmptyPane } from './EmptyPane.tsx'
import { readTree, writeTree } from './storage.ts'
import { SplitTree } from './SplitTree.tsx'
import css from './SplitPane.module.css'

/** How many panes the workspace will hold; `undefined` leaves it unbounded. */
export const PANE_LIMIT: number | undefined = undefined

/** Face this plugin injects into its own `main` panel. */
export interface SplitWorkspaceInjected {
  /** Bare sources the renderer binds to `useCurrent` and `useArchived`. */
  readonly hooks: {
    readonly current: HostObservable<StandardSourceBinding>
    readonly archived: HostObservable<WorkspaceSnapshot>
  }
  /** Client Sessions service, for per-pane retention. */
  readonly sessions: ISessions
}

/** Props of the workspace panel, including the framework-standard SessionProvider seat. */
export type SplitWorkspaceProps =
  & PropsRuntime<'main'>
  & PropsRenderSlots<'split.pane'>
  & PropsLocale<'splitPane'>
  & InjectFace<SplitWorkspaceInjected>
  & {
    /** Renderer-bound hook over the Session scope adapter's current binding. */
    readonly useCurrent: SnapshotSelectorHook<StandardSourceBinding>
    /** Renderer-bound hook over the Workspace snapshot (for the archive set). */
    readonly useArchived: SnapshotSelectorHook<WorkspaceSnapshot>
    /** Session body renderer supplied by the area declaration. */
    readonly SessionProvider: SessionProviderComponent
  }

/**
 * Draw the split workspace.
 * @param props - runtime seats, injected faces, and this plugin's copy.
 * @returns the workspace element.
 */
export function SplitWorkspace({
  useSessions, useCurrent, useArchived, sessions, renderSlot, SessionProvider, t,
}: SplitWorkspaceProps): ReactNode {
  const current = useCurrent(binding => binding.key)
  const archived = useArchived(snapshot => snapshot.archivedSessionIds)
  const list = useSessions(state => state)

  const sessionId = current as SessionId | undefined
  // Explicit element type: outside the monorepo's single program the filtered
  // array's element type is not inferred back to SessionId.
  const ids = useMemo<readonly SessionId[]>(
    () => list.ids.filter(id => !archived.includes(id)),
    [list.ids, archived],
  )
  const choices = useMemo(
    () => ids.map(id => ({ id, title: list.byId[id]?.displayTitle ?? id })),
    [ids, list.byId],
  )

  const [tree, setTree] = useState<PaneNode>(() => leaf(sessionId))
  const [focused, setFocused] = useState<readonly number[]>([])
  const [anchor, setAnchor] = useState<SessionId | undefined>(sessionId)

  // Adopt the anchoring Session every time the workspace is re-entered, then
  // keep the user's own arrangement for as long as that Session stays current.
  useEffect(() => {
    if (anchor === sessionId) return
    setAnchor(sessionId)
    setTree(readTree(sessionId, new Set(ids)))
    setFocused([])
  }, [anchor, sessionId, ids])

  // A Session deleted elsewhere must not leave a pane bound to nothing.
  useEffect(() => {
    const known = new Set(ids)
    setTree((currentTree) => {
      const revived = reviveTree(currentTree, known)
      return revived ?? leaf(sessionId)
    })
  }, [ids, sessionId])

  useEffect(() => { writeTree(anchor, tree) }, [anchor, tree])

  const activePath = focused.length > 0 ? focused : [0]
  const canSplit = PANE_LIMIT === undefined || paneCount(tree) < PANE_LIMIT

  const splitAt = useCallback((path: readonly number[], axis: 'row' | 'column') => {
    setTree(currentTree => replaceAt(currentTree, path, node => makeSplit(axis, node, leaf())))
    setFocused([...path, 1])
  }, [])
  const closeAt = useCallback((path: readonly number[]) => {
    setTree((currentTree) => {
      if (paneCount(currentTree) <= 1) return currentTree
      return removeAt(currentTree, path)
    })
    setFocused(path.slice(0, -1))
  }, [])
  const selectAt = useCallback((path: readonly number[], next: SessionId | undefined) => {
    setTree(currentTree => replaceAt(currentTree, path, () => leaf(next)))
  }, [])
  const ratioAt = useCallback((path: readonly number[], ratio: number) => {
    setTree(currentTree => replaceAt(currentTree, path, (node) => {
      if (node.kind !== 'split') return node
      return { ...node, ratio: clampRatio(ratio) }
    }))
  }, [])
  const retain = useCallback(
    (id: string, signal: AbortSignal): SessionReference =>
      sessions.retain(id as SessionId, { source: 'splitPane', signal }),
    [sessions],
  )

  const renderPane = useCallback((path: readonly number[]): ReactNode => {
    const pane = panes(tree).find(entry => samePath(entry.path, path))
    const paneSession = pane?.sessionId
    const focusedHere = samePath(path, activePath)
    const owner: SplitPaneOwnerProps = {
      path,
      focused: focusedHere,
      canSplit,
      onSplit: (axis) => { splitAt(path, axis) },
      onClose: () => { closeAt(path) },
      choices,
      onSelect: (next) => { selectAt(path, next) },
    }
    return (
      <PaneFrame
        key={path.join('.')}
        path={path}
        focused={focusedHere}
        sessionId={paneSession}
        onFocus={() => { setFocused(path) }}
        chrome={(
          <PaneChrome
            sessionId={paneSession}
            canSplit={canSplit}
            choices={choices}
            onSelect={owner.onSelect}
            onSplit={owner.onSplit}
            onClose={owner.onClose}
            labels={{
              select: t('pane.selectSession'),
              close: t('pane.close'),
              splitRight: t('pane.split.right'),
              splitDown: t('pane.split.down'),
            }}
          />
        )}
        body={(
          <PaneHost
            sessionId={paneSession}
            occurrenceKey={path.join('.')}
            retain={retain}
            SessionProvider={SessionProvider}
            renderBody={() => renderSlot('split.pane', owner)}
            empty={<EmptyPane choices={choices} label={t('pane.selectSession')} onSelect={owner.onSelect} />}
          />
        )}
      />
    )
  }, [
    tree, activePath, canSplit, choices, splitAt, closeAt, selectAt, retain,
    SessionProvider, renderSlot, t,
  ])

  return (
    <div className={css.root} data-split-pane-root="">
      <SplitTree node={tree} path={[]} context={{ renderPane, onRatio: ratioAt }} />
    </div>
  )
}

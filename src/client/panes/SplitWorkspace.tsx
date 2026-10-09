/**
 * The split workspace: the `main` panel that holds several live Sessions at
 * once.
 *
 * This is the plugin's visible surface. It draws one frame, chrome row, and
 * Conversation occurrence per pane. The arrangement itself lives in the shared
 * store, because the conversation header's New split button and the keyboard
 * shortcut act on the same tree from outside this component.
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
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type {
  HostObservable, InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime,
  SnapshotSelectorHook, StandardSourceBinding,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionProviderComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type { ISessions, SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { leaf, paneCount, paneKey, panes, reviveTree, samePath, sameTree } from '../contract/layout.ts'
import type { SplitPaneOwnerProps } from '../contract/slots.ts'
import type { SplitPaneActions, SplitPaneState } from '../stores.ts'
import type { createSplitPaneStore } from '../stores.ts'
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
  /** Bare sources the renderer binds to `useCurrent`, `useArchived`, and `useLayout`. */
  readonly hooks: {
    readonly current: HostObservable<StandardSourceBinding>
    readonly archived: HostObservable<WorkspaceSnapshot>
    readonly layout: HostObservable<SplitPaneState>
  }
  /** Client Sessions service, for per-pane retention. */
  readonly sessions: ISessions
  /** Writes over the shared arrangement. */
  readonly layoutActions: SplitPaneActions
  /** Split one pane onto a newly created Session and show this panel. */
  readonly splitWithNewSession: (
    anchor: SessionId, path: readonly number[] | undefined, axis: 'row' | 'column',
  ) => void
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
    /** Renderer-bound hook over the shared arrangement. */
    readonly useLayout: SnapshotSelectorHook<SplitPaneState>
    /** Session body renderer supplied by the area declaration. */
    readonly SessionProvider: SessionProviderComponent
  }

/**
 * Draw the split workspace.
 * @param props - runtime seats, the store, injected faces, and this plugin's copy.
 * @returns the workspace element.
 */
export function SplitWorkspace({
  useSessions, useCurrent, useArchived, useLayout, sessions, renderSlot, SessionProvider,
  layoutActions: actions, splitWithNewSession: splitNew, t,
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

  const known = useMemo(() => new Set(ids), [ids])
  const arrangement = useLayout(
    state => (sessionId === undefined ? undefined : state.byAnchor[sessionId]),
  )

  // Seed the anchor's arrangement once from storage, so the header entry and the
  // shortcut find a tree to add panes to even before this panel has rendered.
  useEffect(() => {
    if (sessionId === undefined || arrangement !== undefined) return
    actions.seed(sessionId, readTree(sessionId, known))
  }, [actions, arrangement, known, sessionId])

  const tree = arrangement?.tree ?? (sessionId === undefined ? undefined : leaf(sessionId))
  const focus = arrangement?.focus ?? []

  // A Session deleted elsewhere must not leave a pane bound to nothing.
  useEffect(() => {
    if (sessionId === undefined || arrangement === undefined) return
    const revived = reviveTree(arrangement.tree, known)
    // Value comparison, not reference: `reviveTree` rebuilds what it accepts, so
    // writing back an unchanged tree would re-notify this component's own
    // subscription on every render, and the effect would run again.
    if (revived !== undefined && !sameTree(revived, arrangement.tree)) {
      actions.setTree(sessionId, revived)
    }
  }, [actions, arrangement, known, sessionId])

  useEffect(() => {
    if (sessionId === undefined || tree === undefined) return
    writeTree(sessionId, tree)
  }, [sessionId, tree])

  // The focused pane's path, repaired when focus does not address a live pane:
  // a single-pane tree is addressed by `[]`, so a `[0]` default would leave the
  // only pane reading as unfocused.
  const panePaths = tree === undefined ? [] : panes(tree).map(pane => pane.path)
  const activePath = panePaths.find(path => samePath(path, focus)) ?? panePaths[0] ?? []
  const canSplit = tree !== undefined && (PANE_LIMIT === undefined || paneCount(tree) < PANE_LIMIT)
  const anchor = sessionId

  const retain = useCallback(
    (id: string, signal: AbortSignal): SessionReference =>
      sessions.retain(id as SessionId, { source: 'splitPane', signal }),
    [sessions],
  )

  const renderPane = useCallback((path: readonly number[]): ReactNode => {
    if (tree === undefined || anchor === undefined) return null
    const pane = panes(tree).find(entry => samePath(entry.path, path))
    const paneSession = pane?.sessionId
    const focusedHere = samePath(path, activePath)
    const owner: SplitPaneOwnerProps = {
      path,
      focused: focusedHere,
      canSplit,
      // A pane's own split control behaves exactly like the header's: the new
      // half is a new Session, not a second view of this one.
      onSplit: () => { splitNew(anchor, path, 'row') },
      onClose: () => { actions.closePane(anchor, path) },
      choices,
      onSelect: (next) => { actions.showInPane(anchor, path, next) },
    }
    return (
      <PaneFrame
        key={paneKey(path)}
        path={path}
        focused={focusedHere}
        sessionId={paneSession}
        onFocus={() => { actions.setFocus(anchor, path) }}
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
            }}
          />
        )}
        body={(
          <PaneHost
            sessionId={paneSession}
            occurrenceKey={paneKey(path)}
            retain={retain}
            SessionProvider={SessionProvider}
            renderBody={() => renderSlot('split.pane', owner)}
            empty={<EmptyPane choices={choices} label={t('pane.selectSession')} onSelect={owner.onSelect} />}
          />
        )}
      />
    )
  }, [
    tree, anchor, activePath, canSplit, choices, actions, splitNew, retain,
    SessionProvider, renderSlot, t,
  ])

  if (tree === undefined || anchor === undefined) return <div className={css.root} data-split-pane-root="" />
  return (
    <div className={css.root} data-split-pane-root="">
      <SplitTree
        node={tree}
        path={[]}
        context={{ renderPane, onRatio: (path, ratio) => { actions.setRatio(anchor, path, ratio) } }}
      />
    </div>
  )
}

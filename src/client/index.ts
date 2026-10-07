/**
 * Split-pane workspace, browser half.
 *
 * Registers a `main` panel key holding several live Sessions side by side, a
 * session-scope slot its pane bodies occupy, a conversation-header entry that
 * opens a split on a newly created Session, a keyboard shortcut for the same
 * action, keyboard navigation between panes, and the sidebar icon that selects
 * the panel. The panel is an ordinary main panel, so the Conversation stays the
 * default view.
 *
 * Every entry point acts on one tree, so the arrangement lives in a declared
 * store rather than in the workspace component. The header entry and the
 * shortcut both create a Session, seat it in a new pane, and select the panel;
 * the navigation and close commands act on the pane the workspace has focused.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { NS, en, zh, type SplitPaneKey } from './locales.ts'
import { SPLIT_PANEL_ID } from './contract/slots.ts'
import {
  closeAt, focusedPath, leaf, neighborPath, type PaneDirection,
} from './contract/layout.ts'
import { createSplitPaneStore, type SplitAnchorState } from './stores.ts'
import { SplitWorkspace, type SplitWorkspaceInjected } from './panes/SplitWorkspace.tsx'
import { focusPane } from './panes/focus.ts'
import { PaneBody } from './panes/PaneBody.tsx'
import { HeaderEntry } from './panes/HeaderEntry.tsx'
import { SplitIcon } from './SplitIcon.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Split workspace copy. */
    'splitPane': SplitPaneKey
  }
}

/** Services this plugin reads. */
export const inject = [
  'slots', 'locale', 'sessions', 'workspaces', 'uiSession', 'shortcuts', 'layout',
]

/** The command id the header entry's tooltip and the shortcut reference share. */
const NEW_SPLIT_COMMAND = 'splitPane.new'

/**
 * Opening a split, one command per direction.
 *
 * A binding names a physical combination, so a direction cannot be an argument
 * to a command: the pair exists as two commands. The second direction is the
 * first with Shift added, which keeps the two adjacent in the shortcut
 * reference and stays clear of the browser's own Command+Option combinations.
 */
const SPLIT_COMMANDS = [
  {
    id: NEW_SPLIT_COMMAND, axis: 'column', label: 'shortcut.label',
    alias: 'shortcut.alias.split', modifiers: ['primary', 'alt'],
  },
  {
    id: 'splitPane.newRight', axis: 'row', label: 'shortcut.split.right',
    alias: 'shortcut.alias.splitRight', modifiers: ['primary', 'alt', 'shift'],
  },
] as const

/** One command's resolution, as the shortcuts service declares it. */
type Resolution = ReturnType<ShortcutCommand['resolve']>

/** The arrangement the keyboard commands act on: an anchor and its tree. */
interface Seat {
  readonly anchor: SessionId
  readonly state: SplitAnchorState
}

/**
 * The four pane-navigation commands.
 *
 * Each direction is one command because the registry binds physical
 * combinations, not arguments. The copy keys are shared with the reference
 * panel's search, so a user who types "pane" or "left" finds the row.
 */
const FOCUS_COMMANDS = [
  {
    id: 'splitPane.focusLeft', direction: 'left', code: 'ArrowLeft',
    label: 'shortcut.focus.left', alias: 'shortcut.alias.left',
  },
  {
    id: 'splitPane.focusRight', direction: 'right', code: 'ArrowRight',
    label: 'shortcut.focus.right', alias: 'shortcut.alias.right',
  },
  {
    id: 'splitPane.focusUp', direction: 'up', code: 'ArrowUp',
    label: 'shortcut.focus.up', alias: 'shortcut.alias.up',
  },
  {
    id: 'splitPane.focusDown', direction: 'down', code: 'ArrowDown',
    label: 'shortcut.focus.down', alias: 'shortcut.alias.down',
  },
] as const


/**
 * Register the split workspace, its entry points, and its sidebar icon.
 * @param ctx - Client root carrying Slots, locale, Sessions, Workspaces, and shortcuts.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-split-pane: dictionaries')
  const t = ctx.locale.bind(NS)

  // One instance, shared by every seat through its `inject` face. Declaring it
  // as a registration `store` is impossible here: `main` is root-scoped while
  // the header entry and pane bodies are session-scoped, and a handle may be
  // mounted under exactly one scope.
  const layout = createSplitPaneStore().create()

  /**
   * Split one pane onto a freshly created Session and show the split panel.
   *
   * Every split goes through here, so a new pane is always a new Session — the
   * header entry, the shortcut, and a pane's own split control all behave the
   * same way. The Session is created asynchronously, so the pane is seated
   * empty first and filled when the id resolves; seating the anchor's own
   * Session in the meantime would render one conversation twice.
   * @param anchor - the Session the workspace is anchored on.
   * @param path - the pane to split; omitted splits the anchor's focused pane.
   * @param axis - which way the divider runs.
   */
  const splitWithNewSession = (
    anchor: SessionId, path: readonly number[] | undefined, axis: 'row' | 'column',
  ): void => {
    // Seed first: the header entry can be pressed before the panel ever
    // rendered, and `addPane` needs an arrangement to extend.
    if (layout.getSnapshot().byAnchor[anchor] === undefined) {
      layout.actions.seed(anchor, leaf(anchor))
    }
    layout.actions.addPane(anchor, path, undefined, axis)
    // Read the new pane's path synchronously: a second split would move focus
    // before this Session resolves.
    const target = layout.getSnapshot().byAnchor[anchor]?.focus
    // Create in the anchor's own Workspace: a Session with no Workspace opens on
    // the hero's picker instead of a composer the user can type into.
    const workspace = ctx.workspaces.list.getSnapshot().items
      .find(item => item.sessionIds.includes(anchor))
    void ctx.sessions.create(
      workspace === undefined ? {} : { workspaceId: workspace.workspaceId },
    ).then(
      (created) => {
        if (target !== undefined) layout.actions.showInPane(anchor, target, created)
      },
      (reason: unknown) => { console.warn('split pane: new session failed:', reason) },
    )
    ctx.layout.selectPanel(SPLIT_PANEL_ID as MainPanelId)
  }

  /**
   * Open a split from outside the workspace, on the anchor's focused pane.
   * @param anchorSessionId - the Session the workspace is anchored on.
   * @param axis - which way the divider runs; omitted stacks the new pane below.
   */
  const openSplit = (anchorSessionId: string, axis: 'row' | 'column' = 'column'): void => {
    splitWithNewSession(anchorSessionId as SessionId, undefined, axis)
  }

  /**
   * The arrangement the pane commands act on, but only while the split panel is
   * the panel on screen. Every other view — the Conversation, a settings sheet —
   * has no panes to move between, and there the combination belongs to the host,
   * the browser, or the editor inside a composer, so resolving "pass" is what
   * keeps ordinary editing keys ordinary.
   * @returns the anchor and its arrangement, or `undefined` when the workspace is not showing.
   */
  const activeSeat = (): Seat | undefined => {
    if (ctx.layout.panelInfo.getSnapshot().activePanelId !== SPLIT_PANEL_ID) return undefined
    const anchor = ctx.uiSession.adapter.current.getSnapshot().key
    if (anchor === undefined) return undefined
    const state = layout.getSnapshot().byAnchor[anchor]
    return state === undefined ? undefined : { anchor: anchor as SessionId, state }
  }

  /**
   * Move pane focus one pane over.
   *
   * The neighbour is captured here, in the same tick as the key, so the pane
   * this lands on cannot be renumbered by anything that happens before the
   * action runs.
   * @param direction - which way to move.
   * @returns the resolution: pass when there is no workspace, handled otherwise.
   */
  const resolveFocus = (direction: PaneDirection): Resolution => {
    const seat = activeSeat()
    if (seat === undefined) return { status: 'pass' }
    const next = neighborPath(
      seat.state.tree, focusedPath(seat.state.tree, seat.state.focus), direction,
    )
    // At the edge of the layout there is no pane to move to, but the workspace
    // still owns its own keys: consuming the press keeps the composer's caret
    // from jumping instead.
    if (next === undefined) return { status: 'handled', run: () => {} }
    return {
      status: 'handled',
      run: () => {
        layout.actions.setFocus(seat.anchor, next)
        focusPane(next)
      },
    }
  }

  /**
   * Close the focused pane, leaving its sibling in its place.
   * @returns the resolution: pass without a workspace, blocked on the last pane.
   */
  const resolveClose = (): Resolution => {
    const seat = activeSeat()
    if (seat === undefined) return { status: 'pass' }
    const from = focusedPath(seat.state.tree, seat.state.focus)
    const closed = closeAt(seat.state.tree, from)
    if (closed === undefined) return { status: 'blocked', reason: t('shortcut.lastPane') }
    return {
      status: 'handled',
      run: () => {
        layout.actions.closePane(seat.anchor, from)
        // The closed pane's own element is about to unmount, and with it the
        // browser's focus; hand it to the pane that took over the space.
        focusPane(closed.focus)
      },
    }
  }

  const injected = (): SplitWorkspaceInjected => ({
    hooks: {
      // Bare observables; the renderer binds them to `useCurrent`, `useArchived`,
      // and `useLayout` on the component, which never sees the sources.
      current: ctx.uiSession.adapter.current,
      archived: ctx.workspaces.list,
      layout,
    },
    sessions: ctx.sessions,
    layoutActions: layout.actions,
    splitWithNewSession,
  })

  ctx.slots.inject('main', function* () {
    yield ctx.slots.register({
      name: 'main',
      key: SPLIT_PANEL_ID,
      locale: NS,
      children: { 'split.pane': { kind: 'single', scope: 'session' } },
      inject: injected,
    }, SplitWorkspace)
    yield ctx.slots.register({
      name: 'split.pane',
      locale: NS,
    }, PaneBody)
  })

  // The conversation header entry, beside the right panel's expand control.
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'split-pane',
    order: 20,
    locale: NS,
    inject: () => ({
      hooks: { shortcuts: ctx.shortcuts.catalog },
      openSplit,
    }),
  }, HeaderEntry))

  // The keyboard paths to the same action, listed in the shortcut reference:
  // one per split direction, because a binding names a physical combination and
  // cannot carry an argument.
  ctx.effect(() => {
    const disposers = SPLIT_COMMANDS.map(entry => ctx.shortcuts.register({
      id: entry.id as ShortcutCommandId,
      label: () => t(entry.label),
      aliases: [t(entry.alias), t('shortcut.alias.sideBySide')],
      // Web takes primary+alt like the host's own navigation commands: every
      // primary+shift+letter combination worth having is a browser shortcut.
      // The second direction adds Shift rather than a new letter, which keeps
      // the pair together in the reference and stays clear of every browser
      // binding in the Command+Option family.
      defaults: {
        'desktop:macos': { code: 'KeyS', modifiers: entry.modifiers },
        'desktop:windows': { code: 'KeyS', modifiers: entry.modifiers },
        'desktop:linux': { code: 'KeyS', modifiers: entry.modifiers },
        // No `web:linux` row: the Web binding gate admits only a fixed allowlist
        // outside macOS/Windows, and the host's own commands leave Linux Web
        // unbound for the same reason. Users can assign one in the shortcut
        // reference.
        'web:macos': { code: 'KeyS', modifiers: entry.modifiers },
        'web:windows': { code: 'KeyS', modifiers: entry.modifiers },
      },
      regions: ['page', 'editable'],
      modals: [],
      resolve: () => {
        const anchor = ctx.uiSession.adapter.current.getSnapshot().key
        if (anchor === undefined) return { status: 'blocked', reason: t('shortcut.noWorkspace') }
        return { status: 'handled', run: () => { openSplit(anchor, entry.axis) } }
      },
    }))
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-split-pane: shortcuts')

  // Moving and closing panes from the keyboard, listed in the same reference.
  ctx.effect(() => {
    const disposers = FOCUS_COMMANDS.map(entry => ctx.shortcuts.register({
      id: entry.id as ShortcutCommandId,
      label: () => t(entry.label),
      aliases: [t('shortcut.alias.pane'), t('shortcut.alias.focus'), t(entry.alias)],
      // macOS browsers own Command+Option+arrow: Chrome and Firefox switch tabs
      // on Left/Right and cycle focus between toolbars on Up/Down, and a
      // combination the browser reserves never reaches the page at all.
      // Command+Shift+arrow is free there, which is also the Web side of this
      // project's own convention — a desktop default that uses Alt becomes
      // Mod+Shift on the Web. Windows keeps the Alt form, because
      // Control+Shift+arrow is word selection inside a composer.
      defaults: {
        'desktop:macos': { code: entry.code, modifiers: ['primary', 'alt'] },
        'desktop:windows': { code: entry.code, modifiers: ['primary', 'alt'] },
        'web:macos': { code: entry.code, modifiers: ['primary', 'shift'] },
        'web:windows': { code: entry.code, modifiers: ['primary', 'alt'] },
      },
      regions: ['page', 'editable'],
      modals: [],
      resolve: () => resolveFocus(entry.direction),
    }))
    disposers.push(ctx.shortcuts.register({
      id: 'splitPane.close' as ShortcutCommandId,
      label: () => t('shortcut.close'),
      aliases: [t('shortcut.alias.pane'), t('shortcut.close')],
      // Option/Alt+Backspace deletes a word backwards in a text field; the
      // platform modifier on top of that pair is free in browsers and unclaimed
      // by the host. The Command+Shift+W family is not usable on the Web: it
      // closes the browser's own window.
      defaults: {
        'desktop:macos': { code: 'Backspace', modifiers: ['primary', 'alt'] },
        'desktop:windows': { code: 'Backspace', modifiers: ['primary', 'alt'] },
        'web:macos': { code: 'Backspace', modifiers: ['primary', 'alt'] },
        'web:windows': { code: 'Backspace', modifiers: ['primary', 'alt'] },
      },
      regions: ['page', 'editable'],
      modals: [],
      resolve: resolveClose,
    }))
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-split-pane: pane shortcuts')

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: SPLIT_PANEL_ID,
    order: 20,
    locale: NS,
    label: () => t('panel.label'),
  }, SplitIcon))
}

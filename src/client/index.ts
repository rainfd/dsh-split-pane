/**
 * Split-pane workspace, browser half.
 *
 * Registers a `main` panel key holding several live Sessions side by side, a
 * session-scope slot its pane bodies occupy, a conversation-header entry that
 * opens a split on a newly created Session, a keyboard shortcut for the same
 * action, and the sidebar icon that selects the panel. The panel is an ordinary
 * main panel, so the Conversation stays the default view.
 *
 * Three entry points act on one tree, so the arrangement lives in a declared
 * store rather than in the workspace component. The header entry and the
 * shortcut both create a Session, seat it in a new pane, and select the panel.
 *
 * `main` is a root-scope keyed slot, so the plugin's own panel receives no
 * Session binding. The workspace reads the current selection through the
 * `session` scope adapter (`ctx.uiSession.adapter.current`) and re-addresses
 * every pane through `SessionProvider`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
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
import { leaf } from './contract/layout.ts'
import { createSplitPaneStore } from './stores.ts'
import { SplitWorkspace, type SplitWorkspaceInjected } from './panes/SplitWorkspace.tsx'
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

  /** Open a split from outside the workspace, on the anchor's focused pane. */
  const openSplit = (anchorSessionId: string): void => {
    splitWithNewSession(anchorSessionId as SessionId, undefined, 'column')
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

  // The keyboard path to the same action, listed in the shortcut reference.
  ctx.effect(() => ctx.shortcuts.register({
    id: NEW_SPLIT_COMMAND as Parameters<typeof ctx.shortcuts.register>[0]['id'],
    label: () => t('shortcut.label'),
    aliases: [t('shortcut.alias.split'), t('shortcut.alias.sideBySide')],
    // Web takes primary+alt like the host's own navigation commands: every
    // primary+shift+letter combination worth having is a browser shortcut.
    defaults: {
      'desktop:macos': { code: 'KeyS', modifiers: ['primary', 'alt'] },
      'desktop:windows': { code: 'KeyS', modifiers: ['primary', 'alt'] },
      'desktop:linux': { code: 'KeyS', modifiers: ['primary', 'alt'] },
      // No `web:linux` row: the Web binding gate admits only a fixed allowlist
      // outside macOS/Windows, and the host's own commands leave Linux Web
      // unbound for the same reason. Users can assign one in the shortcut
      // reference.
      'web:macos': { code: 'KeyS', modifiers: ['primary', 'alt'] },
      'web:windows': { code: 'KeyS', modifiers: ['primary', 'alt'] },
    },
    regions: ['page', 'editable'],
    modals: [],
    resolve: (context) => {
      const anchor = ctx.uiSession.adapter.current.getSnapshot().key
      if (anchor === undefined) return { status: 'blocked', reason: t('shortcut.noWorkspace') }
      void context
      return { status: 'handled', run: () => { openSplit(anchor) } }
    },
  }), 'ui-split-pane: shortcut')

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: SPLIT_PANEL_ID,
    order: 20,
    locale: NS,
    label: () => t('panel.label'),
  }, SplitIcon))
}

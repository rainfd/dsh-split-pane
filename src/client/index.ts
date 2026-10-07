/**
 * Split-pane workspace, browser half.
 *
 * Registers one `main` panel key that holds several live Sessions side by side,
 * one session-scope slot its pane bodies occupy, and the sidebar icon that
 * selects the panel. The panel is an ordinary main panel, so the Conversation
 * stays the default view and the sidebar's panel list toggles between them.
 *
 * `main` is a root-scope keyed slot, so this plugin's own panel receives no
 * Session binding. The workspace therefore reads the current selection through
 * the `session` scope adapter (`ctx.uiSession.adapter.current`) and re-addresses
 * every pane through `SessionProvider`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { NS, en, zh, type SplitPaneKey } from './locales.ts'
import { SPLIT_PANEL_ID } from './contract/slots.ts'
import { SplitWorkspace, type SplitWorkspaceInjected } from './panes/SplitWorkspace.tsx'
import { PaneBody } from './panes/PaneBody.tsx'
import { SplitIcon } from './SplitIcon.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Split workspace copy. */
    'splitPane': SplitPaneKey
  }
}

/** Services this plugin reads. */
export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'uiSession']

/**
 * Register the split workspace, its pane bodies, and its sidebar entry.
 * @param ctx - Client root carrying Slots, localisation, Sessions, and Workspaces.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-split-pane: dictionaries')
  const t = ctx.locale.bind(NS)

  const injected = (): SplitWorkspaceInjected => ({
    hooks: {
      // Both facts are bare observables; the renderer binds them to `useCurrent`
      // and `useArchived` on the component, which never sees the sources.
      current: ctx.uiSession.adapter.current,
      archived: ctx.workspaces.list,
    },
    sessions: ctx.sessions,
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

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: SPLIT_PANEL_ID,
    order: 20,
    locale: NS,
    label: () => t('panel.label'),
  }, SplitIcon))
}

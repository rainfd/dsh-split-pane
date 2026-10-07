/**
 * The way into a split from an open conversation: one button in the
 * conversation header's utilities row.
 *
 * It sits in the Session header rather than the sidebar so it is reachable
 * without leaving the conversation — the same place the right panel's expand
 * control lives. Pressing it creates a blank Session, seats it in a new pane
 * beside the current one, and selects the split panel, so the new session is
 * ready to type into rather than a pane the user must fill.
 *
 * The control is drawn here rather than imported: a plugin must not load another
 * Harness Client package as a module (its exports change without notice, and a
 * throwing component blanks the slot entry). The markup, the compact-control
 * metrics, and the tooltip's placement are copied from the host's own button and
 * tooltip and renamed under this plugin's classes, so the only shared styling
 * dependency stays the `--dsw-*` tokens.
 */
// Type-only: pulls the declaration merges this file's props rely on.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { ReactNode } from 'react'
import type {
  HostObservable, InjectFace, PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { ShortcutCatalogEntry } from '@deepseek-ai/dsh-client-shortcuts/client'
import css from './HeaderEntry.module.css'

/** What the button needs: its seat, shortcut labels, and the open action. */
export type HeaderEntryProps =
  & PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<'splitPane'>
  & InjectFace<{
    hooks: { shortcuts: HostObservable<readonly ShortcutCatalogEntry[]> }
    /** Open the split panel on a newly created Session. */
    openSplit: (anchorSessionId: string) => void
  }>

/** The split glyph: a panel divided by a vertical seam. */
function SplitGlyph(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M8 2.5v11" />
    </svg>
  )
}

/**
 * Render the New split control.
 * @param props - the header seat, shortcut labels, and the open action.
 * @returns the button element.
 */
export function HeaderEntry({
  sessionId, t, useShortcuts, openSplit,
}: HeaderEntryProps): ReactNode {
  const shortcut = useShortcuts(entries => entries.find(entry => entry.id === 'splitPane.new'))
  return (
    <span className={css.host}>
      <button
        type="button"
        className={css.button}
        aria-label={t('entry.aria')}
        aria-keyshortcuts={shortcut?.aria}
        data-split-pane-entry
        onClick={() => { openSplit(sessionId) }}
      >
        <SplitGlyph />
      </button>
      <span className={css.tip} role="tooltip">
        {t('entry.label')}
        {shortcut !== undefined && shortcut.keys.length > 0 && (
          <span className={css.keys}>
            {shortcut.keys.map(key => <kbd key={key} className={css.key}>{key}</kbd>)}
          </span>
        )}
      </span>
    </span>
  )
}

/**
 * The empty pane: a Session picker, shown while a pane holds no Session.
 */
import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import css from './SplitPane.module.css'

/** Props of the empty-pane body. */
export interface EmptyPaneProps {
  readonly choices: readonly { readonly id: SessionId; readonly title: string }[]
  readonly label: string
  readonly onSelect: (sessionId: SessionId | undefined) => void
}

/**
 * Render the empty-pane picker.
 * @param props - eligible Sessions, the picker's accessible name, and the pick.
 * @returns the empty-pane element.
 */
export function EmptyPane({ choices, label, onSelect }: EmptyPaneProps): ReactNode {
  return (
    <div className={css.empty} data-split-pane-empty="">
      <select
        className={css.emptySelect}
        aria-label={label}
        value=""
        onChange={(event) => {
          onSelect(event.currentTarget.value === '' ? undefined : event.currentTarget.value as SessionId)
        }}
      >
        <option value="">—</option>
        {choices.map(choice => (
          <option key={choice.id} value={choice.id}>{choice.title}</option>
        ))}
      </select>
    </div>
  )
}

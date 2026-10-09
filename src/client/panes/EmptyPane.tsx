/**
 * The empty pane: a Session picker, shown while a pane holds no Session.
 */
import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { PaneChoice, PaneWorkspace } from '../contract/slots.ts'
import css from './SplitPane.module.css'

/** Copy for the empty-pane pickers. */
export interface EmptyPaneLabels {
  readonly select: string
  readonly chooseWorkspace: string
}

/** Props of the empty-pane body. */
export interface EmptyPaneProps {
  readonly choices: readonly PaneChoice[]
  readonly workspaces: readonly PaneWorkspace[]
  readonly labels: EmptyPaneLabels
  readonly onSelect: (sessionId: SessionId | undefined) => void
  readonly onOpenWorkspace: (workspaceId: string) => void
}

/**
 * Render the empty-pane picker.
 * @param props - eligible Sessions, the picker's accessible name, and the pick.
 * @returns the empty-pane element.
 */
export function EmptyPane({
  choices, workspaces, labels, onSelect, onOpenWorkspace,
}: EmptyPaneProps): ReactNode {
  return (
    <div className={css.empty} data-split-pane-empty="">
      <div className={css.emptyHint}>{labels.select}</div>
      <select
        className={css.emptySelect}
        aria-label={labels.select}
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
      <select
        className={css.emptySelect}
        aria-label={labels.chooseWorkspace}
        value=""
        onChange={(event) => {
          const value = event.currentTarget.value
          event.currentTarget.value = ''
          if (value !== '') onOpenWorkspace(value)
        }}
      >
        <option value="">{labels.chooseWorkspace}</option>
        {workspaces.map(workspace => (
          <option key={workspace.id} value={workspace.id}>{workspace.title}</option>
        ))}
      </select>
    </div>
  )
}

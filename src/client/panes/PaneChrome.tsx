/**
 * One pane's chrome row: its Session picker and its split and close controls.
 *
 * The chrome is drawn by the workspace rather than by the Session-scoped body,
 * so a pane keeps its controls whether or not it currently shows a Session. An
 * empty pane that lost its controls could never be split or closed again.
 */
import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { PaneChoice, PaneWorkspace } from '../contract/slots.ts'
import { SplitRightGlyph } from './PaneGlyphs.tsx'
import css from './SplitPane.module.css'

/** Copy for one pane's chrome. */
export interface PaneChromeLabels {
  readonly select: string
  readonly chooseWorkspace: string
  readonly close: string
  readonly splitRight: string
}

/** What one pane's chrome draws and reports. */
export interface PaneChromeProps {
  readonly sessionId: SessionId | undefined
  readonly canSplit: boolean
  readonly choices: readonly PaneChoice[]
  readonly workspaces: readonly PaneWorkspace[]
  readonly labels: PaneChromeLabels
  readonly onSelect: (sessionId: SessionId | undefined) => void
  readonly onOpenWorkspace: (workspaceId: string) => void
  readonly onSplit: () => void
  readonly onClose: () => void
}

/**
 * Draw one pane's chrome row.
 * @param props - the pane's Session, its controls, and its copy.
 * @returns the chrome element.
 */
export function PaneChrome({
  sessionId, canSplit, choices, workspaces, labels, onSelect, onOpenWorkspace, onSplit, onClose,
}: PaneChromeProps): ReactNode {
  return (
    <header className={css.chrome} data-split-pane-chrome="">
      {/* The Session header above this row names the Session; this picker is
          what re-points the pane, and it is the only place an empty pane's
          choice is visible, so it stays. Several blank Sessions share the
          automatic title, so each row names its Workspace too. */}
      <select
        className={css.select}
        aria-label={labels.select}
        value={sessionId ?? ''}
        onChange={(event) => {
          const value = event.currentTarget.value
          onSelect(value === '' ? undefined : value as SessionId)
        }}
      >
        <option value="">—</option>
        {choices.map(choice => (
          <option key={choice.id} value={choice.id}>{choice.title}</option>
        ))}
      </select>
      {/* Where this pane's conversation lives. The host's own Workspace picker
          belongs to the blank-Session Hero, which a pane never renders, so the
          pane needs its own: picking one creates a Session there. */}
      <select
        className={css.select}
        aria-label={labels.chooseWorkspace}
        title={labels.chooseWorkspace}
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
      <div className={css.actions}>
        <button
          type="button"
          className={css.action}
          aria-label={labels.splitRight}
          title={labels.splitRight}
          disabled={!canSplit}
          onClick={onSplit}
        ><SplitRightGlyph /></button>
        <button
          type="button"
          className={css.action}
          aria-label={labels.close}
          title={labels.close}
          onClick={onClose}
        >×</button>
      </div>
    </header>
  )
}

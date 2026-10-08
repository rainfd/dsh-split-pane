/**
 * One pane's chrome row: its Session picker and its split and close controls.
 *
 * The chrome is drawn by the workspace rather than by the Session-scoped body,
 * so a pane keeps its controls whether or not it currently shows a Session. An
 * empty pane that lost its controls could never be split or closed again.
 */
import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SplitDownGlyph, SplitRightGlyph } from './PaneGlyphs.tsx'
import css from './SplitPane.module.css'

/** Copy for one pane's chrome. */
export interface PaneChromeLabels {
  readonly select: string
  readonly close: string
  readonly splitRight: string
  readonly splitDown: string
}

/** What one pane's chrome draws and reports. */
export interface PaneChromeProps {
  readonly sessionId: SessionId | undefined
  readonly canSplit: boolean
  readonly choices: readonly { readonly id: SessionId; readonly title: string }[]
  readonly labels: PaneChromeLabels
  readonly onSelect: (sessionId: SessionId | undefined) => void
  readonly onSplit: (axis: 'row' | 'column') => void
  readonly onClose: () => void
}

/**
 * Draw one pane's chrome row.
 * @param props - the pane's Session, its controls, and its copy.
 * @returns the chrome element.
 */
export function PaneChrome({
  sessionId, canSplit, choices, labels, onSelect, onSplit, onClose,
}: PaneChromeProps): ReactNode {
  return (
    <header className={css.chrome} data-split-pane-chrome="">
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
      <div className={css.actions}>
        <button
          type="button"
          className={css.action}
          aria-label={labels.splitRight}
          title={labels.splitRight}
          disabled={!canSplit}
          onClick={() => { onSplit('row') }}
        ><SplitRightGlyph /></button>
        <button
          type="button"
          className={css.action}
          aria-label={labels.splitDown}
          title={labels.splitDown}
          disabled={!canSplit}
          onClick={() => { onSplit('column') }}
        ><SplitDownGlyph /></button>
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

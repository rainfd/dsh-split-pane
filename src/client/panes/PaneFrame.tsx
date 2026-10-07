/**
 * A pane frame: the chrome row plus whatever occupies the body.
 *
 * The frame is drawn by the workspace, not by the Session-scoped body, so every
 * pane keeps its split and close controls whether or not it currently shows a
 * Session. The body area is either the empty-pane picker or the Conversation
 * occurrence the `split.pane` slot renders.
 *
 * The frame is focusable without joining the tab order, because keyboard
 * navigation between panes focuses it when a pane has no editable of its own.
 */
import type { ReactNode } from 'react'
import { paneKey } from '../contract/layout.ts'
import css from './SplitPane.module.css'

/** What one pane frame draws. */
export interface PaneFrameProps {
  readonly path: readonly number[]
  readonly focused: boolean
  readonly sessionId: string | undefined
  readonly chrome: ReactNode
  readonly body: ReactNode
  /** Focus this pane when its chrome or body is pressed. */
  readonly onFocus: () => void
}

/**
 * Draw one pane frame.
 * @param props - the pane's identity, its chrome and body, and its focus intent.
 * @returns the pane element.
 */
export function PaneFrame({
  path, focused, sessionId, chrome, body, onFocus,
}: PaneFrameProps): ReactNode {
  return (
    <section
      className={css.pane}
      data-split-pane=""
      data-split-pane-path={paneKey(path)}
      data-split-pane-focused={focused ? '' : undefined}
      data-split-pane-session={sessionId ?? ''}
      tabIndex={-1}
      onPointerDown={onFocus}
    >
      {chrome}
      <div className={css.body}>{body}</div>
    </section>
  )
}

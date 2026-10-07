/**
 * Real keyboard focus for one pane.
 *
 * Moving between panes by keyboard moves the workspace's focus, but the browser
 * keeps its own: without this, the caret would stay in the pane the user just
 * left and the next keystroke would land there. The pane that takes over focus
 * is addressed by path, which is stable markup (`data-split-pane-path`), so the
 * element is found without a React render having to land first.
 */
import { paneKey } from '../contract/layout.ts'

/** Elements that accept typing inside a pane, in preference order. */
const EDITABLE = 'textarea, [contenteditable="true"], input'

/**
 * Move the browser's focus into one pane.
 *
 * The pane's own editable takes focus when it has one, so typing continues in
 * the pane the user navigated to. An empty pane has no editable, and focusing
 * its frame still takes the caret out of the pane left behind.
 * @param path - the pane to focus.
 * @returns whether an element was found and focused.
 */
export function focusPane(path: readonly number[]): boolean {
  const frame = document.querySelector(`[data-split-pane-path="${paneKey(path)}"]`)
  if (frame === null) return false
  const target = frame.querySelector(EDITABLE) ?? frame
  if (!(target instanceof HTMLElement)) return false
  target.focus()
  return true
}

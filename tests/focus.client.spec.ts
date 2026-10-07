// @vitest-environment jsdom
/**
 * Handing browser focus to a pane.
 *
 * Moving between panes by keyboard moves the arrangement's focus; without this
 * step the caret would stay in the pane the user just left, and the next
 * keystroke would land in the wrong conversation. Panes are found by the path
 * they render as markup, so nothing here depends on a React render landing
 * first — which is what makes it usable straight from a command.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { focusPane } from '../src/client/panes/focus.ts'

afterEach(() => { document.body.replaceChildren() })

/** What a pane was given to accept typing with. */
type Body = 'textarea' | 'contenteditable' | 'empty'

/**
 * Append one pane frame, shaped like the workspace renders it.
 * @param path - the pane's path, as `paneKey` renders it.
 * @param body - what the pane contains.
 * @returns the pane element.
 */
function pane(path: string, body: Body): HTMLElement {
  const section = document.createElement('section')
  section.dataset.splitPanePath = path
  section.tabIndex = -1
  if (body === 'textarea') section.append(document.createElement('textarea'))
  if (body === 'contenteditable') {
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    section.append(editable)
  }
  document.body.append(section)
  return section
}

describe('focusPane', () => {
  it('focuses the editable inside the pane, so typing continues there', () => {
    const first = pane('0', 'textarea')
    pane('1', 'textarea')
    expect(focusPane([0])).toBe(true)
    expect(document.activeElement).toBe(first.querySelector('textarea'))
  })

  it('accepts a rich-text editor as well as a textarea', () => {
    const second = pane('1', 'contenteditable')
    expect(focusPane([1])).toBe(true)
    expect(document.activeElement).toBe(second.firstElementChild)
  })

  it('focuses the pane itself when it has no editable', () => {
    // A pane is created empty and filled when its Session resolves; keyboard
    // navigation must still take the caret out of the pane it came from.
    const empty = pane('0', 'empty')
    expect(focusPane([0])).toBe(true)
    expect(document.activeElement).toBe(empty)
  })

  it('addresses the single-pane path, which renders as an empty string', () => {
    const only = pane('', 'textarea')
    expect(focusPane([])).toBe(true)
    expect(document.activeElement).toBe(only.querySelector('textarea'))
  })

  it('addresses nested panes, not their parents', () => {
    pane('0', 'textarea')
    const nested = pane('1.0', 'textarea')
    expect(focusPane([1, 0])).toBe(true)
    expect(document.activeElement).toBe(nested.querySelector('textarea'))
    // A prefix of a pane's path is a split, which is not a pane to focus.
    expect(focusPane([1])).toBe(false)
  })

  it('reports a pane that is not rendered', () => {
    expect(focusPane([3])).toBe(false)
    expect(document.activeElement).toBe(document.body)
  })
})

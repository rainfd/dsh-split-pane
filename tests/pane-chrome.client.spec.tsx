// @vitest-environment jsdom
/**
 * Pane chrome keeps its controls regardless of what the pane shows.
 *
 * This is the property that makes an unbounded workspace usable: a pane created
 * by a split starts empty, and an empty pane whose controls disappeared could
 * never be split or closed again. The suite renders the chrome directly, so it
 * covers the control surface without the full Web profile the pane body needs.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { PaneChrome } from '../src/client/panes/PaneChrome.tsx'

afterEach(cleanup)

const sid = (value: string): SessionId => value as SessionId
const LABELS = {
  select: 'Select a session', close: 'Close this pane', splitRight: 'Split right',
}
const CHOICES = [
  { id: sid('alpha'), title: 'Alpha' },
  { id: sid('beta'), title: 'Beta' },
]

/**
 * Render one chrome row.
 * @param overrides - props to replace the defaults with.
 * @returns the render result plus the recorded intents.
 */
function bench(overrides: Partial<Parameters<typeof PaneChrome>[0]> = {}) {
  const onSelect = vi.fn()
  const onSplit = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <PaneChrome
      sessionId={sid('alpha')}
      canSplit
      choices={CHOICES}
      labels={LABELS}
      onSelect={onSelect}
      onSplit={onSplit}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { view, onSelect, onSplit, onClose }
}

describe('pane chrome', () => {
  it('offers the sideways split and a close control for a Session pane', () => {
    const { view } = bench()
    expect(view.getByRole('button', { name: 'Split right' })).toBeDefined()
    expect(view.getByRole('button', { name: 'Close this pane' })).toBeDefined()
    // Panes divide the centre column sideways; there is no vertical control.
    expect(view.queryByRole('button', { name: 'Split down' })).toBeNull()
  })

  it('draws the control, and names it on hover as well as for assistive tech', () => {
    // The control used to be an arrow glyph, which said nothing about which way
    // the workspace ends up divided; it draws the result now — a panel with a
    // vertical seam — and the tooltip carries the words.
    const { view } = bench()
    const button = view.getByRole('button', { name: 'Split right' }) as HTMLButtonElement
    expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'))
    expect(button.querySelector('path')?.getAttribute('d')).toBe('M8 3v10')
  })

  it('keeps every control on an empty pane', () => {
    // The regression this covers: a split seats an empty pane, so losing these
    // controls would strand that pane with no way to split or close it.
    const { view, onSplit, onClose } = bench({ sessionId: undefined })
    const right = view.getByRole('button', { name: 'Split right' })
    expect(right).toBeDefined()
    expect((right as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(right)
    expect(onSplit).toHaveBeenCalledTimes(1)
    fireEvent.click(view.getByRole('button', { name: 'Close this pane' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables the split control once another pane is not allowed', () => {
    const { view, onSplit } = bench({ canSplit: false })
    const button = view.getByRole('button', { name: 'Split right' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onSplit).not.toHaveBeenCalled()
    // Close stays available: the budget limits creating panes, not removing them.
    expect((view.getByRole('button', { name: 'Close this pane' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('lists the eligible Sessions with the pane current one selected', () => {
    const { view } = bench()
    const select = view.getByRole('combobox') as HTMLSelectElement
    expect([...select.options].map(option => option.textContent)).toEqual(['—', 'Alpha', 'Beta'])
    expect(select.value).toBe('alpha')
  })

  it('reports a Session choice, and none for the placeholder', () => {
    const { view, onSelect } = bench()
    const select = view.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'beta' } })
    expect(onSelect).toHaveBeenCalledWith('beta')
    fireEvent.change(select, { target: { value: '' } })
    expect(onSelect).toHaveBeenLastCalledWith(undefined)
  })
})

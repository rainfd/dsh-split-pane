// @vitest-environment jsdom
/**
 * The split tree model: paths stay stable across sibling removal, ratios clamp,
 * and a stored value that no longer matches live Sessions is repaired rather
 * than trusted.
 */
import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  canSplit, clampRatio, leaf, nodeAt, paneCount, panes, pathOfSession, removeAt,
  replaceAt, reviveTree, samePath, shownSessions, split,
} from '../src/client/contract/layout.ts'

const sid = (value: string): SessionId => value as SessionId
const known = (...ids: string[]): ReadonlySet<SessionId> => new Set(ids.map(sid))

describe('ratios', () => {
  it('clamps a drag share into the band the divider may leave', () => {
    expect(clampRatio(0)).toBe(0.15)
    expect(clampRatio(1)).toBe(0.85)
    expect(clampRatio(0.4)).toBe(0.4)
  })

  it('falls back to an even split for a value that is not a finite number', () => {
    // NaN and an infinity are both "not a usable share" rather than a value to
    // clamp: neither gives the divider a position to land on.
    expect(clampRatio(Number.NaN)).toBe(0.5)
    expect(clampRatio(Number.POSITIVE_INFINITY)).toBe(0.5)
    expect(clampRatio(Number.NEGATIVE_INFINITY)).toBe(0.5)
  })

  it('clamps the share a split is built with', () => {
    expect(split('row', leaf(), leaf(), 0.99).ratio).toBe(0.85)
  })
})

describe('walking the tree', () => {
  const tree = split('row', leaf(sid('a')), split('column', leaf(sid('b')), leaf(sid('c'))))

  it('addresses a node by its child choices', () => {
    expect(nodeAt(tree, [])?.kind).toBe('split')
    expect(nodeAt(tree, [0])?.kind).toBe('pane')
    expect(nodeAt(tree, [1, 1])?.kind).toBe('pane')
  })

  it('reports nothing for a path that does not resolve', () => {
    expect(nodeAt(tree, [0, 0])).toBeUndefined()
    expect(nodeAt(tree, [1, 1, 0])).toBeUndefined()
  })

  it('lists panes in reading order with their Sessions', () => {
    expect(panes(tree).map(pane => pane.sessionId)).toEqual(['a', 'b', 'c'])
    expect(panes(tree).map(pane => pane.path)).toEqual([[0], [1, 0], [1, 1]])
    expect(paneCount(tree)).toBe(3)
  })

  it('finds the pane a Session occupies', () => {
    expect(pathOfSession(tree, sid('c'))).toEqual([1, 1])
    expect(pathOfSession(tree, sid('missing'))).toBeUndefined()
    expect(shownSessions(tree)).toEqual(['a', 'b', 'c'])
  })

  it('compares paths by position, not reference', () => {
    expect(samePath([1, 0], [1, 0])).toBe(true)
    expect(samePath([1, 0], [0, 1])).toBe(false)
    expect(samePath([1], [1, 0])).toBe(false)
  })
})

describe('editing the tree', () => {
  const tree = split('row', leaf(sid('a')), split('column', leaf(sid('b')), leaf(sid('c'))))

  it('replaces the node at a path without disturbing its siblings', () => {
    const next = replaceAt(tree, [1, 0], () => leaf(sid('z')))
    expect(shownSessions(next)).toEqual(['a', 'z', 'c'])
  })

  it('returns the same reference when the path does not resolve', () => {
    expect(replaceAt(tree, [0, 0], () => leaf(sid('z')))).toBe(tree)
  })

  it('promotes the sibling when a pane is removed', () => {
    // Removing [1, 0] leaves the column holding only 'c', which takes its place.
    const next = removeAt(tree, [1, 0])
    expect(shownSessions(next)).toEqual(['a', 'c'])
    expect(paneCount(next)).toBe(2)
  })

  it('never removes the root pane', () => {
    expect(removeAt(leaf(sid('a')), [])).toEqual(leaf(sid('a')))
  })

  it('leaves the tree alone when the removal path resolves to nothing', () => {
    expect(removeAt(tree, [0, 0])).toBe(tree)
  })

  it('splits a leaf into two panes, keeping the original first', () => {
    const next = replaceAt(tree, [0], node => split('row', node, leaf()))
    expect(panes(next).map(pane => pane.sessionId)).toEqual(['a', undefined, 'b', 'c'])
  })
})

describe('pane budget', () => {
  it('is unbounded when no limit is given', () => {
    const wide = split('row', split('row', leaf(), leaf()), split('row', leaf(), leaf()))
    expect(canSplit(wide)).toBe(true)
    expect(paneCount(wide)).toBe(4)
  })

  it('refuses another pane once the limit is reached', () => {
    const wide = split('row', split('row', leaf(), leaf()), split('row', leaf(), leaf()))
    expect(canSplit(wide, 4)).toBe(false)
    expect(canSplit(wide, 5)).toBe(true)
  })
})

describe('reviving a stored tree', () => {
  it('keeps a stored arrangement whose Sessions still exist', () => {
    const stored = { kind: 'split', axis: 'row', ratio: 0.3, first: { kind: 'pane', sessionId: 'a' }, second: { kind: 'pane', sessionId: 'b' } }
    expect(reviveTree(stored, known('a', 'b'))).toEqual(split('row', leaf(sid('a')), leaf(sid('b')), 0.3))
  })

  it('empties a pane whose Session disappeared instead of dropping the pane', () => {
    const stored = { kind: 'split', axis: 'row', ratio: 0.5, first: { kind: 'pane', sessionId: 'gone' }, second: { kind: 'pane', sessionId: 'b' } }
    const revived = reviveTree(stored, known('b'))
    expect(revived).toBeDefined()
    expect(shownSessions(revived!)).toEqual(['b'])
    expect(paneCount(revived!)).toBe(2)
  })

  it('clamps a stored ratio that is outside the band', () => {
    const stored = { kind: 'split', axis: 'row', ratio: 5, first: { kind: 'pane' }, second: { kind: 'pane' } }
    const revived = reviveTree(stored, known())
    expect(revived?.kind === 'split' && revived.ratio).toBe(0.85)
  })

  it('rejects a value that is not a tree', () => {
    expect(reviveTree('nonsense', known())).toBeUndefined()
    expect(reviveTree(null, known())).toBeUndefined()
    expect(reviveTree({ kind: 'split', axis: 'diagonal' }, known())).toBeUndefined()
    expect(reviveTree({ kind: 'split', axis: 'row', first: { kind: 'pane' } }, known())).toBeUndefined()
  })

  it('keeps an empty pane as an empty pane', () => {
    expect(reviveTree({ kind: 'pane' }, known())).toEqual(leaf())
  })

  it('drops a pane whose stored Session is not a string', () => {
    expect(reviveTree({ kind: 'pane', sessionId: 42 }, known())).toBeUndefined()
  })
})

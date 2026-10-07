// @vitest-environment jsdom
/**
 * The split tree model: paths stay stable across sibling removal, ratios clamp,
 * and a stored value that no longer matches live Sessions is repaired rather
 * than trusted.
 */
import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { PaneNode } from '../src/client/contract/layout.ts'
import {
  canSplit, clampRatio, closeAt, firstLeafPath, focusedPath, leaf, neighborPath, nodeAt,
  paneCount, paneKey, paneRects, panes, pathOfSession, removeAt, replaceAt, reviveTree,
  samePath, sameTree, shownSessions, split,
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

describe('pane geometry', () => {
  it('measures a single pane as the whole workspace', () => {
    expect(paneRects(leaf(sid('a')))).toEqual([
      { path: [], x: 0, y: 0, width: 1, height: 1 },
    ])
  })

  it('splits a row by share and stacks a column by share', () => {
    const row = split('row', leaf(sid('a')), leaf(sid('b')), 0.3)
    expect(paneRects(row).map(rect => [rect.path, rect.x, rect.width])).toEqual([
      [[0], 0, 0.3], [[1], 0.3, 0.7],
    ])
    const column = split('column', leaf(sid('a')), leaf(sid('b')), 0.25)
    expect(paneRects(column).map(rect => [rect.path, rect.y, rect.height])).toEqual([
      [[0], 0, 0.25], [[1], 0.25, 0.75],
    ])
  })

  it('nests the inner share inside the outer one', () => {
    const tree = split('row', leaf(sid('a')), split('column', leaf(sid('b')), leaf(sid('c'))), 0.5)
    expect(paneRects(tree)).toEqual([
      { path: [0], x: 0, y: 0, width: 0.5, height: 1 },
      { path: [1, 0], x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { path: [1, 1], x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ])
  })

  it('reads a pane as the string markup identifies it by', () => {
    expect(paneKey([])).toBe('')
    expect(paneKey([1, 0])).toBe('1.0')
  })
})

describe('pane neighbours', () => {
  // A wide pane on the left, a column of two on the right.
  const tree = split('row', leaf(sid('a')), split('column', leaf(sid('b')), leaf(sid('c'))))

  it('finds the pane sharing an edge', () => {
    expect(neighborPath(tree, [1, 0], 'down')).toEqual([1, 1])
    expect(neighborPath(tree, [1, 1], 'up')).toEqual([1, 0])
    // Both right-hand panes share half an edge with the wide left pane; the
    // nearer one is a tie, and reading order breaks it.
    expect(neighborPath(tree, [0], 'right')).toEqual([1, 0])
    expect(neighborPath(tree, [1, 1], 'left')).toEqual([0])
  })

  it('reports nothing at the edge of the layout', () => {
    expect(neighborPath(tree, [0], 'left')).toBeUndefined()
    expect(neighborPath(tree, [0], 'up')).toBeUndefined()
    // The wide pane spans the full height, so nothing is below it.
    expect(neighborPath(tree, [0], 'down')).toBeUndefined()
    expect(neighborPath(tree, [1, 0], 'right')).toBeUndefined()
  })

  it('ignores a pane that only touches a corner', () => {
    const diagonal = split('column', split('row', leaf(sid('a')), leaf(sid('b'))), leaf(sid('c')))
    // 'a' and 'b' sit side by side; 'c' lies below both of them.
    expect(neighborPath(diagonal, [0, 0], 'right')).toEqual([0, 1])
    // Below 'a' is 'c', which shares an edge — never 'b', which shares a corner.
    expect(neighborPath(diagonal, [0, 0], 'down')).toEqual([1])
    expect(neighborPath(diagonal, [0, 1], 'down')).toEqual([1])
    expect(neighborPath(diagonal, [0, 1], 'right')).toBeUndefined()
  })

  it('prefers the pane sharing more of the edge when the gap is the same', () => {
    // A pane beside a column whose top pane is a sliver: both start at the same
    // edge, and the taller one is the pane the user means.
    const layout = split('row', leaf(sid('left')),
      split('column', leaf(sid('sliver')), leaf(sid('body')), 0.2), 0.4)
    expect(neighborPath(layout, [0], 'right')).toEqual([1, 1])
  })

  it('takes the nearest pane when the gaps differ', () => {
    const layout = split('row', split('row', leaf(sid('a')), leaf(sid('b'))), leaf(sid('c')))
    // 'b' is the next pane over; 'c' overlaps 'a' just as much but is a gap away.
    expect(neighborPath(layout, [0, 0], 'right')).toEqual([0, 1])
  })

  it('finds nothing from a path that is not a pane', () => {
    expect(neighborPath(tree, [], 'right')).toBeUndefined()
    expect(neighborPath(tree, [0, 0], 'right')).toBeUndefined()
  })
})

describe('pane focus', () => {
  const tree = split('row', leaf(sid('a')), split('column', leaf(sid('b')), leaf(sid('c'))))

  it('keeps a focus that addresses a pane', () => {
    expect(focusedPath(tree, [1, 1])).toEqual([1, 1])
  })

  it('reads the empty path of a fresh arrangement as the first pane', () => {
    // `seed` leaves focus empty, and the root of a wide tree is a split; the
    // first pane is what the workspace draws as focused, so it is what actions
    // must act on.
    expect(focusedPath(tree, [])).toEqual([0])
  })

  it('falls back to the first pane when the focused pane is gone', () => {
    expect(focusedPath(tree, [1, 1, 0])).toEqual([0])
    expect(focusedPath(leaf(sid('a')), [])).toEqual([])
  })

  it('walks down the first child to a pane', () => {
    expect(firstLeafPath(tree, [])).toEqual([0])
    expect(firstLeafPath(tree, [1])).toEqual([1, 0])
    expect(firstLeafPath(tree, [1, 0])).toEqual([1, 0])
    expect(firstLeafPath(tree, [0, 0])).toBeUndefined()
  })
})

describe('closing a pane', () => {
  const tree = split('row', leaf(sid('a')), split('column', leaf(sid('b')), leaf(sid('c'))))

  it('promotes the sibling and focuses the pane that took the space', () => {
    const closed = closeAt(tree, [1, 0])
    expect(closed).toBeDefined()
    expect(shownSessions(closed!.tree)).toEqual(['a', 'c'])
    expect(closed!.focus).toEqual([1])
  })

  it('focuses the first pane of the promoted subtree, not the split it replaced', () => {
    // Closing the left pane promotes the whole column to the root.
    const closed = closeAt(tree, [0])
    expect(shownSessions(closed!.tree)).toEqual(['b', 'c'])
    expect(closed!.focus).toEqual([0])
  })

  it('refuses the last pane and paths that are not panes', () => {
    expect(closeAt(leaf(sid('a')), [])).toBeUndefined()
    expect(closeAt(tree, [1])).toBeUndefined()
    expect(closeAt(tree, [0, 0])).toBeUndefined()
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

describe('comparing trees', () => {
  const tree = split('row', leaf(sid('a')), split('column', leaf(sid('b')), leaf(sid('c')), 0.3), 0.6)

  it('accepts a separately built tree with the same arrangement', () => {
    // `reviveTree` rebuilds what it accepts, so a repair has to be recognized as
    // "no change" by value; writing it back anyway would notify subscribers from
    // inside a render effect, which is an update loop.
    const rebuilt = reviveTree(JSON.parse(JSON.stringify(tree)) as unknown, known('a', 'b', 'c'))
    expect(rebuilt).not.toBe(tree)
    expect(sameTree(rebuilt!, tree)).toBe(true)
  })

  it('notices a different Session, axis, ratio, or nesting', () => {
    const inner = (): PaneNode => split('column', leaf(sid('b')), leaf(sid('c')), 0.3)
    const variants = [
      split('row', leaf(sid('z')), inner(), 0.6),
      split('column', leaf(sid('a')), inner(), 0.6),
      split('row', leaf(sid('a')), inner(), 0.5),
      split('row', leaf(sid('a')), split('row', leaf(sid('b')), leaf(sid('c')), 0.3), 0.6),
      // A pane emptied by a repair is a change the caller must write back.
      split('row', leaf(), inner(), 0.6),
    ]
    for (const variant of variants) expect(sameTree(tree, variant)).toBe(false)
    expect(sameTree(leaf(sid('a')), leaf(sid('a')))).toBe(true)
    expect(sameTree(leaf(sid('a')), leaf())).toBe(false)
    expect(sameTree(leaf(), tree)).toBe(false)
  })
})

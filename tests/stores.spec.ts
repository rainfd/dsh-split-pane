/**
 * The shared split store.
 *
 * Three entry points act on one tree: the workspace panel, the conversation
 * header's New split button, and the keyboard shortcut. The header can act
 * before the panel has ever rendered, so the store — not the component — owns
 * the arrangement.
 */
import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSplitPaneStore } from '../src/client/stores.ts'
import { leaf, paneCount, panes, samePath, split } from '../src/client/contract/layout.ts'

const sid = (value: string): SessionId => value as SessionId

/**
 * Create a store with one seeded anchor.
 * @returns the store instance and the anchor id.
 */
function bench() {
  const anchor = sid('anchor')
  const instance = createSplitPaneStore().create()
  instance.actions.seed(anchor, leaf(anchor))
  return { instance, anchor }
}

/**
 * The Sessions shown in the anchor's tree, in reading order.
 * @param instance - the store instance.
 * @param anchor - the anchoring Session.
 * @returns the shown Session ids, with `undefined` for empty panes.
 */
function shown(instance: ReturnType<typeof bench>['instance'], anchor: SessionId) {
  const arrangement = instance.getSnapshot().byAnchor[anchor]
  if (arrangement === undefined) return undefined
  return panes(arrangement.tree).map(pane => pane.sessionId)
}

describe('seeding', () => {
  it('starts with no arrangement for any anchor', () => {
    const instance = createSplitPaneStore().create()
    expect(instance.getSnapshot().byAnchor).toEqual({})
  })

  it('seeds one anchor with a single pane and no focus', () => {
    const { instance, anchor } = bench()
    expect(shown(instance, anchor)).toEqual([anchor])
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([])
  })
})

describe('addPane', () => {
  it('splits the focused pane and focuses the new half', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('second'), 'column')
    expect(shown(instance, anchor)).toEqual([anchor, 'second'])
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([1])
  })

  it('seats an empty pane when no Session is supplied yet', () => {
    const { instance, anchor } = bench()
    // The header creates a pane first and fills it when the Session resolves.
    instance.actions.addPane(anchor, undefined, undefined, 'row')
    expect(shown(instance, anchor)).toEqual([anchor, undefined])
  })

  it('extends the focused pane, so repeated presses nest rather than replace', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('a'), 'column')
    instance.actions.addPane(anchor, undefined, sid('b'), 'column')
    // Focus followed each new pane, so the third lands beside the second.
    expect(shown(instance, anchor)).toEqual([anchor, 'a', 'b'])
    expect(paneCount(instance.getSnapshot().byAnchor[anchor]!.tree)).toBe(3)
  })

  it('splits the pane named by the path, not the focused one', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('a'), 'column')
    // Focus is now [1]; the caller still asks for the left pane.
    instance.actions.addPane(anchor, [0], sid('b'), 'row')
    // The named pane keeps the leading half; the new pane takes the second.
    expect(shown(instance, anchor)).toEqual([anchor, 'b', 'a'])
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([0, 1])
  })

  it('seeds the anchor itself when the store has no arrangement yet', () => {
    const instance = createSplitPaneStore().create()
    const fresh = sid('fresh')
    // The header can fire before the panel rendered; the action must still work.
    instance.actions.addPane(fresh, undefined, sid('new'), 'row')
    expect(shown(instance, fresh)).toEqual([fresh, 'new'])
  })

  it('splits the first pane when focus addresses the root of a wide tree', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('a'), 'column')
    // Reloading the workspace seeds the stored tree; `seed` leaves focus empty,
    // and in a two-pane tree the empty path is the root — a split, not a pane.
    instance.actions.seed(anchor, instance.getSnapshot().byAnchor[anchor]!.tree)
    instance.actions.addPane(anchor, undefined, sid('b'), 'column')
    // Splitting the addressed node would nest the entire workspace in one half.
    expect(shown(instance, anchor)).toEqual([anchor, 'b', 'a'])
    expect(paneCount(instance.getSnapshot().byAnchor[anchor]!.tree)).toBe(3)
  })
})

describe('showInPane', () => {
  it('replaces one pane without touching its sibling', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.showInPane(anchor, [1], sid('c'))
    expect(shown(instance, anchor)).toEqual([anchor, 'c'])
  })

  it('empties a pane when given no Session', () => {
    const { instance, anchor } = bench()
    // A single-pane tree is addressed by the empty path: the leaf is the root.
    instance.actions.showInPane(anchor, [], undefined)
    expect(shown(instance, anchor)).toEqual([undefined])
  })

  it('focuses the pane it fills', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.showInPane(anchor, [0], sid('c'))
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([0])
  })

  it('ignores an unseeded anchor', () => {
    const { instance } = bench()
    instance.actions.showInPane(sid('other'), [0], sid('x'))
    expect(instance.getSnapshot().byAnchor[sid('other')]).toBeUndefined()
  })
})

describe('closePane', () => {
  it('promotes the sibling when a pane closes', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.closePane(anchor, [1])
    expect(shown(instance, anchor)).toEqual([anchor])
  })

  it('keeps the last pane', () => {
    const { instance, anchor } = bench()
    instance.actions.closePane(anchor, [])
    expect(shown(instance, anchor)).toEqual([anchor])
  })

  it('moves focus to the parent after a close', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.closePane(anchor, [1])
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([])
  })

  it('focuses the pane that took over the closed space', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.addPane(anchor, [1], sid('c'), 'column')
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([1, 1])
    instance.actions.closePane(anchor, [1, 1])
    expect(shown(instance, anchor)).toEqual([anchor, 'b'])
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([1])
  })

  it('leaves the arrangement alone when the path is not a pane', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    const before = instance.getSnapshot().byAnchor[anchor]
    // The root of a two-pane tree is a split, so there is nothing to close; the
    // focus must not be rewritten to the empty path either.
    instance.actions.closePane(anchor, [])
    expect(instance.getSnapshot().byAnchor[anchor]).toEqual(before)
  })
})

describe('focus and ratio', () => {
  it('records the focused pane', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.setFocus(anchor, [0])
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([0])
  })

  it('clamps a divider drag into the allowed band', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.setRatio(anchor, [], 0.99)
    const arrangement = instance.getSnapshot().byAnchor[anchor]!
    expect(arrangement.tree.kind === 'split' && arrangement.tree.ratio).toBe(0.85)
  })

  it('leaves focus alone when a divider moves', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.setRatio(anchor, [], 0.3)
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([1])
  })
})

describe('anchors are independent', () => {
  it('keeps one arrangement per anchoring Session', () => {
    const instance = createSplitPaneStore().create()
    const first = sid('first')
    const second = sid('second')
    instance.actions.seed(first, leaf(first))
    instance.actions.seed(second, split('row', leaf(second), leaf(sid('x'))))
    expect(shown(instance, first)).toEqual(['first'])
    expect(shown(instance, second)).toEqual(['second', 'x'])
  })

  it('does not carry one arrangement into another', () => {
    const instance = createSplitPaneStore().create()
    const first = sid('first')
    const second = sid('second')
    instance.actions.addPane(first, undefined, sid('a'), 'row')
    // The second anchor was never seeded, so it has no arrangement at all.
    expect(instance.getSnapshot().byAnchor[second]).toBeUndefined()
  })
})

describe('setTree', () => {
  it('keeps the focus when the focused pane still exists', () => {
    const { instance, anchor } = bench()
    instance.actions.addPane(anchor, undefined, sid('b'), 'row')
    instance.actions.setTree(anchor, split('row', leaf(anchor), leaf(sid('c'))))
    expect(instance.getSnapshot().byAnchor[anchor]?.focus).toEqual([1])
    expect(shown(instance, anchor)).toEqual([anchor, 'c'])
  })

  it('does not resurrect a focus for an anchor that was never seeded', () => {
    const { instance } = bench()
    const fresh = sid('fresh')
    instance.actions.setTree(fresh, leaf(fresh))
    expect(instance.getSnapshot().byAnchor[fresh]?.focus).toEqual([])
  })
})

describe('path addressing', () => {
  it('treats equal paths as the same pane', () => {
    expect(samePath([1, 0], [1, 0])).toBe(true)
    expect(samePath([1, 0], [0, 1])).toBe(false)
  })
})

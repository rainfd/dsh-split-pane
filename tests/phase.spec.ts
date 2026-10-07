/**
 * The phase one pane's Conversation body renders in.
 *
 * The phase decides between the settling skeleton, the transcript, and the
 * blank-Session shell. The Hero flag is the exception the panes need: the Hero
 * carries single-occurrence slots (the workspace picker and the brand mark are
 * single at root scope), so a pane must never draw it — the main panel owns
 * those slots. This suite pins that flag down.
 */
import { describe, expect, it } from 'vitest'
import type { SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { panePhase } from '../src/client/panes/phase.ts'

/**
 * Build a Session snapshot from the fields the phase reads.
 * @param overrides - lifecycle fields to set.
 * @returns the snapshot.
 */
function session(overrides: Partial<Record<string, unknown>> = {}): SessionSnapshot {
  return {
    blank: false, awaitingFirstTurn: false, running: false, promptAttempted: false,
    openState: 'open', ...overrides,
  } as unknown as SessionSnapshot
}

/**
 * Build a Conversation snapshot with `count` active targets.
 * @param count - how many targets are active.
 * @returns the snapshot.
 */
function conversation(count: number): ConversationSnapshot {
  return {
    views: { get: () => undefined, grouped: () => undefined },
    activeTargets: new Set(Array.from({ length: count }, (_, index) => `target-${index}`)),
  } as unknown as ConversationSnapshot
}

describe('panePhase', () => {
  it('settles before a Session binding exists', () => {
    expect(panePhase(undefined, undefined)).toEqual({ phase: 'settling', hero: false })
    expect(panePhase(session(), undefined)).toEqual({ phase: 'settling', hero: false })
  })

  it('settles while a non-blank Session is still opening', () => {
    const opening = session({ blank: false, awaitingFirstTurn: true, openState: 'loading' })
    expect(panePhase(opening, conversation(0)).phase).toBe('settling')
  })

  it('reads a blank Session as the blank phase', () => {
    const blank = session({ blank: true, awaitingFirstTurn: true, openState: 'open' })
    expect(panePhase(blank, conversation(0)).phase).toBe('hero')
  })

  it('reads a Session with conversation activity as active', () => {
    const blank = session({ blank: true, awaitingFirstTurn: true })
    expect(panePhase(blank, conversation(1)).phase).toBe('active')
  })

  it('reads a Session that has left its first turn behind as active', () => {
    expect(panePhase(session({ awaitingFirstTurn: false }), conversation(0)).phase).toBe('active')
    expect(panePhase(session({ running: true }), conversation(0)).phase).toBe('active')
    expect(panePhase(session({ blank: true, promptAttempted: true }), conversation(0)).phase).toBe('active')
  })

  it('never asks a pane for the Hero, whatever the phase', () => {
    // A pane drawing the Hero renders root-scope single slots a second time.
    const cases = [
      panePhase(undefined, undefined),
      panePhase(session({ blank: true, awaitingFirstTurn: true }), conversation(0)),
      panePhase(session(), conversation(0)),
    ]
    for (const resolved of cases) expect(resolved.hero).toBe(false)
  })
})

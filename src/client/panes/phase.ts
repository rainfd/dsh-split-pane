/**
 * Conversation phase derivation for one pane.
 *
 * The shared Conversation assembly draws the empty hero, a settling skeleton,
 * or the transcript, and it reads that decision from its Factory input. Only the
 * pane knows which Session it holds, so each pane computes its own phase.
 */
// Type-only: pulls the declaration merges this file's standard props rely on.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-ui-conversation/client'

/** The Factory input a pane's phase resolves to. */
export interface PanePhase {
  readonly phase: 'settling' | 'hero' | 'active'
  /**
   * Always false: a pane never draws the blank-Session Hero.
   *
   * The Hero carries single-occurrence slots — the workspace picker and the
   * brand mark are `kind: 'single'` at root scope, and the agent-preset control
   * is single at session-maybe scope, which a blank Session resolves to the root
   * occurrence. A single slot may be rendered in one place at a time, so a
   * second pane drawing the Hero makes those entries fight over their
   * occurrence: React reports "maximum update depth exceeded" once per entry,
   * per pane. Panes therefore draw the composer, which is what a User types
   * into anyway, and the main panel keeps ownership of the Hero.
   */
  readonly hero: false
}

/**
 * Derive the Conversation phase for one Session.
 * @param session - that Session's lifecycle snapshot.
 * @param conversation - that Session's Conversation snapshot.
 * @returns the phase the Factory takes, with the panes' hero flag.
 */
export function panePhase(
  session: SessionSnapshot | undefined,
  conversation: ConversationSnapshot | undefined,
): PanePhase {
  if (session === undefined || conversation === undefined) {
    return { phase: 'settling', hero: false }
  }
  const active = conversation.activeTargets.size > 0
    || (!session.blank && !session.awaitingFirstTurn)
    || session.running
  const shell = active ? 'active' : session.promptAttempted ? 'engaging' : 'blank'
  const settling = shell === 'blank' && session.openState === 'loading' && !session.blank
  const blank = shell === 'blank' && (session.openState === 'open' || session.blank)
  return { phase: settling ? 'settling' : blank ? 'hero' : 'active', hero: false }
}

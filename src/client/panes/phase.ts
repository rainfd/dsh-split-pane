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
  readonly hero: boolean
}

/**
 * Derive the Conversation phase for one Session.
 * @param session - that Session's lifecycle snapshot.
 * @param conversation - that Session's Conversation snapshot.
 * @returns the phase and hero flag the Factory takes.
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
  const hero = shell === 'blank' && (session.openState === 'open' || session.blank)
  return { phase: settling ? 'settling' : hero ? 'hero' : 'active', hero }
}

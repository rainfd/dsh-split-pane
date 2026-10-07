/**
 * A pane host: retention for one pane's Session, then the session-scope body.
 *
 * Retention lives here rather than in the workspace so each pane owns exactly
 * one reference for exactly as long as it is mounted. Closing a pane releases
 * only that pane's reference, which is what lets several panes show different
 * Sessions without sharing a generation.
 *
 * The host draws no chrome of its own: it receives the already-drawn frame and
 * supplies only the body, so an empty pane keeps the controls its frame holds.
 */
import type { ReactNode } from 'react'
import type { SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionProviderComponent } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'

/** Props of one pane host. */
export interface PaneHostProps {
  /** Session this pane shows; `undefined` renders the empty branch. */
  readonly sessionId: string | undefined
  /** Identity of this occurrence, so a replacement Session remounts its body. */
  readonly occurrenceKey: string
  /** Retains one Session generation and releases it on teardown. */
  readonly retain: (sessionId: string, signal: AbortSignal) => SessionReference
  readonly SessionProvider: SessionProviderComponent
  /** Renders the `split.pane` occurrence, addressed to this pane's Session. */
  readonly renderBody: () => ReactNode
  /** Drawn when the pane holds no Session, or while its reference opens. */
  readonly empty: ReactNode
}

/**
 * Retain one pane's Session and render its body.
 * @param props - the pane's Session, its retention face, and render seats.
 * @returns the pane body inside a `SessionProvider`, or the empty branch.
 */
export function PaneHost({
  sessionId, occurrenceKey, retain, SessionProvider, renderBody, empty,
}: PaneHostProps): ReactNode {
  const [reference, setReference] = useState<SessionReference | undefined>()

  useEffect(() => {
    if (sessionId === undefined) {
      setReference(undefined)
      return
    }
    const controller = new AbortController()
    const next = retain(sessionId, controller.signal)
    setReference(next)
    return () => {
      controller.abort()
      next.release()
      setReference(current => (current === next ? undefined : current))
    }
  }, [retain, sessionId, occurrenceKey])

  if (sessionId === undefined || reference === undefined) return <>{empty}</>
  return (
    <SessionProvider session={reference} empty={() => <>{empty}</>}>
      {renderBody()}
    </SessionProvider>
  )
}

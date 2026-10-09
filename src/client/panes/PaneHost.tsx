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
  if (sessionId === undefined) return <>{empty}</>
  return (
    // Keyed by the Session, so re-pointing the pane unmounts the old body and
    // the reference it was rendering before the new one mounts. React runs the
    // old cleanup and the new setup in one commit, and a released reference
    // throws on `binding`: without the key the previous body could still render
    // a frame against the reference this pane just let go.
    <PaneSession
      key={`${occurrenceKey}:${sessionId}`}
      sessionId={sessionId}
      retain={retain}
      SessionProvider={SessionProvider}
      renderBody={renderBody}
      empty={empty}
    />
  )
}

/** Props of one pane's retained Session occurrence. */
interface PaneSessionProps {
  readonly sessionId: string
  readonly retain: PaneHostProps['retain']
  readonly SessionProvider: SessionProviderComponent
  readonly renderBody: () => ReactNode
  readonly empty: ReactNode
}

/**
 * Hold one Session generation for as long as this occurrence is mounted.
 * @param props - the Session to retain, the retention face, and render seats.
 * @returns the pane body inside a `SessionProvider`.
 */
function PaneSession({
  sessionId, retain, SessionProvider, renderBody, empty,
}: PaneSessionProps): ReactNode {
  const [reference] = useState(() => {
    const controller = new AbortController()
    const held = retain(sessionId, controller.signal)
    // Released by the unmount below; the controller only cancels a pending
    // open, so it is aborted with the same boundary.
    return { held, controller }
  })
  useEffect(() => () => {
    reference.controller.abort()
    reference.held.release()
  }, [reference])

  return (
    <SessionProvider session={reference.held} empty={() => <>{empty}</>}>
      {renderBody()}
    </SessionProvider>
  )
}

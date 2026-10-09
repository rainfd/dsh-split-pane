/**
 * One pane's body: the Conversation occurrence for the Session this pane was
 * addressed to.
 *
 * The workspace renders this inside `SessionProvider session={...}`, so the
 * standard Session kit (`sessionId`, `useSession`, `useConversation`) already
 * points at this pane's own Session. That is why a pane body is a child slot
 * rather than inline JSX: addressing a Factory occurrence to an arbitrary
 * Session requires a session-scope render position.
 *
 * The pane's chrome lives outside this component, so nothing here draws
 * controls that must outlive a missing Session.
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
import type { ReactNode } from 'react'
import type { PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { panePhase } from './phase.ts'
import css from './SplitPane.module.css'

/** Props of one pane body: its Session kit and the render seats. */
export type PaneBodyProps = PropsRuntime<'split.pane'> & PropsRenderFactories

/**
 * Render one pane's Conversation body.
 * @param props - this pane's own Session kit and render seats.
 * @returns the body element.
 */
export function PaneBody({ useSession, useConversation, renderFactorySlot }: PaneBodyProps): ReactNode {
  const session = useSession(value => value)
  const conversation = useConversation(value => value)
  const { phase, hero } = panePhase(session, conversation)
  return (
    <div className={css.paneBody} data-split-pane-body="">
      <PaneHeader renderFactorySlot={renderFactorySlot} />
      <div className={css.paneContent} data-split-pane-content="">
        {renderFactorySlot('conversation.content', {
          variant: 'embedded', phase, hero,
        })}
      </div>
    </div>
  )
}

/**
 * Render one pane's Conversation header.
 *
 * Each pane draws the Session's own header — title, mode, View tabs and the
 * utilities row — so a split keeps the interface it had before it was split,
 * rather than trading the header for bare chrome rows.
 *
 * The header became a Component Factory on the shell side precisely to make
 * this possible: a slot may only be rendered by the entry that declared it, and
 * a pane is another render position. The locally built shell carries the
 * definition while the published `dsh-client-ui-conversation` types predate it,
 * so the name is widened once here.
 * @param props - this occurrence's Session kit and render seats.
 * @returns the header occurrence for the pane's own Session.
 */
export function PaneHeader({ renderFactorySlot }: Pick<PaneBodyProps, 'renderFactorySlot'>): ReactNode {
  const renderHeader = renderFactorySlot as unknown as (
    name: 'conversation.header', input: object,
  ) => ReactNode
  return <div className={css.paneHeader} data-split-pane-header="">{renderHeader('conversation.header', {})}</div>
}

/**
 * The split workspace's declarations: its `main` panel key, the session-scope
 * child slot one pane body occupies, its reference-source label, and its
 * dictionary namespace.
 *
 * The pane slot is what makes a pane a first-class Conversation occurrence: the
 * workspace addresses one occurrence per pane through `SessionProvider`, and
 * this session-scope declaration is what gives that occurrence a real Session
 * binding (`sessionId`, `useSession`, `useConversation`).
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
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** The `main` panel key this plugin claims; `ctx.layout.selectPanel` selects it. */
export const SPLIT_PANEL_ID = 'split' as MainPanelId

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** A split pane's own hold on the Session it displays. */
    splitPane: unknown
  }
}

/** Owner props the workspace passes to one pane occurrence. */
export interface SplitPaneOwnerProps {
  /** This pane's path from the tree root; the pane's stable identity. */
  readonly path: readonly number[]
  /** Whether this pane holds focus. */
  readonly focused: boolean
  /** Whether another pane may be added. */
  readonly canSplit: boolean
  /** Split this pane, seating a new empty pane after it. */
  readonly onSplit: () => void
  /** Close this pane, promoting its sibling. */
  readonly onClose: () => void
  /** Sessions eligible for this pane's selector, in workspace order. */
  readonly choices: readonly { readonly id: SessionId; readonly title: string }[]
  /** Show another Session, or none, in this pane. */
  readonly onSelect: (sessionId: SessionId | undefined) => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * One pane body, rendered inside the workspace's `SessionProvider` for the
     * Session that occurrence was addressed to.
     */
    'split.pane': { kind: 'single'; scope: 'session'; owner: SplitPaneOwnerProps }
  }

  interface LocaleNamespaceMap {
    /** Split workspace copy. */
    'splitPane': import('../locales.ts').SplitPaneKey
  }
}

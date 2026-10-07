/**
 * The sidebar's panel icon for the split workspace.
 */
import type { ReactNode } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the sidebar's `sidebar.panellist` declaration merge.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Draw the split workspace's panel icon: a panel divided by a vertical seam.
 * @param props.size - the square edge the sidebar allocates.
 * @returns the icon element.
 */
export function SplitIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      aria-hidden
    >
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M8 2.5v11" />
    </svg>
  )
}

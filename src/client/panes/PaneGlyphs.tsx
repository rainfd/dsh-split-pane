/**
 * Pane chrome glyphs.
 *
 * The split controls draw the *result*, not an arrow: a pane divided by a
 * vertical seam means "a second pane beside this one", and a horizontal seam
 * means "a second pane below it". An arrow glyph reads as a direction the user
 * has to translate — the first version used ⬌ and ⬍, which say nothing about
 * which way the workspace ends up divided.
 *
 * The shapes follow the header's own split glyph: a rounded panel outline with
 * the seam, at the same 16-unit grid, drawn with `currentColor` so the buttons
 * keep the host's color treatment.
 */
import type { ReactNode } from 'react'

/**
 * Draw a pane divided into two columns: the result of splitting to the right.
 * @returns the glyph element.
 */
export function SplitRightGlyph(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <path d="M8 3v10" />
    </svg>
  )
}

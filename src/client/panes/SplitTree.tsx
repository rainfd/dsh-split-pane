/**
 * The split tree renderer: dividers between children and one pane per leaf.
 *
 * Rendering is depth-first over the layout model, so the tree may nest to any
 * depth. Each divider owns its drag; the ratio it reports is committed to the
 * model by the workspace that owns the tree.
 */
import { useCallback, type ReactNode } from 'react'
import type { PaneNode } from '../contract/layout.ts'
import css from './SplitPane.module.css'

/** What every pane in the tree renders from, minus its own path and Session. */
export interface SplitTreeContext {
  /** Drawn for one leaf; the tree supplies the path. */
  readonly renderPane: (path: readonly number[]) => ReactNode
  /** Commit a divider drag for the split at the given path. */
  readonly onRatio: (path: readonly number[], ratio: number) => void
}

/**
 * One draggable divider.
 * @param props.axis - which way the parent splits.
 * @param props.onRatio - receives the new share for the first child.
 * @returns the divider element.
 */
function Divider({ axis, onRatio }: {
  readonly axis: 'row' | 'column'
  readonly onRatio: (ratio: number) => void
}): ReactNode {
  const drag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const parent = event.currentTarget.parentElement
    if (parent === null) return
    const box = parent.getBoundingClientRect()
    const done = (): void => {
      globalThis.removeEventListener('pointermove', move)
      globalThis.removeEventListener('pointerup', done)
      globalThis.removeEventListener('pointercancel', done)
    }
    const move = (moveEvent: PointerEvent): void => {
      const ratio = axis === 'row'
        ? (moveEvent.clientX - box.left) / Math.max(1, box.width)
        : (moveEvent.clientY - box.top) / Math.max(1, box.height)
      onRatio(ratio)
    }
    event.preventDefault()
    // The divider is 7px wide; a pointer capture on it survives leaving the box.
    event.currentTarget.setPointerCapture(event.pointerId)
    globalThis.addEventListener('pointermove', move)
    globalThis.addEventListener('pointerup', done)
    globalThis.addEventListener('pointercancel', done)
  }, [axis, onRatio])
  return (
    <div
      className={axis === 'row' ? css.dividerRow : css.dividerColumn}
      role="separator"
      aria-orientation={axis === 'row' ? 'vertical' : 'horizontal'}
      onPointerDown={drag}
      data-split-divider={axis}
    />
  )
}

/**
 * Render one node of the split tree.
 * @param props.node - the subtree to render.
 * @param props.path - that subtree's path from the root.
 * @param props.context - pane renderer and intents.
 * @returns the subtree element.
 */
export function SplitTree({ node, path, context }: {
  readonly node: PaneNode
  readonly path: readonly number[]
  readonly context: SplitTreeContext
}): ReactNode {
  if (node.kind === 'pane') return <>{context.renderPane(path)}</>
  const first = [...path, 0]
  const second = [...path, 1]
  return (
    <div
      className={node.axis === 'row' ? css.groupRow : css.groupColumn}
      data-split-group={node.axis}
      data-split-path={path.join('.')}
    >
      <div className={css.child} style={{ flexGrow: node.ratio, flexBasis: 0 }}>
        <SplitTree node={node.first} path={first} context={context} />
      </div>
      <Divider
        axis={node.axis}
        onRatio={(ratio) => { context.onRatio(path, ratio) }}
      />
      <div className={css.child} style={{ flexGrow: 1 - node.ratio, flexBasis: 0 }}>
        <SplitTree node={node.second} path={second} context={context} />
      </div>
    </div>
  )
}

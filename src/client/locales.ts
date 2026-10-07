/**
 * `splitPane` namespace dictionaries: the panel label, the per-pane chrome, and
 * every message the split workspace shows.
 */

/** Dictionary namespace owned by this plugin. */
export const NS = 'splitPane'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.label': '分屏',
  'panel.aria': '打开分屏工作区',
  'pane.empty': '空面板',
  'pane.selectSession': '选择会话',
  'pane.close': '关闭此面板',
  'pane.split.right': '向右分屏',
  'pane.split.down': '向下分屏',
} as const

/** English dictionary. */
export const en: Record<keyof typeof zh, string> = {
  'panel.label': 'Split',
  'panel.aria': 'Open the split workspace',
  'pane.empty': 'Empty pane',
  'pane.selectSession': 'Select a session',
  'pane.close': 'Close this pane',
  'pane.split.right': 'Split right',
  'pane.split.down': 'Split down',
}

/** Keys of this plugin's dictionary. */
export type SplitPaneKey = keyof typeof zh

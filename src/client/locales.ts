/**
 * `splitPane` namespace dictionaries: the header entry, the panel label, the
 * shortcut row, the per-pane chrome, and every message the split workspace
 * shows.
 */

/** Dictionary namespace owned by this plugin. */
export const NS = 'splitPane'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'entry.label': '新分屏',
  'entry.aria': '在分屏中新建会话',
  'shortcut.label': '在分屏中新建会话',
  'shortcut.alias.split': '分屏',
  'shortcut.alias.sideBySide': '并排对话',
  'shortcut.noWorkspace': '当前没有可用工作区',
  'panel.label': '分屏',
  'panel.aria': '打开分屏工作区',
  'pane.empty': '空面板',
  'pane.selectSession': '选择会话',
  'pane.close': '关闭此面板',
  'pane.split.right': '向右分屏',
  'pane.split.down': '向下分屏',
  'pane.new': '新会话',
} as const

/** English dictionary. */
export const en: Record<keyof typeof zh, string> = {
  'entry.label': 'New split',
  'entry.aria': 'New session in a split pane',
  'shortcut.label': 'New session in split',
  'shortcut.alias.split': 'split',
  'shortcut.alias.sideBySide': 'side by side',
  'shortcut.noWorkspace': 'No workspace is available',
  'panel.label': 'Split',
  'panel.aria': 'Open the split workspace',
  'pane.empty': 'Empty pane',
  'pane.selectSession': 'Select a session',
  'pane.close': 'Close this pane',
  'pane.split.right': 'Split right',
  'pane.split.down': 'Split down',
  'pane.new': 'New session',
}

/** Keys of this plugin's dictionary. */
export type SplitPaneKey = keyof typeof zh

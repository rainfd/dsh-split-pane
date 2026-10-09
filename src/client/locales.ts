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
  'shortcut.split.right': '向右分屏并新建会话',
  'shortcut.alias.split': '分屏',
  'shortcut.alias.splitRight': '向右分屏',
  'shortcut.alias.sideBySide': '并排对话',
  'shortcut.alias.pane': '面板',
  'shortcut.alias.focus': '切换焦点',
  'shortcut.alias.left': '左',
  'shortcut.alias.right': '右',
  'shortcut.alias.up': '上',
  'shortcut.alias.down': '下',
  'shortcut.focus.left': '焦点移到左侧面板',
  'shortcut.focus.right': '焦点移到右侧面板',
  'shortcut.focus.up': '焦点移到上方面板',
  'shortcut.focus.down': '焦点移到下方面板',
  'shortcut.close': '关闭当前面板',
  'shortcut.lastPane': '只剩一个面板，无法关闭',
  'shortcut.noWorkspace': '当前没有可用工作区',
  'panel.label': '分屏',
  'panel.aria': '打开分屏工作区',
  'pane.empty': '空面板',
  'pane.selectSession': '选择会话',
  'pane.close': '关闭此面板',
  'pane.split.right': '向右分屏',
  'pane.new': '新会话',
} as const

/** English dictionary. */
export const en: Record<keyof typeof zh, string> = {
  'entry.label': 'New split',
  'entry.aria': 'New session in a split pane',
  'shortcut.split.right': 'New session in a pane to the right',
  'shortcut.alias.split': 'split',
  'shortcut.alias.splitRight': 'split right',
  'shortcut.alias.sideBySide': 'side by side',
  'shortcut.alias.pane': 'pane',
  'shortcut.alias.focus': 'focus',
  'shortcut.alias.left': 'left',
  'shortcut.alias.right': 'right',
  'shortcut.alias.up': 'up',
  'shortcut.alias.down': 'down',
  'shortcut.focus.left': 'Focus the pane on the left',
  'shortcut.focus.right': 'Focus the pane on the right',
  'shortcut.focus.up': 'Focus the pane above',
  'shortcut.focus.down': 'Focus the pane below',
  'shortcut.close': 'Close the focused pane',
  'shortcut.lastPane': 'The last pane cannot be closed',
  'shortcut.noWorkspace': 'No workspace is available',
  'panel.label': 'Split',
  'panel.aria': 'Open the split workspace',
  'pane.empty': 'Empty pane',
  'pane.selectSession': 'Select a session',
  'pane.close': 'Close this pane',
  'pane.split.right': 'Split right',
  'pane.new': 'New session',
}

/** Keys of this plugin's dictionary. */
export type SplitPaneKey = keyof typeof zh

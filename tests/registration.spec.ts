// @vitest-environment jsdom
/**
 * Plugin registration against a minimal Cordis context.
 *
 * The monorepo's slot test runtime is not usable outside the repository (its
 * published build imports `ui-renderer/src/*`, which is not shipped), so this
 * suite drives `apply` with a stub context. It asserts what the plugin declares
 * and what its entry points actually do: the conversation header button and the
 * keyboard shortcuts create, move between, and close panes.
 *
 * jsdom is here for the pane commands alone: moving focus also hands the
 * browser's focus to the pane it lands on.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { apply, inject } from '../src/client/index.ts'
import { SPLIT_PANEL_ID } from '../src/client/contract/slots.ts'
import { leaf } from '../src/client/contract/layout.ts'
import type { SplitPaneActions, SplitPaneState } from '../src/client/stores.ts'
import { NS, en, zh } from '../src/client/locales.ts'

afterEach(() => { document.body.replaceChildren() })

interface Registration {
  readonly name: string
  readonly options: Record<string, unknown>
  readonly component: unknown
}

/** The shape `apply` registers with `ctx.shortcuts`. */
interface RegisteredCommand {
  readonly id: string
  readonly label: () => string
  readonly aliases: readonly string[]
  readonly defaults: Record<string, { code: string; modifiers: readonly string[] }>
  readonly regions: readonly string[]
  readonly resolve: (context: unknown) => { status: string } & Record<string, unknown>
}

/**
 * Run `apply` against a stub context that records everything it registers.
 * @param options - overrides for what the stub services answer.
 * @returns the recorded registrations, the opened panels, and the inject faces.
 */
function bench(options: {
  readonly current?: string
  readonly activePanelId?: string
  readonly workspaces?: readonly {
    workspaceId: string
    path: string
    sessionIds: readonly string[]
  }[]
} = {}) {
  const registrations: Registration[] = []
  const dictionaries: Record<string, unknown>[] = []
  const commands: RegisteredCommand[] = []
  const selectedPanels: unknown[] = []
  const created = 0
  const faces: Record<string, unknown>[] = []
  const catalog = { getSnapshot: () => [], subscribe: () => () => {} }
  let counter = created

  const stub = {
    effect: (install: () => unknown) => { install(); return () => {} },
    locale: {
      register: (namespace: string, dictionary: unknown) => {
        dictionaries.push({ [namespace]: dictionary })
        return () => {}
      },
      bind: (namespace: string) => (key: string) => `${namespace}.${key}`,
    },
    slots: {
      // `inject` runs the contribution once, as the real registry does when the
      // owner declaration is present. A contribution that yields several
      // registrations is a generator (cordis registers each yielded disposer),
      // so drain it rather than taking only the first value.
      inject: (owner: string, install: () => unknown) => {
        const effect = install()
        if (effect !== null && typeof effect === 'object' && Symbol.iterator in effect) {
          for (const value of effect as Iterable<unknown>) void value
        }
        return () => {}
      },
      register: (options: Record<string, unknown>, component: unknown) => {
        registrations.push({ name: options.name as string, options, component })
        const face = typeof options.inject === 'function'
          ? (options.inject as () => unknown)()
          : undefined
        if (face !== undefined) faces.push(face as Record<string, unknown>)
        return () => {}
      },
    },
    sessions: {
      retain: vi.fn(),
      create: vi.fn(() => {
        counter += 1
        return Promise.resolve(`created-${counter}`)
      }),
    },
    workspaces: {
      list: {
        getSnapshot: () => ({
          phase: 'ready',
          archivedSessionIds: [],
          items: options.workspaces ?? [],
          byId: {},
        }),
        subscribe: () => () => {},
      },
    },
    uiSession: {
      adapter: {
        current: {
          getSnapshot: () => ({ key: options.current }),
          subscribe: () => () => {},
        },
      },
    },
    shortcuts: {
      catalog,
      register: (command: RegisteredCommand) => { commands.push(command); return () => {} },
    },
    layout: {
      selectPanel: (id: unknown) => { selectedPanels.push(id) },
      panelInfo: {
        getSnapshot: () => ({ activePanelId: options.activePanelId ?? null }),
        subscribe: () => () => {},
      },
    },
  } as unknown as Context

  apply(stub)
  return { registrations, dictionaries, commands, selectedPanels, faces, create: stub.sessions.create }
}

/** The face an entry supplies through its registration's `inject`. */
function faceWith(faces: Record<string, unknown>[], key: string): Record<string, unknown> | undefined {
  return faces.find(face => typeof face[key] === 'function')
}

describe('plugin registration', () => {
  it('declares the services it reads', () => {
    expect([...inject]).toEqual([
      'slots', 'locale', 'sessions', 'workspaces', 'uiSession', 'shortcuts', 'layout',
    ])
  })

  it('claims its own main panel key with the pane slot as its session-scope child', () => {
    const { registrations } = bench()
    const panel = registrations.find(entry => entry.name === 'main')
    expect(panel?.options.key).toBe(SPLIT_PANEL_ID)
    // The child declaration is what grants the pane occurrences a Session
    // binding; without it a pane could not be addressed to its own Session.
    expect(panel?.options.children).toEqual({ 'split.pane': { kind: 'single', scope: 'session' } })
  })

  it('registers the pane body, the sidebar entry, and the header entry', () => {
    const { registrations } = bench()
    const names = registrations.map(entry => entry.name)
    expect(names).toContain('split.pane')
    expect(names).toContain('sidebar.panellist')
    // The in-conversation way in, beside the right panel's expand control.
    expect(names).toContain('conversation.session.header.utilities')
    expect(registrations.find(entry => entry.name === 'sidebar.panellist')?.options.id)
      .toBe(SPLIT_PANEL_ID)
  })

  it('shares one arrangement through inject rather than a declared store', () => {
    const { registrations } = bench()
    // A store handle may be mounted under exactly one scope, and these seats
    // span two (`main` is root-scoped, the header entry is session-scoped), so
    // no registration may declare one.
    for (const entry of registrations) expect(entry.options.store).toBeUndefined()
    // The panel and the header entry are wired to the same source instead.
    const panel = registrations.find(entry => entry.name === 'main')
    const header = registrations.find(entry => entry.name === 'conversation.session.header.utilities')
    expect(panel?.options.inject).toBeTypeOf('function')
    expect(header?.options.inject).toBeTypeOf('function')
  })
})

describe('header entry', () => {
  it('creates a Session in the anchor Workspace and selects the split panel', async () => {
    const { selectedPanels, faces, create } = bench({
      current: 'anchor-1',
      workspaces: [{ workspaceId: 'ws-9', path: '/tmp/ws', sessionIds: ['anchor-1'] }],
    })
    const openSplit = faceWith(faces, 'openSplit')?.openSplit as (id: string) => void
    expect(openSplit).toBeDefined()

    openSplit('anchor-1')
    // The panel is selected immediately, so the user lands in the workspace...
    expect(selectedPanels).toEqual([SPLIT_PANEL_ID])
    // ...and the new Session is requested for it.
    // Creating in the anchor's Workspace is what makes the new pane land on a
    // composer instead of the hero's workspace picker.
    expect(create).toHaveBeenCalledWith({ workspaceId: 'ws-9' })
    await vi.waitFor(() => { expect(create).toHaveBeenCalledTimes(1) })
  })

  it('falls back to no Workspace when the anchor belongs to none', () => {
    const { faces, create } = bench({ current: 'orphan' })
    const openSplit = faceWith(faces, 'openSplit')?.openSplit as (id: string) => void
    openSplit('orphan')
    expect(create).toHaveBeenCalledWith({})
  })

  it('does not disturb the Conversation when no anchor Session exists', () => {
    const { selectedPanels, faces, create } = bench()
    const openSplit = faceWith(faces, 'openSplit')?.openSplit as (id: string) => void
    openSplit('anchor-1')
    // The header only renders for a Session, so an anchor is always present;
    // the assertion pins that the action never silently skips the panel.
    expect(create).toHaveBeenCalledTimes(1)
    expect(selectedPanels).toEqual([SPLIT_PANEL_ID])
  })
})

describe('keyboard shortcut', () => {
  /** The command that opens a split, the only one the header also offers. */
  const splitCommand = (commands: RegisteredCommand[]): RegisteredCommand =>
    commands.find(command => command.id === 'splitPane.new')!

  it('registers one command with defaults for desktop and web', () => {
    const { commands } = bench()
    const command = splitCommand(commands)
    expect(Object.keys(command.defaults).sort()).toEqual([
      'desktop:linux', 'desktop:macos', 'desktop:windows', 'web:macos', 'web:windows',
    ])
    // Every profile binds the same physical gesture, so the reference lists one
    // row rather than a per-platform table.
    expect(new Set(Object.values(command.defaults).map(b => `${b.code}:${[...b.modifiers].sort().join('+')}`)))
      .toEqual(new Set(['KeyS:alt+primary']))
    for (const binding of Object.values(command.defaults)) {
      expect(binding.modifiers.length).toBeGreaterThan(0)
    }
    // The header tooltip and the shortcut reference read the same labels.
    expect(command.label()).toBe(`${NS}.shortcut.label`)
    expect([...command.aliases]).toEqual([`${NS}.shortcut.alias.split`, `${NS}.shortcut.alias.sideBySide`])
  })

  it('keeps every default inside the Web binding gate', () => {
    // Copied from `isWebBindingAllowed` in the shortcuts package (not exported
    // from its public entry): outside macOS/Windows the Web gate admits a fixed
    // allowlist, so a `web:linux` row using a letter key is rejected at
    // registration time and takes the whole plugin down with it.
    const webAllowed = (code: string, modifiers: readonly string[], platform: string): boolean => {
      if (platform === 'macos' || platform === 'windows') {
        const primary = platform === 'macos' ? 'primary' : 'primary'
        if (modifiers.length >= 3) return true
        if (modifiers.length === 2 && modifiers.includes(primary)
          && (modifiers.includes('alt') || modifiers.includes('shift'))) return true
        return false
      }
      return [['Slash', ['primary']], ['Comma', ['primary', 'shift']], ['Period', ['primary', 'shift']]]
        .some(([candidate, mods]) => candidate === code
          && [...mods].sort().join() === [...modifiers].sort().join())
    }

    const { commands } = bench()
    for (const command of commands) {
      // Linux Web stays unbound, exactly as the host's own commands leave it.
      expect(Object.keys(command.defaults).some(key => key.startsWith('web:linux'))).toBe(false)
      for (const [profile, binding] of Object.entries(command.defaults)) {
        if (!profile.startsWith('web:')) continue
        const platform = profile.split(':')[1]!
        expect(webAllowed(binding.code, binding.modifiers, platform), `${command.id} ${profile}`).toBe(true)
      }
    }
  })

  it('declares no default the host reserves outside macOS and Windows', () => {
    // Copied from `bindingIssue`: on Linux, for both shells, these codes are
    // rejected outright — and a rejected default throws during registration,
    // which fails the whole plugin rather than dropping one row. Arrow keys are
    // on that list, which is why the pane commands have no Linux default.
    const reserved = new Set([
      'Escape', 'Tab', 'Space', 'Backspace', 'Delete',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    ])
    const { commands } = bench()
    for (const command of commands) {
      for (const [profile, binding] of Object.entries(command.defaults)) {
        const [, platform] = profile.split(':')
        if (platform === 'macos' || platform === 'windows') continue
        expect(reserved.has(binding.code), `${command.id} ${profile}`).toBe(false)
      }
    }
  })

  it('runs the same open action as the header entry', () => {
    const { commands, selectedPanels } = bench({ current: 'anchor-9' })
    const resolution = splitCommand(commands).resolve({})
    expect(resolution.status).toBe('handled')
    ;(resolution.run as () => void)()
    expect(selectedPanels).toEqual([SPLIT_PANEL_ID])
  })

  it('blocks with a reason when no Session is open', () => {
    const { commands } = bench()
    const resolution = splitCommand(commands).resolve({})
    expect(resolution.status).toBe('blocked')
    expect(resolution.reason).toBe(`${NS}.shortcut.noWorkspace`)
  })
})

describe('pane commands', () => {
  const id = (commands: RegisteredCommand[], commandId: string): RegisteredCommand => {
    const found = commands.find(command => command.id === commandId)
    expect(found, commandId).toBeDefined()
    return found!
  }
  const run = (command: RegisteredCommand): string => {
    const resolution = command.resolve({})
    if (resolution.status === 'handled') (resolution.run as () => void)()
    return resolution.status
  }

  /**
   * Read one property off the inject face that carries it.
   * @param faces - the inject faces `apply` produced.
   * @param key - the property to take.
   * @returns that property, typed by the caller; object-shaped faces (the store
   * handle, the hook sources) are not functions, so `faceWith` cannot find them.
   */
  const fromFace = <T>(faces: Record<string, unknown>[], key: string): T => {
    const found = faces.find(face => face[key] !== undefined)
    expect(found, key).toBeDefined()
    return found![key] as T
  }

  /**
   * Seed one anchor with a row of as many panes as asked for.
   * @param faces - the inject faces `apply` produced.
   * @param count - how many panes to build, the anchor first.
   * @returns the anchor and read access to the shared arrangement.
   */
  function layout(faces: Record<string, unknown>[], count: number) {
    const actions = fromFace<SplitPaneActions>(faces, 'layoutActions')
    const hooks = fromFace<{ layout: { getSnapshot: () => SplitPaneState } }>(faces, 'hooks')
    const anchor = 'anchor-1' as SessionId
    actions.seed(anchor, leaf(anchor))
    for (let index = 1; index < count; index += 1) {
      actions.addPane(anchor, undefined, `pane-${index}` as SessionId, 'row')
    }
    return { anchor, actions, state: () => hooks.layout.getSnapshot().byAnchor[anchor] }
  }

  it('adds four navigation commands and one close command beside the split command', () => {
    const { commands } = bench()
    expect(commands.map(command => command.id).sort()).toEqual([
      'splitPane.close', 'splitPane.focusDown', 'splitPane.focusLeft', 'splitPane.focusRight',
      'splitPane.focusUp', 'splitPane.new',
    ])
  })

  it('binds each direction to its own arrow, with copy the reference can search', () => {
    const { commands } = bench()
    const expected = [
      ['splitPane.focusLeft', 'ArrowLeft', `${NS}.shortcut.focus.left`],
      ['splitPane.focusRight', 'ArrowRight', `${NS}.shortcut.focus.right`],
      ['splitPane.focusUp', 'ArrowUp', `${NS}.shortcut.focus.up`],
      ['splitPane.focusDown', 'ArrowDown', `${NS}.shortcut.focus.down`],
    ] as const
    for (const [commandId, code, label] of expected) {
      const command = id(commands, commandId)
      expect(command.label()).toBe(label)
      expect(command.defaults['desktop:macos']).toEqual({ code, modifiers: ['primary', 'alt'] })
      // macOS browsers reserve Command+Option+arrow for tab and toolbar focus,
      // and a browser combination never reaches the page; Command+Shift+arrow
      // is free there and is what the Web side of the convention asks for.
      expect(command.defaults['web:macos']).toEqual({ code, modifiers: ['primary', 'shift'] })
      // Windows keeps the Alt form: Control+Shift+arrow selects words in the
      // composer, and no browser claims Control+Alt+arrow.
      expect(command.defaults['web:windows']).toEqual({ code, modifiers: ['primary', 'alt'] })
      expect(Object.keys(command.defaults)).toHaveLength(4)
      expect([...command.regions]).toEqual(['page', 'editable'])
    }
  })

  it('binds close to the platform modifier with Alt and Backspace', () => {
    const { commands } = bench()
    const command = id(commands, 'splitPane.close')
    expect(Object.keys(command.defaults).sort())
      .toEqual(['desktop:macos', 'desktop:windows', 'web:macos', 'web:windows'])
    for (const binding of Object.values(command.defaults)) {
      expect(binding).toEqual({ code: 'Backspace', modifiers: ['primary', 'alt'] })
    }
    expect(command.label()).toBe(`${NS}.shortcut.close`)
  })

  it('passes every pane command through while the workspace is not on screen', () => {
    // The Conversation, a settings sheet, an embedded page: there the arrows and
    // Backspace belong to whatever has focus, so nothing may be consumed.
    const { commands } = bench({ current: 'anchor-1' })
    for (const command of commands.filter(entry => entry.id !== 'splitPane.new')) {
      expect(command.resolve({}).status, command.id).toBe('pass')
    }
  })

  it('moves focus to the neighbouring pane and hands it the browser focus', () => {
    const { commands, faces } = bench({ current: 'anchor-1', activePanelId: SPLIT_PANEL_ID })
    const { anchor, state } = layout(faces, 2)
    // The pane the command lands on, as the workspace renders it.
    const frame = document.createElement('section')
    frame.dataset.splitPanePath = '0'
    const editable = document.createElement('textarea')
    frame.append(editable)
    document.body.append(frame)
    expect(state()?.focus).toEqual([1])

    expect(run(id(commands, 'splitPane.focusLeft'))).toBe('handled')
    expect(state()?.focus).toEqual([0])
    expect(document.activeElement).toBe(editable)
    // An anchor with no pane that way keeps its focus and consumes the press.
    expect(run(id(commands, 'splitPane.focusLeft'))).toBe('handled')
    expect(state()?.focus).toEqual([0])
  })

  it('closes the focused pane, leaving the sibling in its place', () => {
    const { commands, faces } = bench({ current: 'anchor-1', activePanelId: SPLIT_PANEL_ID })
    const { state } = layout(faces, 2)
    expect(state()?.focus).toEqual([1])

    expect(run(id(commands, 'splitPane.close'))).toBe('handled')
    const arrangement = state()
    expect(arrangement?.tree.kind).toBe('pane')
    expect(arrangement?.focus).toEqual([])
  })

  it('blocks the close command on the last pane', () => {
    const { commands, faces } = bench({ current: 'anchor-1', activePanelId: SPLIT_PANEL_ID })
    layout(faces, 1)
    const resolution = id(commands, 'splitPane.close').resolve({})
    expect(resolution.status).toBe('blocked')
    expect(resolution.reason).toBe(`${NS}.shortcut.lastPane`)
  })
})

describe('dictionary', () => {
  it('installs both languages under the plugin namespace', () => {
    const { dictionaries } = bench()
    expect(dictionaries).toHaveLength(1)
    const parsed = dictionaries[0] as Record<string, { zh: unknown; en: unknown }>
    expect(parsed[NS]?.zh).toBe(zh)
    expect(parsed[NS]?.en).toBe(en)
  })

  it('keeps the two dictionaries on the same key set', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('leaves no empty copy', () => {
    for (const value of Object.values(zh)) expect(value.trim().length).toBeGreaterThan(0)
    for (const value of Object.values(en)) expect(value.trim().length).toBeGreaterThan(0)
  })
})

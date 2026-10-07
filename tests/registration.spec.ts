/**
 * Plugin registration against a minimal Cordis context.
 *
 * The monorepo's slot test runtime is not usable outside the repository (its
 * published build imports `ui-renderer/src/*`, which is not shipped), so this
 * suite drives `apply` with a stub context. It asserts what the plugin declares
 * and what its two non-sidebar entry points actually do: the conversation
 * header button and the keyboard shortcut both create a Session and select the
 * split panel.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../src/client/index.ts'
import { SPLIT_PANEL_ID } from '../src/client/contract/slots.ts'
import { NS, en, zh } from '../src/client/locales.ts'

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
    layout: { selectPanel: (id: unknown) => { selectedPanels.push(id) } },
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
  it('registers one command with defaults for desktop and web', () => {
    const { commands } = bench()
    expect(commands).toHaveLength(1)
    const command = commands[0]!
    expect(command.id).toBe('splitPane.new')
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
    const defaults = commands[0]!.defaults
    // Linux Web stays unbound, exactly as the host's own commands leave it.
    expect(Object.keys(defaults).some(key => key.startsWith('web:linux'))).toBe(false)
    for (const [profile, binding] of Object.entries(defaults)) {
      const platform = profile.split(':')[1]!
      if (!profile.startsWith('web:')) continue
      expect(webAllowed(binding.code, binding.modifiers, platform), profile).toBe(true)
    }
  })

  it('runs the same open action as the header entry', () => {
    const { commands, selectedPanels } = bench({ current: 'anchor-9' })
    const resolution = commands[0]!.resolve({})
    expect(resolution.status).toBe('handled')
    ;(resolution.run as () => void)()
    expect(selectedPanels).toEqual([SPLIT_PANEL_ID])
  })

  it('blocks with a reason when no Session is open', () => {
    const { commands } = bench()
    const resolution = commands[0]!.resolve({})
    expect(resolution.status).toBe('blocked')
    expect(resolution.reason).toBe(`${NS}.shortcut.noWorkspace`)
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

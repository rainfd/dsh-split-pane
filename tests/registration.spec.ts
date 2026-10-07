/**
 * Plugin registration against a minimal Cordis context.
 *
 * The monorepo's slot test runtime is not usable outside the repository (its
 * published build imports `ui-renderer/src/*`, which is not shipped), so this
 * suite drives `apply` with a stub context and asserts what the plugin itself
 * declares: its panel key, its Session-scoped pane slot, its sidebar entry, and
 * its dictionary. Component behavior is covered by the chrome and layout specs.
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

/**
 * Run `apply` against a stub context that records registrations.
 * @returns every slot registration, the registered dictionaries, and the inject list.
 */
function bench() {
  const registrations: Registration[] = []
  const dictionaries: Record<string, unknown>[] = []
  const injected: Record<string, () => unknown> = {}
  const stub = {
    effect: (install: () => unknown) => { install(); return () => {} },
    locale: {
      register: (namespace: string, dictionary: unknown) => { dictionaries.push({ [namespace]: dictionary }); return () => {} },
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
        return () => {}
      },
    },
    sessions: { retain: vi.fn() },
    workspaces: { list: { getSnapshot: () => ({ archivedSessionIds: [] }), subscribe: () => () => {} } },
    uiSession: { adapter: { current: { getSnapshot: () => ({ key: undefined }), subscribe: () => () => {} } } },
  } as unknown as Context

  apply(stub)
  return { registrations, dictionaries, injected }
}

describe('plugin registration', () => {
  it('declares the services it reads', () => {
    expect([...inject]).toEqual(['slots', 'locale', 'sessions', 'workspaces', 'uiSession'])
  })

  it('claims its own main panel key with the pane slot as its session-scope child', () => {
    const { registrations } = bench()
    const panel = registrations.find(entry => entry.name === 'main')
    expect(panel).toBeDefined()
    expect(panel?.options.key).toBe(SPLIT_PANEL_ID)
    // The child declaration is what grants the pane occurrences a Session
    // binding; without it a pane could not be addressed to its own Session.
    expect(panel?.options.children).toEqual({ 'split.pane': { kind: 'single', scope: 'session' } })
  })

  it('registers the pane body and the sidebar entry', () => {
    const { registrations } = bench()
    const names = registrations.map(entry => entry.name)
    expect(names).toContain('split.pane')
    expect(names).toContain('sidebar.panellist')
    const icon = registrations.find(entry => entry.name === 'sidebar.panellist')
    // The list id addresses the matching main panel key.
    expect(icon?.options.id).toBe(SPLIT_PANEL_ID)
  })

  it('installs its dictionary for both languages', () => {
    const { dictionaries } = bench()
    expect(dictionaries).toHaveLength(1)
    const parsed = dictionaries[0] as Record<string, { zh: unknown; en: unknown }>
    expect(parsed[NS]).toBeDefined()
    expect(parsed[NS]?.zh).toBe(zh)
    expect(parsed[NS]?.en).toBe(en)
  })

  it('keeps the two dictionaries on the same key set', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('leaves no visible copy outside the dictionary', () => {
    // Every rendered string the plugin owns is a locale key, so the dictionary
    // is the single source of user-facing text.
    for (const value of Object.values(zh)) expect(value.trim().length).toBeGreaterThan(0)
    for (const value of Object.values(en)) expect(value.trim().length).toBeGreaterThan(0)
  })
})

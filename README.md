---
description: "Web split-pane workspace: several live Sessions side by side in one main panel, each a real Conversation with its own composer."
kind: "package-reference"
---

# dsh-split-pane

English | [中文](README.zh.md)

## Summary

The Web client can show its center column as one Conversation or as a split workspace of several. Each pane is an independent Conversation occurrence addressed to its own Session: it streams, accepts prompts, queues messages, and answers its own `ask_user_question` and approval prompts. Panes split right without a fixed count, every pane keeps the Session's full header, dividers drag, focus moves between panes from the keyboard and the focused pane closes the same way, and the arrangement persists per Session.

## Install

```sh
# from this checkout
dsh plugin --profile web add .

# or from a path / git spec
dsh plugin --profile web add file:/Users/mac/projects/dsh-split-pane
```

Then restart `dsh web`. The sidebar's panel list gains a `Split` entry beside the
Conversation; selecting it swaps the center column for the split workspace.

Requires DeepSeek Harness `0.2.0-rc.2`. The plugin declares that range in
`peerDependencies`, and its DSH imports are type-only, so the browser bundle
resolves every shared module through the shell's own module table.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Use this package

<a id="use-this-package"></a>

There are three ways in, and all three produce the same thing: a new pane holding a **new Session**, in the Workspace the Session you split from belongs to.

**The conversation header button.** While a conversation is open, a split control sits in the header's utilities row beside the right panel's expand control. Pressing it splits the panel you are reading and opens the workspace on the new Session, ready to type into.

**The keyboard.** `Cmd/Ctrl+Alt+S` (`splitPane.new`) opens a new pane beside the focused one, listed in the shortcut reference and shown in the header button's tooltip. Panes divide the centre column sideways, which is how several live Conversations are read at once. On Linux Web no default is bound: the browser-binding gate admits only a fixed allowlist there, and the host's own commands leave Linux Web unbound for the same reason; assign one in the shortcut reference.

**Moving and closing panes from the keyboard.** While the split workspace is the panel on screen, five commands are available: `Cmd/Ctrl+Shift+arrow` on the Web and `Cmd/Ctrl+Alt+arrow` on the desktop move focus to the pane lying in that direction, and `Cmd/Ctrl+Alt+Backspace` closes the focused pane, handing its space and the browser's focus to the pane that takes over. Adjacency is geometric: two panes must share an edge, so a pane that only touches a corner is not one; among the candidates in a direction the nearest wins, and an equal gap prefers the one sharing more of that edge — pressing right from a tall pane beside a column lands in the pane covering most of it. Moving focus also hands the browser's own focus to the target pane's composer, so typing simply continues there. At the edge of the layout a direction key does nothing, but the combination stays the workspace's: it never becomes a caret jump inside the composer. macOS Web uses `Cmd+Shift` rather than `Cmd+Alt`, because Chrome and Firefox spend `Cmd+Option+Left/Right` on switching tabs and `Cmd+Option+Up/Down` on cycling focus between toolbars, and a combination the browser reserves never reaches the page at all. Linux (desktop and Web) carries no default for these five, for the reason under Known Limitations.

**A pane's own split control.** Inside the workspace, every pane's control row carries split-right, which divides that pane and puts a new Session in the right half.

The button is hidden on a brand-new empty conversation, because the host renders no header utilities until a conversation has content. The shortcut and the pane controls work there.

The sidebar's panel list also carries a `Split` entry beside the Conversation. Selecting it swaps the center column for the split workspace without creating anything; selecting the Conversation entry again (or any other main panel) swaps back. The workspace opens on the Session that was already current, so entering it never changes which Session the user was reading.

Every pane draws the Session's **full Conversation header** — title, mode, background tasks, View tabs and utilities, exactly as the main panel did before the split, because splitting adds to the interface rather than replacing it. Under that header sits the pane's own control row: a Session picker, split-right, and close. The Session picker re-points a pane at any existing Session, so a pane is not stuck on the one it was created with. Closing a pane promotes its sibling into the space the pair occupied, and the last remaining pane cannot be closed — an empty workspace has nothing to show. A divider drags to change the shares, bounded so neither side falls below a usable width.

Panes do not share state. Each pane keeps its own Session binding, so a prompt typed in one pane never lands in another; a Session shown in two panes is two independent views of one Session, not one view mirrored. `ask_user_question` and approval prompts are answered in the pane whose Session asked.

The arrangement is stored per anchoring Session: leaving the workspace and returning restores it, and so does a page reload. A stored pane whose Session no longer exists becomes an empty pane rather than disappearing, so a deleted Session costs one pane's content and not the layout around it.

## Understand the implementation

<a id="understand-the-implementation"></a>

### Why panes are a child slot

`conversation.content` is a Component Factory whose occurrences inherit their render-position Session; it does not accept an independently addressed Session (`ui-conversation/README.md`, Known Limitations). Addressing one occurrence to an arbitrary Session therefore requires a session-scope render position, which is why this package declares `split.pane` with `scope: 'session'` and renders one occurrence per pane inside `SessionProvider`.

The `main` slot this package claims is a root-scope keyed slot, so the workspace itself receives no Session binding. It reads the current selection through the `session` scope adapter (`ctx.uiSession.adapter.current`) and re-addresses each pane. `PaneHost` owns that per-pane work: it retains one `sessions.retain()` reference for the pane's Session and releases it on unmount, so closing a pane disturbs no other pane's generation.

### The layout model

`contract/layout.ts` is pure data plus pure functions over a binary split tree, with no React and no DOM. A pane is addressed by a path — the sequence of child choices from the root — rather than an index, so removing one pane never renumbers its siblings. Ratios are clamped into a band both when a split is built and when a divider reports a drag. `reviveTree` validates a stored tree at the storage boundary: it drops nodes whose shape is wrong and empties panes whose Session is gone.

`PANEL_LIMIT` in `SplitWorkspace.tsx` is `undefined`, which leaves the pane count unbounded. The docking kit's four-pane cap belongs to its planner layer and never reaches `applyOp`, so a split workspace of its own does not inherit it.

### Keyboard navigation between panes

The arrow commands are geometric rather than tree-shaped. `paneRects` measures every pane into a rectangle of the unit square from the same ratios the renderer uses, and `neighborPath` picks the neighbour from those rectangles: an edge must be shared, the nearest candidate wins, and an equal gap prefers the larger overlap. "The pane to the right" therefore means the same thing at any nesting depth, where "the next sibling in the tree" would surprise a reader inside a nested split. Closing is a model operation too: `closeAt` returns both the edited tree and the first pane of the promoted sibling, so focus lands on the pane that took over the space instead of staying on a stale path that addresses a split node.

All five commands act only while the split workspace is the panel on screen. Everywhere else — the Conversation, a settings sheet, any other panel — they resolve to `pass` and hand the combination straight back: on macOS `Cmd+Shift+Left/Right` is "select to the start/end of the line", and the workspace should only own it when there is a pane to move to.

### Why a pane draws the composer, not the Hero

The blank-Session Hero carries the workspace picker, the brand mark, and the agent-preset control. Those slots are `kind: 'single'` in `ui-conversation`: the workspace picker and the brand mark are root-scoped, and the preset is session-maybe, which a blank Session resolves to the root occurrence. A single slot may be rendered in exactly one place at a time, so a second pane drawing the Hero makes those entries fight over the same occurrence — one React "maximum update depth exceeded" per entry, per pane. `panePhase` therefore always reports `hero: false`: a pane draws the composer, which is what a user types into anyway, and the main panel keeps the Hero to itself.

### Copy and locale

Every visible string lives in the `splitPane` dictionary and reaches components through the standard `t` seat. Chrome controls name themselves through `aria-label` from the same dictionary, so a pane with no visible text still has an accessible name.

## Further Exploration

<a id="further-exploration"></a>

- [`conversation.content`](../ui-conversation/README.md) — the reusable assembly each pane renders, and the addressing rule pane bodies depend on.
- [`ui-subagent`](../ui-subagent/README.md) — the Sidebar's chat tab, the shipped example of rendering a non-current Session through `SessionProvider`.
- [`ui-sidebar-right`](../ui-sidebar-right/README.md) — `RightbarRoot`, which keeps several Session subtrees live and hides the ones outside the selection.
- [`ui-dockkit`](../ui-dockkit/README.md) — the docking engine and the pane cap this package deliberately does not use.

## Model Experience

None, as the package is a browser-side split workspace that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A pane's header is a second instance of the same assembly.** The Session header is a Component Factory on the shell side, so the main panel and every pane each render one; with the same Session open in two panes, the header's session-scoped children (title, utilities) contend for one render position, and nothing guards that case yet.
- **An empty pane draws a composer, not the Hero.** The blank-Session Hero carries root-scope single-occurrence slots (the workspace picker and the brand mark), which may be rendered in one place at a time, so the Hero stays with the main panel; a pane gets a composer it can be typed into instead of the large headline.
- **Linux carries no default binding for the pane commands.** DSH's reservation table rejects arrow and Backspace codes outright on Linux, for both shells, so the directions and Close declare defaults for macOS and Windows only. A Linux user can assign letter or symbol combinations in the shortcut reference.
- **The header entry is absent on an empty conversation.** Its seat is the header utilities row, which the host renders only once a conversation has content; the shortcut and the sidebar panel entry cover that state.
- **Retention grows with the pane count.** Each pane holds its own Session reference and history stream; there is no eviction of off-screen panes yet, so a very wide arrangement costs one live stream per pane.
- **No drag-to-arrange.** Panes are created by the split controls and removed by close; moving an existing pane to another position is not offered.
- **The workspace is not a Session.** It carries no Session of its own, so it has no entry in the Session list and its arrangement is keyed by whichever Session was current when it opened.
- **An archived Session is never handed back to a pane:** it stays out of the pane's Session picker, and opening its Workspace seats a live blank Session instead of the archived one.

### Dev Note

<a id="dev-note"></a>

<details>
<summary>Working context for maintainers — click to expand</summary>

`apps/web/tests/` has no coverage of this package: its runtime behavior needs a full Web profile (model selection, input triggers, and the composer chain), which the jsdom bench does not assemble. The pane body's phase derivation and the layout model both have direct coverage instead.

</details>

---
description: "Web split-pane workspace: several live Sessions side by side in one main panel, each a real Conversation with its own composer."
kind: "package-reference"
---

# dsh-split-pane

English | [中文](README.zh.md)

## Summary

The Web client can show its center column as one Conversation or as a split workspace of several. Each pane is an independent Conversation occurrence addressed to its own Session: it streams, accepts prompts, queues messages, and answers its own `ask_user_question` and approval prompts. Panes split right or down without a fixed count, dividers drag, and the arrangement persists per Session.

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

The sidebar's panel list carries a `Split` entry beside the Conversation. Selecting it swaps the center column for the split workspace; selecting the Conversation entry again (or any other main panel) swaps back. The workspace opens on the Session that was already current, so entering it never changes which Session the user was reading.

Every pane draws its own chrome row: a Session picker, split-right and split-down controls, and a close control. Splitting a pane seats a new empty pane beside it and focuses that pane; the empty pane offers the same Session picker. Closing a pane promotes its sibling into the space the pair occupied, and the last remaining pane cannot be closed — an empty workspace has nothing to show. A divider drags to change the shares, bounded so neither side falls below a usable width.

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

- **Panes render the Conversation body, not the Session header.** A pane shows the transcript and composer; the resident header's navigation and View tabs stay with the main panel, because the header belongs to `main.conversation` and is not a reusable Factory.
- **Retention grows with the pane count.** Each pane holds its own Session reference and history stream; there is no eviction of off-screen panes yet, so a very wide arrangement costs one live stream per pane.
- **No drag-to-arrange.** Panes are created by the split controls and removed by close; moving an existing pane to another position is not offered.
- **The workspace is not a Session.** It carries no Session of its own, so it has no entry in the Session list and its arrangement is keyed by whichever Session was current when it opened.

### Dev Note

<a id="dev-note"></a>

<details>
<summary>Working context for maintainers — click to expand</summary>

`apps/web/tests/` has no coverage of this package: its runtime behavior needs a full Web profile (model selection, input triggers, and the composer chain), which the jsdom bench does not assemble. The pane body's phase derivation and the layout model both have direct coverage instead.

</details>

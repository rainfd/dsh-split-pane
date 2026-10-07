/**
 * Split-pane workspace, node half.
 *
 * The split workspace is browser-only: it composes existing Client services
 * (Sessions, Slots, the docking kit) and owns no Host capability. This entry
 * exists so the package satisfies the Client/Host plugin contract.
 */

/** Host plugin body — the split workspace renders entirely in the browser. */
export function apply(): void {}

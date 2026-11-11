// Host half of @refine/split.
//
// The split is browser-only: panes, layout and drag live in the client module. The Host row still
// exists so the bundle composes as one package, but it registers nothing.
export function apply(): void {}

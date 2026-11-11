/**
 * Semantic aliases over the dsh theme (docs/ui/DESIGN.md section 2). Every value is a host token,
 * a length, or a calc()/color-mix() of host tokens, so light, dark and user skins all follow the
 * host. Only tokens that exist in dsh-client-ui-theme 0.2.1-rc.1 are referenced.
 */
export const TOKEN_VALUES = {
	"--refine-s1": "4px",
	"--refine-s2": "8px",
	"--refine-s3": "12px",
	"--refine-s4": "16px",
	"--refine-s5": "24px",
	"--refine-s6": "32px",

	"--refine-font-body": "var(--dsw-font-xs-13)",
	"--refine-font-body-strong": "var(--dsw-font-xs-strong-13)",
	"--refine-font-secondary": "var(--dsw-font-xxs-12)",
	"--refine-font-secondary-strong": "var(--dsw-font-xxs-strong-12)",
	"--refine-font-caption": "var(--dsw-font-xxxs-11)",
	"--refine-font-caption-strong": "var(--dsw-font-xxxs-strong-11)",
	"--refine-font-title": "var(--dsw-font-s-strong-14)",
	"--refine-font-family": "var(--dsw-font-family)",
	"--refine-font-code": "var(--ds-font-family-code)",

	"--refine-radius-xs": "var(--dsw-radius-xs)",
	"--refine-radius-sm": "var(--dsw-radius-sm)",
	"--refine-radius-md": "var(--dsw-radius-md)",
	"--refine-radius-lg": "var(--dsw-radius-lg)",
	"--refine-radius-xl": "var(--dsw-radius-xl)",
	"--refine-radius-panel": "var(--dsw-radius-panel)",

	"--refine-bg": "var(--dsw-alias-bg-base)",
	"--refine-bg-1": "var(--dsw-alias-bg-layer-1)",
	"--refine-bg-2": "var(--dsw-alias-bg-layer-2)",
	"--refine-bg-3": "var(--dsw-alias-bg-layer-3)",
	"--refine-bg-sidebar": "var(--dsw-specific-sidebar-fill)",
	"--refine-bg-skeleton": "var(--dsw-alias-bg-skeleton)",
	"--refine-bg-code": "var(--dsw-alias-markdown-code-block)",
	"--refine-bg-inline-code": "var(--dsw-alias-markdown-inline-code)",
	"--refine-mask": "var(--dsw-alias-bg-mask-1)",

	"--refine-text": "var(--dsw-alias-label-primary)",
	"--refine-text-secondary": "var(--dsw-alias-label-secondary)",
	"--refine-text-tertiary": "var(--dsw-alias-label-tertiary)",
	"--refine-text-caption": "var(--dsw-alias-label-caption)",
	"--refine-text-on-accent": "var(--dsw-alias-label-primary-foreground)",
	"--refine-link": "var(--dsw-alias-link)",

	"--refine-border-1": "var(--dsw-alias-border-l1)",
	"--refine-border-2": "var(--dsw-alias-border-l2)",
	"--refine-border-3": "var(--dsw-alias-border-l3)",
	"--refine-border-4": "var(--dsw-alias-border-l4)",
	"--refine-hairline": "0.5px",

	"--refine-hover": "var(--dsw-alias-interactive-bg-hover)",
	"--refine-active": "var(--dsw-alias-interactive-bg-active)",
	"--refine-hover-danger": "var(--dsw-alias-interactive-bg-hover-danger)",
	"--refine-button-primary": "var(--dsw-alias-button-primary-fill)",
	"--refine-button-primary-hover": "var(--dsw-alias-button-primary-hover)",
	"--refine-button-floating": "var(--dsw-alias-button-floating-fill)",
	"--refine-button-floating-hover": "var(--dsw-alias-button-floating-hover)",
	"--refine-switch-thumb": "var(--dsw-alias-switch-thumb)",
	"--refine-switch-on": "var(--dsw-alias-brand-primary)",

	"--refine-business": "var(--dsw-alias-state-business-primary)",
	"--refine-business-soft": "var(--dsw-alias-state-business-tertiary)",
	"--refine-success": "var(--dsw-alias-state-success-primary)",
	"--refine-success-soft":
		"color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)",
	"--refine-warn": "var(--dsw-alias-state-warn-primary)",
	"--refine-warn-label": "var(--dsw-alias-state-warn-label)",
	"--refine-warn-soft": "color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)",
	"--refine-error": "var(--dsw-alias-state-error-primary)",
	"--refine-error-soft": "color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)",
	"--refine-idle": "var(--dsw-alias-state-idle-primary)",
	"--refine-info-soft":
		"color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)",

	"--refine-diff-added-bg": "var(--dsw-alias-file-diff-added-bg)",
	"--refine-diff-added-gutter": "var(--dsw-alias-file-diff-added-gutter)",
	"--refine-diff-added-marker": "var(--dsw-alias-file-diff-added-marker)",
	"--refine-diff-deleted-bg": "var(--dsw-alias-file-diff-deleted-bg)",
	"--refine-diff-deleted-gutter": "var(--dsw-alias-file-diff-deleted-gutter)",
	"--refine-diff-deleted-marker": "var(--dsw-alias-file-diff-deleted-marker)",
	"--refine-diff-added-inline": "var(--dsw-alias-code-diff-added)",
	"--refine-diff-deleted-inline": "var(--dsw-alias-code-diff-deleted)",

	"--refine-elevation-panel": "var(--dsw-elevation-panel)",
	"--refine-elevation-soft": "var(--dsw-elevation-soft)",
	"--refine-menu-fill": "var(--dsw-menu-surface-fill)",
	"--refine-menu-filter": "var(--dsw-menu-backdrop-filter)",
	"--refine-toast-bg": "var(--dsw-alias-toast-bg)",
	"--refine-toast-label": "var(--dsw-alias-toast-label)",
	"--refine-tooltip-bg": "var(--dsw-alias-tooltip-bg)",

	"--refine-focus-ring":
		"var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))",
	// Above the host's full-screen right panel (dock layer 40, float layer 60); the host's own modal
	// root uses 1000.
	"--refine-z-overlay": "1000",
	"--refine-duration": "150ms",
	"--refine-ease-out": "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export type UiToken = keyof typeof TOKEN_VALUES;

/** Root class every rail surface carries; it scopes the aliases and the base typography. */
export const ROOT_CLASS = "rf-root";

/** `var(--refine-…)` reference for inline styles. */
export function token(name: UiToken): string {
	return `var(${name})`;
}

/** The alias block plus base typography, scoped to `.rf-root`. */
export function tokensCss(): string {
	const declarations = Object.entries(TOKEN_VALUES)
		.map(([name, value]) => `${name}:${value};`)
		.join("");
	return `.${ROOT_CLASS}{${declarations}font:var(--refine-font-body);color:var(--refine-text);-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;}`;
}

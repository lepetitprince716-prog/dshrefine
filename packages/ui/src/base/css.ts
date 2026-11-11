// Styles of the base, form and container components. Only `--refine-*` aliases from
// `src/tokens.ts` (plus the local `--rf-tree-level` counter) appear here; no literal colours.
// Elevated surfaces use an elevation token and never a border at the same time (DESIGN 2).

/** Every focusable kit element; they share one keyboard focus ring. */
const FOCUSABLE = [
	".rf-btn",
	".rf-chip-button",
	".rf-input",
	".rf-textarea",
	".rf-select",
	".rf-switch",
	".rf-segment",
	".rf-menu-item",
	".rf-row",
	".rf-disclosure-trigger",
	".rf-toast-action",
	".rf-toast-close",
	".rf-scroll",
	".rf-popover",
	".rf-modal-layer",
	".rf-menu",
];

const focusVisible = FOCUSABLE.map((selector) => `.rf-root ${selector}:focus-visible`).join(",");

const FOCUS = `
:is(${focusVisible}),.rf-root .rf-checkbox-input:focus-visible+.rf-checkbox-box{outline:var(--refine-focus-ring);outline-offset:2px;}
html[data-input-modality="pointer"] :is(${focusVisible}),html[data-input-modality="pointer"] .rf-root .rf-checkbox-input:focus-visible+.rf-checkbox-box{outline:none;}
.rf-root .rf-modal-layer:focus-visible,.rf-root .rf-menu:focus-visible,.rf-root .rf-popover:focus-visible{outline:none;}
`;

const BUTTONS = `
.rf-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:var(--refine-s1);box-sizing:border-box;margin:0;border:var(--refine-hairline) solid transparent;font:var(--refine-font-body-strong);font-family:var(--refine-font-family);color:var(--refine-text);background:transparent;cursor:pointer;white-space:nowrap;user-select:none;transition:background-color var(--refine-duration) var(--refine-ease-out),color var(--refine-duration) var(--refine-ease-out);}
.rf-btn-md{height:32px;min-width:32px;padding:0 var(--refine-s3);border-radius:var(--refine-radius-md);}
.rf-btn-sm{height:24px;min-width:24px;padding:0 var(--refine-s2);border-radius:var(--refine-radius-sm);font:var(--refine-font-secondary-strong);}
.rf-btn-icon{padding:0;}
.rf-btn-md.rf-btn-icon{width:32px;}
.rf-btn-sm.rf-btn-icon{width:24px;}
.rf-btn-glyph{display:inline-flex;flex:none;}
.rf-btn-label{overflow:hidden;text-overflow:ellipsis;}
.rf-btn-primary{background:var(--refine-button-primary);color:var(--refine-text-on-accent);}
.rf-btn-primary:hover:not(:disabled){background:var(--refine-button-primary-hover);}
.rf-btn-primary:active:not(:disabled){filter:brightness(0.95);}
.rf-btn-secondary{border-color:var(--refine-border-3);background:var(--refine-button-floating);}
.rf-btn-secondary:hover:not(:disabled){background:var(--refine-button-floating-hover);}
.rf-btn-secondary:active:not(:disabled){background:var(--refine-active);}
.rf-btn-ghost{color:var(--refine-text-secondary);}
.rf-btn-ghost:hover:not(:disabled){background:var(--refine-hover);color:var(--refine-text);}
.rf-btn-ghost:active:not(:disabled){background:var(--refine-active);}
.rf-btn-danger{border-color:var(--refine-border-3);color:var(--refine-error);}
.rf-btn-danger:hover:not(:disabled){background:var(--refine-hover-danger);}
.rf-btn-danger:active:not(:disabled){background:var(--refine-error-soft);}
.rf-btn:disabled{opacity:0.5;cursor:default;}
.rf-btn[aria-busy="true"]{cursor:progress;}
`;

const CHIPS = `
.rf-chip{position:relative;display:inline-flex;align-items:center;gap:var(--refine-s1);box-sizing:border-box;height:18px;max-width:100%;padding:0 6px;border:0;border-radius:var(--refine-radius-xs);font:var(--refine-font-caption-strong);font-family:var(--refine-font-family);color:var(--refine-text-secondary);background:var(--refine-bg-2);white-space:nowrap;vertical-align:middle;}
.rf-chip-label{overflow:hidden;text-overflow:ellipsis;}
.rf-chip-glyph{display:inline-flex;flex:none;}
.rf-chip-glyph .rf-glyph{width:12px;height:12px;}
.rf-chip-mono .rf-chip-label{font-family:var(--refine-font-code);}
.rf-chip-success{color:var(--refine-success);background:var(--refine-success-soft);}
.rf-chip-warn{color:var(--refine-warn-label);background:var(--refine-warn-soft);}
.rf-chip-error{color:var(--refine-error);background:var(--refine-error-soft);}
.rf-chip-info{color:var(--refine-business);background:var(--refine-info-soft);}
.rf-chip-business{color:var(--refine-business);background:var(--refine-business-soft);}
.rf-chip-button{margin:0;cursor:pointer;}
.rf-chip-button::after{content:"";position:absolute;inset:-3px 0;}
.rf-chip-button:hover:not(:disabled){filter:brightness(0.97);text-decoration:underline;}
.rf-chip-button:disabled{opacity:0.5;cursor:default;}
`;

const SMALL = `
.rf-status-dot{display:inline-block;flex:none;width:8px;height:8px;border-radius:50%;background:var(--refine-idle);}
.rf-status-dot[data-status="running"]{background:var(--refine-business);animation:rf-breathe 1.2s ease-in-out infinite;}
.rf-status-dot[data-status="attention"]{background:var(--refine-warn);}
.rf-status-dot[data-status="done"]{background:var(--refine-success);}
.rf-status-dot[data-status="error"]{background:var(--refine-error);}
@keyframes rf-breathe{0%,100%{opacity:1;}50%{opacity:0.35;}}
.rf-kbd{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:18px;height:18px;padding:0 var(--refine-s1);border-radius:var(--refine-radius-xs);font:var(--refine-font-caption);font-family:var(--refine-font-family);color:var(--refine-text-secondary);background:var(--refine-bg-2);}
.rf-divider{flex:none;margin:0;border:0;background:var(--refine-border-2);}
.rf-divider[data-orientation="horizontal"]{width:100%;height:var(--refine-hairline);}
.rf-divider[data-orientation="vertical"]{width:var(--refine-hairline);height:auto;align-self:stretch;}
.rf-spinner{display:inline-block;flex:none;box-sizing:border-box;border-radius:50%;border:1.5px solid var(--refine-border-3);border-top-color:currentColor;animation:rf-spin 0.8s linear infinite;}
.rf-spinner-sm{width:12px;height:12px;}
.rf-spinner-md{width:16px;height:16px;}
@keyframes rf-spin{to{transform:rotate(360deg);}}
.rf-glyph{display:block;flex:none;}
`;

const FORMS = `
.rf-field{display:flex;flex-direction:column;gap:var(--refine-s1);min-width:0;}
.rf-field-label{font:var(--refine-font-secondary-strong);color:var(--refine-text);}
.rf-field-description{margin:0;font:var(--refine-font-secondary);color:var(--refine-text-tertiary);}
.rf-field-error{margin:0;font:var(--refine-font-secondary);color:var(--refine-error);}
.rf-input,.rf-textarea,.rf-select{box-sizing:border-box;width:100%;min-width:0;margin:0;border:var(--refine-hairline) solid var(--refine-border-3);border-radius:var(--refine-radius-sm);font:var(--refine-font-body);font-family:var(--refine-font-family);color:var(--refine-text);background:var(--refine-bg-1);transition:border-color var(--refine-duration) var(--refine-ease-out);}
.rf-input-md,.rf-select-md{height:32px;padding:0 var(--refine-s3);}
.rf-input-sm,.rf-select-sm{height:24px;padding:0 var(--refine-s2);font:var(--refine-font-secondary);}
.rf-textarea{display:block;padding:6px var(--refine-s3);resize:none;line-height:20px;}
.rf-input::placeholder,.rf-textarea::placeholder{color:var(--refine-text-caption);}
.rf-input:where(:hover:not(:disabled)),.rf-textarea:where(:hover:not(:disabled)),.rf-select:where(:hover:not(:disabled)){border-color:var(--refine-border-4);}
.rf-input:focus,.rf-textarea:focus,.rf-select[aria-expanded="true"]{border-color:var(--refine-business);}
.rf-input[aria-invalid="true"],.rf-textarea[aria-invalid="true"],.rf-select[aria-invalid="true"]{border-color:var(--refine-error);}
.rf-input:disabled,.rf-textarea:disabled,.rf-select:disabled{opacity:0.5;cursor:default;}
.rf-select{display:inline-flex;align-items:center;justify-content:space-between;gap:var(--refine-s2);text-align:start;cursor:pointer;}
.rf-select-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rf-select-value[data-placeholder="true"]{color:var(--refine-text-caption);}
.rf-select-chevron{display:inline-flex;flex:none;color:var(--refine-text-tertiary);}
.rf-switch-field{display:inline-flex;align-items:center;gap:var(--refine-s2);}
.rf-switch{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:32px;height:24px;margin:0;padding:0;border:0;border-radius:var(--refine-radius-sm);background:transparent;cursor:pointer;}
.rf-switch-track{position:relative;display:block;width:28px;height:16px;border-radius:999px;background:var(--refine-border-3);transition:background-color var(--refine-duration) var(--refine-ease-out);}
.rf-switch-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--refine-switch-thumb);box-shadow:var(--refine-elevation-soft);transition:transform var(--refine-duration) var(--refine-ease-out);}
.rf-switch[aria-checked="true"] .rf-switch-track{background:var(--refine-switch-on);}
.rf-switch[aria-checked="true"] .rf-switch-thumb{transform:translateX(12px);background:var(--refine-text-on-accent);}
.rf-switch:disabled{opacity:0.5;cursor:default;}
.rf-switch-label{font:var(--refine-font-body);color:var(--refine-text);cursor:pointer;}
.rf-switch-field[data-disabled="true"] .rf-switch-label{color:var(--refine-text-tertiary);cursor:default;}
.rf-checkbox{position:relative;display:inline-flex;align-items:center;gap:var(--refine-s2);min-height:24px;font:var(--refine-font-body);color:var(--refine-text);cursor:pointer;}
.rf-checkbox-input{position:absolute;top:0;left:0;width:24px;height:24px;margin:0;opacity:0;cursor:inherit;}
.rf-checkbox-box{display:inline-flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box;width:16px;height:16px;margin:4px;border:var(--refine-hairline) solid var(--refine-border-4);border-radius:var(--refine-radius-xs);color:var(--refine-text-on-accent);background:var(--refine-bg-1);transition:background-color var(--refine-duration) var(--refine-ease-out);}
.rf-checkbox:hover .rf-checkbox-input:not(:disabled)+.rf-checkbox-box{border-color:var(--refine-business);}
.rf-checkbox-input:checked+.rf-checkbox-box,.rf-checkbox-input:indeterminate+.rf-checkbox-box{border-color:var(--refine-business);background:var(--refine-business);}
.rf-checkbox[data-disabled="true"]{color:var(--refine-text-tertiary);cursor:default;}
.rf-checkbox[data-disabled="true"] .rf-checkbox-box{opacity:0.5;}
.rf-segmented{display:inline-flex;align-items:stretch;gap:2px;box-sizing:border-box;padding:2px;border-radius:var(--refine-radius-sm);background:var(--refine-bg-2);}
.rf-segment{display:inline-flex;align-items:center;justify-content:center;gap:var(--refine-s1);box-sizing:border-box;min-width:24px;margin:0;padding:0 var(--refine-s2);border:0;border-radius:calc(var(--refine-radius-sm) - 2px);font:var(--refine-font-secondary-strong);font-family:var(--refine-font-family);color:var(--refine-text-secondary);background:transparent;cursor:pointer;white-space:nowrap;}
.rf-segmented-md .rf-segment{height:28px;}
.rf-segmented-sm .rf-segment{position:relative;height:20px;font:var(--refine-font-caption-strong);}
.rf-segmented-sm .rf-segment::after{content:"";position:absolute;inset:-2px 0;}
.rf-segment:hover:not(:disabled){color:var(--refine-text);}
.rf-segment[aria-selected="true"]{color:var(--refine-text);background:var(--refine-bg-1);box-shadow:var(--refine-elevation-soft);}
.rf-segment:disabled{opacity:0.5;cursor:default;}
.rf-segment-glyph{display:inline-flex;}
`;

const LAYERS = `
.rf-overlay{position:fixed;inset:0;z-index:var(--refine-z-overlay);pointer-events:none;}
.rf-overlay .rf-layer,.rf-overlay .rf-modal-mask,.rf-overlay .rf-toast{pointer-events:auto;}
.rf-modal-mask{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:var(--refine-s5);background:var(--refine-mask);}
.rf-modal-layer{display:flex;max-width:100%;max-height:100%;outline:none;}
.rf-modal{display:flex;flex-direction:column;box-sizing:border-box;width:100%;max-height:100%;border:0;border-radius:var(--refine-radius-panel);background:var(--refine-bg-1);box-shadow:var(--refine-elevation-panel);overflow:hidden;}
.rf-modal-sm{width:360px;}
.rf-modal-md{width:480px;}
.rf-modal-lg{width:640px;}
.rf-modal-header{display:flex;align-items:center;gap:var(--refine-s2);padding:var(--refine-s5) var(--refine-s5) 0;}
.rf-modal-title{flex:1;min-width:0;margin:0;font:var(--refine-font-title);color:var(--refine-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rf-modal-description{margin:var(--refine-s1) var(--refine-s5) 0;font:var(--refine-font-secondary);color:var(--refine-text-secondary);}
.rf-modal-body{flex:1;min-height:0;padding:var(--refine-s4) var(--refine-s5);overflow:auto;}
.rf-modal-footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:var(--refine-s2);padding:0 var(--refine-s5) var(--refine-s5);}
.rf-modal-footer>.rf-btn{flex:none;max-width:100%;}
.rf-modal-header+.rf-modal-footer,.rf-modal-description+.rf-modal-footer{padding-top:var(--refine-s4);}
.rf-anchored-layer{position:fixed;box-sizing:border-box;max-width:calc(100vw - 16px);}
.rf-menu,.rf-listbox,.rf-popover{box-sizing:border-box;max-height:min(360px,calc(100vh - 16px));overflow:auto;border:0;border-radius:var(--refine-radius-md);background:var(--refine-menu-fill);backdrop-filter:var(--refine-menu-filter);-webkit-backdrop-filter:var(--refine-menu-filter);box-shadow:var(--refine-elevation-panel);color:var(--refine-text);font:var(--refine-font-body);}
.rf-menu,.rf-listbox{min-width:160px;padding:var(--refine-s1);}
.rf-popover{padding:var(--refine-s3);background:var(--refine-bg-1);backdrop-filter:none;-webkit-backdrop-filter:none;}
.rf-menu-item,.rf-option{display:flex;align-items:center;gap:var(--refine-s2);box-sizing:border-box;width:100%;min-height:28px;margin:0;padding:var(--refine-s1) var(--refine-s2);border:0;border-radius:var(--refine-radius-sm);font:var(--refine-font-body);font-family:var(--refine-font-family);color:var(--refine-text);background:transparent;text-align:start;cursor:pointer;}
.rf-menu-item:hover:not([aria-disabled="true"]),.rf-menu-item:focus,.rf-option[data-active="true"]{background:var(--refine-hover);outline:none;}
.rf-menu-item[data-danger="true"]{color:var(--refine-error);}
.rf-menu-item[data-danger="true"]:hover,.rf-menu-item[data-danger="true"]:focus{background:var(--refine-hover-danger);}
.rf-menu-item[aria-disabled="true"],.rf-option[aria-disabled="true"]{opacity:0.5;cursor:default;}
.rf-menu-glyph{display:inline-flex;flex:none;color:var(--refine-text-secondary);}
.rf-menu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rf-menu-shortcut{margin-inline-start:auto;}
.rf-menu-separator{height:var(--refine-hairline);margin:var(--refine-s1) calc(-1 * var(--refine-s1));border:0;background:var(--refine-border-2);}
.rf-option{flex-direction:column;align-items:flex-start;justify-content:center;gap:0;}
.rf-option[aria-selected="true"] .rf-option-label{font:var(--refine-font-body-strong);}
.rf-option-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rf-option-description{font:var(--refine-font-caption);color:var(--refine-text-tertiary);}
.rf-listbox-group+.rf-listbox-group,.rf-option+.rf-listbox-group{margin-top:var(--refine-s1);}
.rf-listbox-group-label{padding:var(--refine-s1) var(--refine-s2);font:var(--refine-font-caption-strong);color:var(--refine-text-tertiary);}
.rf-listbox-empty{padding:var(--refine-s2);font:var(--refine-font-secondary);color:var(--refine-text-tertiary);}
.rf-tooltip-anchor{display:inline-flex;max-width:100%;}
.rf-tooltip{max-width:280px;padding:var(--refine-s1) var(--refine-s2);border-radius:var(--refine-radius-sm);font:var(--refine-font-secondary);color:var(--refine-toast-label);background:var(--refine-tooltip-bg);box-shadow:var(--refine-elevation-soft);overflow-wrap:anywhere;}
.rf-overlay .rf-layer:has(.rf-tooltip){pointer-events:none;}
.rf-toasts{position:fixed;right:var(--refine-s4);bottom:var(--refine-s4);display:flex;flex-direction:column;align-items:flex-end;gap:var(--refine-s2);max-width:calc(100vw - 32px);}
.rf-toast{display:flex;align-items:center;gap:var(--refine-s2);box-sizing:border-box;max-width:420px;min-height:36px;padding:var(--refine-s2) var(--refine-s2) var(--refine-s2) var(--refine-s3);border-radius:var(--refine-radius-md);font:var(--refine-font-body);color:var(--refine-toast-label);background:var(--refine-toast-bg);box-shadow:var(--refine-elevation-panel);animation:rf-toast-in var(--refine-duration) var(--refine-ease-out);}
.rf-toast-mark{flex:none;width:8px;height:8px;border-radius:50%;background:var(--refine-business);}
.rf-toast[data-tone="success"] .rf-toast-mark{background:var(--refine-success);}
.rf-toast[data-tone="warn"] .rf-toast-mark{background:var(--refine-warn);}
.rf-toast[data-tone="error"] .rf-toast-mark{background:var(--refine-error);}
.rf-toast-text{flex:1;min-width:0;overflow-wrap:anywhere;}
.rf-toast-action,.rf-toast-close{display:inline-flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box;min-width:24px;height:24px;margin:0;padding:0 var(--refine-s2);border:0;border-radius:var(--refine-radius-sm);font:var(--refine-font-body-strong);font-family:var(--refine-font-family);color:var(--refine-toast-label);background:transparent;cursor:pointer;}
.rf-toast-close{padding:0;width:24px;}
.rf-toast-action:hover,.rf-toast-close:hover{background:color-mix(in srgb, var(--refine-toast-label) 14%, transparent);}
@keyframes rf-toast-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
`;

const SURFACES = `
.rf-disclosure{display:flex;flex-direction:column;min-width:0;}
.rf-disclosure-header{display:flex;align-items:center;gap:var(--refine-s1);}
.rf-disclosure-trigger{display:flex;flex:1;align-items:center;gap:var(--refine-s1);box-sizing:border-box;min-width:0;min-height:28px;margin:0;padding:0 var(--refine-s1);border:0;border-radius:var(--refine-radius-sm);font:var(--refine-font-secondary-strong);font-family:var(--refine-font-family);color:var(--refine-text-secondary);background:transparent;text-align:start;cursor:pointer;}
.rf-disclosure-trigger:hover{background:var(--refine-hover);color:var(--refine-text);}
.rf-disclosure-chevron{display:inline-flex;flex:none;transition:transform var(--refine-duration) var(--refine-ease-out);}
.rf-disclosure[data-open="true"] .rf-disclosure-chevron{transform:rotate(90deg);}
.rf-disclosure-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rf-disclosure-count{flex:none;font:var(--refine-font-caption);color:var(--refine-text-tertiary);}
.rf-disclosure-actions{display:flex;flex:none;align-items:center;gap:var(--refine-s1);}
.rf-disclosure-panel{animation:rf-reveal var(--refine-duration) var(--refine-ease-out);}
@keyframes rf-reveal{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}
.rf-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--refine-s2);padding:var(--refine-s6) var(--refine-s4);text-align:center;color:var(--refine-text-tertiary);}
.rf-empty-glyph{display:inline-flex;color:var(--refine-text-tertiary);}
.rf-empty-title{margin:0;font:var(--refine-font-body-strong);color:var(--refine-text-secondary);}
.rf-empty-description{margin:0;max-width:360px;font:var(--refine-font-secondary);color:var(--refine-text-tertiary);}
.rf-empty-action{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--refine-s2);margin-top:var(--refine-s2);}
.rf-error-banner{display:flex;align-items:flex-start;gap:var(--refine-s2);box-sizing:border-box;padding:var(--refine-s2) var(--refine-s3);border-radius:var(--refine-radius-sm);background:var(--refine-error-soft);color:var(--refine-text);}
.rf-error-banner-mark{flex:none;width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--refine-error);}
.rf-error-banner-text{display:flex;flex:1;flex-direction:column;min-width:0;}
.rf-error-banner-title{margin:0;font:var(--refine-font-body-strong);}
.rf-error-banner-message{margin:0;font:var(--refine-font-body);overflow-wrap:anywhere;}
.rf-error-banner-code{font:var(--refine-font-caption);font-family:var(--refine-font-code);color:var(--refine-text-tertiary);}
.rf-skeleton-group{display:inline-flex;flex-direction:column;gap:var(--refine-s2);width:100%;}
.rf-skeleton{display:block;width:100%;height:12px;background:var(--refine-bg-skeleton);animation:rf-shimmer 1.4s ease-in-out infinite;}
.rf-skeleton-xs{border-radius:var(--refine-radius-xs);}
.rf-skeleton-sm{border-radius:var(--refine-radius-sm);}
.rf-skeleton-md{border-radius:var(--refine-radius-md);}
.rf-skeleton-last{width:60%;}
@keyframes rf-shimmer{0%,100%{opacity:1;}50%{opacity:0.55;}}
.rf-scroll{min-height:0;scrollbar-width:thin;scrollbar-color:transparent transparent;}
.rf-scroll:hover,.rf-scroll:focus-within{scrollbar-color:var(--refine-border-3) transparent;}
.rf-scroll[data-orientation="vertical"]{overflow-x:hidden;overflow-y:auto;}
.rf-scroll[data-orientation="horizontal"]{overflow-x:auto;overflow-y:hidden;}
.rf-scroll[data-orientation="both"]{overflow:auto;}
.rf-list,.rf-tree{display:flex;flex-direction:column;gap:1px;min-width:0;}
.rf-row{display:flex;align-items:center;gap:var(--refine-s2);box-sizing:border-box;min-height:28px;padding:var(--refine-s1) var(--refine-s2);border-radius:var(--refine-radius-sm);color:var(--refine-text);cursor:pointer;user-select:none;}
.rf-row:hover:not([aria-disabled="true"]){background:var(--refine-hover);}
.rf-row[aria-selected="true"]{background:var(--refine-active);}
.rf-row[aria-disabled="true"]{color:var(--refine-text-tertiary);cursor:default;}
.rf-tree-row{padding-inline-start:calc(var(--refine-s1) + var(--rf-tree-level, 0) * var(--refine-s4));}
.rf-tree-toggle{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:16px;color:var(--refine-text-tertiary);transition:transform var(--refine-duration) var(--refine-ease-out);}
.rf-tree-toggle[data-expanded="true"]{transform:rotate(90deg);}
.rf-tree-glyph{display:inline-flex;flex:none;color:var(--refine-text-secondary);}
.rf-tree-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rf-tree-trailing{display:inline-flex;flex:none;align-items:center;gap:var(--refine-s1);}
`;

const REDUCED_MOTION = `
@media (prefers-reduced-motion: reduce){
.rf-status-dot,.rf-spinner,.rf-skeleton,.rf-toast,.rf-disclosure-panel{animation:none;}
.rf-btn,.rf-switch-track,.rf-switch-thumb,.rf-checkbox-box,.rf-disclosure-chevron,.rf-tree-toggle,.rf-input,.rf-textarea,.rf-select{transition:none;}
}
`;

export const BASE_CSS = [FOCUS, BUTTONS, CHIPS, SMALL, FORMS, LAYERS, SURFACES, REDUCED_MOTION]
	.map((block) => block.trim())
	.join("\n");

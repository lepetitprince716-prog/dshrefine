/**
 * Styles of the icons and data components. Only `--refine-*` aliases (src/tokens.ts) are used, so
 * light, dark and user skins follow the host.
 */
const ICON_CSS = `
.rf-icon{display:inline-block;flex:none;vertical-align:middle;}
`;

const DIFF_CSS = `
.rf-diff{display:flex;flex-direction:column;height:100%;min-height:0;font:var(--refine-font-secondary);font-family:var(--refine-font-code);color:var(--refine-text);}
.rf-diff-notice{display:flex;align-items:center;gap:var(--refine-s2);padding:var(--refine-s2) var(--refine-s3);background:var(--refine-warn-soft);color:var(--refine-warn-label);font:var(--refine-font-secondary);font-family:var(--refine-font-family);}
.rf-diff-empty{padding:var(--refine-s4);color:var(--refine-text-tertiary);font:var(--refine-font-body);font-family:var(--refine-font-family);}
.rf-diff-scroll{position:relative;flex:1 1 auto;min-height:0;overflow:auto;outline:none;container-type:inline-size;}
.rf-diff-scroll:focus-visible{outline:var(--refine-focus-ring);outline-offset:-2px;}
html[data-input-modality='pointer'] .rf-diff-scroll:focus-visible{outline:none;}
.rf-diff-canvas{position:relative;width:100%;}
.rf-diff-row{position:absolute;top:0;left:0;min-width:100%;width:max-content;display:flex;height:20px;line-height:20px;white-space:pre;tab-size:4;}
.rf-diff-gutter{display:flex;flex:none;color:var(--refine-text-tertiary);user-select:none;}
.rf-diff--unified .rf-diff-gutter{position:sticky;left:0;z-index:1;background:var(--refine-bg);}
.rf-diff-num{flex:none;box-sizing:border-box;padding:0 var(--refine-s1) 0 var(--refine-s2);text-align:right;font-variant-numeric:tabular-nums;}
.rf-diff-add-slot{flex:none;width:20px;display:flex;align-items:center;justify-content:center;}
.rf-diff-add{display:none;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:none;border-radius:var(--refine-radius-xs);background:var(--refine-button-primary);color:var(--refine-text-on-accent);cursor:pointer;}
.rf-diff-add:hover{background:var(--refine-button-primary-hover);}
.rf-diff-line:hover .rf-diff-add,.rf-diff-half:hover .rf-diff-add,.rf-diff-row--cursor .rf-diff-add{display:inline-flex;}
.rf-diff-marker{flex:none;width:16px;text-align:center;}
.rf-diff-text{flex:1 0 auto;padding-right:var(--refine-s4);}
.rf-diff-line--added{background:var(--refine-diff-added-bg);}
.rf-diff-line--deleted{background:var(--refine-diff-deleted-bg);}
.rf-diff--unified .rf-diff-line--added .rf-diff-gutter{background:linear-gradient(var(--refine-diff-added-gutter),var(--refine-diff-added-gutter)),var(--refine-bg);}
.rf-diff--unified .rf-diff-line--deleted .rf-diff-gutter{background:linear-gradient(var(--refine-diff-deleted-gutter),var(--refine-diff-deleted-gutter)),var(--refine-bg);}
.rf-diff-half.rf-diff-line--added .rf-diff-gutter{background:var(--refine-diff-added-gutter);}
.rf-diff-half.rf-diff-line--deleted .rf-diff-gutter{background:var(--refine-diff-deleted-gutter);}
.rf-diff-line--added .rf-diff-marker{color:var(--refine-diff-added-marker);}
.rf-diff-line--deleted .rf-diff-marker{color:var(--refine-diff-deleted-marker);}
.rf-diff-line--added .rf-diff-word{background:var(--refine-diff-added-inline);border-radius:var(--refine-radius-xs);}
.rf-diff-line--deleted .rf-diff-word{background:var(--refine-diff-deleted-inline);border-radius:var(--refine-radius-xs);}
.rf-diff-noeol{margin-left:var(--refine-s2);color:var(--refine-text-tertiary);font:var(--refine-font-caption);font-family:var(--refine-font-family);}
.rf-diff-row--selected,.rf-diff-row--selected .rf-diff-gutter{background:var(--refine-info-soft);}
.rf-diff-row--cursor{box-shadow:inset 2px 0 0 var(--refine-business);}
.rf-diff-split .rf-diff-half{display:flex;flex:1 0 0;box-sizing:border-box;}
.rf-diff-split .rf-diff-half+.rf-diff-half{border-left:var(--refine-hairline) solid var(--refine-border-2);}
.rf-diff-half--empty{background:var(--refine-bg-1);}
.rf-diff-hunk,.rf-diff-gap{background:var(--refine-bg-1);color:var(--refine-text-tertiary);}
.rf-diff-hunk-text{padding:0 var(--refine-s3);}
.rf-diff-gap-cell{display:flex;align-items:center;position:sticky;left:0;}
.rf-diff-expand{display:inline-flex;align-items:center;gap:var(--refine-s1);height:20px;padding:0 var(--refine-s2);border:none;background:transparent;color:var(--refine-link);font:var(--refine-font-secondary);font-family:var(--refine-font-family);cursor:pointer;}
.rf-diff-expand:hover{background:var(--refine-hover);}
.rf-diff-thread{height:auto;white-space:normal;}
.rf-diff-thread-body{position:sticky;left:0;box-sizing:border-box;width:100cqi;padding:var(--refine-s2) var(--refine-s3);font:var(--refine-font-body);font-family:var(--refine-font-family);}
`;

const TEXT_CSS = `
.rf-code{margin:0;padding:var(--refine-s2) var(--refine-s3);overflow:auto;background:var(--refine-bg-code);border-radius:var(--refine-radius-sm);font:var(--refine-font-secondary);font-family:var(--refine-font-code);line-height:18px;white-space:pre;tab-size:4;color:var(--refine-text);}
.rf-code-line{display:block;}
.rf-code-num{display:inline-block;min-width:3ch;margin-right:var(--refine-s3);text-align:right;color:var(--refine-text-tertiary);user-select:none;font-variant-numeric:tabular-nums;}
.rf-md{font:var(--refine-font-body);color:var(--refine-text);overflow-wrap:anywhere;}
.rf-md>:first-child{margin-top:0;}
.rf-md>:last-child{margin-bottom:0;}
.rf-md-h{margin:var(--refine-s4) 0 var(--refine-s2);font:var(--refine-font-body-strong);}
.rf-md-h1,.rf-md-h2{font:var(--refine-font-title);}
.rf-md-p{margin:0 0 var(--refine-s2);}
.rf-md-list{margin:0 0 var(--refine-s2);padding-left:var(--refine-s5);}
.rf-md-li>.rf-md-list,.rf-md-li>.rf-md-p{margin-bottom:0;}
.rf-md-pre{margin:0 0 var(--refine-s2);padding:var(--refine-s2) var(--refine-s3);overflow:auto;background:var(--refine-bg-code);border-radius:var(--refine-radius-sm);font:var(--refine-font-secondary);font-family:var(--refine-font-code);white-space:pre;}
.rf-md-code{padding:0 var(--refine-s1);background:var(--refine-bg-inline-code);border-radius:var(--refine-radius-xs);font-family:var(--refine-font-code);font-size:0.92em;}
.rf-md-link{color:var(--refine-link);text-decoration:none;}
.rf-md-link:hover{text-decoration:underline;}
.rf-md-link:focus-visible{outline:var(--refine-focus-ring);outline-offset:2px;border-radius:var(--refine-radius-xs);}
.rf-time{font-variant-numeric:tabular-nums;}
.rf-diffstat{display:inline-flex;gap:var(--refine-s1);font:var(--refine-font-secondary);font-family:var(--refine-font-code);font-variant-numeric:tabular-nums;white-space:nowrap;}
.rf-diffstat-added{color:var(--refine-success);}
.rf-diffstat-removed{color:var(--refine-error);}
`;

export const DATA_CSS = [ICON_CSS, DIFF_CSS, TEXT_CSS].join("").replace(/\n/g, "");

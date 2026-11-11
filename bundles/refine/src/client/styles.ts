/** Package id: the `data-plugin` tag the module system uses to remove the sheets on unload. */
export const PKG = "@refine/refine";

export const REFINE_CSS = `
.rfx-ctl{display:inline-flex;align-items:center;gap:2px;}
.rfx-mask{position:fixed;inset:0;z-index:var(--refine-z-overlay,1000);display:flex;align-items:flex-start;justify-content:center;padding:10vh 16px 16px;background:var(--refine-mask);animation:rfx-in 160ms var(--refine-ease-out);}
.rfx-dialog{display:flex;flex-direction:column;width:min(620px,100%);max-height:72vh;overflow:hidden;background:var(--refine-bg-2);border:var(--refine-hairline) solid var(--refine-border-2);border-radius:var(--refine-radius-panel);box-shadow:var(--refine-elevation-panel);animation:rfx-rise 200ms var(--refine-ease-out);}
.rfx-head{display:flex;align-items:flex-start;gap:12px;padding:16px 16px 10px;}
.rfx-head-text{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 auto;}
.rfx-title{font:var(--refine-font-title);color:var(--refine-text);}
.rfx-hint{font:var(--refine-font-secondary);color:var(--refine-text-tertiary);}
.rfx-running{font:var(--refine-font-secondary);color:var(--refine-warn);}
.rfx-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 8px 8px;}
.rfx-row{display:flex;align-items:flex-start;gap:10px;width:100%;box-sizing:border-box;padding:8px 10px;border:0;border-radius:var(--refine-radius-md);background:none;color:var(--refine-text);font:var(--refine-font-body);text-align:left;cursor:pointer;transition:background-color 120ms var(--refine-ease-out);}
.rfx-row:hover{background:var(--refine-hover);}
.rfx-row:focus-visible{outline:var(--refine-focus-ring);outline-offset:1px;}
.rfx-when{flex:none;width:64px;color:var(--refine-text-tertiary);font:var(--refine-font-caption);font-variant-numeric:tabular-nums;padding-top:2px;}
.rfx-text{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:20px;}
.rfx-note{padding:10px 16px 14px;color:var(--refine-text-tertiary);font:var(--refine-font-caption);border-top:var(--refine-hairline) solid var(--refine-border-1);}
.rfx-state{padding:24px 16px;text-align:center;color:var(--refine-text-tertiary);font:var(--refine-font-secondary);}
.rfx-error{color:var(--refine-error);}
.rfx-close{flex:none;width:26px;height:26px;border:0;border-radius:var(--refine-radius-sm);background:none;color:var(--refine-text-tertiary);font-size:18px;line-height:1;cursor:pointer;}
.rfx-close:hover{background:var(--refine-hover);color:var(--refine-text);}
.rfx-close:focus-visible{outline:var(--refine-focus-ring);outline-offset:1px;}
.rfx-ctl-note{position:absolute;right:8px;top:36px;z-index:10;padding:2px 8px;border-radius:var(--refine-radius-sm);background:var(--refine-bg-3);color:var(--refine-text-secondary);font:var(--refine-font-caption);white-space:nowrap;}
@keyframes rfx-in{from{opacity:0;}}
@keyframes rfx-rise{from{opacity:0;transform:translateY(6px);}}
@media (prefers-reduced-motion: reduce){
.rfx-mask,.rfx-dialog{animation:none;}
}
`;

/**
 * Overlay CSS styles.
 */

export const CSS = /* css */ `
#__tdt{
  --bg:#0a0a0c;--bg2:#131316;--bg3:#1c1c21;--bg4:#26262d;
  --bd:#2a2a32;--bd2:#38383f;
  --fg:#e4e4e7;--fg2:#8e8e96;--fg3:#5a5a63;
  --grn:#22c55e;--blu:#3b82f6;--ylw:#eab308;--red:#ef4444;
  --pur:#a855f7;--cyn:#06b6d4;--orn:#f97316;
  --r:10px;
  position:fixed;top:12px;right:12px;width:380px;
  max-height:calc(100vh - 24px);
  background:var(--bg);border:1px solid var(--bd);
  border-radius:16px;color:var(--fg);
  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:12px;line-height:1.5;z-index:999999;
  overflow:hidden;
  box-shadow:0 24px 48px -12px rgba(0,0,0,.6);
  user-select:none;
}
#__tdt.mini{width:48px;max-height:48px;border-radius:14px;cursor:pointer}
#__tdt.mini .__body,#__tdt.mini .__hbtns{display:none}
#__tdt.mini .__hdr{justify-content:center;padding:12px;border:none}
#__tdt.mini .__htitle{display:none}
#__tdt *{box-sizing:border-box;margin:0;padding:0}

/* header */
.__hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--bd);cursor:grab}
.__hdr:active{cursor:grabbing}
.__htitle{font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--fg2);display:flex;align-items:center;gap:8px}
.__hdot{width:6px;height:6px;border-radius:50%;background:var(--grn);box-shadow:0 0 8px var(--grn);animation:__p 2s ease-in-out infinite}
@keyframes __p{0%,100%{opacity:1}50%{opacity:.4}}
.__hbtns{display:flex;gap:4px}
.__hb{width:28px;height:28px;border:1px solid var(--bd);border-radius:8px;background:0 0;color:var(--fg3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all .15s}
.__hb:hover{background:var(--bg3);color:var(--fg);border-color:var(--bd2)}

/* body */
.__body{overflow-y:auto;max-height:calc(100vh - 70px);scrollbar-width:thin;scrollbar-color:var(--bg3) transparent}
.__body::-webkit-scrollbar{width:3px}
.__body::-webkit-scrollbar-thumb{background:var(--bg3);border-radius:2px}

/* section */
.__s{border-bottom:1px solid var(--bd)}.__s:last-child{border-bottom:none}
.__sh{display:flex;align-items:center;padding:8px 14px;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--fg3);gap:6px;transition:color .15s}
.__sh:hover{color:var(--fg2)}
.__sh svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2.5;flex-shrink:0;transition:transform .2s}
.__sh.open svg{transform:rotate(90deg)}
.__sh .c{margin-left:auto;font-size:9px;font-weight:600;color:var(--fg3);background:var(--bg3);padding:1px 6px;border-radius:5px;min-width:20px;text-align:center}
.__sb{padding:0 12px 10px;display:none}.__sb.open{display:block}

/* stats — 3 columns */
.__g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.__st{padding:10px 10px 8px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);position:relative;overflow:hidden;min-width:0;text-align:center}
.__st::before{content:'';position:absolute;bottom:0;left:8px;right:8px;height:2px;border-radius:1px}
.__st.g::before{background:var(--grn)}.__st.b::before{background:var(--blu)}.__st.y::before{background:var(--ylw)}
.__st.p::before{background:var(--pur)}.__st.c::before{background:var(--cyn)}.__st.o::before{background:var(--orn)}
.__st.r::before{background:var(--red)}
.__sl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--fg3);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.__sv{font-size:18px;font-weight:800;font-family:ui-monospace,'Cascadia Code',monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.__st.g .__sv{color:var(--grn)}.__st.b .__sv{color:var(--blu)}.__st.y .__sv{color:var(--ylw)}
.__st.p .__sv{color:var(--pur)}.__st.c .__sv{color:var(--cyn)}.__st.o .__sv{color:var(--orn)}
.__st.r .__sv{color:var(--red)}

/* sparkline */
.__sp{margin-top:8px;height:28px;background:var(--bg2);border:1px solid var(--bd);border-radius:8px;display:flex;align-items:flex-end;gap:1px;padding:3px 4px;overflow:hidden}
.__sc{flex:1;border-radius:1px 1px 0 0;min-height:1px;transition:height .12s ease}

/* tree */
.__tree{font-family:ui-monospace,'Cascadia Code',monospace;font-size:11px;line-height:1;max-height:300px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--bg4) transparent;padding:4px 0}
.__tree::-webkit-scrollbar{width:3px}
.__tree::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px}

.__tr{display:flex;align-items:center;height:26px;padding:0 8px 0 0;gap:5px;border-radius:7px;cursor:pointer;white-space:nowrap;transition:background .1s;margin:1px 0}
.__tr:hover{background:var(--bg3)}
.__tr.sel{background:rgba(34,197,94,.12);outline:1px solid rgba(34,197,94,.25)}
.__ta{width:14px;height:26px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--fg3);font-size:10px;transition:transform .15s}
.__ta.open{transform:rotate(90deg)}
.__ta.no{visibility:hidden}
.__ti{flex-shrink:0;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;line-height:1;letter-spacing:.3px}
.__ti.mesh{background:rgba(59,130,246,.15);color:var(--blu)}
.__ti.light{background:rgba(234,179,8,.15);color:var(--ylw)}
.__ti.cam{background:rgba(168,85,247,.15);color:var(--pur)}
.__ti.grp{background:rgba(113,113,122,.12);color:var(--fg3)}
.__ti.pts{background:rgba(6,182,212,.15);color:var(--cyn)}
.__ti.inst{background:rgba(249,115,22,.15);color:var(--orn)}
.__ti.bone{background:rgba(239,68,68,.12);color:var(--red)}
.__tn{color:var(--fg);font-weight:500;overflow:hidden;text-overflow:ellipsis;min-width:0}
.__tx{color:var(--fg3);font-size:10px;margin-left:auto;flex-shrink:0;padding-left:6px}
.__th{color:var(--red);font-size:8px;margin-left:4px;flex-shrink:0;font-weight:600;letter-spacing:.3px}
.__tk{display:none}.__tk.open{display:block}

/* details */
.__det{margin:8px 0 4px;padding:12px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r)}
.__dh{font-size:12px;font-weight:700;color:var(--fg);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.__dc{margin-left:auto;cursor:pointer;color:var(--fg3);font-size:11px;padding:2px 6px;border-radius:5px;transition:all .15s}
.__dc:hover{color:var(--fg);background:var(--bg3)}
.__dr{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:11px;font-family:ui-monospace,'Cascadia Code',monospace;border-bottom:1px solid rgba(255,255,255,.04)}
.__dr:last-of-type{border-bottom:none}
.__dk{color:var(--fg3);flex-shrink:0;min-width:70px}
.__dv{color:var(--fg);font-weight:500;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:auto}

/* preview */
.__pv{width:100%!important;height:auto!important;aspect-ratio:1;border-radius:8px;display:block;cursor:grab}
.__pv:active{cursor:grabbing}
.__pv_wrap{position:relative;background:var(--bg3);border:1px solid var(--bd);border-radius:8px;margin-bottom:8px;overflow:hidden}
.__pv_loading{padding:40px 0;text-align:center;color:var(--fg3);font-size:10px}

/* copy button */
.__cp{display:block;width:100%;margin-top:10px;padding:7px 0;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;color:#22c55e;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;letter-spacing:.3px}
.__cp:hover{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.35)}
.__cp:active{transform:scale(.98)}

/* badges */
.__bl{display:flex;flex-wrap:wrap;gap:5px}
.__bd{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;background:var(--bg2);border:1px solid var(--bd);border-radius:8px;font-size:10px;color:var(--fg2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.__bd .dot{width:9px;height:9px;border-radius:3px;flex-shrink:0;border:1px solid rgba(255,255,255,.08)}
.__bd{position:relative}

/* material tooltip */
.__mt{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);
  background:var(--bg);border:1px solid var(--bd);border-radius:12px;
  padding:10px;width:180px;z-index:10;pointer-events:none;opacity:0;transition:opacity .15s;
  box-shadow:0 8px 24px rgba(0,0,0,.5)}
.__bd:hover .__mt{opacity:1;pointer-events:auto}
.__mt_sphere{width:64px;height:64px;border-radius:50%;margin:0 auto 8px;
  border:1px solid rgba(255,255,255,.06)}
.__mt_row{display:flex;justify-content:space-between;font-size:10px;padding:1px 0;
  font-family:ui-monospace,'Cascadia Code',monospace}
.__mt_k{color:var(--fg3)}.__mt_v{color:var(--fg);font-weight:500}
.__mt::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);
  border:5px solid transparent;border-top-color:var(--bd)}
`;

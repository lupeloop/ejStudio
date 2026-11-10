// ════════════════════════════════════════════════════════════════════════════
//  ejLogger cluster — the Live cluster, drawn from the cluster sidecar files
//  (page-<profile>, gauges, labels, trim, warnlimits, display, warmup .properties)
// ════════════════════════════════════════════════════════════════════════════
const CLU=(()=>{
  // key = value sidecars; # and ; comment lines; keys keep their case (warnlimits keys are parameter names)
  function props(txt){ const o={}, order=[]; for(const ln of String(txt||'').split(/\r?\n/)){ const t=ln.trim(); if(!t||t[0]==='#'||t[0]===';') continue; const i=t.indexOf('='); if(i<0) continue; const k=t.slice(0,i).trim(), v=t.slice(i+1).trim(); o[k]=v; order.push(k); } Object.defineProperty(o,'_order',{value:order}); return o; }
  const num=(v,d)=>{ const n=parseFloat(v); return Number.isFinite(n)?n:d; };
  const bool=(v,d)=>v==null||v===''?d:String(v).toLowerCase()==='true';
  // RomRaider profile XML → [{id,units}] for dash="selected", externals mapped to ejLogger wideband ids
  const EXT={'X_AEM_UEGO_Wideband_[9600_baud]':'wb:aem','X_Innovate_Wideband_AFR':'wb:innovate','X_PLX_O2_-_Wideband':'wb:plx'};
  function profile(xml){ const out=[]; const re=/<(parameter|ecuparam|switch|external)\s+([^>]*?)\/?>/g; let m;
    while((m=re.exec(xml))){ const a={}; m[2].replace(/(\w+)="([^"]*)"/g,(_,k,v)=>{ a[k]=v; }); if(a.dash!=='selected'&&a.livedata!=='selected') continue;
      if(m[1]==='external'){ const id=EXT[a.id]; if(id) out.push({id,units:a.units||''}); } else out.push({id:a.id,units:a.units||''}); }
    return out; }
  // res = {dir, files:{name:text}, profiles:{name:xml}}
  function parse(res){ const P={}; for(const [n,t] of Object.entries(res.files||{})) P[n.replace(/\.properties$/,'')]=props(t);
    const profiles={}; for(const [n,x] of Object.entries(res.profiles||{})) profiles[n.replace(/\.xml$/i,'')]=profile(x);
    const g=P.gauges||{}, alias={}, roles={}, gauge={};
    for(const k of g._order||[]){ let m;
      if((m=k.match(/^alias\.(.+)$/))) alias[m[1]]=g[k];
      else if((m=k.match(/^role\.(.+)$/))) roles[m[1]]=g[k];
      else if((m=k.match(/^gauge\.(.+)\.(name|title|unit|flags|lunit)$/))){ (gauge[m[1]]=gauge[m[1]]||{})[m[2]]=g[k]; } }
    const lab=P.labels||{}, titles=[], units=[]; for(const k of lab._order||[]){ if(k.startsWith('title.')) titles.push([k.slice(6).toLowerCase(),lab[k]]); else if(k.startsWith('unit.')) units.push([k.slice(5).toLowerCase(),lab[k]]); }
    const wlist=wl=>{ const w=[]; for(const k of wl._order||[]){ if(k.includes('.')&&!/[A-Z ]/.test(k)) continue; if(String(wl[k]).trim().toLowerCase()==='off'){ w.push([k.toLowerCase(),null]); continue; } const n=String(wl[k]).split(',').map(s=>parseFloat(s)); if(n.length>=3&&n.slice(0,3).every(Number.isFinite)) w.push([k.toLowerCase(),n]); } return w; };
    const wl=P.warnlimits||{}, warn=wlist(wl).filter(([,n])=>n), warnBy={}; for(const f of Object.keys(P)) if(f.startsWith('warnlimits-')){ const own=wlist(P[f]); warnBy[f.slice(11)]=own.concat(warn.filter(([k])=>!own.some(([k2])=>k2===k))).filter(([,n])=>n); }
    return {dir:res.dir,P,profiles,alias,roles,gauge,titles,units,warn,warnBy,hyst:num(wl['hysteresis.frac'],0.05)}; }
  const slotsFor=(C,name)=>{ const p=(C.P['page-'+name]||C.P.page||{}).slots; return p?p.split(',').map(s=>s.trim()).filter(Boolean):null; };

  // warn tier 0–3 and ramp 0–1 (how close to the approach threshold)
  function tierOf(C,name,v){ if(!Number.isFinite(v)) return [0,0]; const lname=name.toLowerCase(); const w=((C.cur&&C.warnBy&&C.warnBy[C.cur])||C.warn).find(([k])=>lname.includes(k)); if(!w) return [0,0];
    const [a,b,c,d]=w[1]; let down=c<a; if(a===c) down=Number.isFinite(d)?d<a:true;
    const past=x=>down?v<=x:v>=x, t=past(c)?3:past(b)?2:past(a)?1:0;
    const span=Math.abs(c-a)||Math.abs(a)*0.1||1, r=t?1:Math.max(0,1-Math.abs(v-a)/span); return [t,a===c?0:r]; }

  // ── DOM ──
  const css=`
@font-face{font-family:ejDIN;src:url('ejLogger/ui/fonts/HunDIN1451.ttf')}@font-face{font-family:ejMono;src:url('ejLogger/ui/fonts/SpaceMono-Regular.ttf')}
#ejl .cl{width:min(100%,calc((100vh - 130px)*1024/600));aspect-ratio:1024/600;background:#000;position:relative;display:grid;container-type:inline-size;padding:.8cqw .6cqw;gap:0;user-select:none}
#ejl .cl .g{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;overflow:hidden;color:#f2f2f2;--s:1}
#ejl .cl .walls{position:absolute;inset:.8cqw .6cqw;pointer-events:none;z-index:1}#ejl .cl .walls i{position:absolute;background:var(--dvc,#424242);border-radius:9px}
#ejl .cl .t{color:var(--tc,#f2f2f2);font:700 calc(1.75cqw*var(--s)*var(--ts,1)) ejMono,var(--mono);letter-spacing:.04em;white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:clip}
#ejl .cl .vr{display:flex;align-items:flex-end;gap:.5cqw;line-height:.86;margin:.9cqw 0 .5cqw}
#ejl .cl .v{color:var(--vc,#f2f2f2);font:calc(9.6cqw*var(--s)*var(--vs,1))/.9 ejDIN,"Arial Narrow",sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;transition:color .18s}
#ejl .cl .u{font:calc(1.25cqw*var(--s)*var(--us,1)) ejMono,var(--mono);color:var(--uc,#8a8a92);padding-bottom:.4cqw}
#ejl .cl .mm{color:var(--mc,#f2f2f2);font:calc(2.3cqw*var(--s)*var(--ms,1)) ejDIN,sans-serif;letter-spacing:.03em;display:flex;justify-content:space-between;width:88%;white-space:nowrap}#ejl .cl .mm.c{justify-content:center}
#ejl .cl .g.t1 .v{color:var(--wa,#f0b030)}#ejl .cl .g.t2 .v,#ejl .cl .g.t3 .v{color:var(--wr,#ff4040)}
#ejl .cl.glow .g.t1 .v{text-shadow:0 0 1.2cqw color-mix(in srgb,var(--wa,#f0b030) 55%,transparent)}#ejl .cl.glow .g.t2 .v,#ejl .cl.glow .g.t3 .v{text-shadow:0 0 1.4cqw color-mix(in srgb,var(--wr,#ff4040) 60%,transparent)}
#ejl .cl .g.t1 .v{animation:clf 1.2s ease-in-out infinite}#ejl .cl .g.t2 .v{animation:clf .7s ease-in-out infinite}#ejl .cl .g.t3 .v{animation:clf .32s steps(2) infinite}@keyframes clf{50%{opacity:.45}}
#ejl .cl .pill{margin-top:.5cqw;font:calc(2cqw*var(--s)) ejDIN,sans-serif;letter-spacing:.14em;padding:.25cqw 1.3cqw;border-radius:2cqw;white-space:nowrap}
#ejl .cl .rd{position:absolute;left:.6cqw;top:.4cqw;display:flex;flex-direction:column;align-items:flex-start;gap:.2cqw;font:700 1.45cqw ejMono,var(--mono)}#ejl .cl .rd i{width:1.2cqw;height:1.2cqw;border-radius:50%}
#ejl .cl .tr{justify-content:space-around;padding:1cqw 0}#ejl .cl .tr .row{display:flex;align-items:baseline;gap:1.6cqw;font:calc(6cqw*var(--trs,1)) ejDIN,sans-serif}#ejl .cl .tr .row b{font:calc(3.3cqw*var(--trs,1)) ejDIN,sans-serif;color:#8a8a92;letter-spacing:.08em;font-weight:400}
#ejl .cl .tr .row span,#ejl .cl .tr .tot{color:var(--vc,#f2f2f2)}#ejl .cl .tr .tot{font:calc(8.4cqw*var(--trs,1)) ejDIN,sans-serif}#ejl .cl .tr.open .row,#ejl .cl .tr.open .tot{color:#6a6a72}
#ejl .cl .clol{position:absolute;font:700 1.3cqw ejMono,var(--mono);padding:.1cqw .6cqw;border-radius:.4cqw}
#ejl .cl .ring{position:absolute;inset:0;pointer-events:none;transition:opacity .5s}
#ejl .cl.ol .g{border:var(--olw,1px) solid var(--olc,#2a2a2e);margin:2px}#ejl .cl{background:var(--bg0,#000)}#ejl .cl .tr .row b{color:var(--uc,#8a8a92)}#ejl .cl .g{border-radius:var(--rad,0)}
#ejl .cl.ed .g{cursor:pointer}#ejl .cl.ed .g:hover{background:#0a0a0d}#ejl .cl.ed .g.tsel{outline:2px solid var(--acc);outline-offset:-2px;z-index:2}#ejl .cl.ed .g.nl{opacity:.45}#ejl .cl.ed .g.dragover{background:var(--acc-d)}#ejl .cl .g.nl .v{color:#3a3a40}
#ejl .cl .dock.left{left:0;right:auto;border-left:0;border-right:var(--dkbw,0px) solid var(--dkbc,transparent);transform:translateX(-1.2cqw)}#ejl .cl .dock.left.on{transform:none}
#ejl .cl .dock{position:absolute;top:0;bottom:0;right:0;width:calc(var(--dkw,92)/1024*100cqw);background:var(--dkbg,#060608);display:flex;flex-direction:column;justify-content:space-evenly;align-items:stretch;padding:1cqw .6cqw;gap:.8cqw;z-index:5;opacity:0;transform:translateX(1.2cqw);pointer-events:none;transition:opacity .18s ease,transform .18s ease;border-left:var(--dkbw,0px) solid var(--dkbc,transparent)}
#ejl .cl .dock.on{opacity:1;transform:none;pointer-events:auto}
#ejl .cl .dock button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5cqw;background:var(--dkbtn,transparent);border:var(--dkbtnb,0px) solid var(--dkbtnc,transparent);border-radius:var(--dkr,0px);color:var(--dkic,#E8E8EE);font:700 calc(1.15cqw*var(--dkls,1.15)) ejMono,var(--mono);letter-spacing:.08em;cursor:pointer;padding:0}
#ejl .cl .dock button svg{width:calc(3.2cqw*var(--dkis,1.3));height:calc(3.2cqw*var(--dkis,1.3))}#ejl .cl .dock button.act,#ejl .cl .dock button:active{color:var(--dkac,#E4AA28)}#ejl .cl .dock.nolab button span{display:none}
#ejl .cl .dock button{position:relative}#ejl .cl .dock .dbd{position:absolute;top:6%;right:14%;min-width:1.7em;height:1.7em;border-radius:1em;background:#e02424;color:#fff;font:700 calc(1.2cqw) ejMono,monospace;display:grid;place-items:center;font-style:normal}#ejl .cl .dock button[data-dk=codes] svg{color:#ff6b6b}
#ejl .cl .pg{position:absolute;bottom:-1.8em;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center}#ejl .cl .pg i{width:7px;height:7px;border-radius:50%;background:#333;cursor:pointer}#ejl .cl .pg i.on{background:var(--acc)}
`;
  mk('style',null,document.head).textContent=css;
  const signed=(v,dp)=>{ const s=Math.abs(v).toFixed(dp); return (+s===0?'':v>0?'+':'-')+s; };
  const dpOf=s=>{ const m=String(s||'').match(/\.(\d+)/); return m?m[1].length:0; };
  const fmtNum=(v,dp)=>{ const s=Math.abs(v).toFixed(dp); return (v<0&&+s!==0?'-':'')+s; };

  let M=null; // mounted state
  // ctx: {C, profile, sel:[{id,units}], byId, page, rec, recT0, hz, logging}
  function sig(ctx){ return [ctx.profile,ctx.page,ctx.edit?'e'+ctx.selected:'',ctx.ver||0,Object.keys(ctx.byId||{}).length,sel2(ctx).map(s=>s.id+'|'+s.units).join(','),ctx.C&&ctx.C.dir].join('#'); }
  const sel2=ctx=>ctx.sel||[];
  // logged item for a cluster id (direct or via alias.<loggedId> = <clusterId>)
  function find(ctx,cid){ const C=ctx.C; return sel2(ctx).find(s=>s.id===cid)||sel2(ctx).find(s=>C.alias[s.id]===cid)||(cid.startsWith('X_')&&sel2(ctx).find(s=>s.id===EXT[cid])); }
  const gid=(C,s)=>C.alias[s.id]||s.id;
  function role(ctx,r){ const C=ctx.C, id=C.roles[r]; if(!id) return null; return find(ctx,id)||sel2(ctx).find(s=>C.alias[s.id]===id); }
  function titleOf(C,cid,name){ const g=C.gauge[cid]; if(g&&g.title) return g.title; const n=name.toLowerCase(); const t=C.titles.find(([f])=>n.includes(f)); return t?t[1]:name.toUpperCase(); }
  function unitOf(C,cid,units){ const g=C.gauge[cid]; if(g&&g.unit) return g.unit; const u=String(units||'').toLowerCase(); const t=C.units.find(([f])=>u.includes(f)); return t?t[1]:units; }

  const GRIDS={'2x2':[2,2],'3x2':[3,2],'3x3':[3,3],'4x2':[4,2],'4x3':[4,3]};
  function pageOf(C,name){ return C.P['page-'+name]||C.P.page||{}; }
  function themeOf(C,name){ return C.P['theme-'+name]||{}; }
  function layout(ctx){ const C=ctx.C, P=C.P, pg=pageOf(C,ctx.profile);
    let slots=slotsFor(C,ctx.profile)||sel2(ctx).map(s=>gid(C,s)); if(!ctx.edit) slots=slots.filter(cid=>find(ctx,cid));
    const fixed=GRIDS[String(pg.grid||'').toLowerCase()], per=fixed?fixed[0]*fixed[1]:slots.length<=9?9:12, pages=Math.max(1,Math.ceil(slots.length/per)), page=Math.min(ctx.page||0,pages-1);
    return {slots,per,pages,page,fixed,list:slots.slice(page*per,page*per+per)}; }
  function mount(el,ctx){ const C=ctx.C, P=C.P, disp=P.display||{}, trim=P.trim||{}, th=themeOf(C,ctx.profile), base=P['theme-base']||{};
    const L=layout(ctx), list=L.list, n=list.length;
    const afc=C.roles.AFC_SOURCE, afl=C.roles.AFL_SOURCE, merge=bool(trim.enabled,true)&&L.slots.includes(afc)&&L.slots.includes(afl);
    const cols=L.fixed?L.fixed[0]:n<=3?Math.max(n,1):n===4?2:n<=9?3:4, s=cols>=4?0.8:cols<=2?1.25:1;
    const tget=(cid,k)=>th['tile.'+cid+'.'+k];
    el.innerHTML=''; const outl=num(th['tile.outline']!=null?th['tile.outline']:base['tile.outline'],0), rad=num(th['tile.radius']!=null?th['tile.radius']:base['tile.radius'],0);
    const cl=mk('div','cl'+(bool(disp['warn.glow'],true)?' glow':'')+(outl>0?' ol':'')+(ctx.edit?' ed':''),el); cl.style.gridTemplateColumns=`repeat(${cols},1fr)`; cl.style.setProperty('--rad',rad+'px');
    const G=k=>th[k]!=null&&th[k]!==''?th[k]:base[k]; const GV={digits:'--vc',titles:'--tc',units:'--uc',minmax:'--mc',divider:'--dvc',outline:'--olc','warn.amber':'--wa','warn.red':'--wr',background:'--bg0'};
    for(const [k,v] of Object.entries(GV)){ const c=G(k); if(/^#[0-9a-f]{6}$/i.test(String(c||'').trim())) cl.style.setProperty(v,String(c).trim()); }
    const dvw=num(G('divider.px'),NaN); if(Number.isFinite(dvw)) cl.style.setProperty('--dvw',dvw+'px'); if(outl>0) cl.style.setProperty('--olw',outl+'px');
    const clc=G('clol.cl'), olc=G('clol.ol');
    const tiles=[]; const used=new Set();
    // placement: slots fill the grid in order; a tile can span cells (tile.<id>.span = 2x1, 1x2, 2x2, 3x1 …); the merged TRIMS tile is 1x2
    const occ2=new Set(); let maxR=0; const spanOf=cid=>{ const m=String(tget(cid,'span')||'').match(/^(\d)x(\d)$/); return m?[Math.min(+m[1],cols),Math.min(+m[2],4)]:null; };
    const place=(w,h)=>{ for(let r=0;r<16;r++) for(let c=0;c<=cols-w;c++){ let ok=true; for(let a=0;a<h&&ok;a++) for(let b=0;b<w;b++) if(occ2.has((r+a)+','+(c+b))){ ok=false; break; }
      if(ok){ for(let a=0;a<h;a++) for(let b=0;b<w;b++) occ2.add((r+a)+','+(c+b)); maxR=Math.max(maxR,r+h); return [r,c]; } } return [0,0]; };
    const put=(d,cid,def)=>{ const [w,h]=spanOf(cid)||def||[1,1], [r,c]=place(w,h); d.style.gridRow=`${r+1} / span ${h}`; d.style.gridColumn=`${c+1} / span ${w}`; d._p={r,c,w,h}; const hero=w>=2&&h>=2?1.9:w>=2?1.35:h>=2?1.25:1; if(hero>1) d.classList.add('hero'); return hero; };
    const style=(d,cid)=>{ for(const k of ['tc','vc','mc','uc']){ const v=tget(cid,k); if(v) d.style.setProperty('--'+k,v); } for(const k of ['ts','vs','ms','us']){ const v=num(tget(cid,k),NaN); if(Number.isFinite(v)) d.style.setProperty('--'+k,v); } };
    const editable=(d,cid)=>{ if(!ctx.edit) return; d.dataset.cid=cid; d.draggable=true; if(cid===ctx.selected) d.classList.add('tsel');
      d.onclick=()=>ctx.onSelect&&ctx.onSelect(cid); d.ondragstart=e=>{ e.dataTransfer.setData('text/plain',cid); };
      d.ondragover=e=>{ e.preventDefault(); d.classList.add('dragover'); }; d.ondragleave=()=>d.classList.remove('dragover');
      d.ondrop=e=>{ e.preventDefault(); d.classList.remove('dragover'); const from=e.dataTransfer.getData('text/plain'); if(from&&from!==cid&&ctx.onMove) ctx.onMove(from,cid); }; };
    list.forEach((cid,i)=>{ if(used.has(i)) return; const it=find(ctx,cid), p=(it&&ctx.byId[it.id])||{name:(C.gauge[cid]||{}).name||cid};
      const d=mk('div','g'+(it?'':' nl'),cl); style(d,cid);
      if(merge&&(cid===afc||cid===afl)){ const other=cid===afc?afl:afc, j=list.indexOf(other); if(j>=0) used.add(j); const hz=put(d,afc,[1,j>=0?2:1]); d.style.setProperty('--s',s*(hz>1.3?1.2:1));
        d.classList.add('tr'); d.style.setProperty('--trs',s*Math.min(1.6,num(trim['component.scale'],1.6))/1.6*num(tget(afc,'vs'),1));
        d.innerHTML=`<div class="t">${esc(trim.title||'TRIMS')}</div><div class="row"><b>AFC</b><span data-r="afc">--</span></div><div class="tot" data-r="tot">--</div><div class="row"><b>AFL</b><span data-r="afl">--</span></div>${bool(trim['clol.label'],true)?`<span class="clol" style="left:${num(trim['clol.x'],86)}%;top:${num(trim['clol.y'],7)}%"></span>`:''}`;
        editable(d,afc); tiles.push({kind:'trim',el:d}); return; }
      { const hz=put(d,cid); d.style.setProperty('--s',s*hz); }
      const fl=((C.gauge[cid]||{}).flags||'').split(',').map(x=>x.trim()).filter(Boolean), bot=tget(cid,'bottom');
      d.innerHTML=`<div class="t">${esc(tget(cid,'title')||titleOf(C,cid,p.name))}</div><div class="vr"><span class="v">--</span><span class="u">${esc(it?unitOf(C,cid,it.units):'')}</span></div><div class="mm"></div>${fl.includes('recDot')?'<div class="rd"><i></i><span></span></div>':''}`;
      editable(d,cid); if(!ctx.edit&&it&&ctx.onTile){ d.style.cursor='pointer'; d.onclick=e=>{ e.stopPropagation(); ctx.onTile(keyOf(it),tget(cid,'title')||titleOf(C,cid,p.name),unitOf(C,cid,it.units),p.name); }; }
      tiles.push({kind:'g',el:d,cid,it,name:p.name,fl,bot,v:d.querySelector('.v'),mm:d.querySelector('.mm'),rd:d.querySelector('.rd'),disp:null,dp:null,last:''}); });
    // column walls: on a tile's right edge, one per row, only when a tile sits to its right in that row (original rrOS look)
    const rows=Math.max(L.fixed?L.fixed[1]:1,maxR,1); cl.style.gridTemplateRows=`repeat(${rows},1fr)`;
    { const occ={}; for(const T of tiles){ const q=T.el._p; if(!q) continue; for(let a=0;a<q.h;a++) for(let b=0;b<q.w;b++) occ[(q.r+a)+','+(q.c+b)]=T.el; }
      const wl=mk('div','walls',cl), on=bool(G('wall.on'),true), len=Math.max(.1,Math.min(1,num(G('wall.len'),0.72))), px=num(G('divider.px'),2), ron=bool(G('rowdiv.on'),false), rlen=Math.max(.1,Math.min(1,num(G('rowdiv.len'),0.8))), rpx=num(G('rowdiv.px'),1), rc=G('rowdiv');
      for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){ const a=occ[r+','+c];
        if(on&&a&&c+1<cols&&occ[r+','+(c+1)]&&occ[r+','+(c+1)]!==a){ const w=mk('i',null,wl); w.style.left=`calc(${(c+1)/cols*100}% - ${px/2}px)`; w.style.width=px+'px'; w.style.top=((r+(1-len)/2)/rows*100)+'%'; w.style.height=(len/rows*100)+'%'; }
        if(ron&&a&&r+1<rows&&occ[(r+1)+','+c]&&occ[(r+1)+','+c]!==a){ const w=mk('i',null,wl); w.style.top=`calc(${(r+1)/rows*100}% - ${rpx/2}px)`; w.style.height=rpx+'px'; w.style.left=((c+(1-rlen)/2)/cols*100)+'%'; w.style.width=(rlen/cols*100)+'%'; if(/^#[0-9a-f]{6}$/i.test(rc||'')) w.style.background=rc; } } }
    const wu=P.warmup||{}; let ring=null; if(bool(wu.enabled,true)&&bool(wu['ring.enabled'],true)){ ring=document.createElementNS('http://www.w3.org/2000/svg','svg'); ring.setAttribute('class','ring'); ring.setAttribute('viewBox','0 0 1024 600'); ring.setAttribute('preserveAspectRatio','none'); const px=num(wu['ring.px'],5);
      ring.innerHTML=`<rect x="${px/2}" y="${px/2}" width="${1024-px}" height="${600-px}" fill="none" stroke="#1a1a1e" stroke-width="${px}" ${bool(wu['ring.track'],true)?'':'opacity="0"'}/><rect class="rp" x="${px/2}" y="${px/2}" width="${1024-px}" height="${600-px}" fill="none" stroke-width="${px}" pathLength="100" stroke-dasharray="0 100"/>`; cl.appendChild(ring); }
    // dock (theme keys dock.*; profile theme, then base)
    const DK={'dock.bg':'--dkbg','dock.icon':'--dkic','dock.active':'--dkac','dock.button':'--dkbtn','dock.button.border':'--dkbtnc','dock.border':'--dkbc'};
    for(const [k,v] of Object.entries(DK)){ const c=G(k); if(/^#[0-9a-f]{6}$/i.test(String(c||'').trim())) cl.style.setProperty(v,String(c).trim()); }
    for(const [k,v,u] of [['dock.width','--dkw',''],['dock.icon.size','--dkis',''],['dock.label.size','--dkls',''],['dock.radius','--dkr','px'],['dock.border.px','--dkbw','px'],['dock.button.border.px','--dkbtnb','px']]){ const n=num(G(k),NaN); if(Number.isFinite(n)) cl.style.setProperty(v,n+u); }
    const ICON={qr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
      reset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
      profiles:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="5" rx="1"/><path d="M3 20h18"/></svg>',
      rec:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>'};
    const LAB={qr:'QR',reset:'RESET',profiles:'PROFILES',codes:'CODES',rec:'REC'}; ICON.codes='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 10h2l2-3h5l2 2h3v3h2v4h-2v2h-4l-2 2H8l-2-3H4z"/><path d="M11 11v3M11 16v.5"/></svg>';
    const dock=mk('div','dock'+(bool(G('dock.labels'),true)?'':' nolab')+(String(G('dock.side')||'right')==='left'?' left':''),cl);
    const DO=String(G('dock.order')||'qr,reset,profiles,codes,rec').split(',').map(x=>x.trim()).filter(x=>ICON[x]); if(ctx.dtc&&!DO.includes('codes')) DO.splice(Math.max(0,DO.indexOf('rec')>=0?DO.indexOf('rec'):DO.length),0,'codes');
    DO.forEach(k=>{ const b=mk('button',null,dock); b.dataset.dk=k; b.innerHTML=ICON[k]+`<span>${LAB[k]}</span>`+(k==='codes'&&ctx.dtc?`<i class="dbd">${ctx.dtc}</i>`:''); b.onclick=e=>{ e.stopPropagation(); ctx.onDock&&ctx.onDock(k); wake(); }; });
    const wake=()=>{ if(!M) return; M.dockT=performance.now(); };
    if(!ctx.edit&&!ctx.noDock) cl.addEventListener('click',wake); if(ctx.noDock) dock.style.display='none';
    if(L.pages>1){ const d=mk('div','pg',cl); for(let k=0;k<L.pages;k++){ const i=mk('i',k===L.page?'on':'',d); i.onclick=()=>{ ctx.onPage&&ctx.onPage(k); }; } }
    M={dock,dockT:-1e9,dhp:num(G('dock.hide.parked'),10)*1000,dhm:num(G('dock.hide.moving'),3)*1000,sig:sig(ctx),clc:/^#/.test(clc||'')?clc:null,olc:/^#/.test(olc||'')?olc:null,wa:/^#[0-9a-f]{6}$/i.test(G('warn.amber')||'')?G('warn.amber'):'#f0b030',cl,tiles,ring,tau:num(disp['ease.tau.ms'],55),ramp:bool(disp['color.ramp'],true),wbcut:num(disp['wb.cut.afr'],24),minload:num(disp['lambda.dev.minload'],1),wu,trim,dim:P.dimming||{},coolEta:{t:0,v:null,rate:0}}; }

  // night dimming: offline sunrise/sunset for the configured lat/lon (NOAA approximation)
  function sunTimes(lat,lon,d){ const rad=Math.PI/180, n=Math.floor((d-new Date(d.getFullYear(),0,0))/864e5), g=2*Math.PI/365*(n-1);
    const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
    const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
    const ha=Math.acos(Math.max(-1,Math.min(1,Math.cos(90.833*rad)/(Math.cos(lat*rad)*Math.cos(dec))-Math.tan(lat*rad)*Math.tan(dec))))/rad;
    const utc0=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()); return [utc0+(720-4*(lon+ha)-eq)*6e4, utc0+(720-4*(lon-ha)-eq)*6e4]; }
  let dimCache={t:0,night:false};
  function isNight(D){ const mode=String(D.mode||'auto').toLowerCase(); if(mode==='night') return true; if(mode==='day') return false;
    const now=Date.now(); if(now-dimCache.t<60000) return dimCache.night; const [rise,set]=sunTimes(num(D.lat,49.2827),num(D.lon,-123.1207),new Date());
    dimCache={t:now,night:now<rise+num(D['sunrise.offset.min'],15)*6e4||now>set-num(D['sunset.offset.min'],15)*6e4}; return dimCache.night; }

  function frame(el,ctx,dt){ if(!ctx.C) return; if(!M||M.sig!==sig(ctx)||!el.contains(M.cl)) mount(el,ctx); const C=ctx.C; C.cur=String(ctx.profile||'').replace(/[^A-Za-z0-9_-]/g,'_'); const val=s=>s?ctx.num[keyOf(s)]:undefined, txt=s=>s?ctx.cur[keyOf(s)]:undefined, k=1-Math.exp(-dt/Math.max(1,M.tau));
    if(M.dock){ const sp=ctx.speed, hold=sp>=1?M.dhm:M.dhp; M.dock.classList.toggle('on',!!ctx.dockForce||performance.now()-M.dockT<hold); const rb=M.dock.querySelector('[data-dk=rec]'); if(rb) rb.classList.toggle('act',!!ctx.rec); }
    M.cl.style.filter=!ctx.edit&&isNight(M.dim)?`brightness(${Math.max(.1,Math.min(1,num(M.dim.brightness,42)/100))})`:'';
    const wbS=role(ctx,'WIDEBAND_SOURCE'), ffbS=role(ctx,'COMMANDED_FUEL_SOURCE'), loadS=role(ctx,'LOAD_SOURCE')||sel2(ctx).find(s=>/^Engine Load/.test((ctx.byId[s.id]||{}).name||''));
    const toL=(s,v)=>/lambda/i.test(s.units)?v:v/14.7;
    let dev=null; if(wbS&&ffbS&&Number.isFinite(val(wbS))&&Number.isFinite(val(ffbS))&&(!loadS||!(val(loadS)<M.minload))) dev=toL(wbS,val(wbS))-toL(ffbS,val(ffbS));
    for(const T of M.tiles){
      if(T.kind==='trim'){ const a=role(ctx,'AFC_SOURCE')||find(ctx,C.roles.AFC_SOURCE), l=role(ctx,'AFL_SOURCE')||find(ctx,C.roles.AFL_SOURCE), av=val(a), lv=val(l), q=s=>T.el.querySelector(`[data-r=${s}]`);
        q('afc').textContent=Number.isFinite(av)?signed(av,1):'--'; q('afl').textContent=Number.isFinite(lv)?signed(lv,1):'--'; q('tot').textContent=Number.isFinite(av)&&Number.isFinite(lv)?fmtNum(av+lv,1):'--';
        const cs=role(ctx,'CLOL_SOURCE'), cv=val(cs), pill=T.el.querySelector('.clol'), closed=num(M.trim['clol.closed'],8);
        if(pill){ if(Number.isFinite(cv)){ const isC=Math.round(cv)===closed; pill.textContent=isC?'CL':'OL'; const pc=isC?(M.clc||'#5a9fd4'):(M.olc||'#3baf84'); pill.style.color=pc; pill.style.background=`color-mix(in srgb,${pc} 22%,#000)`; pill.style.display=''; } else pill.style.display='none'; }
        T.el.classList.toggle('open',bool(M.trim['grey.when.open'],false)&&Number.isFinite(cv)&&Math.round(cv)!==closed); continue; }
      const s=T.it; if(!s){ if(T.last!=='--'){ T.v.textContent='--'; T.last='--'; T.mm.innerHTML='<span>NOT LOGGED</span>'; T.mm.className='mm c'; } continue; }
      const v=val(s), t=txt(s);
      let [tier,ramp]=T.fl.includes('devWarn')?(dev==null?[0,0]:tierOf(C,'lambda deviation',dev)):tierOf(C,(ctx.byId[s.id]||{}).name||T.name,v);
      T.el.classList.toggle('t1',tier===1); T.el.classList.toggle('t2',tier===2); T.el.classList.toggle('t3',tier===3);
      if(Number.isFinite(v)){ if(T.dp==null||t) T.dp=dpOf(t); if(T.disp==null||tier||!M.tau) T.disp=v; else T.disp+= (v-T.disp)*k; }
      let out=Number.isFinite(v)?(Math.abs(T.disp-v)<Math.pow(10,-T.dp)/2?t:fmtNum(T.disp,T.dp)):'--';
      if(s.id.startsWith('wb:')&&Number.isFinite(v)&&!/lambda/i.test(s.units)&&v>=M.wbcut) out='- - - -';
      if(out!==T.last){ T.v.textContent=out; T.last=out; }
      T.v.style.color=!tier&&M.ramp&&ramp>0?`color-mix(in srgb,${M.wa} ${Math.round(ramp*100)}%,var(--vc,#f2f2f2))`:'';
      let mm='', cls='mm';
      const mn=ctx.mn[keyOf(s)], mx=ctx.mx[keyOf(s)], fl=T.fl, b=T.bot;
      const mode=b?b:fl.includes('rateDisplay')?'poll':fl.includes('hideMM')?'off':fl.includes('minOnly')?'min':fl.includes('maxOnly')?'max':'minmax';
      if(fl.includes('coolantPill')&&bool(M.wu.enabled,true)&&Number.isFinite(v)&&v<num(M.wu['threshold.c'],80)){
        const thr=num(M.wu['threshold.c'],80), E=M.coolEta, now=performance.now(); if(E.v==null){ E.v=v; E.t=now; } else if(now-E.t>15000){ E.rate=(v-E.v)/((now-E.t)/60000); E.v=v; E.t=now; }
        const eta=bool(M.wu['eta.enabled'],true)&&E.rate>0.05?'  '+Math.max(1,Math.round((thr-v)/E.rate))+'M':'';
        mm=`<span class="pill" style="color:#32C85A;background:#0d2a16">${esc(M.wu.text||'WARMING UP')}${eta}</span>`; cls='mm c'; }
      else if(mode==='poll') { mm=`<span>POLL ${ctx.logging&&ctx.hz?ctx.hz.toFixed(2):'--'}/S</span>`; cls='mm c'; }
      else if(mode==='off') mm='';
      else if(mode==='min') { mm=`<span>MIN ${mn?esc(mn.f):'--'}</span>`; cls='mm c'; }
      else if(mode==='max') { mm=`<span>MAX ${mx?esc(mx.f):'--'}</span>`; cls='mm c'; }
      else mm=`<span>MIN ${mn?esc(mn.f):'--'}</span><span>MAX ${mx?esc(mx.f):'--'}</span>`;
      if(T.mm.innerHTML!==mm) T.mm.innerHTML=mm; if(T.mm.className!==cls) T.mm.className=cls;
      if(T.rd){ const i=T.rd.firstChild, sp=T.rd.lastChild; if(ctx.rec){ const e=Math.max(0,(Date.now()-ctx.recT0)/1000|0); i.style.background='#32c85a'; sp.style.color='#32c85a'; sp.textContent=String(e/60|0).padStart(2,'0')+':'+String(e%60).padStart(2,'0'); }
        else if(ctx.logging){ i.style.background='#eb2323'; sp.style.color='#eb2323'; sp.textContent='STOPPED'; } else { i.style.background='#333'; sp.textContent=''; } }
    }
    if(M.ring){ const cs=role(ctx,'COOLANT_SOURCE'), cv=val(cs), lo=num(M.wu['coldstart.c'],20), hi=num(M.wu['threshold.c'],80);
      const on=Number.isFinite(cv)&&cv<hi; M.ring.style.opacity=on?1:0; if(on){ const f=Math.max(0,Math.min(1,(cv-lo)/(hi-lo))), rp=M.ring.querySelector('.rp');
        const hex=h=>[1,3,5].map(i=>parseInt(String(h).slice(i,i+2),16)), A=hex(M.wu['grad.cold']||'#EB2D2D'), B=hex(M.wu['grad.mid']||'#E4AA28'), Z=hex(M.wu['grad.ready']||'#32C85A');
        const mix=(p,q,u)=>p.map((x,i)=>x+(q[i]-x)*u|0), col=f<.5?mix(A,B,f*2):mix(B,Z,(f-.5)*2);
        rp.setAttribute('stroke-dasharray',`${(f*100).toFixed(2)} 100`); rp.setAttribute('stroke',`rgb(${col})`); } }
  }
  const keyOf=s=>s.id+'|'+(s.units||'');
  return {wakeDock:()=>{ if(M) M.dockT=performance.now(); },parse,profile,slotsFor,layout,pageOf,themeOf,titleOf,frame,GRIDS,find,reset:()=>{ M=null; }};
})();

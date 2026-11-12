// ════════════════════════════════════════════════════════════════════════════
//  ejStudio views — Graph · Tables (knock layer) · MAF Scaling · MAF Curve
// ════════════════════════════════════════════════════════════════════════════
const $=id=>document.getElementById(id);
const mk=(t,c,p)=>{ const e=document.createElement(t); if(c) e.className=c; if(p) p.appendChild(e); return e; };
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CVRO=typeof ResizeObserver!=='undefined'?new ResizeObserver(es=>{ for(const e of es){ const t=e.target; t._W=t.clientWidth; t._H=t.clientHeight; } }):null;
function sizeCanvas(cv){ if(cv._W==null||!CVRO){ cv._W=cv.clientWidth; cv._H=cv.clientHeight; if(CVRO&&!cv._ro){ cv._ro=1; CVRO.observe(cv); } } const dpr=devicePixelRatio||1, W=cv._W, H=cv._H; if(!W||!H){ cv._W=null; return null; }
  const w=Math.round(W*dpr), h=Math.round(H*dpr); if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
  const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); return {c,W,H}; }
function fmtT(ms){ const s=Math.max(0,ms)/1000, m=Math.floor(s/60); return m+':'+(s-m*60).toFixed(1).padStart(4,'0'); }
const lamK=d=>d==='afr'?LAM:1, uLbl=d=>d==='afr'?'AFR':'λ', dpOf=d=>d==='afr'?2:3;
const COL={rb:'#a78bfa',acc:'#e4aa28',wb:'#b794f6',ffb:'#facc15',ol:'#3baf84',cl:'#5a9fd4',red:'#ff1e1e',grid:'#26262c',lab:'#8a8a92',muted:'#7d7d85',amber:'#f0c060',green:'#32c85a'};

// ── table colour palettes; overlays pick colours that contrast with the active palette ──
const TPALS=[['classic','Classic',null],['traffic','Traffic',[[60,170,80],[235,215,70],[220,60,50]]],['coolwarm','Cool–warm',[[59,76,192],[221,221,221],[180,4,38]]],['thermal','Thermal',[[20,10,10],[170,30,20],[240,170,30],[255,250,220]]],
 ['viridis','Viridis',[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]]],['amber','Amber',[[26,20,8],[240,180,50]]],['grey','Grey',[[30,30,34],[215,215,219]]],['off','Off',[[18,18,22],[18,18,22]]],
 ['jet','Jet',[[0,0,143],[0,0,255],[0,255,255],[255,255,0],[255,0,0],[128,0,0]]],['turbo','Turbo',[[48,18,59],[70,130,248],[27,229,181],[164,252,60],[251,185,56],[228,70,10],[122,4,3]]],['inferno','Inferno',[[0,0,4],[87,16,110],[188,55,84],[249,142,9],[252,255,164]]],['magma','Magma',[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]]],
 ['plasma','Plasma',[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]]],['spectral','Spectral',[[94,79,162],[50,136,189],[171,221,164],[255,255,191],[253,174,97],[213,62,79],[158,1,66]]],['ice','Ice',[[8,20,40],[60,130,200],[220,240,255]]],['lime','Lime',[[8,26,10],[60,170,60],[210,250,160]]]];
const INKC=['#ff1e1e','#00e0ff','#e4aa28','#ffffff','#000000','#2050ff','#00f060','#ff00d0'], INK_CLASSIC={cur:'#ff1e1e',knk:'#ff1e1e',sel:'#e4aa28',chg:'#e4aa28',win:['#00d8ff','#00f060','#ffaa00'],fc:'#b46cff',heat:true};
const h2rgb=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16)), hexA=(h,a)=>'rgba('+h2rgb(h)+','+a+')', rlum=c=>{ const s=c.map(v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*s[0]+.7152*s[1]+.0722*s[2]; }, inkOut=h=>rlum(h2rgb(h))>.35?'#000':'#fff';
function palRGB(f){ const p=TPALS.find(x=>x[0]===UI.tpal)||TPALS[0]; f=Math.max(0,Math.min(1,f)); if(!p[2]){ const h=240*(1-f)/60, C=.5, X=C*(1-Math.abs(h%2-1)), m=.5, r=[[C,X,0],[X,C,0],[0,C,X],[0,X,C],[X,0,C],[C,0,X]][Math.min(5,Math.floor(h))]; return r.map(v=>Math.round((v+m)*255)); }
  const s=p[2], x=f*(s.length-1), i=Math.min(s.length-2,Math.floor(x)), k=x-i; return s[i].map((v,j)=>Math.round(v+(s[i+1][j]-v)*k)); }
const cellF=(v,lo,hi)=>hi>lo?(v-lo)/(hi-lo):0.5, cellBg=(v,lo,hi)=>'rgb('+palRGB(cellF(v,lo,hi))+')', cellFg=(v,lo,hi)=>rlum(palRGB(cellF(v,lo,hi)))>.28?'#000':'#fff';
let INKK='', INKV=INK_CLASSIC;
function INK(){ const id=UI.tpal||'classic'; if(INKK===id) return INKV; INKK=id; if(id==='classic') return INKV=INK_CLASSIC; const S=[]; for(let i=0;i<=20;i++) S.push(palRGB(i/20));
  const d=(a,b)=>{ const r=(a[0]+b[0])/2, dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2]; return Math.sqrt((2+r/256)*dr*dr+4*dg*dg+(2+(255-r)/256)*db*db); };
  const sc=INKC.map(h=>({h,s:Math.min(...S.map(c=>d(c,h2rgb(h))))})).sort((a,b)=>b.s-a.s); return INKV={cur:sc[0].h,knk:sc[0].h,sel:sc[1].h,chg:sc[1].h,win:[sc[0].h,sc[1].h,sc[2].h],fc:sc[2].h,heat:false}; }
function mafPop(b){ setPop(b,['cov','flt'],'MAF data and filters',ex=>{ for(const [l,fn] of [['OL calc',window.__mafOL],['Source',window.__mafSrc]]){ if(!fn) continue; const r=mk('div','spr',ex); mk('span','vlab',r).textContent=l; fn(r); } }); }
const FONT_MONO="ui-monospace,'SF Mono','JetBrains Mono',Menlo,Consolas,monospace";
function rpSample(L,i){ const o={}; for(const k in L.c) o[k]=fin(L.c[k][i]); if(o.maf==null&&o.load!=null&&o.rpm!=null) o.maf=o.load*o.rpm/60; o.wb=fin(L.wb[i]); o.ffb=fin(L.ffb[i]); if(o.torque==null&&L.rb&&L.rb.tq) o.torque=fin(L.rb.tq.pred[i]); const tg=o.tboost!=null?o.tboost:(L.rb&&L.rb.boost?fin(L.rb.boost.fin[i]):null); o.berr=tg!=null&&o.map!=null?tg-o.map:null; return o; }
const hasKey=(L,k)=>k==='maf'?!!(L.c.maf||(L.c.load&&L.c.rpm)):k==='berr'?!!(L.c.map&&(L.c.tboost||(L.rb&&L.rb.boost))):k==='torque'?!!(L.c.torque||(L.rb&&L.rb.tq)):!!L.c[k];
const NOTRACE={idx:1,idy:1};
// pressure display: tables/PIDs are kPa absolute internally; psi / bar shown as gauge (vs 101.325 kPa)
const PU={psi:{k:0.1450377,u:'psi',dp:1},kPa:{k:1,u:'kPa',dp:0},bar:{k:0.01,u:'bar',dp:2}};
function pDisp(kind){ const id=UI.pu||'psi', p=PU[id]||PU.psi, abs=kind==='abs'; return {k:p.k,o:abs&&id!=='kPa'?-ATM*p.k:0,dp:p.dp,u:p.u+(abs&&id==='kPa'?' abs':'')}; }
const PK={map:'abs',baro:'abs',berr:'rel'};
const SVG_GEAR="<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'/></svg>";
const SVG_TARGET="<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'><circle cx='12' cy='12' r='7'/><line x1='12' y1='1' x2='12' y2='5'/><line x1='12' y1='19' x2='12' y2='23'/><line x1='1' y1='12' x2='5' y2='12'/><line x1='19' y1='12' x2='23' y2='12'/></svg>";
function seg(host,items,cur,on){ const s=mk('div','seg',host); items.forEach(([v,t,tip])=>{ const b=mk('button',v===cur?'on':'',s); b.textContent=t; if(tip) b.title=tip; b.dataset.v=v;
  b.onclick=()=>{ s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); on(v); }; }); s.set=v=>s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.v==String(v))); return s; }

// ── warning tiles (Graph + Tables) ─────────────────────────────────────
let WT=null;
function WarnTiles(){ if(WT) return WT; const box=mk('div','wtiles',document.body); let sig='';
  const place=()=>{ const b=document.getElementById('t-evb'), r=b&&b.offsetParent?b.getBoundingClientRect():null; if(!r){ box.style.display='none'; return; } box.style.display=''; box.style.left=r.left+'px'; box.style.width=r.width+'px'; const up=r.top>innerHeight/2; box.classList.toggle('up',up); b.classList.toggle('wlu',up); if(up){ box.style.top=''; box.style.bottom=(innerHeight-r.top-1)+'px'; } else { box.style.bottom=''; box.style.top=(r.bottom-1)+'px'; } };
  { const evb=document.getElementById('t-evb'); if(evb&&window.IntersectionObserver) new IntersectionObserver(es=>{ box.style.visibility=es[0].isIntersecting?'':'hidden'; }).observe(evb); }
  addEventListener('resize',()=>{ if(box.childElementCount) place(); });
  WT={ update(){ const L=RP.L, list=[]; if(L) for(const fam in LIMITS){ const j=L.fam.findIndex((f,x)=>f===fam&&x!==L.wbj); if(j<0) continue; const v=logCol(L,j)[RP.i], t=warnTier(fam,v); if(t) list.push({fam,v,t}); }
    list.sort((a,b)=>b.t-a.t); const s=list.map(o=>o.fam+o.t+o.v).join('|'); if(s===sig) return; sig=s; const top=list.length?list[0].t:0, b=document.getElementById('t-evb');
    if(b){ b.classList.toggle('wl',!!list.length); b.classList.toggle('wl3',top>=3); } box.classList.toggle('t3',top>=3);
    box.innerHTML=list.slice(0,4).map(o=>`<div class="wtile t${o.t}"><i>${esc(o.fam)}</i><b>${Number.isFinite(o.v)?+o.v.toFixed(2):'—'}</b></div>`).join(''); if(list.length) place(); } }; return WT; }

// ════════════════════════════════════════════════════════════════════════════
//  GRAPH — 1-5 lanes; time zoom 10 s … full log; playhead right or centred
// ════════════════════════════════════════════════════════════════════════════
const GL=58, GR=10, GT=6, GB=18;
const TUNE_RANGE_KEY={'Engine Speed':'rpm','Engine Load':'load','Mass Airflow Sensor Voltage':'mafv','Coolant Temperature':'ect','Intake Air Temperature':'iat','Battery Voltage':'batt'};
function closeCtx(){ const m=document.getElementById('ctxm'); if(m) m.remove(); }
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('#ctxm')) closeCtx(); },true);
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeCtx(); },true);
function GraphView(side){ const CX=side==='b'?{get L(){return RP.B},get playT(){return RP.bT},get i(){return RP.bI}}:{get L(){return RP.L},get playT(){return RP.playT},get i(){return RP.i}}, SEEK=side==='b'?t=>setB(t):(t,sn)=>rpSeek(t,sn);
  const G=side==='2'?(UI.g2||(UI.g2=JSON.parse(JSON.stringify(UI.g)))):UI.g; let shown=false; const root=mk('div','view gv');
  const bar=mk('div','vbar',root);
  mk('span','vlab',bar).textContent='Lanes'; const nSeg=seg(bar,[1,2,3,4,5].map(n=>[n,String(n)]),G.n,v=>{ G.n=+v; save(); build(); });
  mk('span','vlab',bar).textContent='Window'; const winLab=mk('span','mono vval',bar); const full=mk('button','btn sm',bar); full.textContent='Full log'; full.title='Zoom out to the whole log (mouse wheel zooms)';
  full.onclick=()=>{ G.full=true; save(); dirty(); };
  mk('span','vlab',bar).textContent='Playhead'; seg(bar,[['right','Right'],['center','Centre']],G.mode,v=>{ G.mode=v; save(); dirty(); });
  mk('span','vfill',bar); if(side!=='b'&&side!=='2'){ const gm=mk('div','seg',bar); gm.innerHTML='<button class="on">Lanes</button><button>Scatter</button>'; gm.lastChild.onclick=()=>grMode('scatter');
    const pg=mk('button','ibtn',bar); pg.innerHTML=SVG_GEAR; pg.title='Pull detection'; pg.onclick=()=>setPop(pg,['pull'],'Pull detection'); } const wt=WarnTiles(root);
  const box=mk('div','gv-lanes',root), lanes=[];
  const V=[['v:wbffb','Wideband vs FFB target'],['v:wb','Wideband'],['v:idc','Injector duty (IDC)'],['v:avcsi','AVCS intake: actual vs target'],['v:avcse','AVCS exhaust: actual vs target'],['v:dthr','Throttle rate'],['v:aerr','AFR error vs target'],['v:rb_boost','Boost target: rebuilt vs logged'],['v:rb_map','Boost: actual vs target'],['v:rb_wg','WG duty: rebuilt vs logged'],['v:rb_tim','Total timing: rebuilt vs logged'],['v:rb_tq','Requested torque: table vs logged'],['v:rb_thr','Target throttle: table vs logged']];
  const vOK=(L,v)=>{ if(!L) return true; const rb=L.rb||{}; if(v==='v:idc') return !!idcOf(L); if(v==='v:avcsi'||v==='v:avcse') return !!(L.c[v.slice(2)]&&avcsTgt(L,v.slice(2))); if(v==='v:dthr') return !!dThr(L); if(v==='v:aerr') return !!afrErr(L); if(v==='v:wb') return !!L.c.wb; if(v==='v:wbffb') return !!(L.c.wb&&L.ffbSrc);
    if(v==='v:rb_map') return !!(rb.boost&&rb.boost.act); const k=v.slice(5); return !!rb[k]; };
  function build(){ box.innerHTML=''; lanes.length=0; while(G.lanes.length<5) G.lanes.push('');
    for(let k=0;k<G.n;k++){ const ln=mk('div','gv-lane',box), hd=mk('div','gv-hd',ln), sel=mk('select','sel',hd), ym=mk('span','gv-y',hd), val=mk('span','gv-val',hd), cv=mk('canvas','gv-cv',ln);
      const o={sel,val,cv,ym,k,el:ln}; sel.onchange=()=>{ G.lanes[k]=sel.value; save(); fillY(o); dirty(); };
      cv.addEventListener('wheel',e=>{ e.preventDefault(); if(G.full){ G.full=false; G.win=CX.L?Math.max(10000,CX.L.dur):G.win; } const L=CX.L; const mx=L?Math.max(10000,L.dur):3600000; G.win=Math.max(10000,Math.min(mx,G.win*(e.deltaY<0?0.8:1.25))); save(); dirty(); },{passive:false});
      cv.addEventListener('contextmenu',e=>{ e.preventDefault(); peakMenu(e,G.lanes[o.k],nearEv(e,cv)); }); let drag=null;
      cv.addEventListener('pointerdown',e=>{ if(e.button!==0) return; drag={x:e.clientX,off:RP.gOff,moved:false}; try{cv.setPointerCapture(e.pointerId);}catch(_){} });
      cv.addEventListener('pointermove',e=>{ if(!drag) return; const r=cv.getBoundingClientRect(), dx=e.clientX-drag.x; if(G.full&&CX.L){ if(Math.abs(dx)>2) drag.moved=true; if(drag.moved){ const f=Math.max(0,Math.min(1,(e.clientX-r.left-GL)/(r.width-GL-GR))); SEEK(f*CX.L.dur,false); } return; } if(Math.abs(dx)>3){ drag.moved=true; G.full=false; if(!RP.playing){ RP.gOff=drag.off-dx/(r.width-GL-GR)*G.win; dirty(); } } });
      cv.addEventListener('pointerup',e=>{ if(drag&&!drag.moved){ const r=cv.getBoundingClientRect(), f=(e.clientX-r.left-GL)/(r.width-GL-GR); if(f>=0&&f<=1){ const [t0,t1]=win(); RP.gOff=0; SEEK(t0+f*(t1-t0),true); } } drag=null; }); cv.addEventListener('pointercancel',()=>{ drag=null; });
      cv.addEventListener('pointermove',e=>{ if(!drag) laneTip(e,cv); }); cv.addEventListener('pointerleave',()=>$('tltip').classList.add('hidden'));
      lanes.push(o); }
    fill(); nSeg.set(G.n); dirty(); }
  function fill(){ const L=CX.L; const fams=[]; if(L) L.fam.forEach((f,j)=>{ if(f!=='Time'&&j!==L.wbj&&!WB_COL.test(L.headers[j])&&!fams.includes(f)) fams.push(f); });
    if(L&&!G.auto&&G.lanes.every(x=>!x)){ G.auto=1; const f=re=>fams.find(x=>re.test(x))||''; G.lanes=[f(/engine speed|\brpm\b/i),vOK(L,'v:wbffb')?'v:wbffb':'',f(/manifold relative|boost/i)||f(/manifold (absolute )?pressure/i),f(/feedback knock|\bfbkc\b/i),f(/^intake air temp|^IAT\b/i)].filter(Boolean); while(G.lanes.length<5) G.lanes.push(''); save(); }
    lanes.forEach(o=>{ const cur=G.lanes[o.k]||'';
      let h='<option value="">— choose a PID —</option><optgroup label="Derived">'+V.filter(([v])=>v!=='v:wb'&&vOK(L,v)).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')+'</optgroup><optgroup label="Logged">'+(vOK(L,'v:wb')?'<option value="v:wb">Wideband</option>':'')+fams.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('')+'</optgroup>';
      if(cur&&!cur.startsWith('v:')&&!fams.includes(cur)) h+=`<option value="${esc(cur)}" disabled>${esc(cur)} (not in this log)</option>`;
      o.sel.innerHTML=h; o.sel.value=cur; fillY(o); }); }
  // Y range per PID family: Auto · Fixed (own min/max) · Tune (matching tune axis)
  function fillY(o){ const id=G.lanes[o.k]||''; o.ym.innerHTML=''; if(!id) return; const mode=G.ymode[id]||'auto', tk=TUNE_RANGE_KEY[id];
    const opts=[['auto','A','Auto range'],['fixed','F','Fixed min/max']]; if(tk&&TUNE&&TUNE.ranges[tk]) opts.push(['tune','T','Tune axis range']);
    seg(o.ym,opts,mode,v=>{ G.ymode[id]=v; save(); fillY(o); dirty(); });
    if(id==='v:wb'||id==='v:wbffb'){ const sp=mk('span','',o.ym); sp.style.marginLeft='6px'; seg(sp,[['s','Smoothed','Wideband smoothing '+(UI.tauLast||UI.tau||400)+' ms'],['r','Raw']],UI.tau>0?'s':'r',v=>{ if(v==='r'){ if(UI.tau>0) UI.tauLast=UI.tau; UI.tau=0; } else UI.tau=UI.tauLast||400; save(); RP.dirty=true; lanes.forEach(fillY); dirty(); }); }
    if(mode==='fixed'){ const f=G.yfix[id]||(G.yfix[id]={lo:null,hi:null});
      for(const k of ['lo','hi']){ const inp=mk('input','num',o.ym); inp.type='number'; inp.step='any'; inp.placeholder=k==='lo'?'min':'max'; inp.value=f[k]??''; inp.onchange=()=>{ const x=parseFloat(inp.value); f[k]=Number.isFinite(x)?x:null; save(); dirty(); }; } } }
  function peaks(id){ const s=series(id), L=CX.L; if(!s||!L) return null; const key='pk|'+id+'|'+UI.wbDisp+'|'+UI.pu; if(L.ser[key]) return L.ser[key];
    const a=s.a, N=L.N, W=Math.max(3,Math.round(1500/Math.max(1,L.dur/Math.max(1,N)))), hi=[], lo=[]; let gx=-1, gn=-1;
    for(let i=0;i<N;i++){ const v=a[i]; if(!Number.isFinite(v)) continue; if(gx<0||v>a[gx]) gx=i; if(gn<0||v<a[gn]) gn=i; }
    const rg=gx>=0?(a[gx]-a[gn])||1:1;
    for(let i=0;i<N;i++){ const v=a[i]; if(!Number.isFinite(v)) continue; let isH=true, isL=true, mn=v, mx=v;
      for(let j=Math.max(0,i-W);j<=Math.min(N-1,i+W);j++){ if(j===i) continue; const w=a[j]; if(!Number.isFinite(w)) continue; if(w<mn) mn=w; if(w>mx) mx=w;
        if(j<i?w>=v:w>v) isH=false; if(j<i?w<=v:w<v) isL=false; if(!isH&&!isL) break; }
      if(isH&&v-mn>rg*0.02) hi.push(i); if(isL&&mx-v>rg*0.02) lo.push(i); }
    return L.ser[key]={hi,lo,gx,gn}; }
  function peakMenu(e,id,ne){ closeCtx(); const P=peaks(id)||{hi:[],lo:[],gx:-1,gn:-1}, L=CX.L; if(!L) return; const T=L.t, now=CX.playT;
    const nx=l=>{ for(const i of l) if(T[i]>now+1) return i; return -1; }, pv=l=>{ for(let k=l.length-1;k>=0;k--) if(T[l[k]]<now-1) return l[k]; return -1; };
    const items=[...(ne&&EVT_TBL[ne.kind]?[['Open table · '+ne.kind,-2]]:[]),['Next peak',nx(P.hi)],['Previous peak',pv(P.hi)],['Next valley',nx(P.lo)],['Previous valley',pv(P.lo)],['Highest in log',P.gx],['Lowest in log',P.gn]];
    const name=(V.find(x=>x[0]===id)||[0,id])[1], m=mk('div','ctxm',document.body); m.id='ctxm';
    m.innerHTML='<i title="'+esc(name)+'">'+esc(name)+'</i>'+items.map(([t,i],k)=>`<button data-k="${k}"${i===-1?' disabled':''}>${t}${i>=0?` <span class="dim">${fmtT(T[i])}</span>`:''}</button>`).join('');
    m.addEventListener('click',ev=>{ const b=ev.target.closest('button[data-k]'); if(b&&items[+b.dataset.k][1]===-2){ ev.stopImmediatePropagation(); closeCtx(); rpPlay(false); SEEK(ne.t,true); showView('table'); TV.openGroup(EVT_TBL[ne.kind],true); } },true);
    m.style.left=Math.min(e.clientX,innerWidth-m.offsetWidth-8)+'px'; m.style.top=Math.min(e.clientY,innerHeight-m.offsetHeight-8)+'px';
    m.onclick=ev=>{ const b=ev.target.closest('button[data-k]'); if(!b||b.disabled) return; const i=items[+b.dataset.k][1]; closeCtx(); rpPlay(false); RP.gOff=0; SEEK(T[i],true); }; }
  function nearEv(e,cv){ const L=CX.L; if(!L) return null; const r=cv.getBoundingClientRect(), gw=r.width-GL-GR, [t0,t1]=win(), x=e.clientX-r.left-GL; if(x<0||x>gw) return null;
    const ms=(t1-t0)/gw*6, t=t0+x/gw*(t1-t0); let best=null, bd=ms;
    for(const ev of (L.allEv||[])) if(ev.sev==='warn'||ev.sev==='crit'||ev.kind==='Knock'||ev.kind==='Flag'){ const d=Math.abs(ev.t-t); if(d<bd){ bd=d; best=ev; } }
    if(!best) for(const kt of L.kticks){ const d=Math.abs(kt-t); if(d<bd){ bd=d; best={t:kt,kind:'Knock',label:'knock'}; } } return best; }
  function laneTip(e,cv){ const tip=$('tltip'), ev=nearEv(e,cv); if(!ev){ tip.classList.add('hidden'); return; }
    tip.textContent=fmtT(ev.t)+' · '+ev.kind+': '+ev.label; tip.classList.remove('hidden'); tip.style.left=Math.max(4,Math.min(innerWidth-tip.offsetWidth-4,e.clientX+14))+'px'; tip.style.top=(e.clientY-32)+'px'; }
  function win(){ if(G.full&&CX.L) return [0,Math.max(1000,CX.L.dur)]; const P=CX.playT; let t0=G.mode==='center'?P-G.win/2:P-G.win; t0+=RP.gOff; return [t0,t0+G.win]; }
  function series(id,LL){ const L=LL||CX.L; if(!L||!id) return null; const key=id+'|'+UI.wbDisp+'|'+UI.ffbDisp+'|'+UI.pu+'|'+UI.tu+'|'+(L.rbP?EDIT.ver:0); if(L.ser&&L.ser[key]) return L.ser[key]; L.ser=L.ser||{};
    const sc=(a,k)=>{ if(k===1) return a; const o=new Float64Array(a.length); for(let i=0;i<a.length;i++) o[i]=a[i]*k; return o; }; let s=null;
    if(id==='v:wbffb') s={unit:uLbl(UI.wbDisp),a:sc(L.wb,lamK(UI.wbDisp)),a2:sc(L.ffb,lamK(UI.wbDisp)),wb:true,dp:dpOf(UI.wbDisp)};
    else if(id==='v:idc'){ const a=idcOf(L); if(!a) return null; s={unit:'%',a,dp:1,col:COL.acc}; }
    else if(id==='v:avcsi'||id==='v:avcse'){ const k=id.slice(2), A=L.c[k], Tg=avcsTgt(L,k); if(!A||!Tg) return null; s={unit:'°',a:A,a2:Tg,dp:1,col:COL.acc,col2:COL.rb,n1:'actual',n2:'target'}; }
    else if(id==='v:dthr'){ const a=dThr(L); if(!a) return null; s={unit:'%/s',a,dp:0,col:COL.acc}; }
    else if(id==='v:aerr'){ const a=afrErr(L); if(!a) return null; s={unit:'AFR',a,dp:2,col:COL.wb}; }
    else if(id==='v:wb') s={unit:uLbl(UI.wbDisp),a:sc(L.wb,lamK(UI.wbDisp)),wb:true,dp:dpOf(UI.wbDisp)};
    else if(id.startsWith('v:rb_')){ const rb=L.rb||{}, P=pDisp('abs'), cv=(a,d)=>{ if(!a) return null; const o=new Float64Array(a.length); for(let i=0;i<a.length;i++) o[i]=a[i]*d.k+(d.o||0); return o; };
      const pair=(lg,rv,u,d)=>({unit:u,a:lg||rv,a2:lg?rv:null,dp:d,col:lg?COL.acc:COL.rb,col2:COL.rb,n1:lg?'logged':'rebuilt',n2:'rebuilt'});
      if(id==='v:rb_boost'&&rb.boost) s=pair(cv(rb.boost.log,P),cv(rb.boost.fin,P),P.u,P.dp);
      else if(id==='v:rb_map'&&rb.boost&&rb.boost.act) s=Object.assign(pair(cv(rb.boost.act,P),cv(rb.boost.log||rb.boost.fin,P),P.u,P.dp),{n1:'actual',n2:'target'});
      else if(id==='v:rb_wg'&&rb.wg) s=pair(rb.wg.log,rb.wg.dc,'%',1);
      else if(id==='v:rb_tim'&&rb.tim) s=pair(rb.tim.log,rb.tim.tot,'°',1);
      else if(id==='v:rb_tq'&&rb.tq) s=pair(rb.tq.log,rb.tq.pred,'Nm',0);
      else if(id==='v:rb_thr'&&rb.thr) s=pair(rb.thr.log,rb.thr.pred,'%',1);
      if(s&&L.rbP){ const Q=L.rbP, pv={'v:rb_boost':Q.boost&&cv(Q.boost.fin,P),'v:rb_map':Q.boost&&cv(Q.boost.fin,P),'v:rb_wg':Q.wg&&Q.wg.dc,'v:rb_tim':Q.tim&&Q.tim.tot,'v:rb_tq':Q.tq&&Q.tq.pred,'v:rb_thr':Q.thr&&Q.thr.pred}[id]; if(pv) s.a3=pv; } }
    else if(id==='v:ffb') s={unit:uLbl(UI.ffbDisp),a:sc(L.ffb,lamK(UI.ffbDisp)),dp:dpOf(UI.ffbDisp),col:COL.ffb};
    else { const j=L.fam.findIndex((f,x)=>f===id&&x!==L.wbj); if(j<0) return null; const m=/\(([^()]*)\)\s*$/.exec(L.headers[j]), tu=m&&/^(°?C|deg ?C)$/i.test(m[1])?'C':m&&/^(°?F|deg ?F)$/i.test(m[1])?'F':null; let a=logCol(L,j);
      if(tu&&tu!==UI.tu){ const o=new Float64Array(a.length); for(let q=0;q<a.length;q++) o[q]=tu==='C'?a[q]*1.8+32:(a[q]-32)/1.8; a=o; } s={unit:tu?'°'+UI.tu:(m?m[1]:''),a,dp:null,fam:tu&&tu!==UI.tu?null:id}; }
    return L.ser[key]=s; }
  function smooth(a,t,i0,i1,tau){ const n=i1-i0+1, o=new Float64Array(n); let p=NaN;
    for(let k=0;k<n;k++){ const v=a[i0+k]; if(!Number.isFinite(v)){ o[k]=p; continue; } if(!Number.isFinite(p)) p=v; else p+=(v-p)*(1-Math.exp(-(t[i0+k]-t[i0+k-1])/tau)); o[k]=p; }
    p=NaN; for(let k=n-1;k>=0;k--){ const v=o[k]; if(!Number.isFinite(v)) continue; if(!Number.isFinite(p)) p=v; else p+=(v-p)*(1-Math.exp(-(t[i0+k+1]-t[i0+k])/tau)); o[k]=p; } return o; }
  function pick(get,i0,i1){ const n=i1-i0+1, out=[]; if(n<=600){ for(let i=i0;i<=i1;i++) out.push(i); return out; }
    const bs=n/300; for(let b=0;b<300;b++){ const s=i0+Math.floor(b*bs), e=Math.min(i1,i0+Math.floor((b+1)*bs)-1); let mi=-1,ma=-1;
      for(let i=s;i<=e;i++){ const v=get(i); if(!Number.isFinite(v)) continue; if(mi<0||v<get(mi)) mi=i; if(ma<0||v>get(ma)) ma=i; }
      if(mi<0) continue; if(mi===ma) out.push(mi); else if(mi<ma) out.push(mi,ma); else out.push(ma,mi); } return out; }
  function drawLane(o){
    const z=sizeCanvas(o.cv); if(!z) return; const {c,W,H}=z, L=CX.L, id=G.lanes[o.k]||''; c.fillStyle='#000'; c.fillRect(0,0,W,H);
    const s=series(id); c.font='12px '+FONT_MONO; c.fillStyle=COL.muted;
    if(!s){ o.val.textContent=''; c.fillText(L?(id?'not in this log':'choose a PID'):'no log',GL,22); return; }
    const [t0,t1]=win(), T=L.t, gw=W-GL-GR, gh=H-GT-GB, X=t=>GL+gw*(t-t0)/(t1-t0);
    const i0=Math.max(0,rpIdx(t0)-1), i1=Math.min(L.N-1,rpIdx(t1)+1);
    let sm=null; if(s.wb&&UI.tau>0){ const so=Math.max(0,rpIdx(t0-3*UI.tau)), full=smooth(s.a,T,so,i1,UI.tau); sm=i=>full[i-so]; }
    const gets=[i=>s.a[i]]; if(s.a2) gets.push(i=>s.a2[i]); if(s.a3) gets.push(i=>s.a3[i]);
    const B=RP.B, sb=B&&B!==L?series(id,B):null, dT=sb?RP.bT-CX.playT:0, bi0=sb?Math.max(0,rpIdxL(B,t0+dT)-1):0, bi1=sb?Math.min(B.N-1,rpIdxL(B,t1+dT)+1):-1;
    let lo=Infinity, hi=-Infinity; const mode=G.ymode[id]||'auto';
    if(mode==='fixed'&&G.yfix[id]&&G.yfix[id].lo!=null&&G.yfix[id].hi!=null&&G.yfix[id].hi>G.yfix[id].lo){ lo=G.yfix[id].lo; hi=G.yfix[id].hi; }
    else if(mode==='tune'&&TUNE&&TUNE.ranges[TUNE_RANGE_KEY[id]]){ [lo,hi]=TUNE.ranges[TUNE_RANGE_KEY[id]]; }
    else { for(const g of gets.concat(sm?[sm]:[])) for(let i=i0;i<=i1;i++){ const v=g(i); if(Number.isFinite(v)){ if(v<lo) lo=v; if(v>hi) hi=v; } }
      if(sb) for(let i=bi0;i<=bi1;i++){ const v=sb.a[i]; if(Number.isFinite(v)){ if(v<lo) lo=v; if(v>hi) hi=v; } }
      if(Number.isFinite(lo)){ if(hi-lo<1e-9){ lo-=1; hi+=1; } const pd=(hi-lo)*0.08; lo-=pd; hi+=pd; } }
    const cv=fin(s.a[CX.i]), dp=s.dp!=null?s.dp:(Number.isFinite(hi)&&Math.abs(hi-lo)<10?2:(Math.abs(hi)>=100?0:1));
    o.val.innerHTML=(cv==null?'<span class="dim">—</span>':`<span style="color:${s.wb?COL.wb:(s.col||COL.acc)}">${cv.toFixed(dp)}${s.n1?` <small>${s.n1}</small>`:''}</span>`)+(s.a2&&Number.isFinite(s.a2[CX.i])?` <span style="color:${s.col2||COL.ffb}">${s.a2[CX.i].toFixed(dp)}${s.n2?` <small>${s.n2}</small>`:''}</span>`:'')+(s.a3&&Number.isFinite(s.a3[CX.i])?` <span style="color:var(--tx)">${s.a3[CX.i].toFixed(dp)} <small>what-if</small></span>`:'')+(sb&&Number.isFinite(sb.a[RP.bI])?` <span style="color:${logC('b')}">B ${sb.a[RP.bI].toFixed(dp)}</span>`:'')+(s.unit?` <span class="dim">${esc(s.unit)}</span>`:'');
    const an=L.an; c.fillStyle='rgba(255,255,255,.06)';                       // frames the scaling filters reject
    if(an) for(let i=i0;i<=i1;i++){ if(!an.drop[i]) continue; let j=i; while(j+1<=i1&&an.drop[j+1]) j++; const xa=Math.max(GL,X(T[i])), xb=Math.min(GL+gw,X(j+1<L.N?T[j+1]:T[j]+255)); if(xb>xa) c.fillRect(xa,GT,xb-xa,gh); i=j; }
    if(!Number.isFinite(lo)){ c.fillStyle=COL.muted; c.fillText('no data in window',GL+6,GT+16); return; }
    const Y=v=>GT+gh-gh*(v-lo)/(hi-lo);
    c.strokeStyle=COL.grid; c.fillStyle=COL.lab; c.font='11px '+FONT_MONO; c.lineWidth=1; c.textAlign='right'; c.textBaseline='middle';
    for(let k=0;k<=4;k++){ const yy=GT+gh-gh*k/4, lv=lo+(hi-lo)*k/4; c.beginPath(); c.moveTo(GL,yy); c.lineTo(GL+gw,yy); c.stroke(); c.fillText(lv.toFixed(Math.abs(hi-lo)<1?3:Math.abs(hi-lo)<10?2:0),GL-5,yy); }
    c.textBaseline='alphabetic'; c.textAlign='left'; c.fillText(fmtT(Math.max(0,t0)),GL,H-4); c.textAlign='right'; c.fillText(fmtT(t1),GL+gw,H-4);
    c.save(); c.beginPath(); c.rect(GL,GT,gw,gh); c.clip();
    if(s.fam&&LIMITS[s.fam]){ const l=LIMITS[s.fam], cols=['rgba(228,170,40,.85)','rgba(240,120,40,.85)','rgba(235,35,35,.9)'];
      for(const side of ['lo','hi']) (l[side]||[]).forEach((v,k)=>{ if(!Number.isFinite(v)||v<lo||v>hi) return; c.setLineDash([6,5]); c.strokeStyle=cols[k]; c.lineWidth=1.5; c.beginPath(); c.moveTo(GL,Y(v)); c.lineTo(GL+gw,Y(v)); c.stroke(); c.setLineDash([]); }); }
    const line=(get,col,w,dash)=>{ const idx=pick(get,i0,i1); c.strokeStyle=col; c.lineWidth=w; c.setLineDash(dash||[]); c.beginPath(); let pen=false;
      for(const i of idx){ const v=get(i); if(!Number.isFinite(v)){ pen=false; continue; } const px=X(T[i]), py=Y(v); if(pen) c.lineTo(px,py); else { c.moveTo(px,py); pen=true; } } c.stroke(); c.setLineDash([]); };
    if(s.a2) line(gets[1],s.col2||COL.ffb,s.col2?2:1.5,[6,4]); if(s.a3) line(i=>s.a3[i],'#e8e8ea',1.6,[2,3]);
    if(s.wb){ if(sm){ line(gets[0],'rgba(150,150,158,.35)',1); line(sm,COL.wb,2.5); } else line(gets[0],COL.wb,2); } else line(gets[0],sb&&!s.col?logC('a'):(s.col||COL.acc),2);
    if(sb){ c.strokeStyle=logC('b'); c.lineWidth=2; c.setLineDash([]); c.beginPath(); let pen=false; const st=Math.max(1,Math.floor((bi1-bi0)/800));
      for(let i=bi0;i<=bi1;i+=st){ const v=sb.a[i]; if(!Number.isFinite(v)){ pen=false; continue; } const px=X(B.t[i]-dT), py=Y(v); if(pen) c.lineTo(px,py); else { c.moveTo(px,py); pen=true; } } c.stroke(); }
    c.restore();
    c.strokeStyle='#eb2323'; c.lineWidth=3; for(const kt of L.kticks){ if(kt<t0) continue; if(kt>t1) break; const kx=X(kt); c.beginPath(); c.moveTo(kx,GT+gh-10); c.lineTo(kx,GT+gh); c.stroke(); }
    if(L.allEv) for(const e of L.allEv){ if(e.t<t0||e.t>t1||e.kind==='Knock'||!(e.sev==='warn'||e.sev==='crit')) continue; c.fillStyle=sevC(e.sev); c.fillRect(X(e.t)-1,GT,2.5,9); }
    const px=X(CX.playT); if(px>=GL&&px<=GL+gw){ c.strokeStyle='rgba(255,255,255,.85)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(px,GT); c.lineTo(px,GT+gh); c.stroke(); }
  }
  function dirty(){ RP.dirty=true; }
  function draw(){ if(!shown) return; winLab.textContent=G.full?'Full':G.win>=60000?(G.win/60000).toFixed(G.win%60000?1:0)+' m':Math.round(G.win/1000)+' s'; const eff=(paneCount()>1&&root.clientHeight<480)?Math.min(2,G.n):G.n; lanes.forEach((o,k)=>{ const v=k<eff; o.el.style.display=v?'':'none'; if(v) drawLane(o); }); wt.update(); }
  build();
  function jump(kind,dir){ const L=CX.L; if(!L) return; const P=peaks(G.lanes[0]||''); if(!P){ toast('Pick a PID in graph lane 1'); return; } const T=L.t, now=CX.playT, l=kind==='hi'?P.hi:P.lo; let i=-1;
    if(dir>0){ for(const j of l) if(T[j]>now+1){ i=j; break; } } else for(let k=l.length-1;k>=0;k--) if(T[l[k]]<now-1){ i=l[k]; break; } if(i>=0){ rpPlay(false); RP.gOff=0; SEEK(T[i],true); } }
  return { el:root, draw, fill, build, jump, show(on){ shown=on; if(on){ fill(); dirty(); } }, resize:dirty };
}

// ════════════════════════════════════════════════════════════════════════════
//  TABLE TRACE — PL heatmap, hollow crosshair, knock layer on timing tables
// ════════════════════════════════════════════════════════════════════════════
function TableView(side){ const CX=side==='b'?{get L(){return RP.B},get playT(){return RP.bT},get i(){return RP.bI}}:{get L(){return RP.L},get playT(){return RP.playT},get i(){return RP.i}}, SEEK=side==='b'?t=>setB(t):(t,sn)=>rpSeek(t,sn);
  const TT=()=>side==='b'?((CX.L&&CX.L.tuneT)||TUNE):(EDIT.on&&EDIT.T?EDIT.T:TUNE), ED=()=>side!=='b'&&EDIT.on, SEL={r0:null,r1:null,c0:null,c1:null,drag:false};
  const T=UI.tt, S={pick:null,fuel:'normal',zoom:1,follow:true,win:{c0:0,r0:0,vx:1,vy:1},live:null,tx:null,ty:null,px:null,py:null,geo:null,shown:false,heat:null,heatKey:'',heatT0:0};
  const root=mk('div','view tt'), bar=mk('div','vbar',root);
  const railBtn=mk('button','ibtn',bar); railBtn.innerHTML='☰'; railBtn.title='Show / hide the table list'; const ttl=mk('span','tt-ttl',bar), vrow=mk('div','tt-var',bar), needChip=mk('span','chip ro tt-need',bar); mk('span','vfill',bar);
  const edB=mk('button','btn sm',bar); edB.textContent='Edit'; edB.title='Edit this tune'; if(side==='b') edB.style.display='none'; edB.onclick=()=>EDITOR.on(!EDIT.on);
  const zo=mk('button','ibtn',bar), zi=mk('button','ibtn',bar), zf=mk('button','ibtn',bar), gear=mk('button','ibtn',bar);
  zo.textContent='−'; zi.textContent='+'; zf.innerHTML=SVG_TARGET; gear.innerHTML=SVG_GEAR; zo.title='Zoom out'; zi.title='Zoom in'; zf.title='Follow crosshair'; gear.title='Table options';
  const opts=mk('div','tt-opts',root); opts.style.display='none';
  const ebar=mk('div','tt-ebar',bar); ebar.style.display='none';
  ebar.onclick=e=>{ const b=e.target.closest('[data-e]'); if(!b||b.disabled) return; const a=b.dataset.e; if(a==='ov'){ EDIT.overlays=!EDIT.overlays; draw(); syncEd(); } else if(a==='only'){ EDIT.onlyEd=!EDIT.onlyEd; renderRail(); syncEd(); } else EDITOR.act(a); };
  function selStats(){ const t=built, n=(Math.abs(SEL.r1-SEL.r0)+1)*(Math.abs(SEL.c1-SEL.c0)+1); if(!t) return n+' selected'; const d=edDisp(t), b=baseOf(t), r0=Math.min(SEL.r0,SEL.r1), r1=Math.max(SEL.r0,SEL.r1), c0=Math.min(SEL.c0,SEL.c1), c1=Math.max(SEL.c0,SEL.c1);
    let lo=Infinity, hi=-Infinity, s=0, sb=0, k=0; for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){ const v=toD(d,t.z[r][c]); lo=Math.min(lo,v); hi=Math.max(hi,v); s+=v; if(b&&b.z[r]) sb+=toD(d,b.z[r][c]); k++; } if(!k) return n+' selected';
    const f=v=>v.toFixed(d.dp), dl=b?(s-sb)/k:0; return `${k} cell${k>1?'s':''} · min ${f(lo)} · max ${f(hi)} · avg ${f(s/k)}${b&&Math.abs(dl)>1e-9?` · Δ ${dl>0?'+':''}${dl.toFixed(d.dp)} ${d.u}`:''}`; }
  function syncEd(){ if(side!=='b'){ const eb=$('ed-top'); if(eb){ eb.classList.toggle('on',ED()); eb.hidden=!TUNE; } const pn=root.closest('.pane'); if(pn) pn.classList.toggle('editing',ED()); if(!ED()) S.cardEd=null; } edB.style.display='none'; edB.classList.toggle('acc',ED()); edB.textContent=ED()?'Done':'Edit'; ebar.style.display=ED()?'':'none'; if(hrail){ const o=ED()&&HR.open, was=hrail.style.display!=='none'; hrail.style.display=o?'':'none'; if(o) hrPaint(hrail); if(o!==was) requestAnimationFrame(()=>{ layout(); RP.dirty=true; }); } if(!ED()) return;
    const sl=SEL.r0!=null?selStats():'', n=edCount();
    ebar.innerHTML=`<button class="btn sm" data-e="undo"${EDIT.undo.length?'':' disabled'} title="${esc(EDIT.undo.length?'Undo '+EDIT.undo[EDIT.undo.length-1].label:'Nothing to undo')}">Undo</button><button class="btn sm" data-e="redo"${EDIT.redo.length?'':' disabled'}>Redo</button><button class="btn sm" data-e="diff"${REV.nodes.length>1?'':' disabled'} title="Revision tree and compare">Revisions ▾</button><button class="btn sm" data-e="hist"${EDIT.undo.length?'':' disabled'} title="Jump back to any step">History ▾</button>`
      +`<button class="chip${EDIT.overlays?' on':''}" data-e="ov" title="Log trace, knock heat and B marker">Overlays</button><button class="chip${EDIT.onlyEd?' on':''}" data-e="only" title="Only list tables you have changed">Changed only</button><span class="vfill"></span><span class="mono dim">${sl}</span>`
      +`${side==="b"?"":(()=>{ const hn=hrCount(); return `<button class="btn sm hlpb${hn?" has":""}${HR.open?" on":""}" data-e="sug">Helpers · ${hn}</button>`; })()}<button class="btn sm acc" data-e="build" title="Save as a new revision (Ctrl+B)">Build</button>`; }
  function edDown(e){ const t=built; if(!t||!S.geo) return false; const p=cellAt(e.clientX,e.clientY), W=S.win; if(!p) return false;
    const nx=t.x.length, ny=t.z.length, hx=p.x<W.c0-0.5, hy=p.y<W.r0-0.5;
    if(hy&&!hx){ EDITOR.axis(t,'x',Math.max(0,Math.min(nx-1,Math.round(p.x))),axName(t.xin)); return true; }
    if(hx&&!hy){ if(t.yin) EDITOR.axis(t,'y',Math.max(0,Math.min(ny-1,Math.round(p.y))),axName(t.yin)); return true; } if(hx&&hy) return false;
    const c=Math.max(0,Math.min(nx-1,Math.round(p.x))), r=Math.max(0,Math.min(ny-1,Math.round(p.y)));
    if(e.shiftKey&&SEL.r0!=null){ SEL.r1=r; SEL.c1=c; } else { SEL.r0=SEL.r1=r; SEL.c0=SEL.c1=c; } SEL.drag=true; try{ gbox.setPointerCapture(e.pointerId); }catch(_){} draw(); syncEd(); return true; }
  function edMove(e){ const t=built, p=cellAt(e.clientX,e.clientY); if(!t||!p) return; const c=Math.max(0,Math.min(t.x.length-1,Math.round(p.x))), r=Math.max(0,Math.min(t.z.length-1,Math.round(p.y)));
    if(r!==SEL.r1||c!==SEL.c1){ SEL.r1=r; SEL.c1=c; draw(); syncEd(); } }
  function edTip(e){ const t=built, b=baseOf(t), p=cellAt(e.clientX,e.clientY); if(!t||!b||!p) return false; const c=Math.round(p.x), r=Math.round(p.y);
    if(r<0||c<0||r>=t.z.length||c>=t.x.length||!b.z[r]||same(t.z[r][c],b.z[r][c])) return false; const d=uDisp(t), o=dv(d,b.z[r][c]), n=dv(d,t.z[r][c]), bx=gbox.getBoundingClientRect();
    tip.innerHTML=`<b>was ${o} → now ${n} ${esc(d.u)}</b><br>change ${(+n-+o>0?'+':'')+(+n-+o).toFixed(d.dp)}`; tip.classList.remove('hidden');
    tip.style.left=Math.min(bx.width-tip.offsetWidth-6,e.clientX-bx.left+14)+'px'; tip.style.top=Math.max(4,e.clientY-bx.top-tip.offsetHeight-10)+'px'; return true; }
  function edDraw(c,g,t,W){ if(!ED()) return; const b=baseOf(t);
    if(b){ const tri=(x,y)=>{ const z=Math.max(7,Math.min(12,Math.min(g.cw,g.ch)*0.36)); c.fillStyle=inkOut(INK().chg); c.beginPath(); c.moveTo(x,y); c.lineTo(x+z+1.5,y); c.lineTo(x,y+z+1.5); c.fill(); c.fillStyle=INK().chg; c.beginPath(); c.moveTo(x,y); c.lineTo(x+z,y); c.lineTo(x,y+z); c.fill(); };
      for(let r=W.r0;r<W.r0+W.vy;r++) for(let q=W.c0;q<W.c0+W.vx;q++) if(b.z[r]&&!same(t.z[r][q],b.z[r][q])) tri(g.hw+(q-W.c0)*g.cw+1,g.hh+(r-W.r0)*g.ch+1);
      c.fillStyle=INK().chg; for(let q=W.c0;q<W.c0+W.vx;q++) if(b.x[q]!=null&&!same(t.x[q],b.x[q])) c.fillRect(g.hw+(q-W.c0)*g.cw+2,g.hh-4,g.cw-4,3);
      if(t.yin) for(let r=W.r0;r<W.r0+W.vy;r++) if(b.y[r]!=null&&!same(t.y[r],b.y[r])) c.fillRect(g.hw-4,g.hh+(r-W.r0)*g.ch+2,3,g.ch-4); }
    hrDraw(c,g,t,W);
    if(SEL.r0!=null){ const r0=Math.min(SEL.r0,SEL.r1), r1=Math.max(SEL.r0,SEL.r1), c0=Math.min(SEL.c0,SEL.c1), c1=Math.max(SEL.c0,SEL.c1);
      const x0=g.hw+(Math.max(c0,W.c0)-W.c0)*g.cw, y0=g.hh+(Math.max(r0,W.r0)-W.r0)*g.ch, x1=g.hw+(Math.min(c1,W.c0+W.vx-1)-W.c0+1)*g.cw, y1=g.hh+(Math.min(r1,W.r0+W.vy-1)-W.r0+1)*g.ch;
      if(x1>x0&&y1>y0){ c.fillStyle=hexA(INK().sel,.16); c.fillRect(x0,y0,x1-x0,y1-y0); c.strokeStyle=INK().sel; c.lineWidth=2; c.strokeRect(x0+1,y0+1,x1-x0-2,y1-y0-2); } } }
  const body=mk('div','tt-body',root), rail=mk('div','tt-rail',body), main=mk('div','tt-main',body), hrail=side==='b'?null:mk('div','hrail',body); if(hrail) hrail.style.display='none';
  const q=mk('input','tt-q',rail); q.type='search'; q.placeholder='Search tables'; const rlist=mk('div','tt-list',rail);
  const kwrap=mk('div','kwrap',main), strip=mk('div','kstrip',kwrap), bstrip=mk('div','kstrip bstrip',kwrap), kdet=mk('button','chip kdet',kwrap); kdet.onclick=()=>{ UI.ttDet=!UI.ttDet; save(); syncCmp(); requestAnimationFrame(layout); };
  function syncCmp(){ const on=!!knockTbl(built)&&!!CX.L; kdet.style.display=on?'':'none'; root.classList.toggle('kcmp',on&&!UI.ttDet); kdet.textContent=UI.ttDet?'Less':'Details'; } const msg=mk('div','tt-msg',main); msg.style.display='none';
  const cards=mk('div','tt-cards',main); cards.style.display='none'; cards.onclick=e=>{ const el=e.target.closest('[data-card]'); if(!el) return; const id=el.dataset.card;
    if(e.target.closest('[data-cx]')){ S.cardEd=null; renderCards(); return; }
    if(e.target.closest('[data-cs]')){ const c=TT().cards.find(q=>q.id===id), rows=c.v.map(r=>r.slice()); el.querySelectorAll('[data-cv]').forEach(inp=>{ const [i,j]=inp.dataset.cv.split(',').map(Number); rows[i][j]=parseFloat(String(inp.value).replace(',','.')); });
      if(rows.flat().some(x=>!Number.isFinite(x))){ toast('Every field needs a number'); return; } S.cardEd=null; EDITOR.cardSet(id,rows); return; }
    if(e.target.closest('input')||!ED()||S.cardEd===id) return; if(id==='dtc_enable'){ toast('DTC switches are edited in Lambda'); return; }
    if(EDITOR.cardOK(id)){ S.cardEd=id; renderCards(); const f=cards.querySelector('[data-cv]'); if(f){ f.focus(); f.select(); } } };
  cards.addEventListener('keydown',e=>{ if(!e.target.dataset||!e.target.dataset.cv) return; if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); const b=cards.querySelector('[data-cs]'); if(b) b.click(); } else if(e.key==='Escape'){ e.stopPropagation(); S.cardEd=null; renderCards(); } });
  cards.addEventListener('dblclick',e=>{ const r=e.target.closest('[data-rn]'); if(r){ const c=TT().cards.find(q=>'c:'+q.id===r.dataset.rn); renameTitle(r.dataset.rn,c?c.label:''); } });
  ttl.ondblclick=()=>{ const cur=built; if(cur) renameTitle('g:'+cur.group,cur.gname); };
  const gbox=mk('div','tt-box',main), chart=mk('canvas','tt-vc',gbox), gw=mk('div','tt-gw',gbox), grid=mk('div','tt-g',gw), cv=mk('canvas','tt-cv',gw), tip=mk('div','tip hidden',gbox);
  const wt=WarnTiles(root);
  zo.onclick=()=>setZoom(S.zoom/1.5); zi.onclick=()=>setZoom(S.zoom*1.5);
  zf.onclick=()=>{ S.follow=!S.follow; syncZ(); if(S.follow) follow(true); };
  gear.onclick=()=>{ opts.style.display=opts.style.display==='none'?'':'none'; requestAnimationFrame(layout); };
  const OROWS=[];
  function optRow(lab,key,vals,tip,when,extra){ const r=mk('div','tt-or',opts), l=mk('span','vlab',r); l.textContent=lab; l.title=tip; r.title=tip; seg(r,vals,T.opt[key],v=>{ T.opt[key]=typeof vals[0][0]==='number'?+v:v; save(); renderBar(); renderStrip(); draw(); }); if(extra) extra(r); OROWS.push([r,when]); return r; }
  const isKT=()=>knockTbl(built), grpIs=(...g)=>()=>!!built&&g.includes(built.group);
  optRow('Cell box','mark',[['outline','1 cell'],['glow','4 cells (blend)']],'How the live position is boxed: the nearest cell, or the 4 cells the ECU interpolates between (shaded by weight)',()=>!!built&&!!built.yin);
  optRow('Value tag','val',[[1,'On'],[0,'Off']],'Show the interpolated table value next to the crosshair',()=>!!built);
  optRow('Variant name','name',[[1,'On'],[0,'Off']],'In Auto mode, show which variant (TGV / VVT / mode) is active on the Auto chip',()=>!!built&&(tabs(built.group).length>1||hasAuto(built.group)));
  { const r=mk('div','tt-or',opts); mk('span','vlab',r).textContent='Colours'; const sl=mk('select','sel sm',r); sl.innerHTML=TPALS.map(p=>`<option value="${p[0]}"${(UI.tpal||'classic')===p[0]?' selected':''}>${p[1]}</option>`).join(''); sl.onchange=()=>{ UI.tpal=sl.value; INKK=''; save(); kwLegP(); render(); draw(); RP.dirty=true; }; OROWS.push([r,()=>true]); }
  optRow('Knock heat','kmH',[[1,'On'],[0,'Off']],'Outline every cell where knock occurred while the ECU was using this table (pooled logs on this revision), coloured by the worst value',isKT);
  optRow('Knock mark','kmL',[[1,'On'],[0,'Off']],'An × on every cell where FBKC pulled timing while the ECU was using this table (pooled logs on this revision)',isKT);
  optRow('Follow CL/OL','fol',[[0,'Off'],[1,'On']],'Switch to Open loop fuel when the ECU enters open loop and back to Base timing in closed loop',grpIs('fuel'));
  optRow('Auto timing VVT','vvt',[['off','Off · primary'],['on','On · reference']],'Which VVT variant Auto uses (the TGV state is picked from the log)',grpIs('timing'));
  optRow('Visited cells','dim',[[0,'Off'],[1,'Dim unvisited']],'Darken cells the pooled logs on this revision never reached; hover a cell for dwell time',()=>!!built&&!!built.yin&&!!CX.L);
  optRow('Fuel cut','fc',[[0,'Off'],[1,'On']],'Mark cells where the ECU was in fuel cut in the pooled logs (purple corner and dashed outline)',()=>!!built&&!!built.yin&&!!CX.L);
  const kwRow=optRow('Knock windows','kw',[[1,'On'],[0,'Off']],'Dashed outlines where FBKC is active, where FLKC can learn and where IAM can learn (from the tune)',isKT);
  const kwLeg=mk('div','kwleg',kwRow); const kwLegP=()=>{ const w=INK().win; kwLeg.innerHTML=`<span style="--c:${w[0]}">FBKC range</span><span style="--c:${w[1]}">FLKC learns</span><span style="--c:${w[2]}">IAM learns</span>`; }; kwLegP();
  function syncOpts(){ OROWS.forEach(([r,w])=>{ r.style.display=w()?'':'none'; }); kwLeg.style.display=T.opt.kw!==0?'':'none'; }
  if(T.rail==null) T.rail=1; if(!T.rc) T.rc={}; root.classList.toggle('norail',!T.rail);
  railBtn.onclick=()=>{ T.rail=T.rail?0:1; root.classList.toggle('norail',!T.rail); save(); requestAnimationFrame(layout); };
  q.oninput=()=>renderRail();
  const all=()=>TT()?TT().tables:[], tabs=g=>all().filter(t=>t.group===g), byId=id=>all().find(t=>t.id===id)||null, pTbl=id=>id?all().find(t=>t.id===id||t._ids.includes(id))||null:null;
  const hasAuto=g=>tabs(g).some(t=>t.tag), isAuto=g=>T.sel[g]==='auto'||T.sel[g]==null;
  const tgv=()=>{ const p=S.pick&&byId(S.pick); return p?(p.tag==='open'?'open':'closed'):'open'; };
  const autoTag=g=>tabs(g).some(t=>t.tag==='normal'||t.tag==='safe')?S.fuel:tgv();
  function current(){ const g=T.grp, l=tabs(g); if(!l.length) return null;
    if(g==='timing'&&isAuto(g)){ const tg=tgv(), c=l.filter(t=>t.tag===tg), want='VVT '+(T.opt.vvt==='on'?'On':'Off'); return c.find(t=>t.name.includes(want))||c[0]||l[0]; }
    if(isAuto(g)&&hasAuto(g)){ const tg=autoTag(g); return l.find(t=>t.tag===tg)||l[0]; }
    return byId(T.sel[g])||l[0]; }
  const need=t=>!CX.L||!t?[]:[t.xin,t.yin].filter(k=>k&&!NOTRACE[k]&&!hasKey(CX.L,k)).map(k=>IN_NAMES[k]||k);
  const uDisp=t=>t.lam?{k:lamK(UI.wbDisp),o:0,dp:dpOf(UI.wbDisp),u:uLbl(UI.wbDisp)}:t.pk?pDisp(t.pk):(t.unit==='°C'&&UI.tu==='F'?{k:1.8,o:32,dp:t.dp,u:'°F'}:{k:1,o:0,dp:t.dp,u:t.unit});
  const dv=(d,v)=>{ const r=(v*d.k+(d.o||0)).toFixed(d.dp); return /^-0(\.0+)?$/.test(r)?r.slice(1):r; };
  const fmtVal=(t,v)=>{ const d=uDisp(t); return dv(d,v)+' '+d.u; };
  const fmtA=(k,v)=>v==null?'':(k==='ect'||k==='iat')&&UI.tu==='F'?String(Math.round(v*1.8+32)):PK[k]?dv(pDisp(PK[k]),v):k==='rpm'?String(Math.round(v)):(k==='load'||k==='mafv'||k==='batt')?(+v).toFixed(2):Math.abs(v)>=100?String(Math.round(v)):(+v).toFixed(1);
  const AXN={rpm:'RPM',load:'Load',torque:'Torque',accel:'Pedal',iat:'IAT',ect:'ECT',batt:'Battery',mafv:'MAF V',maf:'MAF g/s',vss:'Speed',tipin:'Tip-in',idx:'#',idy:'#',o2ma:'O2 mA',iatv:'IAT V'};
  const axName=k=>PK[k]?({map:'MAP',baro:'Baro',berr:'Boost err'}[k]+' '+pDisp(PK[k]).u):(AXN[k]||k||'');
  const CATS=['Timing','Knock','Fuel','Airflow','Boost','Wastegate','Throttle/Torque','AVCS','Limits','Sensors'];
  const isSet=()=>String(T.grp).startsWith('set:'), setCat=()=>String(T.grp).slice(4);
  function pick(g){ T.grp=g; S.zoom=1; S.follow=true; save(); build(); }
  // category rail: tables + a Settings entry per category; search filters across names and cards
  function renderRail(){ if(!TT()){ rlist.innerHTML=''; return; } const qq=q.value.trim().toLowerCase(), groups={}, order=[];
    all().forEach(t=>{ if(!groups[t.group]){ groups[t.group]={g:t.group,cat:t.cat,name:t.gname,vars:[],need:need(t)}; order.push(t.group); } groups[t.group].vars.push(t.name); });
    const item=(id,label,dim,title)=>{ const hn=hrGroupN(id); return `<button class="tt-it${T.grp===id?' on':''}" data-g="${esc(id)}"${title?` title="${esc(title)}"`:''}>${esc(label)}${hn?`<i class="hcn">${hn}</i>`:''}</button>`; };
    let h='';
    for(const cat of CATS){ const gs=order.map(g=>groups[g]).filter(o=>o.cat===cat), cs=TT().cards.filter(c=>c.cat===cat), extra=cat==='Limits'&&TT().byId.boost_limit;
      const hit=o=>!qq||(o.name+' '+o.vars.join(' ')).toLowerCase().includes(qq), chit=c=>!qq||c.label.toLowerCase().includes(qq);
      const oe=ED()&&EDIT.onlyEd, gl=gs.filter(hit).filter(o=>!oe||grpEdited(o.g)), cl=cs.filter(chit).filter(c=>!oe||edChanges().some(x=>x.card&&x.card.id===c.id)), ex=extra&&!qq&&!oe; if(!gl.length&&!cl.length&&!ex) continue;
      const open=qq||!T.rc[cat]; h+=`<div class="tt-cat${open?'':' shut'}"><button class="tt-ch" data-c="${esc(cat)}">${esc(cat)}</button>`;
      if(open){ for(const o of gl){ const ed=ED()&&grpEdited(o.g); if(ED()&&EDIT.onlyEd&&!ed) continue; h+=item(o.g,(ed?'● ':'')+nm('g:'+o.g,o.name),o.need.length,o.need.length?'Needs: '+o.need.join(', '):''); }
        if(cl.length||ex) h+=item('set:'+cat,qq&&cl.length?'Settings · '+cl.map(c=>c.label).slice(0,2).join(', ')+(cl.length>2?'…':''):cat+' settings',false,'Single values from the tune for '+cat.toLowerCase()+' (switch points, limits, steps)'); }
      h+='</div>'; }
    rlist.innerHTML=h||'<div class="tt-none">No match</div>'; }
  rlist.onclick=e=>{ const c=e.target.closest('[data-c]'); if(c){ const k=c.dataset.c; T.rc[k]=!T.rc[k]; save(); renderRail(); return; }
    const b=e.target.closest('[data-g]'); if(b) pick(b.dataset.g); };
  // settings cards
  const cardVal=c=>{ if(c.id==='dtc_enable'){ const f=c.v.flat(); return f.filter(v=>v).length+' / '+f.length; } const d=c.pk?pDisp(c.pk):(c.unit==='°C'&&UI.tu==='F'?{k:1.8,o:32,dp:c.dp}:null);
    const one=v=>d?dv(d,v):(c.dp?(+v).toFixed(c.dp):String(Math.round(v))); return c.v.map(r=>r.map(one).join(' / ')).join(' · '); };
  const cardUnit=c=>c.pk?pDisp(c.pk).u:(c.unit==='°C'&&UI.tu==='F'?'°F':c.unit);
  function cardHtml(c){ const LB=CARD_LAB[c.id], open=ED()&&S.cardEd===c.id, multi=c.v.length>1||c.v[0].length>1, cls=`scard${ED()?' ed':''}${ED()&&cardEdited(c)?' chg':''}${open?' open':''}`;
    const d=c.pk?pDisp(c.pk):(c.unit==='°C'&&UI.tu==='F'?{k:1.8,o:32,dp:c.dp}:null), fv=v=>d?dv(d,v):(c.dp?(+v).toFixed(c.dp):String(Math.round(v))); let body;
    if(c.id==='dtc_enable') body=`<b>${cardVal(c)}</b>`;
    else if(open||(multi&&LB)){ const rl=LB?LB.rows:c.v.map((_,i)=>c.v.length>1?String.fromCharCode(65+i):''), cl=LB?LB.cols:c.v[0].map((_,j)=>c.v[0].length>1?String(j+1):'');
      body=`<table class="cg"><tr><th>${esc(cardUnit(c))}</th>${cl.map(x=>`<th>${esc(x)}</th>`).join('')}</tr>${c.v.map((r,i)=>`<tr><th>${esc(rl[i]||'')}</th>${r.map((v,j)=>`<td>${open?`<input class="num xs" data-cv="${i},${j}" value="${esc(fv(v))}">`:fv(v)}</td>`).join('')}</tr>`).join('')}</table>`
        +(open?'<div class="drow"><button class="btn sm acc" data-cs>Apply</button><button class="btn sm ghost" data-cx>Cancel</button></div>':''); }
    else body=`<b>${cardVal(c)}</b><u>${esc(cardUnit(c))}</u>`;
    return `<div class="${cls}" data-card="${esc(c.id)}" role="button" tabindex="0" title="${esc(c.tip||'')}"><i data-rn="c:${esc(c.id)}">${esc(nm('c:'+c.id,c.label))}</i>${body}</div>`; }
  function renderCards(){ const cat=setCat(), list=TT()?TT().cards.filter(c=>c.cat===cat):[]; let h='';
    if(cat==='Limits'&&TT()&&TT().byId.boost_limit) h+=`<div class="scard" title="Boost limit table value at the logged atmospheric pressure (sea level if baro isn't logged)"><i>Boost limit (fuel cut)</i><b data-bl>—</b><u>${esc(pDisp('abs').u)} at logged baro</u></div>`;
    for(const c of list) h+=cardHtml(c);
    cards.innerHTML=h; liveCards(); }
  function liveCards(){ if(!isSet()) return; const l=S.live;
    const b=cards.querySelector('[data-bl]'); if(b){ const ba=l&&l.baro!=null?l.baro:ATM; b.textContent=dv(pDisp('abs'),at2(TT().byId.boost_limit,ba,0)); } }
  // rebuild breakdown at the playhead (Boost · Wastegate · Timing · Throttle/Torque)
  const BTIP={'Base':'Main table value at the current log position','IAT comp':'Intake air temperature compensation from the tune','ECT comp':'Coolant temperature compensation from the tune','Baro comp':'Atmospheric pressure compensation from the tune (only below its last breakpoint)',
    'Calculated target':'What the ECU should target: base × comps, capped by the boost limit','Logged target':'Target boost the ECU reported','Actual MAP':'Logged manifold pressure, and how far it is from target','Calc vs logged':'Logged value minus ejStudio\'s calculation. Near zero = the calculation matches the ECU',
    'Base + comps':'Wastegate base duty × IAT / ECT / baro comps','P':'Proportional term from the boost error (target − MAP)','I':'Integral term: accumulates while boost is off target','Max':'Wastegate max duty table: the ceiling','Calculated duty':'Base + P + I, clamped to max. P/I timing is modelled, so expect ~1 % scatter','Logged duty':'Wastegate duty the ECU reported',
    'KCA':'Knock correction advance. Logged KCA already includes FBKC and FLKC','Knock pull':'Feedback + fine-learning knock correction (FBKC + FLKC)','Calculated total':'Base + KCA + ECT + IAT comps: the total timing the ECU should run','Logged total':'Total timing the ECU reported',
    'Torque table':'Requested torque table at logged pedal and RPM','Logged torque':'Requested torque the ECU reported','Throttle table':'Throttle target table at requested torque and RPM'};
  function renderBreak(){ const L=CX.L, t=built, cat=isSet()?setCat():t?t.cat:'', rb=L&&L.rb, i=CX.i;
    const show=(c,html)=>{ bstrip.style.display=html?'':'none'; if(html) bstrip.innerHTML=html; };
    if(!rb||i<0||i>=L.N) return show(0,'');
    const P=pDisp('abs'), D=pDisp('rel'), card=(lab,val,sub,cls)=>`<div class="kcard${cls?' '+cls:''}" title="${esc([BTIP[lab.split(' · ')[0]],sub].filter(Boolean).join('\n'))}"><i>${lab}</i><b>${val}</b></div>`, ok=v=>Number.isFinite(v);
    const fx=(v,d,u,sg)=>ok(v)?(sg&&v>0?'+':'')+v.toFixed(d)+u:'—', pc=v=>ok(v)?(v>0?'+':'')+v.toFixed(1)+' %':'—', pa=v=>ok(v)?dv(P,v):'—', pr=v=>ok(v)?(v>0?'+':'')+dv(D,v):'—', dg=v=>ok(v)?(v>0?'+':'')+v.toFixed(1)+' deg':'—';
    const big=(arr)=>{ let m=-1,k=-1; arr.forEach((v,j)=>{ if(ok(v)&&Math.abs(v)>m+1e-9&&Math.abs(v)>0.05){ m=Math.abs(v); k=j; } }); return k; };
    const delta=(lg,rv,thr,f)=>ok(lg)&&ok(rv)?card('Calc vs logged',f(lg-rv),'',Math.abs(lg-rv)>thr?'warn':'ok'):'';
    if(cat==='Boost'&&rb.boost){ const B=rb.boost, cs=[B.ci[i],B.ce[i],B.cb[i]], k=big(cs);
      return show(1,card('Base · '+esc(B.name),pa(B.base[i]),P.u)+card('IAT comp',pc(B.ci[i]),'',k===0?'hi':'')+card('ECT comp',pc(B.ce[i]),'',k===1?'hi':'')+card('Baro comp',pc(B.cb[i]),'',k===2?'hi':'')
        +card('Calculated target',pa(B.fin[i]),ok(B.lim[i])?'limit '+pa(B.lim[i]):'','on')+(B.log?card('Logged target',pa(B.log[i]),P.u):'')+(B.act?card('Actual MAP',pa(B.act[i]),B.log&&ok(B.log[i])?pr(B.act[i]-B.log[i])+' vs target':''):'')+delta(B.log&&B.log[i],B.fin[i],5,pr)); }
    if(cat==='Wastegate'&&rb.wg){ const W=rb.wg, k=big([W.base[i],W.P[i],W.I[i]]);
      return show(1,card('Base + comps',fx(W.base[i],1,' %'),'',k===0?'hi':'')+card('P · boost error',fx(W.P[i],2,' %',1),ok(W.err[i])?pr(W.err[i]):'off',k===1?'hi':'')+card('I · integral',fx(W.I[i],2,' %',1),'',k===2?'hi':'')
        +card('Max',fx(W.max[i],1,' %'))+card('Calculated duty',ok(W.dc[i])?W.dc[i].toFixed(1)+' %':'—','modelled P/I','on')+(W.log?card('Logged duty',fx(W.log[i],1,' %')):'')+delta(W.log&&W.log[i],W.dc[i],5,v=>(v>0?'+':'')+v.toFixed(1)+' %')); }
    if(cat==='Timing'&&rb.tim){ const M=rb.tim, cs=[M.kca[i],M.knIn?0:M.kn[i],M.ce[i],M.ci[i]], k=big(cs), pk=L.pick&&L.pick[i]&&TT().byId[L.pick[i]];
      return show(1,card(pk?'Base ('+esc(vTiny(pk))+')':'Base',fx(M.base[i],1,' deg'),pk?'':'no TGV pick')+card('KCA',dg(M.kca[i]),M.knIn?'logged':'IAM × max',k===0?'hi':'')+card('Knock pull',dg(M.kn[i]),'FBKC + FLKC'+(M.knIn?' · inside KCA':''),k===1?'hi':'')+card('ECT comp',dg(M.ce[i]),'',k===2?'hi':'')+card('IAT comp',dg(M.ci[i]),'',k===3?'hi':'')
        +card('Calculated total',fx(M.tot[i],1,' deg'),'','on')+(M.log?card('Logged total',fx(M.log[i],1,' deg')):'')+delta(M.log&&M.log[i],M.tot[i],2,dg)); }
    if(cat==='Throttle/Torque'&&(rb.tq||rb.thr)){ let h='';
      if(rb.tq){ const Q=rb.tq; h+=card('Torque table · '+esc(Q.name),fx(Q.pred[i],0,' Nm'),'','on')+(Q.log?card('Logged torque',fx(Q.log[i],0,' Nm')):'')+delta(Q.log&&Q.log[i],Q.pred[i],8,v=>(v>0?'+':'')+v.toFixed(0)+' Nm'); }
      if(rb.thr){ const H=rb.thr; h+=card('Throttle table · '+esc(H.name),fx(H.pred[i],1,' %'),'','on')+(H.log?card('Logged target',fx(H.log[i],1,' %')):'')+delta(H.log&&H.log[i],H.pred[i],8,v=>(v>0?'+':'')+v.toFixed(1)+' %'); }
      return show(1,h); }
    show(0,''); }
  const heatC=(v,lo,hi)=>'hsl('+(240*(1-(hi>lo?(v-lo)/(hi-lo):0.5))).toFixed(1)+',100%,75%)';
  const knockTbl=t=>t&&(t.group==='timing'||t.group==='kca')&&t.xin==='load'&&t.yin==='rpm';
  function renderBar(){ const groups=[], seen={}; all().forEach(t=>{ if(!seen[t.group]){ seen[t.group]=1; groups.push(t); } });
    if(!isSet()&&!seen[T.grp]&&groups.length) T.grp=groups[0].group;
    renderRail(); vrow.innerHTML=''; const g=T.grp, list=tabs(g), cur=current();
    ttl.textContent=isSet()?setCat()+' · Settings':cur?nm('g:'+cur.group,cur.gname):''; ttl.title=isSet()?'':'Double-click to rename'; const nd=need(cur); needChip.style.display=nd.length?'':'none'; needChip.textContent='No live trace'; needChip.title=nd.length?'Needs: '+nd.join(', '):'';
    if(!nd.length&&cur&&cur.group==='timing'&&CX.L&&CX.L.vvtOn>0.5){ needChip.style.display=''; needChip.className='chip ro warn tt-need'; needChip.textContent='Log fits VVT On'; needChip.title=`${Math.round(CX.L.vvtOn*100)}% of steady frames match the VVT On (reference) tables better than VVT Off`; }
    if(isSet()||(list.length<2&&!hasAuto(g))) return;
    const auto=hasAuto(g)||g==='timing', on=auto&&isAuto(g);
    if(auto){ const a=mk('button','chip'+(on?' on':''),vrow); a.title='Follow the table the ECU is using, picked from the log'; a.textContent='Auto'; a.onclick=()=>{ T.sel[g]='auto'; save(); build(); }; }
    if(g==='timing'){ const live=S.pick, isRef=t=>/VVT On/i.test(t.name), prim=list.filter(t=>!isRef(t)), ref=list.filter(isRef);
      prim.forEach(t=>{ const sel=cur&&cur.id===t.id, ecu=live&&t._ids.includes(live), b=mk('button','chip vchip'+(sel?' on':''),vrow); b.innerHTML=esc(vShort(t))+(ecu?'<span class="ecu">● ECU</span>':''); b.title=t.name+(ecu?' · the ECU is using this table now':''); b.onclick=()=>{ T.sel[g]=t.id; save(); build(); }; });
      if(ref.length){ const sl=mk('select','sel sm vref'+(ref.some(t=>cur&&cur.id===t.id)?' on':''),vrow); sl.innerHTML='<option value="">Reference tables ▾</option>'+ref.map(t=>`<option value="${esc(t.id)}"${cur&&cur.id===t.id?' selected':''}>${esc(vShort(t))}${live&&t._ids.includes(live)?' · ● ECU':''}</option>`).join(''); sl.onchange=()=>{ if(sl.value){ T.sel[g]=sl.value; save(); build(); } }; }
      if(ST.logs.length>1){ const pc=mk('button','chip',vrow); pc.textContent=poolL(CX.L).length+' / '+ST.logs.length+' logs pooled'; pc.title='Logs pooled into the overlays on this table'; pc.onclick=()=>setPop(pc,['pool'],'Pooled logs'); }
      return; }
    list.forEach(t=>{ const b=mk('button','chip'+(!on&&cur&&cur.id===t.id?' on':'')+(on&&cur&&cur.id===t.id?' match':''),vrow); b.title=on&&cur&&cur.id===t.id?'Active variant (picked by Auto). Click to lock this one':'Lock to this variant'; b.textContent=t.name; b.onclick=()=>{ T.sel[g]=t.id; save(); build(); }; }); }
  // knock summary strip (timing / knock-advance groups), collapsible, channel switch for the heat layer
  function stripLive(L,i){ if(!L||i==null) return;
    strip.querySelectorAll('[data-lv]').forEach(e=>{ const k=e.dataset.lv, a=L.c[k], v=a?a[i]:NaN; e.textContent=Number.isFinite(v)?(k==='iam'?v.toFixed(3):v.toFixed(2)+'°'):'—'; e.className=!Number.isFinite(v)?'':k==='iam'?(v<0.99?'bad':'ok'):(v<-0.005?'warn':'ok'); const kc=e.closest('.kcard'); if(kc){ const j=L.idx?L.idx[k]:-1, wt=j!=null&&j>=0&&Number.isFinite(v)?warnTier(L.fam[j],v):0; kc.classList.toggle('wl',wt>0); } }); }
  function renderStrip(){ syncCmp(); const t=built; if(!knockTbl(t)||!CX.L){ strip.style.display='none'; return; } strip.style.display='';
    const k=CX.L.ksum||(CX.L.ksum=knockSummary(CX.L)); let h='';
    { for(const key of ['fbkc','flkc']){ const m=k[key]; if(!m) continue;
        h+=`<button class="kcard${kchs().includes(key)&&T.opt.kmH?' on':''}" data-ch="${key}" title="Toggle ${m.label} on the heat layer"><i>${m.label}</i><b data-lv="${key}">—</b><u>worst ${m.worst.toFixed(2)}° · ${m.cnt} frames · ${m.sus} sustained</u></button>`; }
      if(k.iam) h+=`<div class="kcard"><i>IAM</i><b data-lv="iam">—</b><u>min ${k.iam.min.toFixed(2)} · ${k.iam.status}</u></div>`; }
    if(!h){ strip.style.display='none'; return; }
    strip.innerHTML=h; stripLive(CX.L,CX.i);
    strip.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>{ const k=b.dataset.ch; let s=kchs(); if(!T.opt.kmH){ s=[k]; T.opt.kmH=1; } else s=s.includes(k)?s.filter(x=>x!==k):s.concat(k); if(!s.length) T.opt.kmH=0; T.opt.kchs=s.length?s:[k]; save(); S.heatKey=''; renderStrip(); syncOpts(); draw(); }); }
  function kchs(){ if(!Array.isArray(T.opt.kchs)) T.opt.kchs=[T.opt.kch||'fbkc']; return T.opt.kchs; }
  let built=null;
  function build(){ const t=isSet()?null:vT(current()); if(!t||!built||(t.__src||t)!==(built.__src||built)) SEL.r0=null; built=t; S.px=null; gbox.classList.toggle('vert',!!(t&&t.vert)); syncEd();
    cards.style.display=isSet()?'':'none'; if(isSet()) renderCards(); if(TT()) gbox.style.display=isSet()?'none':''; syncOpts();
    if(t){ let lo=Infinity,hi=-Infinity; t.z.forEach(r=>r.forEach(v=>{ lo=Math.min(lo,v); hi=Math.max(hi,v); })); t.lo=lo; t.hi=hi; }
    setWin(S.win.c0,S.win.r0); render(); renderBar(); renderStrip(); renderBreak(); status(); requestAnimationFrame(layout);
    if(t&&S.live){ const xv=S.live[t.xin], yv=t.yin?S.live[t.yin]:0; if(xv!=null&&yv!=null){ S.tx=fi(t.x,xv); S.ty=t.yin?fi(t.y,yv):0; S.px=S.tx; S.py=S.ty; } else S.tx=null; } }
  function setWin(c0,r0){ const t=built; if(!t) return false; const nx=t.x.length, ny=t.z.length, zz=S.zoom;
    const vx=Math.max(Math.min(nx,4),Math.round(nx/zz)), vy=t.yin?Math.max(Math.min(ny,4),Math.round(ny/zz)):1;
    c0=Math.max(0,Math.min(nx-vx,Math.round(c0))); r0=Math.max(0,Math.min(ny-vy,Math.round(r0)));
    const w=S.win, ch=(w.c0!==c0||w.r0!==r0||w.vx!==vx||w.vy!==vy); S.win={c0,r0,vx,vy}; return ch; }
  function render(){ const t=built; grid.innerHTML=''; if(!t){ chart.style.display='none'; return; }
    const w=S.win, oneD=!t.yin, step=w.vx>24?Math.ceil(w.vx/12):1, d=uDisp(t), f=document.createDocumentFragment();
    chart.style.display=oneD||t.vert?'':'none'; const ck=mk('div','ttc tth ttk',f); ck.innerHTML=t.vert?`<span class="axy">↓ ${esc(axName(t.yin))}</span>`:oneD?`<span class="axx">${esc(axName(t.xin))}</span>`:`<span class="axx">${esc(axName(t.xin))} →</span><span class="axy">↓ ${esc(axName(t.yin))}</span>`; ck.title=`X: ${axName(t.xin)}`+(oneD?'':` · Y: ${axName(t.yin)}`)+` · values in ${d.u}`;
    for(let i=w.c0;i<w.c0+w.vx;i++) mk('div','ttc tth',f).textContent=t.vert?d.u:(i-w.c0)%step===0?fmtA(t.xin,t.x[i]):'';
    for(let r=w.r0;r<w.r0+w.vy;r++){ mk('div','ttc tth ttl',f).textContent=oneD?d.u:fmtA(t.yin,t.y[r]);
      for(let c=w.c0;c<w.c0+w.vx;c++){ const e=mk('div','ttc',f), v=t.z[r][c]; e.textContent=dv(d,v); e.style.background=cellBg(v,t.lo,t.hi); if(UI.tpal&&UI.tpal!=='classic') e.style.color=cellFg(v,t.lo,t.hi); } }
    grid.appendChild(f); syncZ(); layout(); }
  function syncZ(){ zo.disabled=S.zoom<=1.01; zi.disabled=S.zoom>=3.99; zf.classList.toggle('on',S.follow); zf.disabled=S.zoom<=1.01; }
  function setZoom(z,ax,ay){ const t=built; if(!t) return; z=Math.max(1,Math.min(4,z)); if(Math.abs(z-S.zoom)<0.01) return; const w=S.win;
    const cx=ax!=null?ax:(S.follow&&S.px!=null?S.px:w.c0+w.vx/2-0.5), cy=ay!=null?ay:(S.follow&&S.py!=null?S.py:w.r0+w.vy/2-0.5);
    const fx=(cx-w.c0)/w.vx, fy=(cy-w.r0)/w.vy; S.zoom=z; setWin(0,0); const n=S.win; setWin(cx-fx*n.vx,cy-fy*n.vy); render(); }
  function follow(force){ const w=S.win, t=built; if(!t||!S.follow||S.zoom<=1.01||S.px==null) return;
    if(force||S.px<w.c0+0.8||S.px>w.c0+w.vx-1.8||(t.yin&&(S.py<w.r0+0.8||S.py>w.r0+w.vy-1.8))){ if(setWin(S.px-w.vx/2+0.5,S.py-w.vy/2+0.5)) render(); } }
  function cellAt(cx,cy){ const g=S.geo; if(!g) return null; const r=gw.getBoundingClientRect(); return {x:S.win.c0+(cx-r.left-g.hw)/g.cw-0.5, y:S.win.r0+(cy-r.top-g.hh)/g.ch-0.5}; }
  gbox.addEventListener('wheel',e=>{ if(!built||built.vert) return; e.preventDefault(); if(S.follow){ S.follow=false; syncZ(); } const p=cellAt(e.clientX,e.clientY); setZoom(S.zoom*(e.deltaY<0?1.25:0.8),p&&p.x,p&&p.y); },{passive:false});
  gbox.addEventListener('dblclick',()=>{ if(S.zoom>1.01){ S.follow=true; setZoom(1); } });
  gbox.addEventListener('contextmenu',e=>{ if(!ED()||!built) return; e.preventDefault(); const p=cellAt(e.clientX,e.clientY); if(!p) return; const c=Math.round(p.x), r=Math.round(p.y); if(c<0||r<0||c>=built.x.length||r>=built.z.length) return;
    const B=selBox(); if(!B||r<B.r0||r>B.r1||c<B.c0||c>B.c1){ SEL.r0=SEL.r1=r; SEL.c0=SEL.c1=c; draw(); syncEd(); } cellMenu(e); });
  const P={on:false,x:0,y:0,c0:0,r0:0,moved:false};
  gbox.addEventListener('pointerdown',e=>{ if(ED()&&e.button===0&&edDown(e)) return; Object.assign(P,{on:true,x:e.clientX,y:e.clientY,c0:S.win.c0,r0:S.win.r0,moved:false}); try{ gbox.setPointerCapture(e.pointerId); }catch(_){} });
  gbox.addEventListener('pointermove',e=>{ const g=S.geo; if(!g) return; if(SEL.drag){ edMove(e); return; }
    if(P.on){ const dx=(e.clientX-P.x)/g.cw, dy=(e.clientY-P.y)/g.ch; if(Math.abs(dx)+Math.abs(dy)>0.3){ P.moved=true; if(S.zoom>1.01){ if(S.follow){ S.follow=false; syncZ(); } if(setWin(P.c0-dx,P.r0-dy)) render(); } } return; }
    hover(e); });
  gbox.addEventListener('pointerup',e=>{ if(SEL.drag){ SEL.drag=false; return; } if(P.on&&!P.moved) clickCell(e); P.on=false; }); gbox.addEventListener('pointercancel',()=>{ SEL.drag=false; P.on=false; });
  gbox.addEventListener('pointerleave',()=>tip.classList.add('hidden'));
  function heatCell(e){ const t=built; if(!t||!T.opt.kmH||!knockTbl(t)) return null; const p=cellAt(e.clientX,e.clientY); if(!p) return null;
    const c=Math.round(p.x), r=Math.round(p.y), H=heatData(); return H&&H.cells[r+','+c]?{c,r,cell:H.cells[r+','+c]}:null; }
  function hover(e){ if(ED()&&edTip(e)) return; const h=heatCell(e); if(!h){ if(!dwellTip(e)) tip.classList.add('hidden'); return; } const t=built, m=h.cell, b=gbox.getBoundingClientRect();
    tip.innerHTML=`<b>${fmtA('load',t.x[h.c])} g/rev · ${Math.round(t.y[h.r])} rpm</b><br>worst ${m.worst.toFixed(2)}° · ${m.cnt} frame${m.cnt>1?'s':''} · ${m.logs.size} log${m.logs.size>1?'s':''}${Object.keys(m.ch).length>1||kchs().length>1?'<br>'+Object.entries(m.ch).map(([c,x])=>c.toUpperCase()+' '+x.toFixed(2)+'°').join(' · '):''}${m.iat!=null?` · IAT ${m.iat}°C`:''}${m.ect!=null?` · ECT ${m.ect}°C`:''}`;
    tip.classList.remove('hidden'); tip.style.left=Math.min(b.width-tip.offsetWidth-6,e.clientX-b.left+14)+'px'; tip.style.top=Math.max(4,e.clientY-b.top-tip.offsetHeight-10)+'px'; }
  function clickCell(e){ const h=heatCell(e); if(h&&h.cell.cwi>=0) SEEK(CX.L.t[h.cell.cwi],true); }
  // whole-log knock heat on this table's own axes; each frame binned on the table the
  // auto-pick says was active (TGV closed/open tables have different axes)
  let vCache={k:''};
  function visitData(){ const t=built; if(!t||!CX.L||!t.yin) return null; const LS=poolL(CX.L), key=t.id+'|'+LS.map(L=>L.fp).join(',')+'|'+t.x.length+'x'+t.y.length; if(vCache.k===key) return vCache.v;
    const nx=t.x.length, ms=new Float64Array(nx*t.y.length), cut=new Uint32Array(nx*t.y.length), ny=t.y.length, lg=Array.from({length:nx*ny},()=>0);
    for(const L of LS){ const seen=new Uint8Array(nx*ny); for(let i=0;i<L.N;i++){ const d=rpSample(L,i), xv=d[t.xin], yv=d[t.yin]; if(xv==null||yv==null||!Number.isFinite(xv)||!Number.isFinite(yv)) continue;
      const cc=Math.max(0,Math.min(nx-1,Math.round(fi(t.x,xv)))), r=Math.max(0,Math.min(ny-1,Math.round(fi(t.y,yv)))), k=r*nx+cc, dt=i+1<L.N?Math.min(1000,L.t[i+1]-L.t[i]):0;
      ms[k]+=dt||1; if(L.an&&L.an.cutF[i]) cut[k]++; if(!seen[k]){ seen[k]=1; lg[k]++; } } }
    vCache={k:key,v:{ms,cut,lg}}; return vCache.v; }
  function dwellTip(e){ if(!(T.opt.dim||T.opt.fc)||!built||!built.yin) return false; const V=visitData(), p=cellAt(e.clientX,e.clientY); if(!V||!p) return false; const t=built, cc=Math.round(p.x), r=Math.round(p.y);
    if(cc<0||r<0||cc>=t.x.length||r>=t.y.length) return false; const k=r*t.x.length+cc, ms=V.ms[k], b=gbox.getBoundingClientRect();
    tip.innerHTML=`<b>${fmtA(t.xin,t.x[cc])} · ${Math.round(t.y[r])}</b><br>${ms?'dwell '+(ms/1000).toFixed(ms<10000?1:0)+' s':'not visited'}${V.cut[k]?` · fuel cut ${V.cut[k]} frames`:''}${V.lg[k]?` · ${V.lg[k]} log${V.lg[k]>1?'s':''}`:''}`;
    tip.classList.remove('hidden'); tip.style.left=Math.min(b.width-tip.offsetWidth-6,e.clientX-b.left+14)+'px'; tip.style.top=Math.max(4,e.clientY-b.top-tip.offsetHeight-10)+'px'; return true; }
  function kOnTable(L,i,t){ const id=L.pick&&L.pick[i]; if(t.group==='timing'){ const p=pTbl(id); return !!p&&p.id===t.id; } if(t.group==='kca'&&id){ const p=pTbl(id); if(p&&p.tag&&p.tag!==t.tag) return false; } return true; }
  function heatData(){ const t=built, L0=CX.L; if(!t||!L0) return null; const LS=poolL(CX.L).filter(L=>L.c.load&&L.c.rpm&&kchs().some(k=>L.c[k])); if(!LS.length) return null; const chs=kchs();
    const key=LS.map(L=>L.fp).join(',')+'|'+t.id+'|'+chs.join(',')+'|'+isAuto('timing'); if(S.heatKey===key) return S.heat; const cells={};
    for(const L of LS){ const A=chs.map(k=>L.c[k]||[]), pk=L.pick, autoT=t.group==='timing'&&isAuto('timing')&&pk&&pk.some(Boolean);
    for(let i=0;i<L.N;i++){ let v=0; const wv=A.map(a=>a[i]<0?a[i]:0); for(const x of wv) if(x<v) v=x; if(!(v<0)) continue;
      if(t.group==='timing'){ const p=pk&&pTbl(pk[i]); if(!p||p.id!==t.id) continue; }
      if(t.group==='kca'&&pk&&pk[i]){ const p=byId(pk[i]); if(p&&p.tag&&p.tag!==t.tag) continue; }
      const c=Math.round(fi(t.x,L.c.load[i])), r=Math.round(fi(t.y,L.c.rpm[i])), k=r+','+c, m=cells[k]||(cells[k]={worst:0,cnt:0,wi:-1,wL:null,cwi:-1,cw:0,logs:new Set(),iat:[],ect:[],ch:{}}); m.logs.add(L.fp); if(L===L0&&v<m.cw){ m.cw=v; m.cwi=i; }
      chs.forEach((c,q)=>{ if(wv[q]<(m.ch[c]??0)) m.ch[c]=wv[q]; });
      m.cnt++; if(v<m.worst){ m.worst=v; m.wi=i; m.wL=L; } if(L.c.iat&&Number.isFinite(L.c.iat[i])) m.iat.push(L.c.iat[i]); if(L.c.ect&&Number.isFinite(L.c.ect[i])) m.ect.push(L.c.ect[i]); } }
    for(const k in cells){ const m=cells[k]; m.iat=m.iat.length?Math.round(median(m.iat)):null; m.ect=m.ect.length?Math.round(median(m.ect)):null; }
    S.heatKey=key; S.heat={cells}; S.heatT0=performance.now(); return S.heat; }
  function layout(){ const t=built; if(!t||!S.shown) return; const nx=S.win.vx, ny=S.win.vy, oneD=!t.yin;
    const W=gbox.clientWidth-16, H=gbox.clientHeight-16; if(W<40||H<40) return;
    const hw=Math.max(60,Math.min(72,W*0.06)), cw=(W-hw)/nx; let ch,hh,chH=0;
    if(t.vert){ const hw2=Math.max(64,Math.min(80,W*0.08)); ch=Math.max(24,Math.min(32,(H-26)/ny)); hh=26; const cw2=Math.max(96,Math.min(140,W*0.16));
      grid.style.gridTemplateColumns=hw2+'px '+cw2+'px'; grid.style.gridTemplateRows=hh+'px repeat('+ny+','+ch+'px)'; grid.style.fontSize=Math.min(18,ch*0.62)+'px';
      const GW=hw2+cw2, GH=hh+ch*ny, dpr=devicePixelRatio||1, chW=Math.max(160,W-GW-14); cv.width=GW*dpr; cv.height=GH*dpr; cv.style.width=GW+'px'; cv.style.height=GH+'px';
      const VH=Math.max(160,H); chart.width=chW*dpr; chart.height=VH*dpr; chart.style.width=chW+'px'; chart.style.height=VH+'px'; S.geo={hw:hw2,hh,cw:cw2,ch,nx:1,ny,GW,GH,chW,dpr,vh:VH}; draw(); return; }
    if(oneD){ ch=Math.max(18,Math.min(34,cw*0.7)); hh=ch; chH=Math.max(100,H-hh-ch-6); }
    else { ch=Math.max(11,Math.min(H/(ny+1),40*Math.max(1,S.zoom))); hh=Math.max(20,Math.min(ch,26)); ch=Math.max(11,Math.min(ch,(H-hh)/ny)); }
    grid.style.gridTemplateColumns=hw+'px repeat('+nx+','+cw+'px)'; grid.style.gridTemplateRows=hh+'px repeat('+ny+','+ch+'px)';
    grid.style.fontSize=Math.max(9,Math.min(17,Math.min(cw/3.7,ch*0.78)))+'px';
    const GW=hw+cw*nx, GH=hh+ch*ny, dpr=devicePixelRatio||1; cv.width=GW*dpr; cv.height=GH*dpr; cv.style.width=GW+'px'; cv.style.height=GH+'px';
    if(oneD){ chart.width=GW*dpr; chart.height=chH*dpr; chart.style.width=GW+'px'; chart.style.height=chH+'px'; }
    S.geo={hw,hh,cw,ch,nx,ny,GW,GH,chH,dpr}; draw(); }
  function status(){ const t=built;
    if(!TT()){ msg.textContent='No tune loaded'; msg.style.display=''; gbox.style.display='none'; return; } gbox.style.display=isSet()?'none':'';
    msg.style.display='none'; gbox.classList.remove('off'); }
  function frame(i,snap){ const L=CX.L; if(!L) return; const d=rpSample(L,i); S.live=d;
    stripLive(L,i);
    const np=L.pick?L.pick[i]:null, nf=L.fuel?L.fuel[i]:'normal', wasT=tgv(), pc=np!==S.pick, fc=nf!==S.fuel; S.pick=np; S.fuel=nf; let rebuilt=false;
    if(T.opt.fol&&i>0&&L.st){ const c=L.st[i], p=L.st[i-1]; if(Number.isFinite(c)&&Number.isFinite(p)&&(p>=10)===(c>=10)){ const want=c>=10?'fuel':'timing';
      if(want!==T.grp&&tabs(want).length){ T.grp=want; S.zoom=1; S.follow=true; save(); build(); rebuilt=true; } } }
    if(!rebuilt){ const g=T.grp; if(isAuto(g)&&((g==='timing'&&tgv()!==wasT)||(g!=='timing'&&hasAuto(g)&&(fc||tgv()!==wasT)))) build(); else if(pc||fc) renderBar(); }
    liveCards(); renderBreak();
    const t=built; if(!t||need(t).length){ S.tx=null; return; } const xv=d[t.xin], yv=t.yin?d[t.yin]:0; if(xv==null||yv==null){ S.tx=null; return; }
    S.tx=fi(t.x,xv); S.ty=t.yin?fi(t.y,yv):0; if(S.px==null||snap){ S.px=S.tx; S.py=S.ty; } if(S.shown) follow(!!snap);
    if(t.vert&&S.shown&&S.follow&&S.geo){ const y=S.geo.hh+(S.ty+0.5)*S.geo.ch, top=gbox.scrollTop, h=gbox.clientHeight; if(y<top+40||y>top+h-40) gbox.scrollTop=Math.max(0,y-h/2); } }
  function drawChart(t,g){ const c=chart.getContext('2d'); c.setTransform(g.dpr,0,0,g.dpr,0,0); c.clearRect(0,0,g.GW,g.chH);
    const d=uDisp(t), Wn=S.win; let lo=t.lo, hi=t.hi;
    if(S.zoom>1.01){ lo=Infinity; hi=-Infinity; for(let q=Math.max(0,Wn.c0-1);q<Math.min(t.x.length,Wn.c0+Wn.vx+1);q++){ lo=Math.min(lo,t.z[0][q]); hi=Math.max(hi,t.z[0][q]); } }
    if(hi-lo<1e-9){ lo-=1; hi+=1; } const pad=(hi-lo)*0.08, lo0=lo; lo-=pad; hi+=pad; if(lo0>=0&&lo<0) lo=0;
    const T0=8, B=g.chH-6, Y=v=>B-(B-T0)*(v-lo)/(hi-lo), X=f=>g.hw+(f-Wn.c0+0.5)*g.cw;
    c.strokeStyle=COL.grid; c.lineWidth=1; c.fillStyle=COL.lab; c.font='11px '+FONT_MONO; c.textAlign='right'; c.textBaseline='middle';
    for(let k=0;k<=4;k++){ const v=lo+(hi-lo)*k/4, yy=Y(v); c.beginPath(); c.moveTo(g.hw,yy); c.lineTo(g.GW,yy); c.stroke(); const vv=v*d.k+(d.o||0); c.fillText(Math.abs((hi-lo)*d.k)<10?vv.toFixed(2):vv.toFixed(0),g.hw-4,yy); }
    c.save(); c.beginPath(); c.rect(g.hw,0,g.GW-g.hw,g.chH); c.clip(); c.strokeStyle=COL.acc; c.lineWidth=2; c.beginPath();
    t.z[0].forEach((v,i)=>{ if(i) c.lineTo(X(i),Y(v)); else c.moveTo(X(i),Y(v)); }); c.stroke(); c.restore();
    if(S.px==null||S.tx==null) return; const v=bil(t,S.px,0), x=X(S.px), y=Y(v), red=COL.red;
    c.strokeStyle=red; c.lineWidth=2; c.shadowColor='rgba(255,0,0,.8)'; c.shadowBlur=6; c.beginPath(); c.moveTo(x,T0); c.lineTo(x,g.chH); c.moveTo(g.hw,y); c.lineTo(g.GW,y); c.stroke(); c.shadowBlur=0;
    c.fillStyle=red; c.beginPath(); c.arc(x,y,5,0,7); c.fill();
    if(T.opt.val){ const tx=fmtVal(t,v); c.font='800 15px system-ui,sans-serif'; c.textAlign='left'; const w=c.measureText(tx).width+10, h=24; let bx=x+10, by=y-h-8; if(bx+w>g.GW) bx=x-10-w; if(by<T0) by=y+8;
      c.fillStyle='rgba(0,0,0,.82)'; c.fillRect(bx,by,w,h); c.strokeStyle=red; c.lineWidth=1.5; c.strokeRect(bx,by,w,h); c.fillStyle='#fff'; c.fillText(tx,bx+5,by+h/2+0.5); } }
  // one-axis tables listed down the side: the graph beside them reads like EcuFlash (axis across, value up)
  function drawV(t,g){ const c=chart.getContext('2d'); c.setTransform(g.dpr,0,0,g.dpr,0,0); c.clearRect(0,0,g.chW,g.GH); const d=uDisp(t), n=t.z.length, Wn=S.win||{r0:0,vy:n}, q0=0, q1=Math.max(0,n-1), vis=()=>true;
    let lo=Infinity, hi=-Infinity; for(let r=q0;r<=q1;r++){ const v=t.z[r][0]; if(Number.isFinite(v)){ lo=Math.min(lo,v); hi=Math.max(hi,v); } } if(!Number.isFinite(lo)){ lo=t.lo; hi=t.hi; } if(hi-lo<1e-9){ lo-=1; hi+=1; } const pad=(hi-lo)*0.08; lo-=pad; hi+=pad;
    const ax=(t.y||[]).map(Number), a0=ax.length?ax[q0]:q0, a1=ax.length?ax[q1]:q1, VH=g.vh||Math.min(g.GH,(chart.parentElement&&chart.parentElement.clientHeight)||g.GH), L0=46, R0=g.chW-12, T0=g.hh+10, B0=VH-26;
    const X=r=>{ const v=ax.length?(r<=0?ax[0]:r>=n-1?ax[n-1]:ax[Math.floor(r)]+(ax[Math.ceil(r)]-ax[Math.floor(r)])*(r-Math.floor(r))):r; return L0+(R0-L0)*((v-a0)/((a1-a0)||1)); }, Y=v=>B0-(B0-T0)*(v-lo)/(hi-lo);
    c.strokeStyle=COL.grid; c.lineWidth=1; c.fillStyle=COL.lab; c.font='11px '+FONT_MONO; c.textBaseline='middle';
    for(let k=0;k<=4;k++){ const v=lo+(hi-lo)*k/4, y=Y(v); c.beginPath(); c.moveTo(L0,y); c.lineTo(R0,y); c.stroke(); const vv=v*d.k+(d.o||0); c.textAlign='right'; c.fillText(Math.abs((hi-lo)*d.k)<10?vv.toFixed(2):vv.toFixed(0),L0-6,y); }
    c.textAlign='center'; for(let k=0;k<=4;k++){ const r=q0+(q1-q0)*k/4, x=X(r), av=ax.length?(ax[Math.round(r)]):r; c.beginPath(); c.moveTo(x,T0); c.lineTo(x,B0); c.stroke(); c.fillText(Number.isFinite(av)?(Math.abs(a1-a0)<10?av.toFixed(2):av.toFixed(0)):'',x,B0+14); }
    const path=z=>{ c.beginPath(); let st=0; for(let r=q0;r<=q1;r++){ const y=Y(z[r][0]); if(st++) c.lineTo(X(r),y); else c.moveTo(X(r),y); } c.stroke(); };
    c.save(); c.beginPath(); c.rect(L0,T0-4,R0-L0,B0-T0+8); c.clip(); const b=baseOf(t); if(ED()&&b){ c.strokeStyle='#5c5c66'; c.setLineDash([4,4]); c.lineWidth=1.4; path(b.z); c.setLineDash([]); }
    c.strokeStyle=COL.acc; c.lineWidth=2; path(t.z); c.fillStyle=COL.acc; for(let r=q0;r<=q1;r++){ c.beginPath(); c.arc(X(r),Y(t.z[r][0]),2.6,0,7); c.fill(); } c.restore();
    if(S.py==null||S.tx==null||!vis(Math.round(S.py))) return; const v=bil(t,0,S.py), x=X(S.py), y=Y(v); c.strokeStyle=COL.red; c.lineWidth=2; c.shadowColor='rgba(255,0,0,.8)'; c.shadowBlur=6; c.beginPath(); c.moveTo(L0,y); c.lineTo(R0,y); c.moveTo(x,T0); c.lineTo(x,B0); c.stroke(); c.shadowBlur=0; c.fillStyle=COL.red; c.beginPath(); c.arc(x,y,5,0,7); c.fill(); }
  function draw(){ const g=S.geo, t=built; if(!g||!t||!S.shown) return; const oneD=!t.yin; if(oneD) drawChart(t,g); if(t.vert) drawV(t,g);
    const c=cv.getContext('2d'); c.setTransform(g.dpr,0,0,g.dpr,0,0); c.clearRect(0,0,g.GW,g.GH);
    const W=S.win, X=f=>g.hw+(f-W.c0+0.5)*g.cw, Y=f=>g.hh+(f-W.r0+0.5)*g.ch, red=INK().cur, L=CX.L;
    c.save(); c.beginPath(); c.rect(0,0,g.GW,g.GH); c.clip();
    if(L&&knockTbl(t)&&T.opt.kmH&&!(ED()&&!EDIT.overlays)){ const H=heatData(); if(H){ const a=Math.min(1,(performance.now()-S.heatT0)/600);   // lights up once
      for(const k in H.cells){ const [r,cc]=k.split(',').map(Number); if(cc<W.c0||cc>=W.c0+W.vx||r<W.r0||r>=W.r0+W.vy) continue; const m=H.cells[k], x0=g.hw+(cc-W.c0)*g.cw, y0=g.hh+(r-W.r0)*g.ch;
        c.globalAlpha=a; c.strokeStyle=INK().heat?knockRamp(m.worst):INK().knk; c.lineWidth=2.5; c.strokeRect(x0+2,y0+2,g.cw-4,g.ch-4);
        c.fillStyle=INK().heat?knockRamp(m.worst):INK().knk; c.beginPath(); c.moveTo(x0+g.cw-2,y0+2); c.lineTo(x0+g.cw-2,y0+Math.min(10,g.ch*0.45)); c.lineTo(x0+g.cw-Math.min(10,g.cw*0.3),y0+2); c.fill(); c.globalAlpha=1; } } }
    if(knockTbl(t)&&T.opt.kw!==0&&TT()&&!(ED()&&!EDIT.overlays)){ const m=TT().m, v=(id,r,k)=>m[id]&&m[id][r]&&m[id][r][k]!=null?m[id][r][k]:null;
      const W2=[[v('knock_load',0,1),null,v('knock_rpm_range',0,1),v('knock_rpm_range',1,1),INK().win[0]],[v('spark_fine_load_limit',0,1),v('spark_fine_load_limit',1,1),v('spark_fine_rpm_min',0,1),v('spark_fine_rpm_max',0,1),INK().win[1]],[v('iam_load_limit',0,1),v('iam_load_limit',1,1),v('iam_rpm_limit',0,1),v('iam_rpm_limit',1,1),INK().win[2]]];
      const ex=v=>X(Math.round(v)), ey=v=>Y(Math.round(v));
      for(const [l0,l1,r0,r1,col] of W2){ if(l0==null||r0==null) continue; const x0=Math.max(g.hw,ex(fi(t.x,l0))-g.cw/2), x1=l1!=null?Math.min(g.GW,ex(fi(t.x,l1))+g.cw/2):g.GW, y0=Math.max(g.hh,ey(fi(t.y,r0))-g.ch/2), y1=r1!=null?Math.min(g.GH,ey(fi(t.y,r1))+g.ch/2):g.GH;
        if(x1-x0<2||y1-y0<2) continue; c.setLineDash([6,4]); c.strokeStyle='rgba(0,0,0,.45)'; c.lineWidth=3; c.strokeRect(x0+1,y0+1,x1-x0-2,y1-y0-2); c.strokeStyle=col; c.lineWidth=1.5; c.strokeRect(x0+1,y0+1,x1-x0-2,y1-y0-2); }
      c.setLineDash([]); }
    if(L&&t.yin&&(T.opt.dim||T.opt.fc)&&!(ED()&&!EDIT.overlays)){ const V=visitData();
      if(V) for(let r=W.r0;r<Math.min(t.y.length,W.r0+W.vy);r++) for(let cc=W.c0;cc<Math.min(t.x.length,W.c0+W.vx);cc++){ const x0=g.hw+(cc-W.c0)*g.cw, y0=g.hh+(r-W.r0)*g.ch, k=r*t.x.length+cc;
        if(T.opt.dim&&!V.ms[k]){ c.fillStyle='rgba(0,0,0,.62)'; c.fillRect(x0,y0,g.cw,g.ch); }
        if(T.opt.fc&&V.cut[k]){ c.strokeStyle=INK().fc; c.lineWidth=1.6; c.setLineDash([4,3]); c.strokeRect(x0+3,y0+3,g.cw-6,g.ch-6); c.setLineDash([]); c.fillStyle=INK().fc; c.beginPath(); c.moveTo(x0+2,y0+g.ch-2); c.lineTo(x0+2,y0+g.ch-Math.min(10,g.ch*.45)); c.lineTo(x0+Math.min(10,g.cw*.3),y0+g.ch-2); c.fill(); } } }
    if(L&&knockTbl(t)&&T.opt.kmL&&!(ED()&&!EDIT.overlays)){ c.save(); c.beginPath(); c.rect(g.hw,g.hh,g.GW-g.hw,g.GH-g.hh); c.clip(); for(const PL of poolL(CX.L)) for(const k of (PL.kmarks||[])){ if(!kOnTable(PL,k.i,t)) continue;
        const kx=X(fi(t.x,k.load)), ky=Y(fi(t.y,k.rpm)), r=Math.max(3,Math.min(g.cw,g.ch)*0.28);
        c.strokeStyle='rgba(255,40,40,.9)'; c.lineWidth=2.2; c.beginPath(); c.moveTo(kx-r,ky-r); c.lineTo(kx+r,ky+r); c.moveTo(kx+r,ky-r); c.lineTo(kx-r,ky+r); c.stroke(); } c.restore(); }
    edDraw(c,g,t,W); if(ED()&&!EDIT.overlays){ c.restore(); return; }
    if(RP.B&&RP.B!==L){ const d=rpSample(RP.B,RP.bI), xv=d[t.xin], yv=t.yin?d[t.yin]:0; if(xv!=null&&yv!=null){ const bx=X(fi(t.x,xv)), by=oneD?g.hh+g.ch/2:Y(fi(t.y,yv)), bc=logC('b');
      c.strokeStyle=bc; c.lineWidth=2.5; c.beginPath(); c.arc(bx,by,Math.max(5,Math.min(g.cw,g.ch)*0.32),0,7); c.stroke(); c.fillStyle=bc; c.font='700 11px system-ui,sans-serif'; c.textAlign='left'; c.textBaseline='alphabetic'; c.fillText('B',bx+7,by-7); } }
    if(S.px==null||S.tx==null){ c.restore(); return; }
    const x=X(S.px), y=Y(S.py); let bx0,by0,bx1,by1;
    if(T.opt.mark==='glow'){ const ix=Math.floor(S.px), iy=Math.floor(S.py), ix1=Math.min(ix+1,t.x.length-1), iy1=oneD?iy:Math.min(iy+1,t.z.length-1), ax=S.px-ix, ay=S.py-iy;
      [[ix,iy,(1-ax)*(1-ay)],[ix1,iy,ax*(1-ay)],[ix,iy1,(1-ax)*ay],[ix1,iy1,ax*ay]].forEach(q=>{ if(q[2]<0.02||q[0]<W.c0||q[0]>=W.c0+W.vx||q[1]<W.r0||q[1]>=W.r0+W.vy) return;
        c.fillStyle='rgba(255,30,30,'+(0.06+0.16*q[2]).toFixed(3)+')'; c.fillRect(g.hw+(q[0]-W.c0)*g.cw,g.hh+(q[1]-W.r0)*g.ch,g.cw,g.ch); });
      bx0=ix; bx1=ax>0.02?ix1:ix; by0=iy; by1=(!oneD&&ay>0.02)?iy1:iy; }
    else { const rx=Math.round(S.px), ry=Math.round(S.py); bx0=bx1=rx; by0=by1=ry; }
    const L0=g.hw+(bx0-W.c0)*g.cw, R0=g.hw+(bx1-W.c0+1)*g.cw, T0=g.hh+(by0-W.r0)*g.ch, B0=g.hh+(by1-W.r0+1)*g.ch;
    const inX=S.px>W.c0-0.5&&S.px<W.c0+W.vx-0.5, inY=oneD||(S.py>W.r0-0.5&&S.py<W.r0+W.vy-0.5);
    c.strokeStyle=red; c.lineWidth=2; c.shadowColor='rgba(255,0,0,.8)'; c.shadowBlur=6; c.beginPath();
    if(inX){ c.moveTo(x,g.hh); c.lineTo(x,Math.max(g.hh,T0)); c.moveTo(x,Math.min(g.GH,B0)); c.lineTo(x,g.GH); }
    if(!oneD&&inY){ c.moveTo(g.hw,y); c.lineTo(Math.max(g.hw,L0),y); c.moveTo(Math.min(g.GW,R0),y); c.lineTo(g.GW,y); }
    c.stroke(); c.lineWidth=2.5; c.strokeRect(L0+1.25,T0+1.25,R0-L0-2.5,B0-T0-2.5); c.shadowBlur=0;
    if(inX&&inY){ c.fillStyle=red; c.strokeStyle='rgba(0,0,0,.7)'; c.lineWidth=1; c.beginPath(); c.arc(x,y,Math.max(2.5,Math.min(4,g.ch*0.14)),0,7); c.fill(); c.stroke(); }
    const l=S.live; c.font='700 '+Math.max(9,Math.min(13,g.hh*0.72))+'px system-ui,sans-serif'; c.textBaseline='middle'; c.textAlign='center';
    const pill=(px,py,txt,minW,maxR,h)=>{ const w=Math.max(minW,c.measureText(txt).width+8), lx=Math.max(0,Math.min(maxR-w,px-w/2)); c.fillStyle=red; c.fillRect(lx,py-h/2,w,h); c.fillStyle='#fff'; c.fillText(txt,lx+w/2,py+0.5); };
    if(l){ if(inX) pill(x,g.hh/2,fmtA(t.xin,l[t.xin]),g.cw*0.9,g.GW,g.hh-2); if(!oneD&&inY) pill(g.hw/2,y,fmtA(t.yin,l[t.yin]),g.hw-2,g.hw,g.ch-2); }
    if(T.opt.val&&!oneD&&inX&&inY){ const tx=fmtVal(t,bil(t,S.px,S.py)); c.font='800 '+Math.max(11,Math.min(16,g.ch*0.95))+'px system-ui,sans-serif';
      const w=c.measureText(tx).width+10, h=Math.max(14,Math.min(26,g.ch*1.15)); let bx=R0+4, by=T0-h-4;
      if(bx+w>g.GW) bx=L0-4-w; if(bx<g.hw) bx=Math.min(g.GW-w,R0+4); if(by<g.hh) by=B0+4; if(by+h>g.GH) by=Math.max(g.hh,T0-h-4);
      c.fillStyle='rgba(0,0,0,.82)'; c.fillRect(bx,by,w,h); c.strokeStyle=red; c.lineWidth=1.5; c.strokeRect(bx,by,w,h); c.fillStyle='#fff'; c.textAlign='left'; c.fillText(tx,bx+5,by+h/2+0.5); }
    c.restore(); }
  function tick(dt){ if(!S.shown) return; if(S.tx!=null&&S.px!=null){ const k=Math.min(1,dt/120); S.px+=(S.tx-S.px)*k; S.py+=(S.ty-S.py)*k; } follow(false); draw(); wt.update(); }
  return { el:root, frame, tick, openGroup(g,live){ T.grp=g; S.zoom=1; S.follow=true; save(); build(); if(live&&CX.L) frame(CX.i,true); if(live&&ED()&&S.tx!=null&&built){ SEL.r0=SEL.r1=Math.max(0,Math.min(built.z.length-1,Math.round(S.ty))); SEL.c0=SEL.c1=Math.max(0,Math.min(built.x.length-1,Math.round(S.tx))); draw(); syncEd(); } }, edRefresh(){ build(); syncEd(); renderRail(); }, showTable(id,r,c){ const t=byId(id); if(!t) return; T.grp=t.group; T.sel[t.group]=t.id; S.zoom=1; save(); renderBar(); build(); renderRail(); if(r!=null&&built){ SEL.r0=SEL.r1=r; SEL.c0=SEL.c1=c; draw(); syncEd(); } }, cur:()=>built, sel:()=>SEL, setSel(o){ Object.assign(SEL,o); draw(); syncEd(); }, isShown:()=>S.shown, show(on){ S.shown=on; if(on){ renderBar(); build(); requestAnimationFrame(layout); } }, resize(){ layout(); },
    setTune(){ S.pick=null; S.heatKey=''; renderBar(); build(); if(CX.L) frame(CX.i,true); }, refreshUnits(){ render(); if(isSet()) renderCards(); renderBreak(); }, logChanged(){ S.heatKey=''; renderStrip(); } };
}

// ════════════════════════════════════════════════════════════════════════════
//  MAF SCALING — pooled bins, CL/OL split, checks, copy row
// ════════════════════════════════════════════════════════════════════════════
function MafTableView(){
  let shown=false, liveBin=-1, revealKey=''; const root=mk('div','view mt'), bar=mk('div','vbar',root);
  const olMk=h=>seg(h,[['afl','+AFL','OL = WB/FFB × (1+AFL)'],['raw','raw','OL = WB/FFB']],CFG.olAfl?'afl':'raw',v=>{ CFG.olAfl=v==='afl'; UI.cfg.olAfl=CFG.olAfl; save(); refinalize(); }); const olSeg=olMk(document.createElement('div')); window.__mafOL=olMk;
  const srcChip=mk('span','chip ro',bar); const ipwChip=mk('span','chip ro',bar); const seamChip=mk('span','chip ro',bar); const chkChip=mk('span','chip ro',bar); const poolChip=mk('button','chip',bar); poolChip.onclick=()=>setPop(poolChip,['pool'],'Pooled logs'); const OPEN=new Set();
  mk('span','vfill',bar); { const fg=mk('button','ibtn',bar); fg.innerHTML=SVG_GEAR; fg.title='MAF filters and data'; fg.onclick=()=>mafPop(fg); }
  const now=mk('div','mt-now',root); now.style.display='none'; let nowSig='';
  const wrap=mk('div','ml',root), strip=mk('div','ml-strip',wrap), grid=mk('div','ml-grid',wrap), list=mk('div','ml-list',grid), side=mk('div','ml-side',grid); let narrow=false; let SELB=-1;
  const mc=m=>m==null?null:(m<0.88||m>1.12)?'#ff6b6b':(m<0.93||m>1.07)?'#f0a050':(m<0.97||m>1.03)?'#7bbf50':'#8a8a92';
  const f2=(v,d,s)=>v==null||!Number.isFinite(v)?'<span class="dim">—</span>':(s&&v>0?'+':'')+v.toFixed(d);
  const ZN=['Idle','Cruise','Load','Boost'], zEdges=()=>{ const z=UI.mafZones; return Array.isArray(z)&&z.length===3?z:[1.2,1.9,2.5]; };
  const lpC=s=>s==='CL'?'var(--cl,#4a90d9)':s==='OL'?'#3bb07f':s==='MIX'?'linear-gradient(var(--cl,#4a90d9) 50%,#3bb07f 50%)':'#1c1c22';
  const dOf=i=>{ const R=ST.row, sc=TUNE&&TUNE.mafScale, b=ST.bins&&ST.bins[i]; if(!R||!b||!b.n) return null; return sc&&R.nv?(R.nv[i]/sc[i]-1)*100:(R.f[i]-1)*100; };
  function refinalize(){ for(const b of ST.bins||[]) {} finalizeBins(ST.bins||[]); ST.row=scaleRow(ST.bins,ST.fixes); render(); RP.dirty=true; drawerRefresh(); }
  function render(){ const B=ST.bins, R=ST.row; olSeg.set(CFG.olAfl?'afl':'raw');
    
    { const ls=ST.logs.filter(L=>L.cap&&L.cap.maf), t=[]; if(ls.length&&!ls.some(L=>L.cap.ol)) t.push(ls.some(L=>L.cap.wb)?'OL: no target λ':'No wideband · CL only');
      if(ls.some(L=>L.cap.ol&&L.cap.tgt==='tune')) t.push('OL target from tune'); if(ls.some(L=>L.cap.ol&&L.cap.tgt==='pl')) t.push('PL target'); srcChip.style.display=t.length?'':'none'; srcChip.textContent=t.join(' · ');
      srcChip.title=t.includes('PL target')?'OL target λ = Power Mode - Fuel Ratio Target':''; }
    const ip=ST.ipw; ipwChip.style.display=ip?'':'none'; if(ip){ ipwChip.className='chip ro '+(ip.verdict==='applied'||ip.verdict==='not applied'?'ok':''); ipwChip.textContent=ip.verdict?('IPW: AFL '+ip.verdict+' in OL'):'IPW: not enough data'; ipwChip.title=ip.verdict?`OL fuel ratio ${ip.ratio.toFixed(3)} vs 1+AFL ${ip.afl.toFixed(3)} (CL n=${ip.nCL}, OL n=${ip.nOL})`:''; }
    const sg=B&&seamGap(B); seamChip.style.display=sg?'':'none'; if(sg){ seamChip.textContent=`CL/OL seam ${(sg.gap*100>=0?'+':'')+(sg.gap*100).toFixed(1)}%`; seamChip.title='Mean OL − CL multiplier where both loops have data. Mostly the wideband vs front-O2 offset, not MAF.'; }
    const nk=R?R.kink.filter(v=>v!=null).length:0, nm=R?R.mono.filter(Boolean).length:0; chkChip.style.display=R?'':'none';
    chkChip.className='chip ro '+(nk||nm?'warn':'ok'); chkChip.textContent=nk||nm?`${nk} kink${nk!==1?'s':''} · ${nm} non-monotonic`:'Curve checks OK';
    { const np=ST.logs.filter(pooled).length; poolChip.style.display=ST.logs.length>1?'':'none'; poolChip.textContent=np+' / '+ST.logs.length+' logs pooled'; poolChip.title='Choose which logs are pooled'; }
    list.innerHTML=''; strip.innerHTML=''; side.innerHTML=''; if(!B) return; if(SELB<0||!B[SELB]||!B[SELB].n){ SELB=B.findIndex(b=>b.n); }
    let mx=5; B.forEach((b,i)=>{ const d=dOf(i); if(d!=null) mx=Math.max(mx,Math.abs(d)); }); mx=Math.min(15,mx);
    strip.innerHTML=B.map((b,i)=>{ const f=R&&b.n?R.f[i]:null; return `<i role="button" tabindex="0" data-sb="${i}" class="${i===SELB?'pick':''}" style="background:${f!=null?mc(f):'#141418'}" title="${b.v.toFixed(3)} V${f!=null?' · ×'+f.toFixed(4):''}"></i>`; }).join('');
    const E=zEdges(), zs=[[0,E[0]],[E[0],E[1]],[E[1],E[2]],[E[2],99]], col=UI.mafCol||(UI.mafCol={}); let h='';
    zs.forEach(([z0,z1],zi)=>{ const ids=B.map((b,i)=>i).filter(i=>B[i].v>=z0&&B[i].v<z1); if(!ids.length) return; let sw=0, sn=0; for(const i of ids){ const d=dOf(i); if(d!=null){ sw+=d*B[i].n; sn+=B[i].n; } }
      const avg=sn?sw/sn:null, cls=avg==null?'dim':Math.abs(avg)>=6?'bad':Math.abs(avg)>=3?'warn':'ok', shut=!!col[ZN[zi]];
      h+=`<div class="ml-z" data-z="${zi}"><span class="zt">${shut?'▸':'▾'} ${ZN[zi]} <span class="dim">· ${B[ids[0]].v.toFixed(2)}–${B[ids[ids.length-1]].v.toFixed(2)} V</span></span><span class="za ${cls}">${avg==null?'no data':'avg '+(avg>0?'+':'')+avg.toFixed(2)+'%'}</span></div>`;
      if(shut) return;
      for(const i of ids){ const b=B[i], f=R&&b.n?R.f[i]:null, d=dOf(i), w=d==null?0:Math.min(50,Math.abs(d)/mx*50), kk=R&&R.kink[i]!=null, mo=R&&R.mono[i], ck=mo?'#ff5a5a':(kk||b.lean>0||b.rich||(b.agree!=null&&Math.abs(b.agree)>0.05))?'#f0a050':'';
        const sc=TUNE&&TUNE.mafScale, g0=sc&&sc[i]!=null?sc[i]:null, g1=R&&b.n&&R.nv?R.nv[i]:null, sr=String(b.src||'');
        h+=`<div class="ml-r${i===SELB?' pick':''}${b.n?'':' emp'}" data-bin="${i}" role="button" tabindex="0"><span class="lp" style="background:${lpC(b.src)}" title="${b.src||'no data'}"></span><span class="vv">${b.v.toFixed(3)}</span>`
          +`<span class="gs">${g0!=null?g0.toFixed(2):''}</span><span class="gs nw">${g1!=null?g1.toFixed(2):''}</span><span class="mm" style="color:${f!=null?mc(f):''}">${f!=null?'×'+f.toFixed(4):'—'}</span><span class="pc" style="color:${f!=null?mc(f):''}">${d!=null?(d>0?'+':'')+d.toFixed(2)+'%':''}</span>`
          +`<span class="nn ${b.trust==='solid'?'n-ok':b.n?'n-prov':''}">${b.n?b.n.toFixed(0):''}</span><span class="src">${(()=>{ const k=b.v.toFixed(3), ov=(UI.mafSrc||{})[k]; return (b.nCL?`<em class="c${ov==='OL'?' dim':''}${ov==='CL'?' set':''}" role="button" tabindex="0" aria-pressed="${ov==='CL'}" data-st="${k}" data-s="CL" title="${ov==='CL'?'CL only · click for Auto':'Use CL only'}">CL</em>`:'')+(b.nOL?`<em class="o${ov==='CL'?' dim':''}${ov==='OL'?' set':''}" role="button" tabindex="0" aria-pressed="${ov==='OL'}" data-st="${k}" data-s="OL" title="${ov==='OL'?'OL only · click for Auto':'Use OL only'}">OL</em>`:''); })()}</span><span class="ckw">${[mo?['NM','b','non-monotonic']:null,kk?['KINK','w','slope kink']:null,b.lean>0?['LEAN','w','lean']:null,b.rich?['RICH','w','rich floor']:null,b.agree!=null&&Math.abs(b.agree)>0.05?['CL≠OL','w','CL and OL disagree']:null].filter(Boolean).map(([t,c,ti])=>`<em class="${c}" title="${ti}">${t}</em>`).join('')}</span></div>`; } });
    list.innerHTML='<div class="ml-h"><span></span><span style="text-align:left">Volts</span><span>Cur. g/s</span><span>New g/s</span><span>Multiplier</span><span>Change</span><span>n</span><span style="text-align:left">Source</span><span style="text-align:left">Checks</span></div>'+h; panel(); liveBin=-1; mark(); }
  function panel(){ const B=ST.bins, R=ST.row, b=B&&B[SELB]; if(!b){ side.innerHTML=''; side._h=''; return; } const i=SELB, f=R&&b.n?R.f[i]:null, d=dOf(i), sc=TUNE&&TUNE.mafScale;
    const pts=B.map((x,j)=>[x,dOf(j)]).filter(p=>p[1]!=null), v0=BP[0], v1=BP[BP.length-1], sx=v=>4+(v-v0)/(v1-v0)*272; let my=5; pts.forEach(p=>my=Math.max(my,Math.abs(p[1]))); const sy=q=>36-q/my*30;
    const wbD=b.wb!=null?b.wb*lamK(UI.wbDisp):null, ffD=b.ff!=null?b.ff*lamK(UI.ffbDisp):null, kk=R&&R.kink[i]!=null, on=ST.fixes.has(i), chk=[];
    if(kk) chk.push(`<button class="kk${on?' on':''}" data-fix="${i}" title="Slope kink: correction ${R.raw[i].toFixed(3)} vs neighbours' ${R.kink[i].toFixed(3)}"><i></i>${on?'kink · smoothed':'kink'}</button>`);
    if(R&&R.mono[i]) chk.push('<span class="ck bad">non-monotonic</span>'); if(b.agree!=null&&Math.abs(b.agree)>0.05) chk.push(`<span class="ck warn">CL≠OL ${(b.agree*100).toFixed(0)}%</span>`); if(b.lean>0) chk.push('<span class="ck warn">lean</span>'); if(b.rich) chk.push('<span class="ck warn">rich floor</span>');
    const ovr=(UI.mafSrc||{})[b.v.toFixed(3)], srcTxt=ovr?ovr+' only (set)':b.src==='MIX'?'Auto · CL + OL weighted by samples':b.src?'Auto · '+b.src:'—', st=(l,v,c)=>`<div class="st"><em>${l}</em><b${c?` style="color:${c}"`:''}>${v}</b></div>`;
    const _h=`<div class="sh"><div class="sv">${b.v.toFixed(3)} V <span>· bin ${i+1}</span></div>${narrow?'<button class="ibtn" data-sx title="Close" aria-label="Close">✕</button>':''}</div><div class="smul" style="color:${f!=null?mc(f):'var(--mut)'}">${f!=null?'×'+f.toFixed(4):'no data'}</div><div class="sd" style="color:${f!=null?mc(f):'var(--mut)'}">${d!=null?(d>0?'+':'')+d.toFixed(2)+'%':''}${b.n?' · n '+b.n.toFixed(0):''}</div>
      <svg class="spark" viewBox="0 0 280 110" preserveAspectRatio="none"><line x1="0" x2="280" y1="55" y2="55" stroke="#33333b" stroke-dasharray="3 3"/>${pts.length?`<path d="${pts.map((p,k)=>(k?'L':'M')+sx(p[0].v).toFixed(1)+' '+(55+(sy(p[1])-36)*1.6).toFixed(1)).join(' ')}" fill="none" stroke="#e4aa28" stroke-width="1.8" vector-effect="non-scaling-stroke"/>`:''}${d!=null?`<circle cx="${sx(b.v)}" cy="${55+(sy(d)-36)*1.6}" r="5" fill="${mc(f)}" stroke="#000" stroke-width="1.5"/>`:''}<line class="sl" x1="-9" x2="-9" y1="0" y2="110" stroke="#ff1e1e" stroke-width="1.5"/></svg>
      ${b.n?`<div class="sgp"><h5>Source</h5><div class="srcl">${srcTxt}</div></div>
      <div class="sgp"><h5>Correction</h5><div class="sts">${st('CL ×',f2(b.cl,3))}${st('OL ×',f2(b.ol,3))}</div></div>
      <div class="sgp"><h5>Trims</h5><div class="sts">${st('AFL',f2(b.afl,2,1))}${st('AFC',f2(b.afc,2,1))}</div></div>
      <div class="sgp"><h5>Fuelling</h5><div class="sts">${st('WB '+uLbl(UI.wbDisp),f2(wbD,dpOf(UI.wbDisp)))}${st('FFB '+uLbl(UI.ffbDisp),f2(ffD,dpOf(UI.ffbDisp)))}</div></div>
      <div class="sgp"><h5>Samples</h5><div class="sts">${st('CL',b.nCL.toFixed(0))}${st('OL',b.nOL.toFixed(0))}</div></div>
      ${sc&&R?`<div class="sgp"><h5>MAF scale</h5><div class="sts">${st('Cur. g/s',sc[i].toFixed(2))}${st('New g/s',R.nv[i].toFixed(2),f!=null?mc(f):'')}</div></div>`:''}`:''}
      ${chk.length?`<div class="cks">${chk.join(' ')}</div>`:''}<div class="drow"><button class="btn sm" data-jc="${i}">Show on curve</button><button class="btn sm" data-jt="${i}">Open in Tables</button></div>`; if(_h!==side._h){ side._h=_h; side.innerHTML=_h; } }
  function selBin(i,scroll){ SELB=i; list.querySelectorAll('.ml-r.pick').forEach(x=>x.classList.remove('pick')); const r=list.querySelector(`.ml-r[data-bin="${i}"]`); if(r){ r.classList.add('pick'); if(scroll) r.scrollIntoView({block:'center',behavior:'smooth'}); }
    strip.querySelectorAll('i.pick').forEach(x=>x.classList.remove('pick')); const c=strip.querySelector(`[data-sb="${i}"]`); if(c) c.classList.add('pick'); panel(); liveBin=-1; mark(); }
  strip.addEventListener('click',e=>{ const c=e.target.closest('[data-sb]'); if(!c) return; const i=+c.dataset.sb, b=ST.bins[i]; if(!b) return; const zi=zEdges().filter(z=>b.v>=z).length; if(UI.mafCol&&UI.mafCol[ZN[zi]]){ delete UI.mafCol[ZN[zi]]; save(); SELB=i; render(); selBin(i,true); } else selBin(i,true); });
  side.addEventListener('pointerdown',e=>{ if(e.target.closest('[data-sx]')){ e.preventDefault(); e.stopPropagation(); side.classList.remove('open'); } });
  root.addEventListener('click',e=>{ if(e.target.closest('[data-sx]')) return;
    const st=e.target.closest('[data-st]'); if(st){ const k=st.dataset.st, src=st.dataset.s, M=UI.mafSrc||(UI.mafSrc={}); if(M[k]===src) delete M[k]; else M[k]=src; save(); refinalize(); return; }
    const fx=e.target.closest('[data-fix]'); if(fx){ const i=+fx.dataset.fix; if(ST.fixes.has(i)) ST.fixes.delete(i); else ST.fixes.add(i); ST.row=scaleRow(ST.bins,ST.fixes); render(); RP.dirty=true; return; }
    const jc=e.target.closest('[data-jc]'); if(jc){ const vis=UI.panes.slice(0,paneCount()); if(!vis.includes('maf_curve')&&!vis.includes('maf_both')) mafMode('maf_curve'); MV.focusBin(+jc.dataset.jc); return; }
    const jt=e.target.closest('[data-jt]'); if(jt){ const i=+jt.dataset.jt; showView('table'); TV.openGroup('maf',false); if(EDIT.on) TV.setSel({r0:i,r1:i,c0:0,c1:0}); return; }
    const zs=e.target.closest('[data-zs]'); if(zs){ const E=zEdges(), zi=+zs.dataset.zs, z=[[0,E[0]],[E[0],E[1]],[E[1],E[2]],[E[2],99]][zi]; if(window.__sug) window.__sug({maf:z}); return; }
    const zh=e.target.closest('.ml-z'); if(zh){ const n=ZN[+zh.dataset.z], c=UI.mafCol||(UI.mafCol={}); if(c[n]) delete c[n]; else c[n]=1; save(); render(); return; }
    const r=e.target.closest('.ml-r'); if(r){ selBin(+r.dataset.bin,false); if(narrow) side.classList.add('open'); } });
  // narrow pane (Both, splits): the bin panel becomes a drawer over the list
  const lay=()=>{ const n=wrap.clientWidth>0&&wrap.clientWidth<1120; if(n===narrow) return; narrow=n; root.classList.toggle('mlnarrow',n); if(n){ root.appendChild(side); side.classList.add('drw'); side.classList.remove('open'); } else { grid.appendChild(side); side.classList.remove('drw','open'); } panel(); };
  try{ new ResizeObserver(lay).observe(wrap); }catch(_){}
  root.addEventListener('keydown',e=>{ if(e.key==='Escape'&&side.classList.contains('open')){ e.stopPropagation(); side.classList.remove('open'); } });
  root.tabIndex=0; root.addEventListener('keydown',e=>{ if(!ST.bins||(e.key!=='ArrowDown'&&e.key!=='ArrowUp')||e.target.closest('input')) return; e.preventDefault(); e.stopPropagation(); const B=ST.bins; let i=SELB; do{ i+=e.key==='ArrowDown'?1:-1; }while(B[i]&&!B[i].n); if(B[i]) selBin(i,true); });

  function nowStrip(L,vb){ const B=ST.bins; if(vb<0||!B||!B[vb]){ if(nowSig){ now.style.display='none'; nowSig=''; } return; } const b=B[vb], f=ST.row&&b.n?ST.row.f[vb]:null, an=L.an, lp=an?an.loop[RP.i]:0;
    const lv=!an?null:lp===1?an.mCL[RP.i]:lp===2?(CFG.olAfl?an.mOLa[RP.i]:an.mOLr[RP.i]):null, sig=vb+'|'+(f!=null?f.toFixed(4):'')+'|'+(lv!=null?lv.toFixed(3):'');
    if(sig===nowSig) return; nowSig=sig; now.style.display='';
    now.innerHTML=`<span class="l">● Now</span><span class="v">${BP[vb].toFixed(3)} V</span><span class="m" style="color:${f!=null?mc(f):'var(--mut)'}">${f!=null?'×'+f.toFixed(4):'no data'}</span><span class="s">bin ${vb+1} · ${b.src||'—'} · n ${b.n.toFixed(0)}${lv!=null?' · live ×'+lv.toFixed(3):''}</span>`; }
  function mark(){ if(!shown) return; const L=RP.L, on=UI.sync.maf_table; let bi=-1, vb=-1;
    if(L&&L.c.mafv){ const v=L.c.mafv[RP.i]; if(Number.isFinite(v)) vb=Math.round(fi(BP,v)); if(on) bi=vb; } if(L) nowStrip(L,vb);
    if(bi===liveBin) return; liveBin=bi; list.querySelectorAll('.ml-r.live').forEach(x=>x.classList.remove('live')); strip.querySelectorAll('i.live').forEach(x=>x.classList.remove('live'));
    const sl=side.querySelector('.sl'); if(sl){ const x=vb>=0?(4+(BP[vb]-BP[0])/(BP[BP.length-1]-BP[0])*272):-9; sl.setAttribute('x1',x); sl.setAttribute('x2',x); }
    if(bi>=0){ const r=list.querySelector(`.ml-r[data-bin="${bi}"]`); if(r) r.classList.add('live'); const c=strip.querySelector(`[data-sb="${bi}"]`); if(c) c.classList.add('live'); } }
  return { el:root, render, frame:mark, show(on){ shown=on; if(on){ render(); } }, resize(){}, draw:mark };
}

// ════════════════════════════════════════════════════════════════════════════
//  MAF CURVE — scale curve + replay dot, corrected curve, Δ% bars, scatter layer
// ════════════════════════════════════════════════════════════════════════════
function MafCurveView(){
  const M=UI.m; let shown=false, cache={key:null,bins:null,row:null,at:0}; const root=mk('div','view mv'), bar=mk('div','vbar',root);
  window.__mafSrc=h=>seg(h,[['all','All logs'],['play','To playhead'],['ab','A–B']],M.src,v=>{ M.src=v; cache.key=null; save(); RP.dirty=true; }); { const g=mk('button','ibtn'); g.innerHTML=SVG_GEAR; g.title='MAF data and filters'; g.onclick=()=>mafPop(g); queueMicrotask(()=>bar.appendChild(g)); }
  seg(bar,[['curve','Line'],['delta','Δ %']],M.mode,v=>{ M.mode=v; save(); RP.dirty=true; });
  seg(bar,[['both','Corrected + current'],['new','Corrected'],['old','Current']],M.show||'both',v=>{ M.show=v; save(); RP.dirty=true; }).title='Which maf_scale curve to draw';
  const scBtn=mk('button','chip'+(M.scatter?' on':''),bar); scBtn.textContent='Scatter Plot'; scBtn.title='Show every kept frame behind the curve';
  scBtn.onclick=()=>{ M.scatter=!M.scatter; scBtn.classList.toggle('on',M.scatter); save(); RP.dirty=true; };
    const covBtn=mk('button','chip'+(M.cov!==false?' on':''),bar); covBtn.textContent='Coverage';
  covBtn.onclick=()=>{ M.cov=M.cov===false; covBtn.classList.toggle('on',M.cov!==false); cov.style.display=M.cov===false?'none':''; save(); RP.dirty=true; };
  const read=mk('span','mv-read',bar);
  const main=mk('canvas','mv-main',root), cov=mk('canvas','mv-cov',root); cov.style.display=M.cov===false?'none':'';
  // wheel zoom around the cursor, drag to pan, double-click resets (voltage axis)
  const Z={v0:null,v1:null}, HL={i:null}; let geo=null; const span=()=>[Z.v0??BP[0],Z.v1??BP[BP.length-1]];
  function setSpan(a,b){ const lo=BP[0], hi=BP[BP.length-1], w=Math.max(0.15,Math.min(hi-lo,b-a)); a=Math.max(lo,Math.min(hi-w,a)); if(w>=hi-lo-1e-9){ Z.v0=Z.v1=null; } else { Z.v0=a; Z.v1=a+w; } RP.dirty=true; }
  main.addEventListener('wheel',e=>{ if(!geo) return; e.preventDefault(); const r=main.getBoundingClientRect(), [a,b]=span(), f=Math.max(0,Math.min(1,(e.clientX-r.left-geo.L)/geo.gw)), v=a+f*(b-a), w=(b-a)*(e.deltaY<0?0.8:1.25); setSpan(v-f*w,v-f*w+w); },{passive:false});
  let pd=null; main.addEventListener('pointerdown',e=>{ pd={x:e.clientX,s:span()}; try{ main.setPointerCapture(e.pointerId); }catch(_){} });
  main.addEventListener('pointermove',e=>{ if(!pd||!geo) return; const [a,b]=pd.s, dv=-(e.clientX-pd.x)/geo.gw*(b-a); setSpan(a+dv,b+dv); });
  main.addEventListener('pointerup',()=>{ pd=null; }); main.addEventListener('pointercancel',()=>{ pd=null; }); main.addEventListener('dblclick',()=>{ Z.v0=Z.v1=null; RP.dirty=true; });
  function data(){ if(M.src==='all'||!RP.L) return {bins:ST.bins,row:ST.row,spans:ST.logs.filter(pooled).map(trimSpan)};
    let lo=0, hi=RP.i; if(M.src==='ab'){ if(RP.a==null||RP.b==null) return {bins:null}; lo=rpIdx(Math.min(RP.a,RP.b)); hi=rpIdx(Math.max(RP.a,RP.b)); }
    const key=M.src+':'+lo+':'+hi+':'+ST.anKey+':'+CFG.olAfl, now=performance.now(); const spans=[{L:RP.L,lo,hi}];
    if(cache.key!==key&&!(M.src==='play'&&cache.bins&&RP.playing&&now-cache.at<250)){ const b=computeBins(spans); cache={key,bins:b,row:scaleRow(b),at:now}; }
    return {bins:cache.bins,row:cache.row,spans}; }
  function draw(){ if(!shown) return; const z=sizeCanvas(main); if(!z) return; const {c,W,H}=z; c.fillStyle='#000'; c.fillRect(0,0,W,H);
    const D=data(), B=D.bins, R=D.row, sc=TUNE&&TUNE.mafScale, n=BP.length; c.font='12px '+FONT_MONO; c.fillStyle=COL.muted;
    if(!sc||sc.length!==n){ c.fillText(sc?`Tune maf_scale has ${sc.length} points; MAF axis has ${n}`:'No tune loaded',16,24); read.textContent=''; drawCov(null); return; }
    if(!B){ c.fillText('No A–B range',16,24); read.textContent=''; drawCov(null); return; }
    const Lp=62,Rp=16,Tp=14,Bp=26, gw=W-Lp-Rp, gh=H-Tp-Bp, [v0,v1]=span(), X=v=>Lp+(v-v0)/(v1-v0)*gw, L=RP.L; geo={L:Lp,gw};
    const sync=UI.sync.maf_curve&&L, mv=sync&&L.c.mafv?fin(L.c.mafv[RP.i]):null, an=L&&L.an, lp=sync&&an?an.loop[RP.i]:0;
    const live=!sync||!an?null:lp===1?an.mCL[RP.i]:lp===2?(CFG.olAfl?an.mOLa[RP.i]:an.mOLr[RP.i]):null;
    c.strokeStyle=COL.grid; c.lineWidth=1; c.textAlign='center'; c.textBaseline='top';
    const xs=(v1-v0)<1.2?0.1:0.5; for(let v=Math.ceil(v0/xs-1e-9)*xs; v<=v1+1e-9; v+=xs){ const x=X(v); c.beginPath(); c.moveTo(x,Tp); c.lineTo(x,Tp+gh); c.stroke(); c.fillStyle=COL.muted; c.fillText(v.toFixed(1)+'V',x,Tp+gh+6); }
    const srcCol=b=>b.src==='OL'?COL.ol:b.src==='CL'?COL.cl:COL.acc;
    const scat=(fy)=>{ if(!M.scatter) return; const sp=D.spans||[]; let tot=0; for(const s of sp) tot+=s.hi-s.lo+1; const step=Math.max(1,Math.ceil(tot/15000));
      for(const s of sp){ const a=s.L.an; if(!a) continue; for(let i=s.lo;i<=s.hi;i+=step){ const l=a.loop[i]; if(!l) continue; const m=l===1?a.mCL[i]:(CFG.olAfl?a.mOLa[i]:a.mOLr[i]); const y=fy(s.L.c.mafv[i],m); if(!Number.isFinite(y)) continue;
        c.fillStyle=l===2?'rgba(59,175,132,.28)':'rgba(90,159,212,.22)'; c.fillRect(X(s.L.c.mafv[i])-1.2,y-1.2,2.4,2.4); } } };
    if(M.mode==='curve'){ const corr=R?R.nv:sc; let lo=Infinity,hi=-Infinity; sc.forEach((v,i)=>{ if(BP[i]<v0-0.06||BP[i]>v1+0.06) return; for(const g of [v,corr[i]]) if(g>0){ lo=Math.min(lo,g); hi=Math.max(hi,g); } }); if(!Number.isFinite(lo)){ lo=sc[0]; hi=sc[sc.length-1]; } lo*=0.9; hi*=1.1;
      const lg=Math.log, Y=g=>Tp+gh-(lg(g)-lg(lo))/(lg(hi)-lg(lo))*gh; c.textAlign='right'; c.textBaseline='middle';
      for(const g of [1,2,5,10,20,50,100,200,500]){ if(g<lo||g>hi) continue; const y=Y(g); c.strokeStyle='#1c1c22'; c.beginPath(); c.moveTo(Lp,y); c.lineTo(Lp+gw,y); c.stroke(); c.fillStyle=COL.muted; c.fillText(g+' g/s',Lp-6,y); }
      c.save(); c.beginPath(); c.rect(Lp,Tp,gw,gh); c.clip(); scat((v,m)=>Y(lerpArr(BP,sc,v)*m));
      const shw=M.show||'both'; if(HL.i!=null&&BP[HL.i]>=v0&&BP[HL.i]<=v1){ const hx=X(BP[HL.i]); c.fillStyle='rgba(228,170,40,.10)'; c.fillRect(hx-10,Tp,20,gh); c.strokeStyle='rgba(228,170,40,.7)'; c.lineWidth=1; c.setLineDash([4,4]); c.beginPath(); c.moveTo(hx,Tp); c.lineTo(hx,Tp+gh); c.stroke(); c.setLineDash([]); }
      if(shw!=='new'){ c.strokeStyle='#7c7c82'; c.lineWidth=1.5; c.beginPath(); sc.forEach((g,i)=>{ const x=X(BP[i]), y=Y(g); if(i) c.lineTo(x,y); else c.moveTo(x,y); }); c.stroke(); }
      if(shw!=='old'){ c.strokeStyle=COL.acc; c.lineWidth=2; c.beginPath(); corr.forEach((g,i)=>{ const x=X(BP[i]), y=Y(g); if(i) c.lineTo(x,y); else c.moveTo(x,y); }); c.stroke(); }
      if(shw!=='old') B.forEach((b,i)=>{ if(!b.n) return; c.beginPath(); c.arc(X(BP[i]),Y(corr[i]),3.5,0,7); if(b.trust==='solid'){ c.fillStyle=srcCol(b); c.fill(); } else { c.strokeStyle=srcCol(b); c.lineWidth=1.5; c.stroke(); }
        if(R&&(R.kink[i]!=null||R.mono[i])){ c.strokeStyle='#f0a050'; c.lineWidth=1.5; c.beginPath(); c.arc(X(BP[i]),Y(corr[i]),7,0,7); c.stroke(); } });
      { const lg=[...(shw!=='new'?[['line','#7c7c82','Current maf_scale']]:[]),...(shw!=='old'?[['line',COL.acc,'Corrected']]:[]),['dot',COL.cl,'CL'],['dot',COL.ol,'OL'],['dot',COL.acc,'MIX'],['ring','#8a8a92','n < '+CFG.solidN]]; let lx=Lp+12; const ly=Tp+12;
        c.font='11px '+FONT_MONO; c.textBaseline='middle'; c.textAlign='left'; c.fillStyle='rgba(0,0,0,.72)'; c.fillRect(Lp+4,Tp+3,Math.min(gw-8,500),18);
        for(const [k,col,tx] of lg){ if(k==='line'){ c.strokeStyle=col; c.lineWidth=2; c.beginPath(); c.moveTo(lx,ly); c.lineTo(lx+16,ly); c.stroke(); lx+=21; } else { c.beginPath(); c.arc(lx+4,ly,3.5,0,7); if(k==='dot'){ c.fillStyle=col; c.fill(); } else { c.strokeStyle=col; c.lineWidth=1.5; c.stroke(); } lx+=13; } c.fillStyle=COL.lab; c.fillText(tx,lx,ly); lx+=c.measureText(tx).width+14; } }
      c.restore(); if(mv!=null&&mv>=v0&&mv<=v1){ const g=lerpArr(BP,sc,mv), x=X(mv), y=Y(g); cross(c,x,y,Lp,Tp,gw,gh); tag(c,x,y,`${mv.toFixed(3)} V · ${g.toFixed(2)} g/s`,Lp+gw); }
    } else { const pct=B.map((b,i)=>R&&b.n?(R.f[i]-1)*100:null); let mx=5; pct.forEach(p=>{ if(p!=null) mx=Math.max(mx,Math.abs(p)); }); if(live!=null) mx=Math.max(mx,Math.abs((live-1)*100)); mx=Math.min(40,Math.ceil(mx+1));
      const Y=p=>Tp+gh/2-p/mx*gh/2; c.textAlign='right'; c.textBaseline='middle';
      for(const p of [-mx,-mx/2,0,mx/2,mx]){ const y=Y(p); c.strokeStyle=p===0?'#3a3a44':'#1c1c22'; c.beginPath(); c.moveTo(Lp,y); c.lineTo(Lp+gw,y); c.stroke(); c.fillStyle=COL.muted; c.fillText((p>0?'+':'')+p.toFixed(1)+'%',Lp-6,y); }
      c.save(); c.beginPath(); c.rect(Lp,Tp,gw,gh); c.clip(); scat((v,m)=>Y((m-1)*100));
      B.forEach((b,i)=>{ if(pct[i]==null) return; const xa=X(i?(BP[i-1]+BP[i])/2:BP[0]), xb=X(i<n-1?(BP[i]+BP[i+1])/2:BP[n-1]), w=Math.max(2,(xb-xa)*0.75), x=(xa+xb)/2-w/2;
        c.globalAlpha=b.trust==='solid'?0.9:0.45; c.fillStyle=srcCol(b); const y0=Y(0), y1=Y(pct[i]); c.fillRect(x,Math.min(y0,y1),w,Math.abs(y1-y0)||1); c.globalAlpha=1;
        if(R&&R.kink[i]!=null){ c.strokeStyle='#f0a050'; c.lineWidth=1.5; c.strokeRect(x-2,Math.min(y0,y1)-2,w+4,Math.abs(y1-y0)+4); } }); c.restore();
      if(mv!=null&&live!=null){ const x=X(mv), y=Y((live-1)*100); cross(c,x,y,Lp,Tp,gw,gh); tag(c,x,y,`${mv.toFixed(3)} V · ${((live-1)*100>=0?'+':'')+((live-1)*100).toFixed(1)}%`,Lp+gw); } }
    if(sync&&mv!=null){ const bi=Math.round(fi(BP,mv)), b=B[bi], m=b&&b.n?b.m:null, d=an.drop[RP.i];
      read.innerHTML=`bin <b>${bi+1}</b> · live <b>${live!=null?'×'+live.toFixed(3):'—'}</b> · bin <b>${m!=null?'×'+m.toFixed(3):'—'}</b>${b&&b.n?` <span class="dim">(${b.src} n=${b.n.toFixed(0)})</span>`:''}`+(d?` · <span class="warn">${DROP_LABEL[d]||d}</span>`:''); }
    else read.textContent='';
    drawCov(B,mv!=null?Math.round(fi(BP,mv)):-1,Lp,X); }
  function cross(c,x,y,L,T,gw,gh){ c.strokeStyle=COL.red; c.lineWidth=1.5; c.shadowColor='rgba(255,0,0,.8)'; c.shadowBlur=6; c.beginPath(); c.moveTo(x,T); c.lineTo(x,T+gh); c.moveTo(L,y); c.lineTo(L+gw,y); c.stroke(); c.shadowBlur=0;
    c.fillStyle=COL.red; c.strokeStyle='rgba(0,0,0,.7)'; c.lineWidth=1; c.beginPath(); c.arc(x,y,5,0,7); c.fill(); c.stroke(); }
  function tag(c,x,y,txt,maxR){ c.font='800 13px system-ui,sans-serif'; c.textAlign='left'; c.textBaseline='middle'; const w=c.measureText(txt).width+10, h=22; let bx=x+10, by=y-h-8; if(bx+w>maxR) bx=x-10-w; if(by<4) by=y+8;
    c.fillStyle='rgba(0,0,0,.82)'; c.fillRect(bx,by,w,h); c.strokeStyle=COL.red; c.lineWidth=1.5; c.strokeRect(bx,by,w,h); c.fillStyle='#fff'; c.fillText(txt,bx+5,by+h/2+0.5); }
  function drawCov(B,cur,L,X){ const z=sizeCanvas(cov); if(!z) return; const {c,W,H}=z; c.fillStyle='#000'; c.fillRect(0,0,W,H); if(!B||!X) return; const n=BP.length;
    c.font='10px '+FONT_MONO; c.fillStyle=COL.muted; c.textAlign='right'; c.textBaseline='top'; c.fillText('n',L-6,6);
    B.forEach((b,i)=>{ const xa=X(i?(BP[i-1]+BP[i])/2:BP[0]), xb=X(i<n-1?(BP[i]+BP[i+1])/2:BP[n-1]), w=Math.max(2,xb-xa-1.5), h=b.n?6+Math.min(1,Math.log10(b.n+1)/Math.log10(300))*(H-16):3;
      if(xb<L||xa>W) return; c.fillStyle=b.n?(b.trust==='solid'?'#7bbf50':'#c9882a'):'#16161b'; c.fillRect(xa+0.75,H-4-h,w,h); if(i===cur){ c.strokeStyle=COL.red; c.lineWidth=1.5; c.strokeRect(xa+0.75,4,w,H-8); } }); }
  return { el:root, draw, focusBin(i){ const v=BP[i]; if(v!=null){ HL.i=i; setSpan(v-0.35,v+0.35); RP.dirty=true; } }, show(on){ shown=on; if(on){ cache.key=null; RP.dirty=true; } }, resize(){ RP.dirty=true; }, reset(){ cache.key=null; } };
}
// ════════════════════════════════════════════════════════════════════════════
//  SCATTER — any X vs Y over unmasked frames, optional colour channel, overlay log, trendline
// ════════════════════════════════════════════════════════════════════════════
function ScatterView(){ const S=UI.sc; let shown=false; const cache={key:''}; const root=mk('div','view sv'), bar=mk('div','vbar',root);
  mk('span','vlab',bar).textContent='Trend'; seg(bar,[['lin','Linear'],['poly','Poly','2nd-order curve'],['none','Off']],S.fit,v=>{ S.fit=v; save(); cache.key=''; RP.dirty=true; });
  const mkSel=(lab,key,tip)=>{ mk('span','vlab',bar).textContent=lab; const el=mk('select','sel sm',bar); el.title=tip; el.onchange=()=>{ S[key]=el.value; save(); cache.key=''; RP.dirty=true; }; return el; };
  const sx=mkSel('X','x','X axis channel'), sy=mkSel('Y','y','Y axis channel'), sc=mkSel('Colour by','c','Colour points by a third channel (blue = low, red = high)'), so=mkSel('Overlay','ov','Second log, drawn in cyan');
  const fitLab=mk('span','mv-read',bar), cv=mk('canvas','mv-main',root); mk('span','vfill',bar);
  { const gm=mk('div','seg',bar); gm.innerHTML='<button>Lanes</button><button class="on">Scatter</button>'; gm.firstChild.onclick=()=>grMode('graph'); { const sp=mk('span','',bar); sp.style.width='34px'; } }
  function chans(L){ const out=[]; if(!L) return out; if(L.c.wb) out.push(['v:wb','Wideband '+uLbl(UI.wbDisp)]); if(idcOf(L)) out.push(['v:idc','Injector duty (IDC)']); if(dThr(L)) out.push(['v:dthr','Throttle rate (%/s)']); if(afrErr(L)) out.push(['v:aerr','AFR error vs target']);
    L.fam.forEach((f,j)=>{ if(f!=='Time'&&j!==L.wbj&&!WB_COL.test(L.headers[j])&&!out.some(o=>o[0]===f)) out.push([f,f]); }); return out; }
  function getCh(L,id){ if(!L||!id) return null; if(id==='v:idc') return idcOf(L); if(id==='v:dthr') return dThr(L); if(id==='v:aerr') return afrErr(L);
    if(id==='v:wb'){ if(!L.c.wb) return null; const k=lamK(UI.wbDisp); if(k===1) return L.wb; const o=new Float64Array(L.N); for(let i=0;i<L.N;i++) o[i]=L.wb[i]*k; return o; }
    const j=L.fam.findIndex((f,x)=>f===id&&x!==L.wbj); return j<0?null:logCol(L,j); }
  function fill(){ const L=RP.L, cs=chans(L), opt=(cur,none)=>`<option value="">${none}</option>`+cs.map(([v,t])=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(t)}</option>`).join('');
    if(L&&!S.x&&!S.y&&!S.auto){ S.auto=1; const p=re=>(cs.find(([v,t])=>re.test(t))||[''])[0]; S.x=p(/engine load|^load|calculated load/i); S.y=p(/^wideband$/i)||p(/wideband|a\/f sensor #1|lambda/i); save(); }
    sx.innerHTML=opt(S.x,'— X —'); sy.innerHTML=opt(S.y,'— Y —'); sc.innerHTML=opt(S.c,'None');
    so.innerHTML='<option value="">None</option>'+ST.logs.filter(x=>x!==L).map(x=>`<option value="${esc(x.fp)}"${x.fp===S.ov?' selected':''}>${esc(x.name)}</option>`).join(''); cache.key=''; }
  function fit(xs,ys,deg){ const n=xs.length; if(n<3) return null;
    if(deg===1){ let a1=0,b1=0,c1=0,d1=0; for(let i=0;i<n;i++){ a1+=xs[i]; b1+=ys[i]; c1+=xs[i]*xs[i]; d1+=xs[i]*ys[i]; } const d=n*c1-a1*a1; if(!d) return null; const b=(n*d1-a1*b1)/d, a=(b1-b*a1)/n; return {c:[a,b],f:x=>a+b*x}; }
    let m=0; for(const x of xs) m+=x; m/=n; const Sm=[0,0,0,0,0], Tm=[0,0,0];
    for(let i=0;i<n;i++){ const x=xs[i]-m, y=ys[i]; let p=1; for(let k=0;k<5;k++){ Sm[k]+=p; if(k<3) Tm[k]+=p*y; p*=x; } }
    const A=[[Sm[0],Sm[1],Sm[2],Tm[0]],[Sm[1],Sm[2],Sm[3],Tm[1]],[Sm[2],Sm[3],Sm[4],Tm[2]]];
    for(let c=0;c<3;c++){ let p=c; for(let r=c+1;r<3;r++) if(Math.abs(A[r][c])>Math.abs(A[p][c])) p=r; [A[c],A[p]]=[A[p],A[c]]; if(Math.abs(A[c][c])<1e-12) return null;
      for(let r=0;r<3;r++){ if(r===c) continue; const f=A[r][c]/A[c][c]; for(let k=c;k<4;k++) A[r][k]-=f*A[c][k]; } }
    const q=[A[0][3]/A[0][0],A[1][3]/A[1][1],A[2][3]/A[2][2]]; return {c:q,f:x=>{ const u=x-m; return q[0]+q[1]*u+q[2]*u*u; }}; }
  function pts(L,X,Y,Cc){ const sp=trimSpan(L), xs=[], ys=[], cs=[]; for(let i=sp.lo;i<=sp.hi;i++){ const x=X[i], y=Y[i]; if(Number.isFinite(x)&&Number.isFinite(y)){ xs.push(x); ys.push(y); cs.push(Cc?Cc[i]:NaN); } } return {xs,ys,cs}; }
  function draw(){ if(!shown) return; const z=sizeCanvas(cv); if(!z) return; const {c,W,H}=z, L=RP.L; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.font='12px '+FONT_MONO; c.fillStyle=COL.muted;
    const X=getCh(L,S.x), Y=getCh(L,S.y); if(!X||!Y){ fitLab.textContent=''; c.fillText(L?'Choose X and Y channels':'No log',16,24); return; }
    const OL=RP.B&&RP.B!==L?RP.B:(S.ov?ST.logs.find(x=>x.fp===S.ov&&x!==L):null), Lp=62,Rp=16,Tp=14,Bp=26, gw=W-Lp-Rp, gh=H-Tp-Bp;
    const key=[W,H,L.fp,S.x,S.y,S.c,S.fit,OL?OL.fp:'',UI.wbDisp,ST.anKey,JSON.stringify(UI.trims[L.fp]||0),OL?JSON.stringify(UI.trims[OL.fp]||0):''].join('|');
    if(cache.key!==key){ cache.key=key; cache.geo=null; const A=pts(L,X,Y,getCh(L,S.c)), B=OL?(()=>{ const x=getCh(OL,S.x), y=getCh(OL,S.y); return x&&y?pts(OL,x,y,null):null; })():null;
      let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity; for(const Q of [A,B]) if(Q) for(let i=0;i<Q.xs.length;i++){ const x=Q.xs[i], y=Q.ys[i]; if(x<x0) x0=x; if(x>x1) x1=x; if(y<y0) y0=y; if(y>y1) y1=y; }
      if(Number.isFinite(x0)){ if(x1-x0<1e-9){ x0-=1; x1+=1; } if(y1-y0<1e-9){ y0-=1; y1+=1; } const px=(x1-x0)*.04, py=(y1-y0)*.06; x0-=px; x1+=px; y0-=py; y1+=py;
        const dpr=devicePixelRatio||1, oc=document.createElement('canvas'); oc.width=W*dpr; oc.height=H*dpr; const o=oc.getContext('2d'); o.scale(dpr,dpr);
        const MX=x=>Lp+(x-x0)/(x1-x0)*gw, MY=y=>Tp+gh-(y-y0)/(y1-y0)*gh, fx=v=>Math.abs(x1-x0)<10?v.toFixed(2):v.toFixed(0), fy=v=>Math.abs(y1-y0)<10?v.toFixed(2):v.toFixed(0);
        o.strokeStyle=COL.grid; o.fillStyle=COL.muted; o.font='11px '+FONT_MONO; o.lineWidth=1;
        for(let k=0;k<=4;k++){ const xv=x0+(x1-x0)*k/4, yv=y0+(y1-y0)*k/4; o.beginPath(); o.moveTo(MX(xv),Tp); o.lineTo(MX(xv),Tp+gh); o.moveTo(Lp,MY(yv)); o.lineTo(Lp+gw,MY(yv)); o.stroke();
          o.textAlign='center'; o.textBaseline='top'; o.fillText(fx(xv),MX(xv),Tp+gh+6); o.textAlign='right'; o.textBaseline='middle'; o.fillText(fy(yv),Lp-6,MY(yv)); }
        const dots=(Q,col,ramp)=>{ const n=Q.xs.length, step=Math.max(1,Math.ceil(n/20000)); let c0=Infinity,c1=-Infinity; if(ramp) for(const v of Q.cs) if(Number.isFinite(v)){ if(v<c0) c0=v; if(v>c1) c1=v; } if(ramp) cache.cr=[c0,c1];
          for(let i=0;i<n;i+=step){ const v=Q.cs[i]; o.fillStyle=ramp&&Number.isFinite(v)?`hsla(${(240*(1-(v-c0)/((c1-c0)||1))).toFixed(0)},90%,60%,.6)`:col; o.fillRect(MX(Q.xs[i])-1.2,MY(Q.ys[i])-1.2,2.4,2.4); } };
        if(B) dots(B,logC('b')+'66',false); dots(A,'rgba(228,170,40,.45)',!!S.c);
        if(S.c&&cache.cr&&Number.isFinite(cache.cr[0])){ const lx=Lp+gw-190, ly=Tp+8, gr=o.createLinearGradient(lx,0,lx+120,0), f2=v=>Math.abs(v)>=100?v.toFixed(0):v.toFixed(2);
          gr.addColorStop(0,'hsl(240,90%,60%)'); gr.addColorStop(.5,'hsl(120,90%,60%)'); gr.addColorStop(1,'hsl(0,90%,60%)'); o.fillStyle='rgba(0,0,0,.78)'; o.fillRect(lx-8,ly-5,196,32);
          o.fillStyle=gr; o.fillRect(lx,ly,120,8); o.fillStyle=COL.lab; o.font='10.5px '+FONT_MONO; o.textBaseline='top'; o.textAlign='left'; o.fillText(f2(cache.cr[0]),lx,ly+11); o.textAlign='right'; o.fillText(f2(cache.cr[1]),lx+120,ly+11); o.textAlign='left'; o.fillText(String(S.c).replace(/^v:/,'').slice(0,14),lx+126,ly-1); }
        let lab=''; const fl=(Q,col,tag)=>{ if(S.fit==='none'||!Q) return; const F=fit(Q.xs,Q.ys,S.fit==='poly'?2:1); if(!F) return; let ss=0,st=0,m=0; for(const y of Q.ys) m+=y; m/=Q.ys.length;
          for(let i=0;i<Q.xs.length;i++){ const e=Q.ys[i]-F.f(Q.xs[i]); ss+=e*e; st+=(Q.ys[i]-m)**2; }
          o.save(); o.beginPath(); o.rect(Lp,Tp,gw,gh); o.clip(); o.strokeStyle=col; o.lineWidth=2; o.beginPath(); for(let k=0;k<=80;k++){ const x=x0+(x1-x0)*k/80; if(k) o.lineTo(MX(x),MY(F.f(x))); else o.moveTo(MX(x),MY(F.f(x))); } o.stroke(); o.restore();
          lab+=`${tag}R² ${(st?1-ss/st:0).toFixed(3)}`+(S.fit==='lin'?` · slope ${F.c[1].toPrecision(3)}`:'')+' · '; };
        fl(A,'#ffffff',''); fl(B,logC('b'),'B ');
        cache.img=oc; cache.geo={MX,MY}; cache.lab=lab+`n ${A.xs.length.toLocaleString()}`; } }
    if(!cache.geo){ fitLab.textContent=''; c.fillText('No data in the unmasked range',16,24); return; }
    c.drawImage(cache.img,0,0,W,H); fitLab.textContent=cache.lab; const x=X[RP.i], y=Y[RP.i];
    if(Number.isFinite(x)&&Number.isFinite(y)){ c.fillStyle=COL.red; c.strokeStyle='rgba(0,0,0,.7)'; c.lineWidth=1; c.beginPath(); c.arc(cache.geo.MX(x),cache.geo.MY(y),5,0,7); c.fill(); c.stroke(); } }
  return { el:root, draw, fill, show(on){ shown=on; if(on){ fill(); RP.dirty=true; } }, resize(){ cache.key=''; RP.dirty=true; } };
}

// ════════════════════════════════════════════════════════════════════════════
//  ejStudio app — shell, panes, transport, timeline, drawer, landing, persistence
// ════════════════════════════════════════════════════════════════════════════
const APP_VER='3.1.1', BUILD_DATE='2026-11-06';
const ERRS=[]; function elog(m){ const x=new Date().toISOString()+' '+m; ERRS.push(x); if(ERRS.length>300) ERRS.shift(); try{ if(window.rrlab&&window.rrlab.log) window.rrlab.log(x); }catch(_){} }
window.addEventListener('error',e=>elog('ERROR '+(e.message||'')+' @ line '+(e.lineno||'?')+'\n'+((e.error&&e.error.stack)||'')));
window.addEventListener('unhandledrejection',e=>elog('REJECTED '+((e.reason&&(e.reason.stack||e.reason.message))||e.reason)));
const UI_DEF={layout:'1',sizes:{h:0.5,v:0.5,l:0.62,r:0.5},panes:['table','graph','maf_table'],focus:0,presets:[null,null,null,null],
  sync:{graph:true,table:true,maf_curve:true,maf_table:true},speed:1,wbDisp:'lambda',ffbDisp:'lambda',pu:'psi',tau:500,drawerPin:false,tu:'C',
  g:{n:3,win:30000,mode:'right',lanes:['','','','',''],ymode:{},yfix:{}},
  tt:{grp:'timing',sel:{},opt:{mark:'glow',val:1,name:1,kmL:1,kmH:0,vvt:'off',km:60,fol:0,kch:'fbkc',ks:1,kw:1},rail:1,rc:{}},
  m:{src:'all',mode:'curve',scatter:false},trims:{},flags:{},keys:{},sc:{x:'',y:'',c:'',fit:'lin',ov:''},sevCol:{},diagOn:{},meta:{},home:null,logCol:{},link:false,pool:{},lrev:{},rails:{},dtab:'session',dq:'',seenVer:null,upd:null,cfg:{},limits:{},axis:null,fp:null,playT:0,open:{}};
const UI=(()=>{ const d=JSON.parse(JSON.stringify(UI_DEF)); try{ const s=JSON.parse(localStorage.getItem('rrlab_ui_v1')||'null');
  if(s) for(const k in s){ if(s[k]==null) continue; if(k in d&&typeof d[k]==='object'&&!Array.isArray(d[k])&&d[k]) d[k]=Object.assign(d[k],s[k]); else d[k]=s[k]; } }catch(_){ try{ localStorage.setItem('rrlab_ui_bad',localStorage.getItem('rrlab_ui_v1')||''); localStorage.removeItem('rrlab_ui_v1'); window.__quar=1; }catch(e){} }
  if(d.tt.opt) d.tt.opt=Object.assign({},UI_DEF.tt.opt,d.tt.opt); if(d.g) d.g=Object.assign({},UI_DEF.g,d.g); return d; })();
if(UI.layout==='2v') UI.layout='2h'; (UI.presets||[]).forEach(p=>{ if(p&&p.layout==='2v') p.layout='2h'; });
Object.assign(CFG,UI.cfg); CFG.olAfl=UI.cfg.olAfl!=null?UI.cfg.olAfl:true; let ULIM=UI.limits||{}; if(!UI.pu) UI.pu='psi'; if(UI.tt&&UI.tt.opt&&UI.tt.opt.kw==null) UI.tt.opt.kw=1;
// effective warning limits = tune limits (in this log's units) overridden slot-by-slot by the user's own
// warn limits: one set shared with ejLogger's cluster (warnlimits.properties); the tune fills any gaps
let TLIM={}; const SLIM=()=>{ try{ return window.__ejlWarn&&window.__ejlWarn(); }catch(_){ return null; } };
const limName=(W,f)=>{ const fl=f.toLowerCase(); return Object.keys(W).find(k=>k.toLowerCase()===fl)||Object.keys(W).find(k=>fl.includes(k.toLowerCase())||k.toLowerCase().includes(fl))||null; };
function limShared(){ const W=SLIM(); if(!W) return; if(Object.keys(ULIM).length&&!UI.limMoved){ for(const f in ULIM){ const u=ULIM[f], s=(u.hi||[]).some(Number.isFinite)?'hi':'lo', a=(u[s]||[]).slice(0,3); if(a.every(Number.isFinite)) window.__ejlWarnSet(limName(W,f)||f,a); } ULIM={}; UI.limMoved=1; save(); }
  mergeLimits(); try{ fillEvents(); RP.dirty=true; }catch(_){} }
function limUser(f){ const W=SLIM(); if(!W) return ULIM[f]||{}; const n=limName(W,f); if(!n) return {}; const a=W[n].slice(0,3); return a[2]>a[0]?{hi:a}:{lo:a}; }
function mergeLimits(){ TLIM=tuneLimits(typeof RP!=='undefined'?RP.L:null); const out={}, W=SLIM()||{}, fams=new Set(Object.keys(TLIM).concat(Object.keys(ULIM))); try{ for(const L of ST.logs) L.fam.forEach(f=>fams.add(f)); }catch(_){}
  for(const f of fams){ const t=TLIM[f]||{}, u=Object.assign({},ULIM[f]||{},SLIM()?limUser(f):{}), o={};
    for(const s of ['lo','hi']){ o[s]=[0,1,2].map(k=>{ const uv=u[s]&&u[s][k], tv=t[s]&&t[s][k]; return Number.isFinite(uv)?uv:Number.isFinite(tv)?tv:null; }); }
    if(o.lo.concat(o.hi).some(Number.isFinite)) out[f]=o; }
  LIMITS=out; }
LIMITS=JSON.parse(JSON.stringify(ULIM));
let saveT=0; function save(){ clearTimeout(saveT); saveT=setTimeout(()=>{ UI.limits=ULIM; try{ localStorage.setItem('rrlab_ui_v1',JSON.stringify(UI)); }catch(_){} },300); }
const VIEW_NAMES={maf_both:'MAF Tools · Both',graph:'Graph',graph2:'Graph · 2',table:'Tables',maf_table:'MAF Tools · Scaling',maf_curve:'MAF Tools · Curve',scatter:'Scatter Plot'}, VIEW_ORDER=['table','graph','maf_table','maf_curve','maf_both','scatter'], TAB_ORDER=['table','graph','maf'];
const ST={logs:[],bins:null,row:null,ipw:null,fixes:new Set(),queue:[],anKey:0};
const RP={L:null,i:0,playT:0,playing:false,lastTs:0,raf:0,dirty:true,a:null,b:null,kClear:-1,gOff:0,hoverT:null,flashes:[]};
let toastT=0;
let DESK=null;
function toast(m){ let e=document.querySelector('.toast'); if(!e) e=mk('div','toast',document.body); e.textContent=m; e.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>e.classList.remove('on'),1800); }
function copyText(txt,ok){ const done=()=>toast(ok);
  if(navigator.clipboard&&window.isSecureContext) return navigator.clipboard.writeText(txt).then(done,fb); fb();
  function fb(){ const ta=mk('textarea','',document.body); ta.value=txt; ta.style.cssText='position:fixed;opacity:0'; ta.select(); try{ document.execCommand('copy'); done(); }catch(_){ toast('Copy failed'); } ta.remove(); } }
function rpIdx(t){ const L=RP.L; if(!L||!L.N) return 0; const T=L.t; if(t<=T[0]) return 0; let lo=0,hi=L.N-1; if(t>=T[hi]) return hi; while(hi-lo>1){ const m=(lo+hi)>>1; if(T[m]<=t) lo=m; else hi=m; } return lo; }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fp=text=>text.length+'|'+text.slice(0,500)+'|'+text.slice(-500);

// ── IndexedDB: logs survive a reload ────────────────────────────────────────
const IDB={db:null,
  open(){ if(this.db) return Promise.resolve(this.db); return new Promise((res,rej)=>{ try{ const r=indexedDB.open('rrlab',1); r.onupgradeneeded=()=>r.result.createObjectStore('logs',{keyPath:'fp'}); r.onsuccess=()=>res(this.db=r.result); r.onerror=()=>rej(r.error); }catch(e){ rej(e); } }); },
  async tx(mode,fn){ try{ const db=await this.open(); return await new Promise((res,rej)=>{ const t=db.transaction('logs',mode), s=t.objectStore('logs'), q=fn(s); t.oncomplete=()=>res(q&&q.result); t.onerror=()=>rej(t.error); }); }catch(_){ return null; } },
  all(){ return this.tx('readonly',s=>s.getAll()); }, put(o){ return this.tx('readwrite',s=>s.put(o)); }, del(k){ return this.tx('readwrite',s=>s.delete(k)); }, clear(){ return this.tx('readwrite',s=>s.clear()); } };

// ── views ───────────────────────────────────────────────────────────────────
let GV,GV2,TV,MT,MV,SV,GVb,TVb,VIEWS;
function makeViews(){ GV=GraphView(); GV2=GraphView('2'); TV=TableView(); MT=MafTableView(); MV=MafCurveView(); SV=ScatterView(); VIEWS={graph:GV,graph2:GV2,table:TV,maf_table:MT,maf_curve:MV,scatter:SV}; MB=MafBothView(); VIEWS.maf_both=MB; GVb=TVb=new Proxy({},{get:()=>()=>{}}); if(Array.isArray(UI.panes)) UI.panes=UI.panes.map(v=>VIEWS[v]?v:'table'); }
// MAF Tools: one tab; each pane picks Scaling, Curve or Both. Both borrows the two views and merges their toolbars.
const MAFV=['maf_table','maf_curve','maf_both'], mafClash=(a,b)=>a===b||(a==='maf_both'&&(b==='maf_table'||b==='maf_curve'))||(b==='maf_both'&&(a==='maf_table'||a==='maf_curve'));
let MB=null, MBAR=null;
function mafMode(v){ UI.mafLast=v; const n=paneCount(), cur=UI.panes.slice(0,n).findIndex(x=>MAFV.includes(x)); setPaneView(cur>=0?cur:UI.focus,v); }
function mafToggle(bar){ const s=seg(bar,[['maf_table','Scaling'],['maf_curve','Curve'],['maf_both','Split']],'',v=>{ const n=paneCount(), own=bar.closest('.view'), j=UI.panes.slice(0,n).findIndex(x=>VIEWS[x]&&VIEWS[x].el===own); UI.mafLast=v; setPaneView(j>=0?j:UI.focus,v); }); s.classList.add('mtog'); bar.prepend(s); return s; }
function MafBothView(){ const root=mk('div','view mb'), bar=mk('div','vbar',root), top=mk('div','mb-a',root), dv=mk('div','mb-d',root), bot=mk('div','mb-b',root);
  const gT=MT.el.querySelector('.vbar'), gV=MV.el.querySelector('.vbar'), iT=[...gT.children], iV=[...gV.children].filter(x=>!/vfill/.test(x.className));
  MBAR={gT,gV,iT,iV,tog:[mafToggle(gT),mafToggle(gV),mafToggle(bar)]}; let on=false;
  dv.onpointerdown=e=>{ e.preventDefault(); dv.setPointerCapture(e.pointerId); dv.onpointercancel=()=>dv.onpointerup&&dv.onpointerup(); dv.onpointermove=ev=>{ const r=root.getBoundingClientRect(); UI.mbSplit=Math.max(.2,Math.min(.8,(ev.clientX-r.left)/r.width)); fit(); }; dv.onpointerup=()=>{ dv.onpointermove=null; save(); }; };
  const fit=()=>{ const f=UI.mbSplit||.55; root.style.gridTemplateColumns=`${f}fr 5px ${1-f}fr`; MT.resize(); MV.resize(); RP.dirty=true; };
  return { el:root, show(v){ on=v; if(v){ gT.style.display=gV.style.display='none'; const sp=mk('span','mb-sep'); bar.append(...iT.filter(x=>!x.classList.contains('vfill')),sp,...iV); top.appendChild(MT.el); bot.appendChild(MV.el); fit(); } },
    restore(){ gT.style.display=gV.style.display=''; gT.append(...iT); gV.append(...iV); bar.querySelectorAll('.mb-sep').forEach(x=>x.remove()); }, draw(){}, frame(){}, resize(){ if(on) fit(); }, isOn:()=>on }; }
const hold=document.createElement('div');

// ── panes: 1 · 2 side by side · 2 stacked · 3 (large left, right split) ──────
function paneCount(){ return UI.layout==='1'?1:UI.layout==='3'?3:2; }
function normPanes(){ const n=paneCount(), used=[], bad=v=>!VIEWS[v]||POP[v]||used.some(u=>mafClash(u,v)); for(let k=0;k<n;k++){ let v=UI.panes[k]; if(bad(v)) v=VIEW_ORDER.find(x=>x!=='maf_both'&&!bad(x)); UI.panes[k]=v; used.push(v); } if(UI.focus>=n) UI.focus=0; }
function buildStage(){
  normPanes(); if(MB) MB.restore(); for(const k in VIEWS) VIEWS[k].el.querySelectorAll('.vbar>.link').forEach(x=>x.remove()); const st=$('stage'), n=paneCount(); for(const k in VIEWS) if(!POP[k]) hold.appendChild(VIEWS[k].el); st.innerHTML=''; st.className='stage l'+UI.layout;
  const P=[]; for(let k=0;k<n;k++) P.push(makePane(k));
  const S=UI.sizes, div=(dir,key,box)=>{ const d=mk('div','divider '+dir); d.onpointerdown=e=>{ e.preventDefault(); d.setPointerCapture(e.pointerId); d.onpointercancel=()=>d.onpointerup&&d.onpointerup(); d.classList.add('on');
      d.onpointermove=ev=>{ const r=box.getBoundingClientRect(), f=dir==='h'?(ev.clientX-r.left)/r.width:(ev.clientY-r.top)/r.height; S[key]=Math.max(0.15,Math.min(0.85,f)); applySizes(); };
      d.onpointerup=()=>{ d.onpointermove=null; d.classList.remove('on'); save(); }; }; return d; };
  if(n===1) st.append(P[0]);
  else if(UI.layout==='3'){ const right=mk('div','col'); st.append(P[0],div('h','l',st),right); right.append(P[1],div('v','r',right),P[2]); }
  else st.append(P[0],div('h','h',st),P[1]);
  applySizes(); const vis=UI.panes.slice(0,n); for(const k in VIEWS) VIEWS[k].show(vis.includes(k)||!!POP[k]||(vis.includes('maf_both')&&(k==='maf_table'||k==='maf_curve'))); if(MBAR) MBAR.tog.forEach((t,i)=>{ const own=i===0?'maf_table':i===1?'maf_curve':'maf_both'; t.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===own||b.dataset.k===own||b.value===own)); }); syncTabs(); RP.dirty=true;
}
function applySizes(){ const st=$('stage'), S=UI.sizes, P=st.querySelectorAll('.pane'), g=(el,f)=>{ if(el) el.style.flex=`${f} 1 0`; };
  if(UI.layout==='2h') { g(P[0],S.h); g(P[1],1-S.h); } else if(UI.layout==='2v'){ g(P[0],S.v); g(P[1],1-S.v); }
  else if(UI.layout==='3'){ g(P[0],S.l); g(st.querySelector('.col'),1-S.l); g(P[1],S.r); g(P[2],1-S.r); } else g(P[0],1); RP.dirty=true; }
function makePane(k){ const v=UI.panes[k], p=mk('div','pane'+(k===UI.focus&&paneCount()>1?' focus':'')), ph=mk('div','ph',p), sel=mk('select','sel sm',ph); if(paneCount()===1) ph.style.display='none';
  VIEW_ORDER.concat(v==='graph2'?['graph2']:[]).forEach(x=>{ const o=mk('option','',sel); o.value=x; o.textContent=VIEW_NAMES[x]; }); sel.value=v;
  sel.onchange=()=>setPaneView(k,sel.value);
  if(v in UI.sync){ const ln=mk('button','ibtn link'+(UI.sync[v]?' on':''),paneCount()===1?VIEWS[v].el.querySelector('.vbar'):ph); ln.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
    ln.title='Follow the playhead'; ln.onclick=()=>{ UI.sync[v]=!UI.sync[v]; ln.classList.toggle('on',UI.sync[v]); save(); if(UI.sync[v]&&v==='table') TV.frame(RP.i,true); RP.dirty=true; if(v==='maf_table') MT.frame(); }; }
  if(v!=='maf_both'){ const po=mk('button','ibtn link',paneCount()===1?VIEWS[v].el.querySelector('.vbar'):ph); po.textContent='⧉'; po.title='Pop out into its own window'; po.onclick=e=>{ e.stopPropagation(); popOut(v); }; }
  const pb=mk('div','pb vin',p); pb.appendChild(VIEWS[v].el); p.addEventListener('pointerdown',()=>{ if(UI.focus!==k){ UI.focus=k; document.querySelectorAll('.pane').forEach((x,j)=>x.classList.toggle('focus',j===k&&paneCount()>1)); syncTabs(); save(); } },true);
  return p; }
function setPaneView(k,v){ if(v==='maf') v=UI.mafLast||'maf_table'; if(v==='graph'&&UI.grLast==='scatter'&&!setPaneView._raw) v='scatter'; if(v==='graph'||v==='graph2'){ const n0=paneCount(), oth=UI.panes.slice(0,n0).filter((x,j)=>j!==k); v=oth.includes('graph')?'graph2':'graph'; } if(MAFV.includes(v)) UI.mafLast=v; const n=paneCount(), old=UI.panes[k]; for(let j=0;j<n;j++) if(j!==k&&mafClash(UI.panes[j],v)) UI.panes[j]=mafClash(old,v)?'':old; UI.panes[k]=v; save(); buildStage(); }
function viewNeeds(v){ if(!ST.logs.length) return []; if(v.endsWith('_b')) return RP.B?[]:['a compare log (B)'];
  if(v==='maf_table'||v==='maf_curve'||v==='maf_both') return ST.logs.some(L=>L.cap.maf)?[]:mafNeeds(RP.L||ST.logs[0]);
  if(v==='table') return ST.logs.some(L=>L.c.rpm)?[]:[IN_NAMES.rpm]; return []; }
// Graph tab: Lanes or Scatter in the same pane
function grMode(v){ UI.grLast=v; const n=paneCount(), from=v==='scatter'?'graph':'scatter', k=UI.panes.slice(0,n).indexOf(from); setPaneView._raw=1; try{ setPaneView(k<0?UI.focus:k,v); }finally{ setPaneView._raw=0; } }
// settings popover: drawer sections shown next to the feature they control, using the drawer's own handlers
let DSEC={};
function setPop(btn,keys,title,extra){ const o=$('setpop'); if(o){ const same=o._k===keys.join(); o._close(); if(same) return; } drawerRefresh();
  const d=mk('div','setpop',document.body); d.id='setpop'; d._k=keys.join(); d.innerHTML=`<div class="sph"><b>${esc(title)}</b><button class="ibtn" data-spx aria-label="Close">✕</button></div><div class="spb"></div>`; if(extra){ const ex=document.createElement('div'); ex.className='spx'; d.insertBefore(ex,d.querySelector('.spb')); extra(ex); }
  const bd=d.querySelector('.spb'), fill=()=>{ bd.innerHTML=keys.map(k=>DSEC[k]||'').join(''); }; fill(); drawerBind(bd);
  bd.addEventListener('click',()=>setTimeout(()=>{ drawerRefresh(); if(document.activeElement&&bd.contains(document.activeElement)&&/INPUT|SELECT/.test(document.activeElement.tagName)) return; fill(); },40));
  bd.addEventListener('change',()=>setTimeout(()=>{ drawerRefresh(); fill(); },40));
  const r=btn.getBoundingClientRect(), W=Math.min(keys.includes('cov')?460:360,innerWidth-16); d.style.width=W+'px'; d.style.left=Math.max(8,Math.min(innerWidth-W-8,r.right-W))+'px';
  if(r.top>innerHeight/2) d.style.bottom=(innerHeight-r.top+6)+'px'; else d.style.top=(r.bottom+6)+'px';
  const out=e=>{ if(!e.target.closest('#setpop')&&!btn.contains(e.target)) d._close(); }, kd=e=>{ if(e.key==='Escape'){ e.stopPropagation(); d._close(); } };
  d._close=()=>{ d.remove(); document.removeEventListener('pointerdown',out,true); document.removeEventListener('keydown',kd,true); };
  d.querySelector('[data-spx]').onclick=()=>d._close(); setTimeout(()=>{ document.addEventListener('pointerdown',out,true); document.addEventListener('keydown',kd,true); },0); }
function syncTabs(){ const vis=UI.panes.slice(0,paneCount()); document.querySelectorAll('#tabs button').forEach(b=>{ const tv=b.dataset.v, is=v=>tv==='maf'?MAFV.includes(v):tv==='graph'?(v==='graph'||v==='scatter'||v==='graph2'):v===tv; b.classList.toggle('on',vis.some(is)); b.classList.toggle('foc',is(UI.panes[UI.focus])); const m=viewNeeds(tv==='maf'?'maf_table':tv); b.classList.toggle('na',!!m.length); b.style.display=b.dataset.v.endsWith('_b')&&!RP.B?'none':''; b.title=m.length?'Needs: '+m.join(', '):''; });
  document.querySelectorAll('#stage .pane').forEach((p,k)=>{ const pb=p.querySelector('.pb'), m=viewNeeds(UI.panes[k]); if(!pb) return; pb.classList.toggle('na',!!m.length); let e=pb.querySelector('.na-msg'); if(m.length){ if(!e) e=mk('div','na-msg',pb); e.textContent='Needs: '+m.join(', '); } else if(e) e.remove(); });
  document.querySelectorAll('#layouts button').forEach(b=>b.classList.toggle('on',b.dataset.l===UI.layout)); syncPresets(); }
function syncPresets(){ document.querySelectorAll('#presets button').forEach((b,k)=>{ const p=UI.presets[k]; b.classList.toggle('has',!!p); b.title=p?`Preset ${k+1}: ${p.panes.slice(0,p.layout==='1'?1:p.layout==='3'?3:2).map(v=>VIEW_NAMES[v]).join(' + ')} — click to load, Shift+click to overwrite`:`Empty — click to save the current layout`; }); }
function preset(k,saveIt){ const p=UI.presets[k]; if(saveIt||!p){ UI.presets[k]={layout:UI.layout,panes:UI.panes.slice(),sizes:JSON.parse(JSON.stringify(UI.sizes))}; toast(`Layout saved to preset ${k+1}`); save(); syncPresets(); return; }
  UI.layout=p.layout; UI.panes=p.panes.slice(); Object.assign(UI.sizes,p.sizes); save(); buildStage(); }

// ── replay ──────────────────────────────────────────────────────────────────
function selectLog(L,keep){ const t=RP.playT; if(RP.B===L) RP.B=null; RP.L=L; mergeLimits(); UI.fp=L?L.fp:null; if(!keep){ RP.a=RP.b=null; RP.kClear=-1; } RP.gOff=0; RP.tlKey=null; RP.i=-1;
  if(L){ TV.setTune(); GV.fill(); GV2.fill(); SV.fill(); MV.reset(); TV.logChanged(); rpSeek(keep?Math.min(t,L.dur):0,true); } fillEvents(); rpAB(); save(); drawerRefresh(); if(L) autoWx(L); cmpUI(); if(window.__edChanged) window.__edChanged(); }
function rpSeek(t,snap){ const L=RP.L; if(!L) return; RP.playT=Math.max(0,Math.min(L.dur,t)); const i=rpIdx(RP.playT); RP.i=i; if(UI.sync.table) TV.frame(i,snap); MT.frame(); RP.dirty=true; rpTime(); }
function rpStep(d){ const L=RP.L; if(!L) return; rpPlay(false); const i=Math.max(0,Math.min(L.N-1,RP.i+d)); RP.playT=L.t[i]; RP.i=i; if(UI.sync.table) TV.frame(i,false); MT.frame(); RP.dirty=true; rpTime(); }
function rpPlay(on){ RP.playing=!!on&&!!RP.L; if(RP.playing){ RP.gOff=0; if(RP.playT>=RP.L.dur) rpSeek(RP.a!=null&&RP.b!=null?Math.min(RP.a,RP.b):0,true); } $('t-play').textContent=RP.playing?'❚❚':'▶'; if(!RP.playing){ UI.playT=RP.playT; save(); } }
function rpTime(){ const e=$('t-time'), s=fmtT(RP.playT)+' / '+fmtT(RP.L?RP.L.dur:0); if(e.textContent!==s) e.textContent=s; }
function rpAB(){ const a=$('t-a'), b=$('t-b'); a.classList.toggle('on',RP.a!=null); b.classList.toggle('on',RP.b!=null); a.textContent=RP.a!=null?'A '+fmtT(RP.a):'A'; b.textContent=RP.b!=null?'B '+fmtT(RP.b):'B'; MV.reset(); RP.dirty=true; }
function evMenu(){ const old=$('evpop'); if(old){ old.remove(); return; } const L=RP.L; if(!L){ toast('Load a log'); return; } drawerRefresh();
  const b=$('t-evb').getBoundingClientRect(), d=mk('div','',document.body); d.id='evpop'; d.innerHTML='<details class="evdg"><summary>Diagnostics</summary><div class="evdb"></div></details><input class="evq" placeholder="Search events"><div class="evl"></div>'; const evdb=d.querySelector('.evdb'); evdb.innerHTML=DSEC.diag||''; drawerBind(evdb);
  const q=d.querySelector('.evq'), lst=d.querySelector('.evl'), open=UI.evOpen||(UI.evOpen={});
  const draw=()=>{ const w=q.value.toLowerCase().trim(), g={}; (L.allEv||[]).forEach((e,i)=>{ if(w&&!(e.kind+' '+e.label).toLowerCase().includes(w)) return; (g[e.kind]=g[e.kind]||[]).push([e,i]); });
    lst.innerHTML=Object.keys(g).map(k=>{ const shut=!w&&open[k]===false, worst=g[k].reduce((a,[e])=>e.sev==='crit'?'crit':a==='crit'?a:e.sev==='warn'?'warn':a,'info');
      return `<div class="evg" data-k="${esc(k)}"><i style="background:${sevC(worst)}"></i><b>${esc(k)}</b><em>${g[k].length}</em><u>${shut?'▸':'▾'}</u></div>`+(shut?'':g[k].map(([e,i])=>`<button class="evi${Math.abs(e.t-RP.playT)<1500?' now':''}" data-i="${i}"><i style="background:${sevC(e.sev)}"></i><span class="t">${fmtT(e.t)}</span><span class="l">${esc(e.label)}</span></button>`).join('')); }).join('')||'<div class="evg dim">No match</div>'; };
  evdb.addEventListener('click',()=>setTimeout(()=>{ drawerRefresh(); evdb.innerHTML=DSEC.diag||''; draw(); },60)); evdb.addEventListener('change',()=>setTimeout(()=>{ drawerRefresh(); draw(); },60));
  draw(); d.style.left=Math.max(8,Math.min(innerWidth-d.offsetWidth-8,b.right-d.offsetWidth))+'px'; d.style.bottom=(innerHeight-b.top+8)+'px'; q.focus();
  const close=()=>{ d.remove(); document.removeEventListener('pointerdown',out,true); document.removeEventListener('keydown',kd,true); }, out=e=>{ if(!e.target.closest('#evpop,#t-evb')) close(); }, kd=e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } };
  setTimeout(()=>{ document.addEventListener('pointerdown',out,true); document.addEventListener('keydown',kd,true); },0); q.oninput=draw;
  d.onclick=e=>{ const it=e.target.closest('[data-i]'); if(it){ const ev=L.allEv[+it.dataset.i]; close(); rpPlay(false); rpSeek(ev.t,true); return; } const gh=e.target.closest('.evg[data-k]'); if(gh&&!q.value){ const k=gh.dataset.k; open[k]=open[k]===false; save(); draw(); } }; }
function fillEvents(){ const s=$('t-ev'), L=RP.L, g={}; if(!L){ s.innerHTML='<option value="">Jump to event…</option>'; return; }
  L.allEv=L.events.concat(warnCrossings(L),userFlags(L)).filter(e=>(e.kind==='Flag'||inTrim(L,e.t))&&diagShown(e)).sort((a,b)=>a.t-b.t); L.allEv.forEach(e=>{ if(!e.sev) e.sev=sevOf(e); });
  L.allEv.forEach((e,i)=>{ (g[e.kind]=g[e.kind]||[]).push(`<option value="${i}">${fmtT(e.t)} · ${esc(e.label)}</option>`); });
  s.innerHTML='<option value="">Jump to event…</option>'+Object.keys(g).map(k=>`<optgroup label="${k} (${g[k].length})">${g[k].join('')}</optgroup>`).join(''); RP.tlKey=null; }
function loop(ts){
  RP.raf=0; const dt=RP.lastTs?Math.min(100,ts-RP.lastTs):16; RP.lastTs=ts; const L=RP.L;
  if(RP.playing&&L){ let t=RP.playT+dt*UI.speed;
    if(RP.a!=null&&RP.b!=null){ const a=Math.min(RP.a,RP.b), b=Math.max(RP.a,RP.b); if(b-a>50&&t>=b) t=a; }
    for(const kt of L.kticks) if(kt>RP.playT&&kt<=t) RP.flashes.push({t:kt,s:ts});
    if(t>=L.dur){ t=L.dur; RP.playT=t; rpPlay(false); }
    RP.playT=t; const i=rpIdx(t); if(i!==RP.i){ RP.i=i; if(UI.sync.table) TV.frame(i,false); MT.frame(); } RP.dirty=true; rpTime(); }
  if(RP.flashes.length){ RP.flashes=RP.flashes.filter(f=>ts-f.s<600); RP.dirty=true; }
  if(RP.B&&UI.link){ const nt=Math.max(0,Math.min(RP.B.dur,RP.playT+RP.bOff)); if(nt!==RP.bT){ RP.bT=nt; RP.bI=rpIdxL(RP.B,nt); RP.dirty=true; } }
  if(RP.B&&RP.bI!==RP.bIp){ RP.bIp=RP.bI; TVb.frame(RP.bI,false); }
  TV.tick(dt); TVb.tick(dt);
  if(RP.dirty){ RP.dirty=false; if(UI.sync.graph!==false||RP.playing===false) GV.draw(); GV2.draw(); MV.draw(); SV.draw(); drawTL($('tl'),false); if(RP.B) drawTLB(); if(!$('tlpop').classList.contains('hidden')) drawTL($('tlpop-cv'),true); }
  RP.raf=requestAnimationFrame(loop);
}

// ── timeline strip + pinned pop-out ─────────────────────────────────────────
function drawTL(cv,big){ const z=sizeCanvas(cv); if(!z) return; const {c,W,H}=z, L=RP.L, dpr=devicePixelRatio||1; c.fillStyle='#0b0b0e'; c.fillRect(0,0,W,H); if(!L||!L.dur) return;
  const key=W+'x'+H+':'+L.fp+':'+ST.anKey+':'+Object.keys(LIMITS).length, ck=big?'tlcB':'tlcS';
  if(RP[ck+'k']!==key){ RP[ck+'k']=key; const oc=document.createElement('canvas'); oc.width=W*dpr; oc.height=H*dpr; const o=oc.getContext('2d'); o.scale(dpr,dpr);
    o.fillStyle='#0b0b0e'; o.fillRect(0,0,W,H); const X=t=>t/L.dur*W, A=L.c.rpm||L.c.load, CL=L.st, pad=big?14:6;
    if(A){ let lo=Infinity,hi=-Infinity; for(let i=0;i<L.N;i++){ const v=A[i]; if(Number.isFinite(v)){ lo=Math.min(lo,v); hi=Math.max(hi,v); } }
      const mn=new Array(Math.ceil(W)).fill(Infinity), mx=new Array(Math.ceil(W)).fill(-Infinity);
      for(let i=0;i<L.N;i++){ const v=A[i]; if(!Number.isFinite(v)) continue; const p=Math.min(mn.length-1,Math.floor(X(L.t[i]))); mn[p]=Math.min(mn[p],v); mx[p]=Math.max(mx[p],v); }
      const Y=v=>H-pad-(v-lo)/((hi-lo)||1)*(H-2*pad); o.fillStyle=big?'rgba(168,168,176,.6)':'rgba(124,124,130,.55)';
      for(let p=0;p<mn.length;p++){ if(mn[p]===Infinity) continue; const y1=Y(mx[p]), y2=Y(mn[p]); o.fillRect(p,y1,1,Math.max(1,y2-y1)); }
      if(big){ o.fillStyle='#7d7d85'; o.font='10px '+FONT_MONO; o.fillText(L.c.rpm?'RPM':'Load',4,11); } }
    if(CL){ o.fillStyle='rgba(59,175,132,.85)'; for(let i=0;i<L.N;i++) if(CL[i]>=10&&!(L.an&&L.an.cutF[i])) o.fillRect(X(L.t[i]),H-3,Math.max(1,X(L.t[Math.min(i+1,L.N-1)])-X(L.t[i])),3); }
    o.fillStyle='#eb2323'; for(const kt of L.kticks) o.fillRect(X(kt)-0.5,0,1.5,big?10:7);
    for(const e of (L.allEv||[])){ if(e.kind==='Warning'){ o.fillStyle=sevC(e.sev); o.fillRect(X(e.t)-0.5,big?10:7,1.5,big?8:5); } else if(e.kind==='Lean outlier'){ o.fillStyle='#b794f6'; o.fillRect(X(e.t)-0.5,H-(big?10:7),1.5,big?6:4); } else if(e.kind==='Flag'){ if(e.t2!=null){ o.fillStyle='rgba(90,209,230,.16)'; o.fillRect(X(e.t),0,X(e.t2)-X(e.t),H); } o.fillStyle='#5ad1e6'; o.fillRect(X(e.t)-0.75,0,2,H); } else if(e.kind==='Pull'){ o.fillStyle='rgba(228,170,40,.7)'; o.fillRect(X(e.t),H-(big?7:5),Math.max(2,X(e.t1)-X(e.t)),2); } else if(e.kind!=='Knock'&&(e.sev==='warn'||e.sev==='crit')){ o.fillStyle=sevC(e.sev); o.fillRect(X(e.t)-0.5,big?10:7,1.5,big?8:5); } }
    RP[ck]=oc; }
  c.drawImage(RP[ck],0,0,W,H); const X=t=>t/L.dur*W;
  { const x=trimOf(L); if(x){ c.fillStyle='rgba(0,0,0,.68)'; if(x.a!=null) c.fillRect(0,0,X(x.a),H); if(x.b!=null) c.fillRect(X(x.b),0,W-X(x.b),H); c.fillStyle='#ff6b6b'; for(const t of [x.a,x.b]) if(t!=null) c.fillRect(X(t)-1,0,2,H); } if(RP.flagA!=null){ c.fillStyle='#5ad1e6'; c.fillRect(X(RP.flagA)-1,0,2,H); } }
  if(RP.a!=null&&RP.b!=null){ const xa=X(Math.min(RP.a,RP.b)), xb=X(Math.max(RP.a,RP.b)); c.fillStyle='rgba(228,170,40,.14)'; c.fillRect(xa,0,xb-xa,H); }
  c.fillStyle='#e4aa28'; for(const t of [RP.a,RP.b]) if(t!=null) c.fillRect(X(t)-1,0,2,H);
  if(RP.drag&&RP.drag.big===big&&RP.drag.ab){ const xa=X(Math.min(RP.drag.t0,RP.drag.t1)), xb=X(Math.max(RP.drag.t0,RP.drag.t1)); c.fillStyle='rgba(228,170,40,.25)'; c.fillRect(xa,0,xb-xa,H); }
  const now=performance.now(); for(const f of RP.flashes){ const a=1-(now-f.s)/600; c.fillStyle=`rgba(255,40,40,${(a*0.8).toFixed(2)})`; c.fillRect(X(f.t)-3,0,6,H); }
  c.fillStyle='#fff'; c.fillRect(X(RP.playT)-1,0,2,H);
  if(RP.hoverT!=null&&RP.hoverBig===big){ const x=X(RP.hoverT); c.fillStyle='rgba(228,170,40,.9)'; c.fillRect(x-0.5,0,1,H); } }
function tlBind(cv,big){ const tip=$('tltip'), tAt=e=>{ const r=cv.getBoundingClientRect(); return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*(RP.L?RP.L.dur:0); };
  cv.addEventListener('pointermove',e=>{ if(!RP.L) return; const t=tAt(e); RP.hoverT=t; RP.hoverBig=big; const r=cv.getBoundingClientRect();
    { const L=RP.L, X=tt=>tt/L.dur*r.width, px=X(t); let lab=''; for(const ev of (L.allEv||[])) if(Math.abs(X(ev.t)-px)<=5){ lab=ev.kind+': '+ev.label; break; } if(!lab) for(const kt of L.kticks) if(Math.abs(X(kt)-px)<=4){ lab='Knock'; break; } tip.textContent=fmtT(t)+(lab?' · '+lab:''); } tip.classList.remove('hidden'); tip.style.left=Math.max(4,Math.min(innerWidth-tip.offsetWidth-4,e.clientX-24))+'px'; tip.style.top=(r.top-26)+'px';
    if(RP.drag&&RP.drag.big===big){ RP.drag.t1=t; RP.drag.moved=true; if(!RP.drag.ab) rpSeek(t,true); } RP.dirty=true; });
  cv.addEventListener('pointerleave',()=>{ RP.hoverT=null; tip.classList.add('hidden'); RP.dirty=true; });
  cv.addEventListener('pointerdown',e=>{ if(!RP.L) return; try{ cv.setPointerCapture(e.pointerId); }catch(_){} const t=tAt(e); RP.drag={big,ab:big&&e.shiftKey,t0:t,t1:t,moved:false}; if(!RP.drag.ab) rpSeek(t,true); });
  cv.addEventListener('pointercancel',()=>{ RP.drag=null; }); cv.addEventListener('pointerup',()=>{ const d=RP.drag; RP.drag=null; if(!d) return; if(d.ab&&Math.abs(d.t1-d.t0)>200){ RP.a=Math.min(d.t0,d.t1); RP.b=Math.max(d.t0,d.t1); rpAB(); }
    if(!big&&!d.moved) pop(true); RP.dirty=true; }); }
function pop(on){ $('tlpop').style.setProperty('--tlop',(UI.tlop??70)/100); $('tlpop').classList.toggle('hidden',!on); RP.tlcBk=null; RP.dirty=true; }

// ── analysis ────────────────────────────────────────────────────────────────
function recompute(full){
  if(full) for(const L of ST.logs) withLogTune(L,()=>{ analyzeLog(L); computePicks(L); logEvents(L); });
  ST.bins=ST.logs.length?computeBins(ST.logs.filter(pooled).map(trimSpan)):null; ST.row=scaleRow(ST.bins,ST.fixes); ST.ipw=ipwCheck(ST.logs); ST.anKey++;
  MT.render(); MV.reset(); fillEvents(); RP.dirty=true; drawerRefresh(); syncTabs(); }
// Column mapping: saved per header layout → names → data guesses; the dialog opens only for unsure guesses.
let MAPS={}; try{ MAPS=JSON.parse(localStorage.getItem('rrlab_maps_v1')||'{}')||{}; }catch(_){}
const saveMaps=()=>{ try{ localStorage.setItem('rrlab_maps_v1',JSON.stringify(MAPS)); }catch(_){} };
async function makeLog(o,errs,edit){ try{
    const P=prepLog(o.name,o.text,sig=>MAPS[sig]); let A=P.A;
    if(edit||(!P.saved&&P.unsure.length)){ A=await mapDialog(P,edit); if(!A){ if(!edit) errs.push(o.name+': skipped'); return null; }
      const inv={}; for(const k in A) inv[A[k].j]=k; MAPS[P.sig]=Object.fromEntries(P.headers.map((h,j)=>[h,j===P.ti?'':(inv[j]||'')])); saveMaps(); }
    const L=finishLog(P,A); L.fp=o.fp; L.src=o.text; withLogTune(L,()=>{ analyzeLog(L); computePicks(L); logEvents(L); }); return L; }
  catch(e){ errs.push(`${o.name}: ${e&&e.message?e.message:e}`); return null; } }
async function ingest(o,persist,errs){ const L=await makeLog(o,errs,false); if(L) ST.logs.push(L); return !!L; }
async function remap(L){ if(!L||!L.src) return; const errs=[], N=await makeLog({name:L.name,text:L.src,fp:L.fp},errs,true); if(errs.length) toast(errs.join(' · ')); if(!N) return;
  ST.logs[ST.logs.indexOf(L)]=N; ST.fixes.clear(); recompute(false); selectLog(N,true); toast('Mapping applied · '+N.name); }
function mapDialog(P,edit){ return new Promise(res=>{
  const used={}; for(const k in P.A) used[P.A[k].j]={k,how:P.A[k].how}; for(const u of P.unsure) if(!used[u.j]) used[u.j]={k:u.k,how:'guess'};
  const opts='<option value="">— not used —</option>'+Object.keys(FIELDS).map(k=>`<option value="${k}">${esc(FIELDS[k][0])}</option>`).join('');
  const st=j=>{ const s=(P.stats&&P.stats[j])||colStats(P.rows,j); if(!s||!s.ok) return '<span class="dim">empty</span>'; const f=v=>Math.abs(v)>=100?v.toFixed(0):Math.abs(v)>=10?v.toFixed(1):v.toFixed(2); return `${f(s.min)} · ${f(s.med)} · ${f(s.max)}`; };
  const BADGE={name:'name',data:'data',guess:'unsure',saved:'saved'};
  const d=mk('div','',document.body); d.id='mapdlg';
  d.innerHTML=`<div class="md-card"><div class="md-h"><b>Column mapping</b><span title="${esc(P.name)}">${esc(P.name)}</span></div><div class="md-cols"><span>Column</span><span>min · median · max</span><span>Is</span><span></span></div><div class="md-list">`
    +P.headers.map((h,j)=>j===P.ti?'':`<div class="md-r${used[j]&&used[j].how==='guess'?' warn':''}" data-j="${j}"><span class="md-n" title="${esc(h)}">${esc(h)}</span><span class="md-s">${st(j)}</span><select class="sel sm">${opts}</select><span class="md-b">${used[j]?BADGE[used[j].how]:''}</span></div>`).join('')
    +`</div><div class="md-f"><button class="btn ghost" data-a="x">${edit?'Cancel':'Skip log'}</button><span class="vfill"></span><button class="btn acc" data-a="ok">Apply</button></div></div>`;
  const sels=[...d.querySelectorAll('.md-r')].map(r=>{ const s=r.querySelector('select'), j=+r.dataset.j; s.value=used[j]?used[j].k:''; s.onchange=()=>{ if(s.value) sels.forEach(o=>{ if(o.s!==s&&o.s.value===s.value){ o.s.value=''; o.r.querySelector('.md-b').textContent=''; o.r.classList.remove('warn'); } }); r.querySelector('.md-b').textContent=s.value?'set':''; r.classList.remove('warn'); }; return {s,r,j}; });
  const done=v=>{ document.removeEventListener('keydown',kd,true); d.remove(); res(v); }, kd=e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(null); } };
  document.addEventListener('keydown',kd,true);
  d.onclick=e=>{ const b=e.target.closest('[data-a]'); if(!b) return; if(b.dataset.a==='x') return done(null);
    const A={}; for(const o of sels) if(o.s.value&&!A[o.s.value]) A[o.s.value]={j:o.j,how:'saved'}; done(A); };
}); }
async function addFiles(list){
  const files=[...(list||[])].filter(Boolean); if(!files.length) return; const errs=[]; let added=0; busy(true,'Reading',files.length+' file'+(files.length>1?'s':'')); await sleep(60);
  for(const f of files){ let text; try{ text=await f.text(); }catch(_){ errs.push(f.name+': could not read'); continue; }
    if(/\.(ejstudio|ejlab)$/i.test(f.name)){ busy(false); await loadSession(text,f.name); return; } if(/\.(tune|json)$/i.test(f.name)||/^\s*\{/.test(text.slice(0,50))){ LAND.tuneP={name:f.name,path:pathFor(f)}; await loadTuneText(text,f.name); continue; }
    const k=fp(text); if(ST.logs.some(L=>L.fp===k)||ST.queue.some(q=>q.fp===k)){ errs.push(f.name+': already loaded'); continue; } (ST.paths||(ST.paths={}))[k]=pathFor(f);
    if(!TUNE){ ST.queue.push({name:f.name,text,fp:k}); continue; }
    busy(true,'Processing',f.name); await sleep(40); if(await ingest({name:f.name,text,fp:k},true,errs)) added++; }
  if(added){ busy(true,'Analysing',ST.logs.length+' log'+(ST.logs.length>1?'s':'')+' pooled'); await sleep(40); try{ afterLogs(); }catch(e){ elog('analysis: '+(e&&e.stack||e)); busy(false); toast('Analysis hit an error. It is in the error log (About → Bug report).'); return; }
    const nb=ST.bins?ST.bins.filter(b=>b.n).length:0; busy(true,'Analysis complete',`${ST.logs.reduce((s,L)=>s+L.N,0).toLocaleString()} frames · ${nb} / ${BP.length} bins`); await sleep(1100); }
  busy(false); if(added) try{ landRecord(); }catch(_){} if(errs.length){ toast(errs.join(' · ')); elog('load: '+errs.join(' | ')); } landRefresh(); }
function afterLogs(){ ST.fixes.clear(); recompute(false); try{ wbLagAuto(); }catch(e){ elog('wb lag '+e); } if(!RP.L||!ST.logs.includes(RP.L)) selectLog(ST.logs.find(L=>L.fp===UI.fp)||ST.logs[0],false); enterApp(); }
function removeLog(L){ if(RP.B===L){ RP.B=null; cmpUI(); } ST.logs.splice(ST.logs.indexOf(L),1); IDB.del(L.fp); if(!ST.logs.length){ RP.L=null; showLanding(); recompute(false); return; } ST.fixes.clear(); recompute(false); if(RP.L===L) selectLog(ST.logs[0],false); }
async function loadTuneText(text,name){
  try{ const T=parseTune(text,name); TUNE=T; profAuto(T); if(!window.__keepEdits) edReset(); if(!window.__treeSwitch) revRoot(text,name); try{ localStorage.setItem('rrlab_tune_v1',JSON.stringify({name,text})); }catch(_){}
    applyTuneAxis();
    for(const L of ST.logs) computePicks(L); const q=ST.queue.splice(0), errs=[]; if(q.length){ busy(true,'Processing',q.length+' queued log'+(q.length>1?'s':'')); await sleep(60); } for(const o of q) await ingest(o,true,errs); if(q.length) busy(false); if(errs.length) toast(errs.join(' · '));
    mergeLimits(); if(ST.logs.length){ recompute(true); if(q.length||!RP.L) afterLogs(); else { TV.setTune(); } } toast('Tune loaded · '+T.cal); landRefresh(); drawerRefresh(); }
  catch(e){ toast('Tune: '+(e&&e.message?e.message:e)); } }
function busy(on,t,s){ const b=$('land-busy'); if(on){ $('busy-t').textContent=t||'Processing'; $('busy-s').textContent=s||''; b.classList.remove('hidden','out'); } else { b.classList.add('out'); setTimeout(()=>{ if(b.classList.contains('out')){ b.classList.add('hidden'); } },450); } }

// ── landing ─────────────────────────────────────────────────────────────────
function showLanding(){ $('app').classList.add('hidden'); $('land').classList.remove('hidden'); landRefresh(); landLoadEjl(); if(!(UI.cars&&UI.cars.length)&&!UI.carSkip&&!document.querySelector('.cardlg')) setTimeout(()=>carDialog(null),400); }
function enterApp(){ if(!ST.logs.length&&!TUNE) return; if(ST.logs.length&&UI.seenVer!==APP_VER){ UI.seenVer=APP_VER; save(); setTimeout(whatsNew,700); } $('land').classList.add('hidden'); $('app').classList.remove('hidden'); buildStage(); if(!RP.raf) RP.raf=requestAnimationFrame(loop); }
// landing: tune card, logs from ejLogger plus anything dropped or browsed, recent sessions
const LAND={q:[],ejl:null,sel:new Set(),init:false,tuneP:null};
const pathFor=f=>{ try{ return f.path||(window.rrlab&&window.rrlab.pathFor&&typeof File!=='undefined'&&f instanceof File?window.rrlab.pathFor(f):'')||''; }catch(_){ return ''; } };
const whenTxt=t=>{ const d=new Date(t), n=new Date(), hm=d.toTimeString().slice(0,5); if(d.toDateString()===n.toDateString()) return 'Today '+hm; const y=new Date(n); y.setDate(n.getDate()-1); if(d.toDateString()===y.toDateString()) return 'Yesterday'; return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); };
const kb=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
async function landLoadEjl(){ const A=window.rrlab&&window.rrlab.ejl; if(!A||!A.logs||!window.rrlab.desktop) return; try{ const r=await A.logs(); LAND.ejl=r;
  if(!LAND.init&&r&&r.files){ LAND.init=true; const cur=r.files.filter(f=>!f.old&&f.name!==r.recording), d=cur.length&&cur[0].date; cur.filter(f=>f.date===d).forEach(f=>LAND.sel.add('e:'+f.name)); } }catch(_){} landRefresh(); }
async function landQueue(list){ for(const f of [...(list||[])]){ if(/\.(tune|json)$/i.test(f.name)){ LAND.tuneP={name:f.name,path:pathFor(f)}; await loadTuneText(await f.text(),f.name); continue; }
    if(/\.(ejstudio|ejlab)$/i.test(f.name)){ await addFiles([f]); return; }
    if(LAND.q.some(x=>x.name===f.name&&x.size===f.size)) continue; LAND.q.push(f); LAND.sel.add('f:'+(LAND.q.length-1)); } landRefresh(); }
function landPicked(){ const files=LAND.q.filter((f,i)=>LAND.sel.has('f:'+i)), names=LAND.ejl&&LAND.ejl.files?LAND.ejl.files.filter(f=>!f.old&&LAND.sel.has('e:'+f.name)).map(f=>f.name):[]; return {files,names}; }
async function landGo(){ if(!TUNE) return; const {files,names}=landPicked(); if(!files.length&&!names.length) return openEditorOnly();
  let ej=[]; if(names.length){ try{ ej=await window.rrlab.ejl.readLogs(names)||[]; }catch(_){ toast('Could not read the ejLogger logs'); } }
  LAND.q=[]; LAND.sel.clear(); LAND.init=true; await addFiles([...files,...ej.map(o=>({name:o.name,path:o.path,text:async()=>o.text}))]); }
function landRecord(){ if(!TUNE||!ST.logs.length) return; const tp=LAND.tuneP||UI.tuneP; if(LAND.tuneP&&LAND.tuneP.path) UI.tuneP=LAND.tuneP; const P=ST.paths||{}, logs=ST.logs.map(L=>({name:L.name,path:P[L.fp]||''}));
  let mn=0, at=null, kn=false; for(const L of ST.logs){ const a=L.c&&L.c.fbkc, r=L.c&&L.c.rpm; if(!a) continue; kn=true; for(let i=0;i<a.length;i++) if(a[i]<mn){ mn=a[i]; at=r?r[i]:null; } }
  const rows=ST.logs.reduce((s,L)=>s+(L.N||0),0), res=mn<-0.05?`FBKC ${mn.toFixed(1)}°${at!=null?' at '+(Math.round(at/100)*100).toLocaleString()+' rpm':''}`:kn?'no knock':rows.toLocaleString()+' frames';
  const key=(UI.car||'')+'|'+TUNE.name+'|'+logs.map(l=>l.name).sort().join(','); UI.sessions=[{key,car:UI.car||null,t:Date.now(),tune:{name:TUNE.name,path:tp&&tp.name===TUNE.name?tp.path:'',cal:TUNE.cal},logs,res},...(UI.sessions||[]).filter(x=>x.key!==key)].slice(0,6); save(); }
async function landReopen(i){ const s=(UI.sessions||[])[i], D=window.rrlab; if(!s) return; if(!D||!D.readFiles) return toast('Reopening needs the desktop app');
  const got=await D.readFiles([s.tune.path,...s.logs.map(l=>l.path)].filter(Boolean))||[], by={}; got.forEach(o=>by[o.path]=o);
  if(ST.logs.length){ RP.B=null; RP.L=null; ST.logs.splice(0); }
  if(by[s.tune.path]){ LAND.tuneP={name:s.tune.name,path:s.tune.path}; await loadTuneText(by[s.tune.path].text,s.tune.name); } else if(!TUNE||TUNE.name!==s.tune.name) return toast('Tune not found: '+s.tune.name);
  const lf=s.logs.map(l=>by[l.path]).filter(Boolean), miss=s.logs.length-lf.length; if(!lf.length){ landRefresh(); return toast('Those logs were moved or deleted'); }
  await addFiles(lf.map(o=>({name:o.name,path:o.path,text:async()=>o.text}))); if(miss) toast(miss+' log'+(miss>1?'s were':' was')+' not found'); }
function landRefresh(){ if(!$('land-tune')) return; $('land-ver').textContent=APP_VER;
  const rv=(typeof REV!=='undefined'&&REV.nodes)||[], cn=rv.find(n=>n.id===REV.cur), others=rv.filter(n=>n.id!==REV.cur).slice(-4).reverse();
  $('ln-tune').classList.toggle('ok',!!TUNE);
  $('land-tune').innerHTML=TUNE?`<div class="lcur"><div class="lic">.tune</div><div><b>${esc(TUNE.name||'tune')}</b><small>${esc([TUNE.cal,cn&&cn.rev?'Rev '+cn.rev:'',cn&&cn.time?whenTxt(cn.time):''].filter(Boolean).join(' · '))}</small></div><span class="lb2"><button class="btn" data-l="edit" title="Open Tables to edit this tune, no log needed">Open in editor</button><button class="btn" data-l="tune">Change</button></span></div>`
    +(others.length?`<div class="lrec"><span>Revisions</span>${others.map(n=>`<button data-rev="${esc(n.id)}">${esc(n.file||'rev '+n.rev)}</button>`).join('')}</div>`:'')
    :`<div class="ldrop big" data-l="tune" role="button" tabindex="0">Drop a Project Lambda .tune here</div>`;
  const E=LAND.ejl&&LAND.ejl.files?LAND.ejl.files.filter(f=>!f.old&&f.name!==LAND.ejl.recording).slice(0,8):[];
  $('land-logs-s').textContent=E.length?'From ejLogger':'';
  $('land-rows').innerHTML=LAND.q.map((f,i)=>`<div class="lrow ${LAND.sel.has('f:'+i)?'on':''}" data-k="f:${i}"><span class="lcb"></span><span>${esc(f.name)}</span><span class="p">dropped</span><span class="r"></span><span class="z">${f.size?kb(f.size):''}</span></div>`).join('')
    +E.map(f=>`<div class="lrow ${LAND.sel.has('e:'+f.name)?'on':''}" data-k="e:${esc(f.name)}"><span class="lcb"></span><span>${esc(f.name)}</span><span class="p">${esc(f.profile||'')}</span><span class="r">${f.meta&&f.meta.rows?Number(f.meta.rows).toLocaleString()+' rows':''}</span><span class="z">${kb(f.size)}</span></div>`).join('');
  const {files,names}=landPicked(), n=files.length+names.length;
  $('ln-logs').classList.toggle('ok',n>0); $('land-count').textContent=TUNE?`1 tune · ${n} log${n===1?'':'s'}`:'Load a tune first';
  const go=$('land-go'); go.disabled=!TUNE; go.textContent=n?'Open session  →':'Open in editor  →';
  $('land-back').classList.toggle('hidden',!ST.logs.length);
  const SS=(UI.sessions||[]).map((s,i)=>Object.assign({i},s)).filter(s=>!UI.car||!s.car||s.car===UI.car), S=SS.slice(0,3); const cars=UI.cars||[];
  $('land-car').innerHTML=cars.length?`<select id="land-carsel">${cars.map(c=>`<option value="${esc(c.id)}" ${c.id===UI.car?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button class="lchip" data-l="caredit">Edit</button><button class="lchip" data-l="caradd">Add car</button>`:`<button class="lchip" data-l="caradd">Create car profile</button>`;
  $('land-last').innerHTML=S.length?`<div class="lbl">Pick up where you left off</div>`+S.map((s,i)=>`<button class="lses ${i?'':'top'}" data-ses="${s.i}" title="${esc(s.logs.map(l=>l.name).join('\n'))}"><b>${esc(s.tune.name)} <em>+ ${s.logs.length} log${s.logs.length===1?'':'s'}</em></b><small>${esc(whenTxt(s.t))} · ${esc(s.res||'')}</small>${i?'':'<span class="btn">Reopen</span>'}</button>`).join(''):'';
  let EJS=null; try{ EJS=EJL.S; }catch(_){} if(window.rrlab&&window.rrlab.desktop&&EJS){ const st=EJS, f0=LAND.ejl&&LAND.ejl.files&&LAND.ejl.files[0], ic=$('land-ejl').dataset.ic||'';
    const s=st.rec?['rec','Recording']:st.state==='logging'?['on','Logging']:st.state==='connecting'?['on','Connecting']:['','Not connected'];
    $('land-ejl').innerHTML=`<div>${ic?`<img src="${ic}" alt="">`:'<span></span>'}<div><b>ejLogger</b><small><i class="${s[0]}"></i>${s[1]}${f0?' · last log '+esc(whenTxt(f0.mtime)):''}</small></div><button class="btn" data-l="ejl">Open</button></div>`; } else $('land-ejl').innerHTML='';
  if(DESK) DESK.land(); }

// ── drawer ──────────────────────────────────────────────────────────────────
function sec(id,title,body,right){ const open=UI.open[id]!==undefined?UI.open[id]:['tune','logs','cov'].includes(id); return `<details class="dsec" data-id="${id}"${open?' open':''}><summary><span>${title}</span>${right||''}</summary><div class="dbd">${body}</div></details>`; }
function drawerRefresh(){ const d=$('drawer-bd'); if(!d) return; const L=RP.L, T=TUNE, B=ST.bins;
  const agg={total:0,kept:0,nowb:0,notgt:0,notrim:0,idle:0,warmup:0,cut:0,recover:0,overrun:0,rail:0,trans:0,nan:0,lean:0,bad:0}; let tier=null, lmc=false;
  for(const x of ST.logs){ const a=x.an.aud; for(const k in agg) agg[k]+=a[k]||0; tier=tier||a.tier; lmc=lmc||a.lmcUnlogged; }
  const chip=(n,l)=>n?`<span class="achip"><b>${n.toLocaleString()}</b> ${l}</span>`:'';
  const nb=B?B.filter(b=>b.n).length:0, cov=B?`<div class="cov">${B.map(b=>`<i style="height:${b.n?6+Math.min(1,Math.log10(b.n+1)/Math.log10(300))*24:3}px;background:${b.n?(b.trust==='solid'?'#7bbf50':'#c9882a'):'#16161b'}" title="${b.v.toFixed(3)} V · n=${b.n.toFixed(0)}${b.src?' · '+b.src:''}"></i>`).join('')}</div><div class="covax"><span>${BP[0].toFixed(2)} V</span><span>${BP[BP.length-1].toFixed(2)} V</span></div>`:'';
  const thr=(id,lab,val,step,unit)=>`<label class="drow"><span>${lab}</span><input class="num" type="number" step="${step}" data-cfg="${id}" value="${val}"><em>${unit||''}</em></label>`;
  const k=lamK(UI.wbDisp), dp=dpOf(UI.wbDisp), wu=uLbl(UI.wbDisp);
  const fams=[]; for(const x of ST.logs) x.fam.forEach((f,j)=>{ if(f!=='Time'&&j!==x.wbj&&!fams.includes(f)) fams.push(f); });
  const lim=fams.sort().map(f=>{ const l=limUser(f), tl=TLIM[f]||{}, set=(l.lo||[]).concat(l.hi||[]).some(Number.isFinite)||(tl.hi||[]).some(Number.isFinite), inp=(s,i)=>{ const uv=l[s]&&Number.isFinite(l[s][i])?l[s][i]:null, tv=tl[s]&&Number.isFinite(tl[s][i])?tl[s][i]:null; return `<input class="num xs${uv==null&&tv!=null?' tl':''}" type="number" step="any" data-lim="${esc(f)}" data-side="${s}" data-k="${i}" value="${uv!=null?uv:tv!=null?tv:''}" placeholder="${['appr','warn','crit'][i]}"${uv==null&&tv!=null?' title="from tune"':''}>`; };
    return `<details class="lim"${UI.open['lim:'+f]?' open':''} data-lf="${esc(f)}"><summary>${esc(f)}${set?' <span class="dot"></span>':''}</summary><div class="limg"><span>Low ≤</span>${[0,1,2].map(i=>inp('lo',i)).join('')}<span>High ≥</span>${[0,1,2].map(i=>inp('hi',i)).join('')}</div></details>`; }).join('');
  const S=(tab,...a)=>sec(...a).replace('<details class="dsec"',`<details class="dsec" data-tab="${tab}"`);
  const sg=(key,opts)=>`<div class="seg" data-u="${key}">${opts.map(([v,l])=>`<button data-v="${v}" class="${UI[key]===v?'on':''}">${l}</button>`).join('')}</div>`;
  const row=(lab,html,tip)=>`<div class="drow"${tip?` title="${tip}"`:''}><span>${lab}</span>${html}</div>`;
  const q=UI.dq||'', ae=document.activeElement, refocus=ae&&ae.dataset&&ae.dataset.dsearch!=null, tabs=[['session','Session'],['settings','Settings'],['about','About'+(ERRS.length?'<i class="errdot"></i>':'')]]; if(UI.dtab==='analysis') UI.dtab='session';
  const tuneB=T?`<div class="kv"><span>CAL</span><b>${esc(T.cal)}</b><span>ROM</span><b>${esc(T.rom)}</b><span>Read</span><b>${esc(T.read)}</b><span>File</span><b>${esc(T.name)}</b></div><button class="btn sm" data-act="tune">Replace tune</button>`:'<button class="btn acc sm" data-act="tune">Load tune</button>';
  const logsB=ST.logs.map((x,i)=>`<div class="lrow${x===L?' on':''}"><input type="checkbox" data-pool="${i}"${pooled(x)?' checked':''} title="Pool into MAF scaling"><button class="lplay" data-log="${i}" title="Replay this log">${x===L?'▶':'▷'}</button><span class="lname" title="${esc(x.name)}">${esc(x.name)}</span><span class="lmeta">${x.N.toLocaleString()}</span><button class="lplay${x===RP.B?' on':''}" data-cmp="${i}" title="${x===RP.B?'End compare':'Compare as log B'}"${x===RP.B?` style="color:${logC('b')};border-color:${logC('b')}"`:''}${x===L?' disabled':''}>B</button><button class="lx" data-rm="${i}" title="Remove">×</button></div>${typeof logRevHtml==='function'?logRevHtml(x,i):''}`).join('')
    +`<div class="drow"><button class="btn sm" data-act="logs" title="CSV logs or an .ejstudio session">Add logs</button><button class="btn sm" data-act="sess" title="Tune, revisions, logs, layout, flags, trims, notes and vehicle profile in one .ejlab file (Ctrl+S)">Save session</button></div>`;
  const covB=`${cov}<div class="achips">${chip(agg.nowb,'no wideband')}${chip(agg.notgt,'no target λ')}${chip(agg.notrim,'no trims')}${chip(agg.warmup,'warmup')}${chip(agg.cut,'fuel cut')}${chip(agg.recover,'cut recovery')}${chip(agg.overrun,'OL overrun')}${chip(agg.trans,'transient')}${chip(agg.rail,'WB rail')}${chip(agg.idle,'idle/crank')}${chip(agg.nan,'unreadable')}${chip(agg.bad,'malformed')}</div>`
    +`<div class="note">Fuel-cut detection: <b>${tier||'—'}</b>${agg.lean?` · <span class="warn">${agg.lean} lean-outlier frames flagged</span>`:''}</div>`+(lmc?`<div class="note warn">Load comp active in tune · MAP not logged</div>`:'')
    +(ST.ipw?`<div class="note">${ST.ipw.verdict?`IPW check: AFL <b>${ST.ipw.verdict}</b> in open loop (fuel ratio ${ST.ipw.ratio.toFixed(3)} vs 1+AFL ${ST.ipw.afl.toFixed(3)})`:'IPW check: not enough frames'}</div>`:'');
  const diagB=[['knock','Knock classification'],['boost','Boost / WGDC health'],['tip','Tip-in / tip-out'],['avcs','AVCS tracking'],['clol','CL/OL transitions'],['fuel','Fuel saturation']].map(([g,l])=>`<div class="drow"><span>${l}</span><div class="seg"><button data-dg="${g}" data-on="1" class="${UI.diagOn[g]!==false?'on':''}">On</button><button data-dg="${g}" data-on="0" class="${UI.diagOn[g]===false?'on':''}">Off</button></div></div>`).join('')
    +thr('tipRate','Tip-in throttle rate ≥',CFG.tipRate,10,'%/s')+thr('knockWin','Transient knock window',CFG.knockWin,0.1,'s')+thr('lowLoad','Low load below',CFG.lowLoad,0.05,'g/rev')+thr('bErr','Boost error ≥',CFG.bErr,0.5,'psi')+thr('bDur','Boost error for',CFG.bDur,0.1,'s')
    +thr('tipAfr','AFR spike ≥',CFG.tipAfr,0.1,'AFR')+thr('avcsErr','AVCS error ≥',CFG.avcsErr,0.5,'°')+thr('clVal','Closed loop status',CFG.clVal,1,'')+thr('olVal','Open loop status ≥',CFG.olVal,1,'')+thr('clolWin','CL/OL window',CFG.clolWin,50,'ms');
  const fltB=thr('cutMafv','Closed-throttle MAF V',CFG.cutMafv,0.01,'V')+thr('transVs','Transient limit',CFG.transVs,0.1,'V/s')+thr('recoverS','Cut recovery',CFG.recoverS,0.1,'s')
    +thr('railLo','WB rail low',(CFG.railLo*k).toFixed(dp),'any',wu)+thr('railHi','WB rail high',(CFG.railHi*k).toFixed(dp),'any',wu)+thr('olEnr','OL counts at FFB ≤',CFG.olEnr.toFixed(3),'any','λ')+thr('leanLam','Lean outlier above',(CFG.leanLam*k).toFixed(dp),'any',wu)
    +thr('richFloor','Rich floor warning',(CFG.richFloor*k).toFixed(dp),'any',wu)+thr('solidN','Solid bin at n ≥',CFG.solidN,1,'')+thr('kinkTol','Kink tolerance',(CFG.kinkTol*100).toFixed(1),0.5,'%')+`<button class="btn sm ghost" data-act="cfgreset">Defaults</button>`;
  const colsB=L?`<div class="kv"><span>Mapped</span><b>${Object.keys(L.map||{}).length} of ${L.headers.length-1}</b><span>Format</span><b>${L.fmt==='lambda'?'Project Lambda':'SSM CSV'}</b>${L.wiped?`<span>Wiped</span><b>${L.wiped} lead rows</b>`:''}</div><div class="drow"><button class="btn sm" data-act="mapedit">Edit mapping</button>${MAPS[L.sig]?'<button class="btn sm ghost" data-act="mapforget">Forget saved</button>':''}</div>`:'';
  const unitsB=row('Wideband',sg('wbDisp',[['lambda','λ'],['afr','AFR']]))+row('FFB target',sg('ffbDisp',[['lambda','λ'],['afr','AFR']]))+row('Temperature',sg('tu',[['C','°C'],['F','°F']]))+row('Pressure',sg('pu',[['psi','psi'],['kPa','kPa'],['bar','bar']]));
  const colB=row('Flag severity',['info','warn','crit'].map(c=>`<input type="color" data-sev="${c}" value="${sevC(c)}" title="${{info:'Info',warn:'Warning',crit:'Critical'}[c]}">`).join(''))+row('Log A / B',['a','b'].map(c=>`<input type="color" data-lc="${c}" value="${logC(c)}" title="Log ${c.toUpperCase()}">`).join(''));
  const homeB=`<label class="drow" title="Used to fetch weather for each log"><span>Home location</span><input class="num" style="width:160px;text-align:left" data-home="1" value="${esc(UI.home?UI.home.name:'')}" placeholder="City"></label>`;
  const rpB=`<label class="drow"><span>WB smoothing (graph)</span><input class="num" type="number" min="0" max="3000" step="100" data-ui="tau" value="${UI.tau}"><em>ms</em></label><label class="drow" title="Opacity of the expanded timeline"><span>Expanded timeline opacity</span><input class="num" type="number" min="30" max="100" step="5" data-ui="tlop" value="${UI.tlop??70}"><em>%</em></label>`;
    DSEC.flt=fltB; DSEC.diag=diagB; DSEC.rp=rpB; DSEC.pool=ST.logs.map((x,i)=>`<label class="lrow"><input type="checkbox" data-pool="${i}"${pooled(x)?' checked':''}><span class="lname" title="${esc(x.name)}">${esc(x.name)}</span><span class="lmeta">${x.N.toLocaleString()}</span></label>`).join(''); DSEC.cov=`<div class="dsh">MAF data · ${agg.kept.toLocaleString()} of ${agg.total.toLocaleString()} frames used</div>`+covB;
    d.innerHTML=`<div class="dtabs">${tabs.map(([v,l])=>`<button data-dtab="${v}">${l}</button>`).join('')}</div><input class="tt-q dsq" type="search" data-dsearch placeholder="Search settings" value="${esc(q)}">`
   +S('session','tune','Tune',tuneB)+''
   +S('session','logs','Logs',logsB,`<em>${agg.total.toLocaleString()} frames</em>`)
   +(DESK?S('session','watch','Log folder',DESK.section(),DESK.st.folder?`<em>${DESK.st.auto?'watching':'manual'}</em>`:''):'')
      +(L?S('session','meta','Session notes',metaHtml(L)):'')+(L?S('session','pf','Pulls · flags · trim',pfHtml(L),`<em>${(L.pulls||[]).length} pulls</em>`):'')
   +((DSEC.pull=(thr('pullThr','Throttle ≥',CFG.pullThr,1,'%')+thr('pullDur','Min length',CFG.pullDur,0.1,'s')+thr('pullSpan','Min RPM sweep',CFG.pullSpan,50,'rpm'))),'')
   
   +S('session','lim','Warning limits',fams.length?lim:'<div class="note">Load a log to set limits</div>')+(L?S('session','cols','Column mapping',colsB,MAPS[L.sig]?'<em>saved</em>':''):'')
   +S('settings','disp','UI scale',`<div class="drow">${SCALES.map(f=>`<button class="btn sm${(UI.scale||1)===f?' acc':''}" data-act="sc${Math.round(f*100)}" title="Ctrl+= / Ctrl+− to step · Ctrl+0 resets">${Math.round(f*100)}%</button>`).join('')}</div>`)+S('settings','units','Units',unitsB)+S('settings','colours','Colours',colB)+S('settings','home','Location',homeB)
   +(typeof editorSettingsHtml==='function'?S('settings','ed','Table editor',editorSettingsHtml()):'')+S('settings','keys','Shortcuts',keysHtml())
   +S('settings','reset','Reset','<button class="btn sm danger" data-act="reset">Reset everything</button>')
   +S('about','about','ejStudio',aboutHtml())+S('about','upd','Updates & bug reports',updHtml());
  dApply(); if(refocus){ const e=d.querySelector('[data-dsearch]'); e.focus(); e.setSelectionRange(q.length,q.length); } }
function dApply(){ const d=$('drawer-bd'), q=(UI.dq||'').trim().toLowerCase(), t=UI.dtab||'session';
  d.querySelectorAll('.dtabs button').forEach(b=>b.classList.toggle('on',!q&&b.dataset.dtab===t));
  d.querySelectorAll('.dsec[data-tab]').forEach(x=>{ const hit=q&&(x.textContent.toLowerCase().includes(q)||[...x.querySelectorAll('input')].some(i=>(i.placeholder||'').toLowerCase().includes(q)));
    x.style.display=(q?hit:x.dataset.tab===t)?'':'none'; if(hit) x.open=true; }); }
function drawerBind(d=$('drawer-bd')){
  d.addEventListener('input',e=>{ if(e.target.dataset&&e.target.dataset.dsearch!=null){ UI.dq=e.target.value; dApply(); } });
  d.addEventListener('toggle',e=>{ if(UI.dq) return; const s=e.target; if(s.dataset&&s.dataset.id){ UI.open[s.dataset.id]=s.open; save(); } else if(s.dataset&&s.dataset.lf){ UI.open['lim:'+s.dataset.lf]=s.open; save(); } },true);
  d.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.log!=null){ rpPlay(false); selectLog(ST.logs[+b.dataset.log],false); return; }
    if(b.dataset.rm!=null){ removeLog(ST.logs[+b.dataset.rm]); return; }
    if(b.dataset.dtab){ UI.dtab=b.dataset.dtab; UI.dq=''; const q=d.querySelector('[data-dsearch]'); if(q) q.value=''; save(); dApply(); return; }
    if(b.dataset.rvo){ revOpen(b.dataset.rvo); return; } if(b.dataset.rvs){ const n=REV.nodes.find(x=>x.id===b.dataset.rvs); if(n) dl(new Blob([n.src],{type:'application/json'}),n.file); return; }
    if(b.dataset.cmp!=null){ const x=ST.logs[+b.dataset.cmp]; setCompare(x===RP.B?null:x); return; }
    if(b.dataset.cfdel!=null){ metaOf(RP.L).custom.splice(+b.dataset.cfdel,1); save(); drawerRefresh(); return; }
    if(b.dataset.dg){ UI.diagOn[b.dataset.dg]=b.dataset.on==='1'; save(); fillEvents(); RP.tlcSk=RP.tlcBk=null; RP.dirty=true; drawerRefresh(); return; }
    if(b.dataset.key){ keyCapture=b.dataset.key; drawerRefresh(); return; } if(b.dataset.seek!=null){ rpPlay(false); rpSeek(+b.dataset.seek,true); return; } if(b.dataset.fdel!=null){ UI.flags[RP.L.fp].splice(+b.dataset.fdel,1); flagsChanged(); return; }
    const sg=b.closest('.seg[data-u]'); if(sg){ UI[sg.dataset.u]=b.dataset.v; save(); unitsChanged(); drawerRefresh(); return; }
    const a=b.dataset.act; if(a&&a[0]==='w'&&DESK){ DESK.act(a); return; } if(a==='mapedit'){ remap(RP.L); return; } if(a==='mapforget'){ delete MAPS[RP.L.sig]; saveMaps(); drawerRefresh(); toast('Saved mapping cleared'); return; } if(a==='tune') $('f-tune').click(); else if(a==='logs') $('f-logs').click();
    else if(a==='sess') saveSession(); else if(/^sc\d+$/.test(a)){ uiScale(+a.slice(2)/100); drawerRefresh(); } else if(a==='news') whatsNew(); else if(a==='bug') bugReport(); else if(a==='updchk') checkUpdates(true); else if(a==='reps'){ if(window.rrlab&&window.rrlab.openReports) window.rrlab.openReports(''); }
    else if(a==='odata'){ if(window.rrlab&&window.rrlab.openData) window.rrlab.openData(); } else if(a==='updopen'){ if(UI.upd&&UI.upd.url&&window.rrlab&&window.rrlab.openUrl) window.rrlab.openUrl(UI.upd.url); } else if(a==='csvx') exportCSV(); else if(a==='wx') fetchWeather(RP.L,false); else if(a==='cfadd'){ const m=metaOf(RP.L); (m.custom=m.custom||[]).push({k:'',v:''}); save(); drawerRefresh(); }
    else if(a==='keyreset'){ UI.keys={}; save(); drawerRefresh(); } else if(a==='trima') trimSet('a'); else if(a==='trimb') trimSet('b'); else if(a==='trimx') trimSet('clear');
    else if(a==='cfgreset'){ const ol=CFG.olAfl; Object.assign(CFG,CFG_DEF); CFG.olAfl=ol; UI.cfg={olAfl:ol}; save(); recompute(true); }
    else if(a==='reset'){ if(!confirm('Reset ejStudio? Clears the tune, stored logs, layouts, limits and settings.')) return; try{ localStorage.removeItem('rrlab_ui_v1'); localStorage.removeItem('rrlab_tune_v1'); }catch(_){} IDB.clear().then(()=>location.reload()); } });
  d.addEventListener('change',e=>{ const t=e.target;
    if(t.dataset.cfg){ const id=t.dataset.cfg, x=parseFloat(t.value); if(!Number.isFinite(x)) return; const lam=['railLo','railHi','leanLam','richFloor'].includes(id);
      const v=lam?x/lamK(UI.wbDisp):id==='kinkTol'?x/100:x; CFG[id]=v; UI.cfg[id]=v; save(); recompute(true); }
    else if(t.dataset.lim){ const f=t.dataset.lim, sd=t.dataset.side, k=+t.dataset.k, x=parseFloat(t.value), W=SLIM();
      if(W){ const n=limName(W,f)||f, cur=(LIMITS[f]&&LIMITS[f][sd]||[null,null,null]).slice(0,3); cur[k]=Number.isFinite(x)?x:null; window.__ejlWarnSet(n,cur.every(Number.isFinite)?cur:cur.some(Number.isFinite)?cur.map(v=>Number.isFinite(v)?v:0):null); }
      else { const tv=TLIM[f]&&TLIM[f][sd]?TLIM[f][sd][k]:null, l=ULIM[f]||(ULIM[f]={lo:[null,null,null],hi:[null,null,null]}); (l[sd]=l[sd]||[null,null,null])[k]=Number.isFinite(x)&&x!==tv?x:null; if(!l.lo.concat(l.hi).some(Number.isFinite)) delete ULIM[f]; }
      mergeLimits(); save(); fillEvents(); RP.dirty=true; drawerRefresh(); }
    else if(t.dataset.meta){ const m=metaOf(RP.L), k=t.dataset.meta; m[k]=t.type==='number'?(t.value===''?'':+t.value):t.value; if(k==='ambient'&&UI.tu==='F'&&m[k]!=='') m[k]=+((m[k]-32)/1.8).toFixed(2); if(k==='date') delete m.wx; save(); }
    else if(t.dataset.cf!=null){ metaOf(RP.L).custom[+t.dataset.cf][t.dataset.part]=t.value; save(); }
    else if(t.dataset.lrev!=null){ const x=ST.logs[+t.dataset.lrev]; UI.lrev[x.fp]=t.value; save(); recompute(true); TV.setTune(); toast(x.name+' → rev '+REV.nodes.find(n=>n.id===t.value).rev); }
    else if(t.dataset.pool!=null){ const x=ST.logs[+t.dataset.pool]; UI.pool[x.fp]=t.checked; if(t.checked) delete UI.pool[x.fp]; save(); ST.fixes.clear(); recompute(false); }
    else if(t.dataset.rail){ UI.rails=UI.rails||{}; const x=parseFloat(t.value); if(Number.isFinite(x)) UI.rails[t.dataset.rail]=x; else delete UI.rails[t.dataset.rail]; save(); }
    else if(t.dataset.lc){ UI.logCol[t.dataset.lc]=t.value; save(); RP.tlbK=null; cmpUI(); RP.dirty=true; }
    else if(t.dataset.home){ geoHome(t.value); }
    else if(t.dataset.sev){ UI.sevCol[t.dataset.sev]=t.value; save(); RP.tlcSk=RP.tlcBk=null; RP.dirty=true; }
    else if(t.dataset.ui==='tau'){ UI.tau=Math.max(0,Math.min(3000,+t.value||0)); save(); RP.dirty=true; } else if(t.dataset.ui==='tlop'){ UI.tlop=Math.max(30,Math.min(100,+t.value||70)); save(); $('tlpop').style.setProperty('--tlop',UI.tlop/100); } }); }
// ── user flags · trim · actions · keymap ────────────────────────────────────
const FLAG_LIST={'Driving events':['WOT pull start','WOT pull end','Shift','Launch','Lift-off / overrun','Highway cruise','Idle','Traffic / stop'],
  'Engine behaviour':['Stumble / hesitation','Bucking / surging','Misfire felt','Knock heard','Boost spike / overshoot','Boost dropout','Lean feeling / bog','Smoke'],
  'Conditions':['Cold start','Heat soak','Rain / wet','Hill / grade','Passenger / load'],'Workflow':['Bad data (ignore)','Compare this','Revisit later','Tune change point']};
function trimOf(L){ return L&&UI.trims&&UI.trims[L.fp]||null; }
function trimSpan(L){ const x=trimOf(L); if(!x) return {L,lo:0,hi:L.N-1}; const T=L.t, ix=t=>{ let lo=0,hi=L.N-1; if(t<=T[0]) return 0; if(t>=T[hi]) return hi; while(hi-lo>1){ const m=(lo+hi)>>1; if(T[m]<=t) lo=m; else hi=m; } return lo; };
  return {L,lo:x.a!=null?ix(x.a):0,hi:x.b!=null?ix(x.b):L.N-1}; }
function inTrim(L,t){ const x=trimOf(L); return !x||((x.a==null||t>=x.a)&&(x.b==null||t<=x.b)); }
function userFlags(L){ return (UI.flags[L.fp]||[]).map(f=>({t:f.t,t2:f.t2,kind:'Flag',label:f.kind+(f.note?' · '+f.note:'')+(f.t2!=null?` (${((f.t2-f.t)/1000).toFixed(1)} s)`:'')})); }
function flagsChanged(){ save(); fillEvents(); RP.tlcSk=RP.tlcBk=null; RP.dirty=true; drawerRefresh(); }
function addFlag(t,t2){ const L=RP.L; if(!L) return; rpPlay(false); const d=mk('div','',document.body); d.id='mapdlg';
  d.innerHTML=`<div class="md-card" style="width:min(460px,100%)"><div class="md-h"><b>Add flag</b><span>${fmtT(t)}${t2!=null?' – '+fmtT(t2):''}</span></div><div style="padding:.6rem 1.1rem;display:flex;flex-direction:column;gap:.6rem"><select class="sel" style="max-width:none">${Object.entries(FLAG_LIST).map(([g,l])=>`<optgroup label="${g}">${l.map(x=>`<option>${esc(x)}</option>`).join('')}</optgroup>`).join('')}<option value="">Other (note only)</option></select><input class="tt-q" style="margin:0" placeholder="Note"></div><div class="md-f"><button class="btn ghost" data-a="x">Cancel</button><span class="vfill"></span><button class="btn acc" data-a="ok">Add</button></div></div>`;
  const sel=d.querySelector('select'), inp=d.querySelector('input'); setTimeout(()=>sel.focus(),0);
  const done=ok=>{ document.removeEventListener('keydown',kd,true); d.remove(); if(!ok) return; const note=inp.value.trim(); if(!sel.value&&!note) return;
    (UI.flags[L.fp]=UI.flags[L.fp]||[]).push({t,t2:t2??null,kind:sel.value||'Note',note}); flagsChanged(); toast('Flag added'); };
  const kd=e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(false); } else if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); done(true); } };
  document.addEventListener('keydown',kd,true); d.onclick=e=>{ const b=e.target.closest('[data-a]'); if(b) done(b.dataset.a==='ok'); }; }
function flagKey(range){ if(!RP.L) return; if(!range) return addFlag(RP.playT);
  if(RP.flagA==null){ RP.flagA=RP.playT; RP.dirty=true; toast('Range start set'); } else { const a=Math.min(RP.flagA,RP.playT), b=Math.max(RP.flagA,RP.playT); RP.flagA=null; RP.dirty=true; addFlag(a,b); } }
function trimSet(w){ const L=RP.L; if(!L) return; if(w==='clear') delete UI.trims[L.fp]; else { const x=UI.trims[L.fp]||(UI.trims[L.fp]={a:null,b:null}); x[w]=RP.playT; if(x.a!=null&&x.b!=null&&x.a>x.b){ const t=x.a; x.a=x.b; x.b=t; } }
  save(); RP.tlcSk=RP.tlcBk=null; recompute(false); toast(w==='clear'?'Trim cleared':'Trim '+(w==='a'?'start':'end')+' set'); }
function pfHtml(L){ const x=trimOf(L), fl=UI.flags[L.fp]||[], pl=(L.pulls||[]).filter(p=>inTrim(L,p.t));
  return (pl.length?pl.map(p=>`<div class="lrow"><button class="lplay" data-seek="${p.t}" title="Jump to pull">▷</button><span class="lname" title="${esc(p.label)}">${esc(p.label)}</span></div>`).join(''):'<div class="note">No pulls</div>')
   +(fl.length?'<div class="vlab">Flags</div>'+fl.map((f,k)=>`<div class="lrow"><button class="lplay" data-seek="${f.t}" title="Jump to flag">▷</button><span class="lname" title="${esc(f.note||f.kind)}">${fmtT(f.t)} · ${esc(f.kind)}${f.note?' · '+esc(f.note):''}</span><button class="lx" data-fdel="${k}" title="Delete flag">×</button></div>`).join(''):'')
   +`<div class="vlab">Trim</div><div class="kv"><span>Start</span><b>${x&&x.a!=null?fmtT(x.a):'—'}</b><span>End</span><b>${x&&x.b!=null?fmtT(x.b):'—'}</b></div><div class="drow"><button class="btn sm" data-act="trima">Start at playhead</button><button class="btn sm" data-act="trimb">End at playhead</button>${x?'<button class="btn sm ghost" data-act="trimx">Clear</button>':''}<button class="btn sm" data-act="csvx" title="Rows inside the trim (whole log if untrimmed), original columns">Export CSV</button></div>`; }
const SPEEDS=[0.25,0.5,1,2,4,8,10];
const ACTIONS=[['play','Play / pause','Space'],['step+','Step forward','→'],['step-','Step back','←'],['jump+','Jump 5 s forward','Shift+→'],['jump-','Jump 5 s back','Shift+←'],
  ['spd-','Speed down','['],['spd+','Speed up',']'],['spd1','Speed 1×','\\'],['pk+','Next peak (graph lane 1)','Ctrl+→'],['pk-','Previous peak (graph lane 1)','Ctrl+←'],
  ['vl+','Next valley (graph lane 1)','Ctrl+Shift+→'],['vl-','Previous valley (graph lane 1)','Ctrl+Shift+←'],['fl+','Next flag','.'],['fl-','Previous flag',','],['pl+','Next pull','Alt+→'],['pl-','Previous pull','Alt+←'],
  ['flag','Add flag at playhead','F'],['flagr','Range flag start / end','Shift+F'],['log','Next log · swap A/B when comparing','Tab'],['exp','Expand / close timeline','E'],['la','Loop start','A'],['lb','Loop end','B'],['trimA','Trim start at playhead','Ctrl+['],['trimB','Trim end at playhead','Ctrl+]'],['save','Save session','Ctrl+S'],['link','Link scrubbers (compare)','L'],['png','Export view as PNG','Ctrl+P']];
let keyCapture=null;
function keyOf(e){ let k=e.key; if(['Control','Shift','Alt','Meta'].includes(k)) return null; const M={' ':'Space',ArrowRight:'→',ArrowLeft:'←',ArrowUp:'↑',ArrowDown:'↓'}; k=M[k]||(k.length===1?k.toUpperCase():k);
  return (e.ctrlKey?'Ctrl+':'')+(e.altKey?'Alt+':'')+(e.shiftKey&&!(k.length===1&&!/[A-Z0-9]/.test(k))?'Shift+':'')+k; }
function keyAction(e){ const k=keyOf(e); if(!k) return null; for(const [id,,d] of ACTIONS) if(!id.startsWith('ed:')&&(UI.keys[id]??d)===k) return id; return null; }
function setSpeed(v){ UI.speed=v; save(); $('t-speed').querySelectorAll('button').forEach(x=>x.classList.toggle('on',+x.dataset.s===v)); toast('Speed '+v+'×'); }
function jumpEv(kind,dir){ const L=RP.L; if(!L) return; const l=(L.allEv||[]).filter(e=>e.kind===kind), now=RP.playT; let e=null;
  if(dir>0) e=l.find(x=>x.t>now+1); else for(let k=l.length-1;k>=0;k--) if(l[k].t<now-1){ e=l[k]; break; }
  if(e){ rpPlay(false); rpSeek(e.t,true); toast(e.label); } else toast('No '+kind.toLowerCase()+(dir>0?' ahead':' behind')); }
function runAction(a){ if(a.startsWith('ed:')){ EDITOR.act(a.slice(3)); return; } const si=SPEEDS.indexOf(UI.speed), c=si<0?2:si;
  switch(a){ case 'play': rpPlay(!RP.playing); break; case 'step+': rpStep(1); break; case 'step-': rpStep(-1); break;
    case 'jump+': rpSeek(RP.playT+5000,true); break; case 'jump-': rpSeek(RP.playT-5000,true); break;
    case 'spd-': setSpeed(SPEEDS[Math.max(0,c-1)]); break; case 'spd+': setSpeed(SPEEDS[Math.min(SPEEDS.length-1,c+1)]); break; case 'spd1': setSpeed(1); break;
    case 'pk+': GV.jump('hi',1); break; case 'pk-': GV.jump('hi',-1); break; case 'vl+': GV.jump('lo',1); break; case 'vl-': GV.jump('lo',-1); break;
    case 'fl+': jumpEv('Flag',1); break; case 'fl-': jumpEv('Flag',-1); break; case 'pl+': jumpEv('Pull',1); break; case 'pl-': jumpEv('Pull',-1); break;
    case 'flag': flagKey(false); break; case 'flagr': flagKey(true); break;
    case 'log': if(RP.B){ swapAB(); break; } if(ST.logs.length>1){ rpPlay(false); selectLog(ST.logs[(ST.logs.indexOf(RP.L)+1)%ST.logs.length],false); toast(RP.L.name); } break;
    case 'exp': pop($('tlpop').classList.contains('hidden')); break; case 'la': RP.a=RP.playT; rpAB(); break; case 'lb': RP.b=RP.playT; rpAB(); break;
    case 'trimA': trimSet('a'); break; case 'trimB': trimSet('b'); break; case 'save': saveSession(); break; case 'link': toggleLink(); break; case 'png': exportPNG(); break; } }
function keysHtml(){ return ACTIONS.filter(a=>!a[0].startsWith('ed:')).map(([id,lab,d])=>{ const k=UI.keys[id]??d; return `<div class="drow"><span>${lab}</span><button class="btn sm" data-key="${id}" title="Click, then press the new keys · Backspace clears · Esc cancels">${keyCapture===id?'Press keys…':esc(k||'—')}</button></div>`; }).join('')
  +'<div class="vlab" style="margin-top:.6rem">Table editor (Edit mode)</div>'+ACTIONS.filter(a=>a[0].startsWith('ed:')).map(([id,lab,d])=>{ const k=UI.keys[id]??d; return `<div class="drow"><span>${lab}</span><button class="btn sm" data-key="${id}" title="Click, then press the new keys · Backspace clears · Esc cancels">${keyCapture===id?'Press keys…':esc(k||'—')}</button></div>`; }).join('')+''
  +`<div class="kv keys"><span>Esc</span><b>Close pop-out / drawer</b><span>Shift-drag</span><b>Expanded timeline: set A–B</b></div><button class="btn sm ghost" data-act="keyreset">Defaults</button>`; }
document.addEventListener('keydown',e=>{ if(!keyCapture) return; e.preventDefault(); e.stopPropagation(); const id=keyCapture;
  if(e.key==='Escape'){ keyCapture=null; drawerRefresh(); return; }
  if(e.key==='Backspace') UI.keys[id]=''; else { const k=keyOf(e); if(!k) return; for(const [o,lab,d] of ACTIONS) if(o!==id&&(UI.keys[o]??d)===k){ UI.keys[o]=''; toast('Removed from '+lab); } UI.keys[id]=k; }
  keyCapture=null; save(); drawerRefresh(); },true);
const SEV_DEF={info:'#5a9fd4',warn:'#f0c060',crit:'#ff6b6b'};
function sevC(k){ return (UI.sevCol&&UI.sevCol[k])||SEV_DEF[k]||SEV_DEF.info; }
function sevOf(e){ switch(e.kind){ case 'Over boost': return 'crit'; case 'Under boost': case 'Knock': case 'Lean outlier': return 'warn'; case 'Warning': return e.tier>=3?'crit':'warn'; default: return 'info'; } }
const DG={Knock:'knock',IAM:'knock','Over boost':'boost','Under boost':'boost',Boost:'boost','Tip-in':'tip',AVCS:'avcs','CL/OL':'clol',Fuel:'fuel'};
function diagShown(e){ const g=DG[e.kind]; return !g||UI.diagOn[g]!==false; }
const PROF_FIELDS=[['name','Name'],['engine','Engine'],['inj','Injectors'],['maf','MAF housing'],['turbo','Turbo'],['gears','Gear ratios'],['fd','Final drive'],['tire','Tire size'],['wbLag','Wideband lag (ms)']];
function profNow(){ return typeof carNow==='function'?carNow():null; }
function profApply(){ PROF=profNow(); }
// a tune remembers the car it was loaded with; loading it again picks that car
function profAuto(T){ if(!T) return; const cars=UI.cars||[], m=cars.find(c=>c.rom&&c.rom===T.rom); if(m) UI.car=m.id; else { const c=profNow(); if(c&&!c.rom) c.rom=T.rom; } profApply(); }
// 3.1.0: the old Vehicle profiles become car profiles
function profMigrate(){ const ps=UI.profiles; if(!Array.isArray(ps)||!ps.length){ delete UI.profiles; delete UI.profSel; return; } const cars=UI.cars||(UI.cars=[]);
  for(const p of ps){ let c=cars.find(x=>x.name&&x.name===p.name); if(!c){ c={id:'car'+p.id,name:p.name||'Car',engine:p.engine||'',avcs:false,inj:p.inj?String(p.inj)+' cc':'',maf:p.mafd?p.mafd+' mm':'',turbo:'',fuelHist:p.fuel?[{t:Date.now(),brand:'',octane:String(p.fuel),eth:''}]:[]}; cars.push(c); }
    for(const k of ['gears','fd','tire','wbLag','rom']) if(c[k]==null||c[k]==='') c[k]=p[k]??''; if(p.id===UI.profSel) UI.car=c.id; }
  if(!UI.car&&cars[0]) UI.car=cars[0].id; delete UI.profiles; delete UI.profSel; save(); }
// ── sessions (.ejstudio; .ejlab still opens): gzip+base64 inside a JSON wrapper ──────────────────────
async function gzB64(str){ const b=await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(), u=new Uint8Array(b); let o='';
  for(let i=0;i<u.length;i+=0x8000) o+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(o); }
async function unGzB64(b64){ const bin=atob(b64), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
function sessionObj(){ const fps=ST.logs.map(L=>L.fp), pick=o=>{ const r={}; for(const f of fps) if(o&&o[f]!=null) r[f]=o[f]; return r; }; let tune=null;
  try{ tune=JSON.parse(localStorage.getItem('rrlab_tune_v1')||'null'); }catch(_){}
  return {app:'ejStudio',v:2,tnotes:UI.tnotes||{},names:UI.names||{},saved:new Date().toISOString(),tune,logs:ST.logs.map(L=>({name:L.name,text:L.src,fp:L.fp})),active:RP.L?RP.L.fp:null,playT:RP.playT,
    ui:JSON.parse(JSON.stringify({layout:UI.layout,panes:UI.panes,sizes:UI.sizes,g:UI.g,tt:UI.tt,m:UI.m,sc:UI.sc})),trims:pick(UI.trims),flags:pick(UI.flags),meta:pick(UI.meta),lrev:pick(UI.lrev),profile:profNow(),rev:REV,edits:edSnapshot()}; }
async function saveSession(){ if(!ST.logs.length){ toast('Nothing to save'); return; } busy(true,'Saving session',''); await sleep(30);
  try{ const txt=JSON.stringify({format:'ejstudio',v:1,gz:await gzB64(JSON.stringify(sessionObj()))}); if(txt.length>50e6) toast('Large session: '+(txt.length/1e6).toFixed(0)+' MB');
    const a=mk('a','',document.body); a.href=URL.createObjectURL(new Blob([txt],{type:'application/octet-stream'})); a.download=(RP.L?RP.L.name.replace(/\.csv$/i,''):'session')+'.ejstudio'; a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },3000); }
  catch(e){ toast('Save failed'); } busy(false); }
async function loadSession(text,name){ let o; try{ const w=JSON.parse(text); o=w.gz?JSON.parse(await unGzB64(w.gz)):w; if(o.app!=='ejStudio'&&o.app!=='ejLab') throw 0; }catch(_){ toast(name+': not an ejStudio session'); return; } await openSession(o,name); }
async function openSession(o,name){
  if((o.v||1)>=2){ if(o.tnotes) UI.tnotes=Object.assign(UI.tnotes||{},o.tnotes); if(o.names) for(const c in o.names) (UI.names=UI.names||{})[c]=Object.assign((UI.names||{})[c]||{},o.names[c]); }
  if(o.profile&&o.profile.fuelHist){ const cars=UI.cars||(UI.cars=[]), same=cars.find(c=>c.id===o.profile.id||c.name===o.profile.name); if(!same) cars.push(Object.assign({},o.profile)); UI.car=same?same.id:o.profile.id; profApply(); }
  else if(o.profile){ UI.profiles=[Object.assign({},o.profile)]; UI.profSel=o.profile.id; profMigrate(); profApply(); }
  for(const k of ['trims','flags','meta','lrev']) Object.assign(UI[k],o[k]||{});
  if(o.ui) for(const k in o.ui){ const v=o.ui[k]; if(v&&typeof v==='object'&&!Array.isArray(v)&&UI[k]&&typeof UI[k]==='object') Object.assign(UI[k],v); else UI[k]=v; }
  ST.logs.length=0; ST.queue.length=0; RP.L=null;
  if(o.rev&&o.rev.nodes&&o.rev.nodes.length){ REV=o.rev; REVP={}; const n=curNode(); window.__treeSwitch=1; await loadTuneText(n.src,n.file); window.__treeSwitch=0; revSave(); } else if(o.tune&&o.tune.text) await loadTuneText(o.tune.text,o.tune.name);
  const errs=[]; for(const g of o.logs||[]){ busy(true,'Opening session',g.name); await sleep(30); await ingest(g,false,errs); } busy(false);
  if(!ST.logs.length){ toast('Session had no readable logs'); return; }
  edRestore(o.edits); save(); ST.fixes.clear(); recompute(false); enterApp(); GV.build(); GV2.build(); selectLog(ST.logs.find(L=>L.fp===o.active)||ST.logs[0],false); if(o.playT) rpSeek(o.playT,true);
  toast(errs.length?errs.join(' · '):'Session opened · '+(name||'')); }
// ── autosave: last 5 sessions in IndexedDB, offered on the landing page ─────
const REC={db:null,last:'',
  open(){ if(this.db) return Promise.resolve(this.db); return new Promise((res,rej)=>{ try{ const r=indexedDB.open('ejlab_rec',1); r.onupgradeneeded=()=>r.result.createObjectStore('s',{keyPath:'k'}); r.onsuccess=()=>res(this.db=r.result); r.onerror=()=>rej(r.error); }catch(e){ rej(e); } }); },
  async run(mode,fn){ try{ const db=await this.open(); return await new Promise((res,rej)=>{ const t=db.transaction('s',mode), q=fn(t.objectStore('s')); t.oncomplete=()=>res(q&&q.result); t.onerror=()=>rej(t.error); }); }catch(_){ return null; } } };
async function autosave(){ if(!ST.logs.length) return; const o=sessionObj(), sig=JSON.stringify([o.logs.map(l=>l.fp),o.trims,o.flags,o.meta,o.active,o.ui,EDIT.ver,REV.cur]); if(sig===REC.last) return; REC.last=sig;
  await REC.run('readwrite',st=>st.put({k:Date.now(),o})); const ks=((await REC.run('readonly',st=>st.getAllKeys()))||[]).sort((a,b)=>b-a); for(const k of ks.slice(5)) await REC.run('readwrite',st=>st.delete(k)); }
setInterval(autosave,60000); window.addEventListener('beforeunload',()=>{ autosave(); });
async function offerRecovery(){ const a=await REC.run('readonly',st=>st.getAll()); if(!a||!a.length||ST.logs.length) return; a.sort((x,y)=>y.k-x.k); const r=a[0];
  let b=$('land-rec'); if(!b){ b=mk('button','btn',document.querySelector('.land-in')); b.id='land-rec'; b.style.marginLeft='.5rem'; }
  b.textContent='Restore last session · '+new Date(r.k).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); b.title=r.o.logs.map(l=>l.name).join('\n');
  b.onclick=async e=>{ e.stopPropagation(); b.remove(); busy(true,'Restoring session',''); await sleep(40); await openSession(r.o,'recovered'); }; }
// ── per-log session notes + weather ─────────────────────────────────────────
function metaOf(L){ return UI.meta[L.fp]||(UI.meta[L.fp]={}); }
function fileDate(n){ let m=/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[_ T-]?(\d{2})(\d{2})(\d{2})?/.exec(n); if(m) return new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
  m=/(\d{2})-(\d{2})-(\d{2})_(\d{2})(\d{2})/.exec(n); return m?new Date(2000+ +m[1],m[2]-1,+m[3],+m[4],+m[5]):null; }
const pad2=n=>String(n).padStart(2,'0'), toLocalInput=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
function logDate(L){ const m=metaOf(L); return m.date?new Date(m.date):fileDate(L.name); }
async function fetchWeather(L,quiet){ if(!L) return; const m=metaOf(L), h=UI.home; if(!h){ if(!quiet) toast('Set a home location under Display'); return; }
  const d=logDate(L); if(!d||isNaN(d)){ if(!quiet) toast('Set the log date first'); return; } const ds=`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`, age=(Date.now()-d)/864e5;
  const url=`${age>7?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast'}?latitude=${h.lat}&longitude=${h.lon}&start_date=${ds}&end_date=${ds}&hourly=temperature_2m,relative_humidity_2m,surface_pressure&timezone=auto`;
  try{ const r=await fetch(url); if(!r.ok) throw 0; const H=(await r.json()).hourly, k=Math.min(H.time.length-1,d.getHours()); if(H.temperature_2m[k]==null) throw 0;
    m.wx={t:H.temperature_2m[k],rh:H.relative_humidity_2m[k],p:+(H.surface_pressure[k]/10).toFixed(1),at:H.time[k]};
    if(m.ambient==null||m.ambient==='') m.ambient=m.wx.t; if(m.hum==null||m.hum==='') m.hum=m.wx.rh; if((m.baro==null||m.baro==='')&&!L.c.baro) m.baro=m.wx.p;
    save(); drawerRefresh(); if(!quiet) toast('Weather loaded'); }
  catch(_){ m.wx={na:1}; save(); drawerRefresh(); if(!quiet) toast('Weather unavailable'); } }
function autoWx(L){ if(UI.home&&!metaOf(L).wx&&logDate(L)) fetchWeather(L,true); }
async function geoHome(v){ v=String(v).trim(); if(!v){ UI.home=null; save(); drawerRefresh(); return; }
  try{ const j=await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name='+encodeURIComponent(v.split(',')[0]))).json(), g=j.results&&j.results[0]; if(!g) throw 0;
    UI.home={name:[g.name,g.admin1,g.country_code].filter(Boolean).join(', '),lat:g.latitude,lon:g.longitude}; save(); drawerRefresh(); toast('Home: '+UI.home.name); if(RP.L) autoWx(RP.L); }
  catch(_){ toast('Location not found or offline'); } }
function metaHtml(L){ const m=metaOf(L), fd=fileDate(L.name), d=m.date||(fd?toLocalInput(fd):''), lb=L.c.baro?median(Array.from(L.c.baro).filter(Number.isFinite)):null, w=m.wx&&!m.wx.na?m.wx:null;
  const inp=(k,l,t,ph,u)=>`<label class="drow"><span>${l}</span><input class="num" style="width:${t==='text'?160:90}px;text-align:${t==='text'?'left':'right'}" type="${t}" step="any" data-meta="${k}" value="${esc(m[k]??'')}" placeholder="${esc(ph??'')}"><em>${u||''}</em></label>`;
  return `<label class="drow" title="${fd?'From the file name':'Not found in the file name'}"><span>Logged</span><input class="num" style="width:190px;text-align:left" type="datetime-local" data-meta="date" value="${esc(d)}"></label>`
   +`<label class="drow"><span>Ambient</span><input class="num" style="width:90px" type="number" step="any" data-meta="ambient" value="${m.ambient===''||m.ambient==null?'':UI.tu==='F'?+(m.ambient*1.8+32).toFixed(1):m.ambient}" placeholder="${w?(UI.tu==='F'?+(w.t*1.8+32).toFixed(1):w.t):''}"><em>°${UI.tu}</em></label>`+inp('baro','Baro','number',lb!=null?lb.toFixed(1)+' (log)':w?w.p:'','kPa')+inp('hum','Humidity','number',w?w.rh:'','%')
   +inp('notes','Notes','text','')
   +(m.custom||[]).map((c,k)=>`<div class="drow"><input class="num" style="width:110px;text-align:left" data-cf="${k}" data-part="k" value="${esc(c.k)}" placeholder="Field"><input class="num" style="width:130px;text-align:left" data-cf="${k}" data-part="v" value="${esc(c.v)}" placeholder="Value"><button class="lx" data-cfdel="${k}" title="Remove field">×</button></div>`).join('')
   +`<div class="drow"><button class="btn sm" data-act="cfadd">Add field</button><button class="btn sm" data-act="wx" title="${UI.home?'Hourly weather at '+esc(UI.home.name)+' for the log time':'Set a home location under Display'}">Fetch weather</button>${m.wx&&m.wx.na?'<span class="dim">weather unavailable</span>':w?`<span class="dim" title="Open-Meteo, ${esc(w.at)}">${w.t} °C · ${w.rh} %</span>`:''}</div>`; }
// ── two-log compare (overlay): log B with its own scrubber, optional link ────
function logC(k){ return (UI.logCol&&UI.logCol[k])||({a:'#e4aa28',b:'#5ad1e6'})[k]; }
function rpIdxL(L,t){ const T=L.t; if(!L.N) return 0; if(t<=T[0]) return 0; let lo=0,hi=L.N-1; if(t>=T[hi]) return hi; while(hi-lo>1){ const m=(lo+hi)>>1; if(T[m]<=t) lo=m; else hi=m; } return lo; }
function setB(t){ const B=RP.B; if(!B) return; RP.bT=Math.max(0,Math.min(B.dur,t)); RP.bI=rpIdxL(B,RP.bT); if(UI.link) RP.bOff=RP.bT-RP.playT; RP.dirty=true; }
function setCompare(L){ if(!L||L===RP.L) RP.B=null; else { RP.B=L; RP.bT=Math.min(RP.playT,L.dur); RP.bI=rpIdxL(L,RP.bT); RP.bOff=RP.bT-RP.playT; }
  RP.tlbK=null; RP.bIp=-1; if(RP.B) TVb.setTune(); cmpUI(); RP.dirty=true; drawerRefresh(); if(RP.B) toast('Comparing with '+RP.B.name); }
function toggleLink(){ if(!RP.B) return; UI.link=!UI.link; RP.bOff=RP.bT-RP.playT; save(); cmpUI(); toast(UI.link?'Scrubbers linked':'Scrubbers unlinked'); }
function swapAB(){ const a=RP.L, b=RP.B, ta=RP.playT, tb=RP.bT; if(!a||!b) return; rpPlay(false); RP.B=null; selectLog(b,false); rpSeek(tb,true); RP.B=a; RP.bT=ta; RP.bI=rpIdxL(a,ta); RP.bOff=RP.bT-RP.playT; RP.tlbK=null; RP.bIp=-1; TVb.setTune(); cmpUI(); drawerRefresh(); }
function cmpUI(){ const B=RP.B, L=RP.L, bar=$('bbar'), ch=$('cmpchips'); if(!bar) return; bar.classList.toggle('hidden',!B);
  ch.innerHTML=B&&L?`<span class="chip ro" style="color:${logC('a')};border-color:${logC('a')}" title="${esc(L.name)}">A · ${esc(L.name)}</span><span class="chip ro" style="color:${logC('b')};border-color:${logC('b')}" title="${esc(B.name)}">B · ${esc(B.name)}</span>`:'';
  if(B){ const n=$('b-name'); n.textContent='B · '+B.name; n.style.color=logC('b'); n.title=B.name; $('b-link').classList.toggle('on',!!UI.link); GVb.fill(); } syncTabs(); RP.dirty=true; }
function drawTLB(){ const cv=$('tlb'), z=sizeCanvas(cv), B=RP.B; if(!z||!B) return; const {c,W,H}=z, key=W+'x'+H+B.fp+logC('b');
  if(RP.tlbK!==key){ RP.tlbK=key; const dpr=devicePixelRatio||1, oc=document.createElement('canvas'); oc.width=W*dpr; oc.height=H*dpr; const o=oc.getContext('2d'); o.scale(dpr,dpr); o.fillStyle='#0b0b0e'; o.fillRect(0,0,W,H);
    const A=B.c.rpm||B.c.load; if(A&&B.dur){ let lo=Infinity,hi=-Infinity; for(const v of A) if(Number.isFinite(v)){ if(v<lo) lo=v; if(v>hi) hi=v; }
      const mn=new Array(Math.ceil(W)).fill(Infinity), mx=new Array(Math.ceil(W)).fill(-Infinity);
      for(let i=0;i<B.N;i++){ const v=A[i]; if(!Number.isFinite(v)) continue; const p=Math.min(mn.length-1,Math.floor(B.t[i]/B.dur*W)); if(v<mn[p]) mn[p]=v; if(v>mx[p]) mx[p]=v; }
      o.globalAlpha=.55; o.fillStyle=logC('b'); const Y=v=>H-3-(v-lo)/((hi-lo)||1)*(H-6); for(let p=0;p<mn.length;p++){ if(mn[p]===Infinity) continue; o.fillRect(p,Y(mx[p]),1,Math.max(1,Y(mn[p])-Y(mx[p]))); } }
    RP.tlbC=oc; }
  c.drawImage(RP.tlbC,0,0,W,H); if(B.dur){ c.fillStyle='#fff'; c.fillRect(RP.bT/B.dur*W-1,0,2,H); } const e=$('b-time'), s=fmtT(RP.bT)+' / '+fmtT(B.dur); if(e.textContent!==s) e.textContent=s; }
// ── pop-outs + export ───────────────────────────────────────────────────────
const POP={};
function popOut(k){ if(POP[k]){ POP[k].focus(); return; } const p=(UI.popPos||{})[k]||{}, f=`width=${p.w||1100},height=${p.h||700}`+(p.x!=null?`,left=${p.x},top=${p.y}`:'');
  const w=window.open('','ejpop_'+k,f); if(!w){ toast('Pop-out blocked'); return; }
  const d=w.document; d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><title>ejStudio · ${VIEW_NAMES[k]}</title></head><body></body></html>`); d.close();
  d.head.appendChild(d.importNode(document.querySelector('style'),true)); d.body.style.cssText='display:flex;flex-direction:column;height:100vh;margin:0;background:#000';
  POP[k]=w; const n=paneCount(), j=UI.panes.slice(0,n).indexOf(k); if(j>=0){ const alt=VIEW_ORDER.find(v=>!POP[v]&&!UI.panes.slice(0,n).includes(v)); if(alt) UI.panes[j]=alt; }
  const el=VIEWS[k].el; buildStage(); d.body.appendChild(d.adoptNode(el)); VIEWS[k].show(true);
  d.addEventListener('keydown',e=>{ const tg=e.target; if(tg&&/^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName)) return; if(EDIT.on&&EDITOR.key(e)) return; const a=keyAction(e); if(a){ e.preventDefault(); runAction(a); } });
  w.addEventListener('resize',()=>{ VIEWS[k].resize(); RP.dirty=true; });
  w.addEventListener('beforeunload',()=>{ (UI.popPos=UI.popPos||{})[k]={x:w.screenX,y:w.screenY,w:w.innerWidth,h:w.innerHeight}; save(); });
  let chk=0; const back=()=>{ if(!POP[k]) return; clearInterval(chk); delete POP[k]; try{ hold.appendChild(document.adoptNode(el)); }catch(e){ elog('pop back '+(e&&e.stack||e)); } buildStage();
    setTimeout(()=>{ VIEWS[k].show(UI.panes.slice(0,paneCount()).includes(k)); VIEWS[k].resize(); if(k==='table') TV.edRefresh(); if(k==='table_b'&&typeof TVb!=='undefined') TVb.edRefresh(); RP.dirty=true; },30); };
  w.addEventListener('pagehide',back); w.addEventListener('beforeunload',()=>setTimeout(back,0)); chk=setInterval(()=>{ if(w.closed) back(); },400);
  setTimeout(()=>{ VIEWS[k].resize(); RP.dirty=true; },60); }
window.addEventListener('beforeunload',()=>{ for(const k in POP) try{ POP[k].close(); }catch(_){} });
function dl(blob,name){ const a=mk('a','',document.body); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },3000); }
function exportCSV(){ const L=RP.L; if(!L) return; const sp=trimSpan(L), out=[L.headers.join(',')]; for(let i=sp.lo;i<=sp.hi;i++) out.push(L.rows[i].join(','));
  dl(new Blob([out.join('\r\n')],{type:'text/csv'}),L.name.replace(/\.csv$/i,'')+(trimOf(L)?'_trim':'')+'.csv'); }
function exportPNG(){ const k=UI.panes[UI.focus]; if(!k||POP[k]){ toast('Focus a pane in the main window first'); return; } const el=VIEWS[k].el, r=el.getBoundingClientRect();
  const name=`${RP.L?RP.L.name.replace(/\.csv$/i,''):'ejstudio'}_${k}_${fmtT(RP.playT).replace(/[:.]/g,'-')}.png`;
  if(window.rrlab&&window.rrlab.capture){ window.rrlab.capture({x:r.left,y:r.top,w:r.width,h:r.height,name}).then(p=>{ if(p) toast('Saved '+String(p).split(/[\\/]/).pop()); },()=>toast('Export failed')); return; }
  const dpr=devicePixelRatio||1, c=document.createElement('canvas'); c.width=r.width*dpr; c.height=r.height*dpr; const g=c.getContext('2d'); g.fillStyle='#000'; g.fillRect(0,0,c.width,c.height);
  el.querySelectorAll('canvas').forEach(cv=>{ const q=cv.getBoundingClientRect(); if(q.width&&q.height) g.drawImage(cv,(q.left-r.left)*dpr,(q.top-r.top)*dpr,q.width*dpr,q.height*dpr); }); c.toBlob(b=>dl(b,name)); }
let INFO=null;
function pooled(L){ return UI.pool[L.fp]!==false; }
function openEditorOnly(){ enterApp(); if(UI.panes[UI.focus]!=='table') setPaneView(UI.focus,'table'); if(window.EDITOR) EDITOR.on(true); }
function modal(title,html,btns){ return new Promise(res=>{ const d=mk('div','',document.body); d.id='mapdlg';
  d.innerHTML=`<div class="md-card mdl" style="width:min(640px,100%)"><div class="md-h"><b>${esc(title)}</b></div><div style="padding:.4rem 1.1rem .8rem;overflow:auto;display:flex;flex-direction:column;gap:.55rem">${html}</div><div class="md-f">${btns.map(([v,l,c],i)=>(i===1?'<span class="vfill"></span>':'')+`<button class="btn ${c||''}" data-m="${v}">${l}</button>`).join('')}</div></div>`;
  const done=v=>{ document.removeEventListener('keydown',kd,true); const vals={}; d.querySelectorAll('[data-f]').forEach(i=>vals[i.dataset.f]=i.type==='checkbox'?i.checked:i.value); d.remove(); res({v,vals}); };
  const kd=e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(null); } }; document.addEventListener('keydown',kd,true);
  d.onclick=e=>{ const b=e.target.closest('[data-m]'); if(b) done(b.dataset.m); }; d.onchange=d.oninput=()=>{ if(d._upd) d._upd(d); }; res.d=d; MODAL=d; }); }
let MODAL=null;
const CHANGES=["<b>MAF Tools</b>: Both is side by side; Scaling shows volts, now and new g/s, multiplier, change, samples and source under clear zone bands", "One-axis tables graph like EcuFlash: axis across, value up", "<b>Warn limits</b> per profile, with on/off per gauge; Parameters → <b>Links</b>; 16 profile glyphs with a picker", "Wideband smoothing on the wideband lane; Fuel &amp; octane shows what it needs logged", "Graph: wideband listed under Logged; Scatter toolbar matches Graph", "USB stick detection only in car mode; MerpMod parameters removed", "MAF Scaling: larger type, the reason for each check written in the row, sticky column header", "Fixes: car profiles and other settings now survive restarts; installer finish page checkbox readable; MAF Tools markers, drawer title, error indicator moved to About and Bug report"];
const OLDER=[['3.1.0',["<b>Wideband lag</b> measured from each car's logs (fuel-cut and tip-in edges, cross-checked against whole-log correlation) and kept on the car unless locked", "<b>One set of warn limits</b> shared by the cluster and the analysis", "<b>Bug reports</b> open a filled-in GitHub issue page", "Sessions save as <b>.ejstudio</b>; .ejlab sessions still open", "<b>Tidier layout</b>: Scatter is a mode in Graph; MAF filters, pull detection, diagnostics and replay settings sit next to their features; <b>Revisions ▾</b> holds the tuning tree; log B draws over the normal views; Helpers opens with H", "Phone panel: sideways gives a full-screen cluster; the toolbar wraps instead of running off the edge", "Old logs zip themselves after 30 days (Config → Logs)", "Update checks run on the laptop only; the car PC updates from the USB stick", "<b>Seven preset profiles</b>: Daily, Timing, Fuel-CL, Fuel-OL, Boost, AVCS and Idle, each with its own cluster built around hero tiles. Existing installs get them added once, next to your own profiles", "<b>Designer → Size</b>: make any tile Wide, Tall, Hero or Banner", "<b>USB stick</b>: plug in any stick (or lock it to one label in Config) to copy new logs, load the newest .tune on it and install a newer ejStudio-Setup from it. Big touch tiles in car mode, a dialog on the laptop", "Updates install for the current user only, so they need no admin prompt", "<b>Trouble codes</b>: a Codes tab reads current and stored codes on connect and on Scan; in car mode they open from the Dock with a count on the button", "<b>Reset ECU</b> in the Codes tab, unlocked with the ignition on and the engine off; the bytes sent and received are logged", "<b>Car profiles</b>: several cars with their engine, parts, drivetrain, wideband lag and fuel history; sessions are kept per car; switch on the start screen or in the drawer. Vehicle profiles move over on their own", "<b>Helpers</b> in Tables edit mode: Knock timing, MAF scaling, Fuel &amp; octane, Boost control and Injectors in one rail, with every change previewed on the table before Apply. Added timing after a move to better fuel is off until you tick it", "Fixed: in car mode, the default profile no longer switches before the ECU's parameters are known (it used to drop every parameter but the wideband)"]],['3.0.8',["<b>Logger definitions built in</b>: ejLogger connects without choosing a definition file first. You can still pick another one under Connect ▾", "<b>Cleaner cluster import</b>: importing a ClusterConfig folder now brings over only the files ejLogger uses and your logger profiles, lists everything it left out, and backs up your current cluster files first", "<b>Config → System → Tidy cluster files</b> moves leftover files ejLogger doesn't use into an _unused folder. Nothing is deleted"]],['3.0.7',["<b>New start screen</b>: pick a tune and the logs to replay on it, with the latest ejLogger logs listed and ready to tick", "<b>Pick up where you left off</b>: the last sessions, each with its tune, logs and a one-line knock result, reopen in one click", "Earlier revisions of the loaded tune are one click away on the tune card", "ejLogger status and the last log time are shown on the start screen", "Logs dropped or browsed on the start screen wait in the list until you open the session", "The analysing screen is now a solid panel with a progress bar, no longer see-through over the tables", "No more animated background behind the start screen"]],['3.0.6',['<b>Phone panel</b>: open <b>ejlogger.local</b> on a phone on the same Wi-Fi. <b>Tuner</b> is the full ejLogger in a phone layout behind a 4-digit passcode (shown and changed in Config → Phone panel; a phone stays unlocked for 30 days). <b>Live view</b> is for passengers, no passcode', 'The phone mirrors the car’s cluster exactly, with the same themes, Dock and fonts. Tap any tile for its live graph with warn lines and knock marks', 'Passenger strip shows the profile and the REC timer, with Reset peaks; the phone screen stays on', 'Changes made on a phone show up on the car straight away, and the other way round', '<b>Parameters → PIDs</b>: All / Selected / Unselected filter and a VARIANT badge where another byte-size exists. <b>Save</b> writes the profile as standard profile XML', '<b>Parameters → Profiles</b>: order, glyph, show in picker, screensaver, default profile, switch, rename, duplicate, delete and per-profile warn limits', '<b>Parameters → Labels</b>: cluster titles and units per parameter', '<b>Linked PIDs</b>: a 1-, 2- or 4-byte variant takes over the original tile, title and warn limits; unlink in Config → System', '<b>Config → System</b>: Health (roles, true rate, last data, recording, free space, recent errors), Restart, Back up config and Skip auto-record for this drive', 'Warn limits can be set for all profiles or for one profile','Each install gets its own random phone passcode, shown in Config → Phone panel','<b>Scatter Plot</b> is the new name for the Scatter tab','Fixed: Esc now leaves the full-screen cluster in car mode','Fixed: the REC timer is right when ejStudio or a phone opens mid-recording','Fixed: the landing screen and menu showed the old name','The duplicate status text beside the full-screen button is gone']]];
function whatsNew(){ modal(`What's new in ejStudio ${APP_VER}`,`<ul>${CHANGES.map(c=>`<li>${c}</li>`).join('')}</ul>`+(OLDER.length?`<details class="wn-old"><summary>Older</summary>${OLDER.map(([v,l])=>`<div class="vlab">${v}</div><ul>${l.map(c=>`<li>${c}</li>`).join('')}</ul>`).join('')}</details>`:''),[['ok','Close','acc']]); }
function aboutHtml(){ const i=INFO||{}; return `<div class="kv"><span>Version</span><b>${APP_VER}</b><span>Built</span><b>${BUILD_DATE}</b>${i.electron?`<span>Electron</span><b>${esc(i.electron)}</b><span>Chromium</span><b>${esc(i.chrome)}</b>`:''}</div>`
  +`<div class="note">ejStudio grew out of tooling built around <b>RomRaider</b> (romraider.com) and <b>Project Lambda</b> (lambdatuning.com). Weather data by <b>Open-Meteo.com</b>, CC BY 4.0.</div>`
  +`<div class="note">Private build for personal use. Not for sale or redistribution.</div><div class="drow"><button class="btn sm" data-act="news">What's new</button>${i.userData?'<button class="btn sm" data-act="odata">Open data folder</button>':''}</div>`; }
function updHtml(){ const u=UI.upd;
  return `<div class="note">${u&&u.newer?`Update available: <b>${esc(u.tag)}</b>`:'Checks for updates at launch'}</div>`
   +`<div class="drow"><button class="btn sm" data-act="updchk">Check for updates</button>${u&&u.newer?'<button class="btn sm acc" data-act="updopen">Open download page</button>':''}<button class="btn sm" data-act="bug">Bug report${ERRS.length?'<i class="errdot"></i>':''}</button>${window.rrlab&&window.rrlab.openReports?'<button class="btn sm" data-act="reps">Reports folder</button>':''}</div>`; }
const GH_REPO='lupeloop/ejStudio';
const semv=v=>String(v).replace(/^v/i,'').split('.').map(n=>parseInt(n)||0), newer=(a,b)=>{ const x=semv(a), y=semv(b); for(let i=0;i<3;i++){ if((x[i]||0)!==(y[i]||0)) return (x[i]||0)>(y[i]||0); } return false; };
async function checkUpdates(manual){
  try{ const r=await fetch(`https://api.github.com/repos/${GH_REPO}/releases/latest`,{headers:{Accept:'application/vnd.github+json'}}); if(!r.ok) throw r.status; const j=await r.json();
    UI.upd={tag:j.tag_name,url:j.html_url,newer:newer(j.tag_name,APP_VER)}; save(); drawerRefresh(); if(UI.upd.newer) toast('Update available: '+j.tag_name); else if(manual) toast('ejStudio is up to date'); }
  catch(e){ elog('update check failed '+e); if(manual) toast('Update check failed'); } }
async function gzBlob(str){ return new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); }
const b64=async blob=>{ const b=new Uint8Array(await blob.arrayBuffer()); let o=''; for(let k=0;k<b.length;k+=0x8000) o+=String.fromCharCode.apply(null,b.subarray(k,k+0x8000)); return btoa(o); };
async function bugReport(){ const L=RP.L, i=INFO||{}, R=window.rrlab; let log=''; try{ log=R&&R.readLog?await R.readLog():''; }catch(_){} log=log||ERRS.join('\n')||'(no errors logged)';
  const on=!!(R&&R.openUrl);
  const sys=`ejStudio ${APP_VER} (built ${BUILD_DATE}) · Electron ${i.electron||'—'} · Chromium ${i.chrome||'—'} · ${navigator.userAgent}`, ch=L?L.name+': '+L.headers.join(', '):'(no log loaded)';
  const p=modal('Bug report',`<input class="tt-q" style="margin:0" data-f="who" placeholder="Your name / contact" value="${esc(UI.bugWho||'')}"><textarea class="axis" style="height:90px" data-f="desc" placeholder="What happened, and what were you doing?"></textarea>`
    +`<label class="drow"><input type="checkbox" data-f="sys" checked><span>System and session info</span></label><label class="drow"><input type="checkbox" data-f="log" checked><span>Error log (last 5 days)</span></label><label class="drow"><input type="checkbox" data-f="ch" checked><span>Channel list of the current log</span></label>${L?'<label class="drow"><input type="checkbox" data-f="csv"><span>Attach the current log CSV</span></label>':''}`
    +`<div class="vlab">Will be sent</div><pre data-prev></pre>`,[['x','Cancel','ghost'],['file','Save to file',''],...(on?[['send','Open issue','acc']]:[])]);
  const body=(v,f)=>[`Reported by: ${v.who||'—'}`,'',v.desc||'(no description)',...(v.sys?['','## System',sys,...(reportText()?['','## Session','```',reportText(),'```']:[])]:[]),...(v.ch?['','## Channels',ch]:[]),...(v.log?['','## Error log','```',log.slice(-60000),'```']:[]),...(v.csv&&L?['',`Log CSV saved on the reporter's PC: reports\\${f||'<file>.csv.gz'}`]:[])].join('\n');
  const d=MODAL; d._upd=x=>{ const v={}; x.querySelectorAll('[data-f]').forEach(e=>v[e.dataset.f]=e.type==='checkbox'?e.checked:e.value); x.querySelector('[data-prev]').textContent=body(v); }; d._upd(d);
  const {v,vals}=await p; if(!v||v==='x') return; UI.bugWho=vals.who; save(); const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  let fname='', saved=false; if(vals.csv&&L){ fname=`ejstudio_bug_${stamp}_${L.name.replace(/[^\w.-]/g,'_')}.gz`; const gz=await gzBlob(L.src);
    if(R&&R.saveReport){ try{ saved=!!(await R.saveReport(fname,await b64(gz))); }catch(e){ elog('report save failed '+e); } } if(!saved){ dl(gz,fname); saved=true; } }
  const txt=body(vals,fname);
  if(v==='file'){ dl(new Blob([txt],{type:'text/plain'}),`ejstudio_bug_${stamp}.txt`); if(fname&&R&&R.openReports) R.openReports(fname); return; }
  const title=`[${APP_VER}] ${(vals.desc||'Bug report').split('\n')[0].slice(0,80)}`, cut=txt.length>6000, bodyU=cut?txt.slice(0,6000)+'\n\n(truncated: paste the full report from the clipboard)':txt;
  try{ if(cut&&R.copy) await R.copy(txt); R.openUrl(`https://github.com/${GH_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(bodyU)}`); toast(cut?'Full report copied to the clipboard':'Issue page opened'); if(fname&&R.openReports) R.openReports(fname); }
  catch(e){ elog('bug report failed '+e); dl(new Blob([txt],{type:'text/plain'}),`ejstudio_bug_${stamp}.txt`); } }
// ── plain-text session report ──
function reportText(){ if(!ST.logs.length&&!TUNE) return '';
  const o=[], H=t=>o.push('',t.toUpperCase(),'-'.repeat(t.length)), pad=(x,n)=>String(x).padEnd(n), P=profNow();
  o.push('ejStudio session report',`${new Date().toLocaleString()} · ejStudio ${APP_VER}`);
  H('Tune'); if(TUNE){ o.push(`File   ${TUNE.name}`,`CAL    ${TUNE.cal} · ROM ${TUNE.rom}`); if(window.__tuneInfo) o.push(...window.__tuneInfo()); } else o.push('(none)');
  H('Vehicle'); if(P) for(const [k,l] of PROF_FIELDS){ if(P[k]!==''&&P[k]!=null) o.push(pad(l,24)+P[k]); } else o.push('(none)');
  for(const L of ST.logs){ H('Log · '+L.name); const m=UI.meta[L.fp]||{}, dt=logDate(L);
    o.push(`Logged      ${dt&&!isNaN(dt)?dt.toLocaleString():'—'}`,`Frames      ${L.N.toLocaleString()} · ${fmtT(L.dur)}`+(trimOf(L)?' · trimmed':'')+(pooled(L)?'':' · not pooled'));
    if(window.__logRev) o.push('Recorded on '+window.__logRev(L));
    for(const [k,l,u] of [['ambient','Ambient','°C'],['baro','Baro','kPa'],['hum','Humidity','%'],['notes','Notes','']]) if(m[k]!==''&&m[k]!=null) o.push(pad(l,12)+m[k]+(u?' '+u:''));
    for(const c of m.custom||[]) if(c.k) o.push(pad(c.k,12)+c.v);
    const C=L.c, pl=(L.pulls||[]).filter(p=>inTrim(L,p.t));
    o.push('','Pulls'); if(!pl.length) o.push('  none');
    else { o.push('  #  Gear  RPM            Time    Peak boost  Worst FBKC  AFR @ peak');
      pl.forEach((p,k)=>{ let pb=null, wk=0, pi=p.i0; for(let j=p.i0;j<=p.i1;j++){ if(C.map){ const b=(C.map[j]-(C.baro&&Number.isFinite(C.baro[j])?C.baro[j]:ATM))*0.1450377; if(pb==null||b>pb) pb=b; } if(C.fbkc&&C.fbkc[j]<wk) wk=C.fbkc[j]; if(C.rpm[j]>C.rpm[pi]) pi=j; }
        const afr=C.wb?L.wb[pi]*LAM:NaN; o.push(`  ${pad(k+1,3)}${pad(p.gear?ORD(p.gear):'—',6)}${pad(p.r0+'–'+p.r1,15)}${pad(((p.t1-p.t)/1000).toFixed(1)+' s',8)}${pad(pb!=null?pb.toFixed(1)+' psi':'—',12)}${pad(C.fbkc?wk.toFixed(2)+'°':'—',12)}${Number.isFinite(afr)?afr.toFixed(2):'—'}`); }); }
    const ks=knockSummary(L); o.push('','Knock'); let any=false;
    for(const k of ['fbkc','flkc','kca']) if(ks[k]){ any=true; o.push(`  ${pad(ks[k].label,6)}worst ${ks[k].worst.toFixed(2)}° · ${ks[k].cnt} rows · ${ks[k].iso} isolated / ${ks[k].sus} sustained`); }
    if(ks.iam){ any=true; o.push(`  IAM   min ${ks.iam.min.toFixed(2)} · ${ks.iam.status}`); } if(!any) o.push('  no knock channels');
    const ev=L.events.concat(warnCrossings(L),userFlags(L)).filter(e=>inTrim(L,e.t)&&diagShown(e)&&!['Open loop','WOT pull','Max load','Pull'].includes(e.kind)).map(e=>Object.assign({},e,{sev:e.sev||sevOf(e)})).sort((a,b)=>a.t-b.t);
    for(const [sv,l] of [['crit','Critical'],['warn','Warnings'],['info','Info']]){ const g=ev.filter(e=>e.sev===sv); if(!g.length) continue; o.push('',`${l} (${g.length})`); for(const e of g.slice(0,60)) o.push(`  ${pad(fmtT(e.t),8)}${e.kind}: ${e.label}`); if(g.length>60) o.push(`  … ${g.length-60} more`); } }
  H('MAF scaling'); const B=ST.bins, R=ST.row;
  if(B&&R&&TUNE&&TUNE.mafScale){ const pl=ST.logs.filter(pooled); o.push(`Pooled logs ${pl.length}: ${pl.map(L=>L.name).join(', ')}`,`Bins with data ${B.filter(b=>b.n).length} / ${B.length}`,'','  V       n      ×        g/s now   g/s new');
    B.forEach((b,i)=>{ if(!b.n||Math.abs(R.f[i]-1)<0.0005) return; o.push(`  ${pad(b.v.toFixed(3),8)}${pad(b.n.toFixed(0),7)}${pad(R.f[i].toFixed(4),9)}${pad(TUNE.mafScale[i].toFixed(2),10)}${R.nv[i].toFixed(2)}`); }); }
  else o.push('No MAF scaling result');
  H('Tune changes'); o.push(...(window.__tuneChanges?window.__tuneChanges():['No tune edits this session']));
  return o.join('\n'); }

document.addEventListener('keydown',e=>{ const t=e.target; if((e.key==='Enter'||e.key===' ')&&t&&t.getAttribute&&t.getAttribute('role')==='button'&&t.tagName!=='BUTTON'){ e.preventDefault(); t.click(); } });

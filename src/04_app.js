// ════════════════════════════════════════════════════════════════════════════
//  ejStudio app — shell, panes, transport, timeline, drawer, landing, persistence
// ════════════════════════════════════════════════════════════════════════════
const APP_VER='3.0.5', BUILD_DATE='2026-11-06';
const ERRS=[]; function elog(m){ const x=new Date().toISOString()+' '+m; ERRS.push(x); if(ERRS.length>300) ERRS.shift(); try{ if(window.rrlab&&window.rrlab.log) window.rrlab.log(x); }catch(_){} }
window.addEventListener('error',e=>elog('ERROR '+(e.message||'')+' @ line '+(e.lineno||'?')+'\n'+((e.error&&e.error.stack)||'')));
window.addEventListener('unhandledrejection',e=>elog('REJECTED '+((e.reason&&(e.reason.stack||e.reason.message))||e.reason)));
const UI_DEF={layout:'1',sizes:{h:0.5,v:0.5,l:0.62,r:0.5},panes:['table','graph','maf_table'],focus:0,presets:[null,null,null,null],
  sync:{graph:true,table:true,maf_curve:true,maf_table:true},speed:1,wbDisp:'lambda',ffbDisp:'lambda',pu:'psi',tau:500,drawerPin:false,tu:'C',
  g:{n:3,win:30000,mode:'right',lanes:['','','','',''],ymode:{},yfix:{}},
  tt:{grp:'timing',sel:{},opt:{mark:'glow',val:1,name:1,kmL:1,kmH:0,vvt:'off',km:60,fol:0,kch:'fbkc',ks:1,kw:1},rail:1,rc:{}},
  m:{src:'all',mode:'curve',scatter:false},trims:{},flags:{},keys:{},sc:{x:'',y:'',c:'',fit:'lin',ov:''},sevCol:{},profiles:[],profSel:null,diagOn:{},meta:{},home:null,logCol:{},link:false,pool:{},lrev:{},rails:{},dtab:'session',dq:'',seenVer:null,upd:null,cfg:{},limits:{},axis:null,fp:null,playT:0,open:{}};
const UI=(()=>{ const d=JSON.parse(JSON.stringify(UI_DEF)); try{ const s=JSON.parse(localStorage.getItem('rrlab_ui_v1')||'null');
  if(s) for(const k in d){ if(s[k]==null) continue; if(typeof d[k]==='object'&&!Array.isArray(d[k])&&d[k]) d[k]=Object.assign(d[k],s[k]); else d[k]=s[k]; } }catch(_){ try{ localStorage.setItem('rrlab_ui_bad',localStorage.getItem('rrlab_ui_v1')||''); localStorage.removeItem('rrlab_ui_v1'); window.__quar=1; }catch(e){} }
  if(d.tt.opt) d.tt.opt=Object.assign({},UI_DEF.tt.opt,d.tt.opt); if(d.g) d.g=Object.assign({},UI_DEF.g,d.g); return d; })();
if(UI.layout==='2v') UI.layout='2h'; (UI.presets||[]).forEach(p=>{ if(p&&p.layout==='2v') p.layout='2h'; });
Object.assign(CFG,UI.cfg); CFG.olAfl=UI.cfg.olAfl!=null?UI.cfg.olAfl:true; let ULIM=UI.limits||{}; if(!UI.pu) UI.pu='psi'; if(UI.tt&&UI.tt.opt&&UI.tt.opt.kw==null) UI.tt.opt.kw=1;
// effective warning limits = tune limits (in this log's units) overridden slot-by-slot by the user's own
let TLIM={}; function mergeLimits(){ TLIM=tuneLimits(typeof RP!=='undefined'?RP.L:null); const out={};
  for(const f of new Set([...Object.keys(TLIM),...Object.keys(ULIM)])){ const t=TLIM[f]||{}, u=ULIM[f]||{}, o={};
    for(const s of ['lo','hi']){ o[s]=[0,1,2].map(k=>{ const uv=u[s]&&u[s][k], tv=t[s]&&t[s][k]; return Number.isFinite(uv)?uv:Number.isFinite(tv)?tv:null; }); }
    if(o.lo.concat(o.hi).some(Number.isFinite)) out[f]=o; }
  LIMITS=out; }
LIMITS=JSON.parse(JSON.stringify(ULIM));
let saveT=0; function save(){ clearTimeout(saveT); saveT=setTimeout(()=>{ UI.limits=ULIM; try{ localStorage.setItem('rrlab_ui_v1',JSON.stringify(UI)); }catch(_){} },300); }
const VIEW_NAMES={maf_both:'MAF Tools · Both',graph:'Graph',table:'Tables',maf_table:'MAF Tools · Scaling',maf_curve:'MAF Tools · Curve',scatter:'Scatter',graph_b:'Graph · B',table_b:'Tables · B'}, VIEW_ORDER=['table','graph','maf_table','maf_curve','maf_both','scatter','graph_b','table_b'], TAB_ORDER=['table','graph','maf','scatter','graph_b','table_b'];
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
let GV,TV,MT,MV,SV,GVb,TVb,VIEWS;
function makeViews(){ GV=GraphView(); TV=TableView(); MT=MafTableView(); MV=MafCurveView(); SV=ScatterView(); GVb=GraphView('b'); TVb=TableView('b'); VIEWS={graph:GV,table:TV,maf_table:MT,maf_curve:MV,scatter:SV,graph_b:GVb,table_b:TVb}; MB=MafBothView(); VIEWS.maf_both=MB; }
// MAF Tools: one tab; each pane picks Scaling, Curve or Both. Both borrows the two views and merges their toolbars.
const MAFV=['maf_table','maf_curve','maf_both'], mafClash=(a,b)=>a===b||(a==='maf_both'&&(b==='maf_table'||b==='maf_curve'))||(b==='maf_both'&&(a==='maf_table'||a==='maf_curve'));
let MB=null, MBAR=null;
function mafMode(v){ UI.mafLast=v; const n=paneCount(), cur=UI.panes.slice(0,n).findIndex(x=>MAFV.includes(x)); setPaneView(cur>=0?cur:UI.focus,v); }
function mafToggle(bar){ const s=seg(bar,[['maf_table','Scaling'],['maf_curve','Curve'],['maf_both','Both']],'',v=>{ const n=paneCount(), own=bar.closest('.view'), j=UI.panes.slice(0,n).findIndex(x=>VIEWS[x]&&VIEWS[x].el===own); UI.mafLast=v; setPaneView(j>=0?j:UI.focus,v); }); s.classList.add('mtog'); bar.prepend(s); return s; }
function MafBothView(){ const root=mk('div','view mb'), bar=mk('div','vbar',root), top=mk('div','mb-a',root), dv=mk('div','mb-d',root), bot=mk('div','mb-b',root);
  const gT=MT.el.querySelector('.vbar'), gV=MV.el.querySelector('.vbar'), iT=[...gT.children], iV=[...gV.children].filter(x=>!/vfill/.test(x.className));
  MBAR={gT,gV,iT,iV,tog:[mafToggle(gT),mafToggle(gV),mafToggle(bar)]}; let on=false;
  dv.onpointerdown=e=>{ e.preventDefault(); dv.setPointerCapture(e.pointerId); dv.onpointermove=ev=>{ const r=root.getBoundingClientRect(); UI.mbSplit=Math.max(.2,Math.min(.8,(ev.clientY-r.top-bar.offsetHeight)/(r.height-bar.offsetHeight))); fit(); }; dv.onpointerup=()=>{ dv.onpointermove=null; save(); }; };
  const fit=()=>{ const f=UI.mbSplit||.55; top.style.flex=`${f} 1 0`; bot.style.flex=`${1-f} 1 0`; MT.resize(); MV.resize(); RP.dirty=true; };
  return { el:root, show(v){ on=v; if(v){ gT.style.display=gV.style.display='none'; const sp=mk('span','mb-sep'); bar.append(...iT.filter(x=>!x.classList.contains('vfill')),sp,...iV); top.appendChild(MT.el); bot.appendChild(MV.el); fit(); } },
    restore(){ gT.style.display=gV.style.display=''; gT.append(...iT); gV.append(...iV); bar.querySelectorAll('.mb-sep').forEach(x=>x.remove()); }, draw(){}, frame(){}, resize(){ if(on) fit(); }, isOn:()=>on }; }
const hold=document.createElement('div');

// ── panes: 1 · 2 side by side · 2 stacked · 3 (large left, right split) ──────
function paneCount(){ return UI.layout==='1'?1:UI.layout==='3'?3:2; }
function normPanes(){ const n=paneCount(), used=[], bad=v=>!VIEWS[v]||POP[v]||used.some(u=>mafClash(u,v)); for(let k=0;k<n;k++){ let v=UI.panes[k]; if(bad(v)) v=VIEW_ORDER.find(x=>x!=='maf_both'&&!bad(x)); UI.panes[k]=v; used.push(v); } if(UI.focus>=n) UI.focus=0; }
function buildStage(){
  normPanes(); if(MB) MB.restore(); for(const k in VIEWS) VIEWS[k].el.querySelectorAll('.vbar>.link').forEach(x=>x.remove()); const st=$('stage'), n=paneCount(); for(const k in VIEWS) if(!POP[k]) hold.appendChild(VIEWS[k].el); st.innerHTML=''; st.className='stage l'+UI.layout;
  const P=[]; for(let k=0;k<n;k++) P.push(makePane(k));
  const S=UI.sizes, div=(dir,key,box)=>{ const d=mk('div','divider '+dir); d.onpointerdown=e=>{ e.preventDefault(); d.setPointerCapture(e.pointerId); d.classList.add('on');
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
  VIEW_ORDER.forEach(x=>{ const o=mk('option','',sel); o.value=x; o.textContent=VIEW_NAMES[x]; }); sel.value=v;
  sel.onchange=()=>setPaneView(k,sel.value);
  if(v in UI.sync){ const ln=mk('button','ibtn link'+(UI.sync[v]?' on':''),paneCount()===1?VIEWS[v].el.querySelector('.vbar'):ph); ln.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
    ln.title='Follow the playhead'; ln.onclick=()=>{ UI.sync[v]=!UI.sync[v]; ln.classList.toggle('on',UI.sync[v]); save(); if(UI.sync[v]&&v==='table') TV.frame(RP.i,true); RP.dirty=true; if(v==='maf_table') MT.frame(); }; }
  if(v!=='maf_both'){ const po=mk('button','ibtn link',paneCount()===1?VIEWS[v].el.querySelector('.vbar'):ph); po.textContent='⧉'; po.title='Pop out into its own window'; po.onclick=e=>{ e.stopPropagation(); popOut(v); }; }
  const pb=mk('div','pb vin',p); pb.appendChild(VIEWS[v].el); p.addEventListener('pointerdown',()=>{ if(UI.focus!==k){ UI.focus=k; document.querySelectorAll('.pane').forEach((x,j)=>x.classList.toggle('focus',j===k&&paneCount()>1)); syncTabs(); save(); } },true);
  return p; }
function setPaneView(k,v){ if(v==='maf') v=UI.mafLast||'maf_table'; if(MAFV.includes(v)) UI.mafLast=v; const n=paneCount(), old=UI.panes[k]; for(let j=0;j<n;j++) if(j!==k&&mafClash(UI.panes[j],v)) UI.panes[j]=mafClash(old,v)?'':old; UI.panes[k]=v; save(); buildStage(); }
function viewNeeds(v){ if(!ST.logs.length) return []; if(v.endsWith('_b')) return RP.B?[]:['a compare log (B)'];
  if(v==='maf_table'||v==='maf_curve'||v==='maf_both') return ST.logs.some(L=>L.cap.maf)?[]:mafNeeds(RP.L||ST.logs[0]);
  if(v==='table') return ST.logs.some(L=>L.c.rpm)?[]:[IN_NAMES.rpm]; return []; }
function syncTabs(){ const vis=UI.panes.slice(0,paneCount()); document.querySelectorAll('#tabs button').forEach(b=>{ const tv=b.dataset.v, is=v=>tv==='maf'?MAFV.includes(v):v===tv; b.classList.toggle('on',vis.some(is)); b.classList.toggle('foc',is(UI.panes[UI.focus])); const m=viewNeeds(tv==='maf'?'maf_table':tv); b.classList.toggle('na',!!m.length); b.style.display=b.dataset.v.endsWith('_b')&&!RP.B?'none':''; b.title=m.length?'Needs: '+m.join(', '):''; });
  document.querySelectorAll('#stage .pane').forEach((p,k)=>{ const pb=p.querySelector('.pb'), m=viewNeeds(UI.panes[k]); if(!pb) return; pb.classList.toggle('na',!!m.length); let e=pb.querySelector('.na-msg'); if(m.length){ if(!e) e=mk('div','na-msg',pb); e.textContent='Needs: '+m.join(', '); } else if(e) e.remove(); });
  document.querySelectorAll('#layouts button').forEach(b=>b.classList.toggle('on',b.dataset.l===UI.layout)); syncPresets(); }
function syncPresets(){ document.querySelectorAll('#presets button').forEach((b,k)=>{ const p=UI.presets[k]; b.classList.toggle('has',!!p); b.title=p?`Preset ${k+1}: ${p.panes.slice(0,p.layout==='1'?1:p.layout==='3'?3:2).map(v=>VIEW_NAMES[v]).join(' + ')} — click to load, Shift+click to overwrite`:`Empty — click to save the current layout`; }); }
function preset(k,saveIt){ const p=UI.presets[k]; if(saveIt||!p){ UI.presets[k]={layout:UI.layout,panes:UI.panes.slice(),sizes:JSON.parse(JSON.stringify(UI.sizes))}; toast(`Layout saved to preset ${k+1}`); save(); syncPresets(); return; }
  UI.layout=p.layout; UI.panes=p.panes.slice(); Object.assign(UI.sizes,p.sizes); save(); buildStage(); }

// ── replay ──────────────────────────────────────────────────────────────────
function selectLog(L,keep){ const t=RP.playT; if(RP.B===L) RP.B=null; RP.L=L; mergeLimits(); UI.fp=L?L.fp:null; if(!keep){ RP.a=RP.b=null; RP.kClear=-1; } RP.gOff=0; RP.tlKey=null; RP.i=-1;
  if(L){ TV.setTune(); GV.fill(); SV.fill(); MV.reset(); TV.logChanged(); rpSeek(keep?Math.min(t,L.dur):0,true); } fillEvents(); rpAB(); save(); drawerRefresh(); if(L) autoWx(L); cmpUI(); if(window.__edChanged) window.__edChanged(); }
function rpSeek(t,snap){ const L=RP.L; if(!L) return; RP.playT=Math.max(0,Math.min(L.dur,t)); const i=rpIdx(RP.playT); RP.i=i; if(UI.sync.table) TV.frame(i,snap); MT.frame(); RP.dirty=true; rpTime(); }
function rpStep(d){ const L=RP.L; if(!L) return; rpPlay(false); const i=Math.max(0,Math.min(L.N-1,RP.i+d)); RP.playT=L.t[i]; RP.i=i; if(UI.sync.table) TV.frame(i,false); MT.frame(); RP.dirty=true; rpTime(); }
function rpPlay(on){ RP.playing=!!on&&!!RP.L; if(RP.playing){ RP.gOff=0; if(RP.playT>=RP.L.dur) rpSeek(RP.a!=null&&RP.b!=null?Math.min(RP.a,RP.b):0,true); } $('t-play').textContent=RP.playing?'❚❚':'▶'; if(!RP.playing){ UI.playT=RP.playT; save(); } }
function rpTime(){ const e=$('t-time'), s=fmtT(RP.playT)+' / '+fmtT(RP.L?RP.L.dur:0); if(e.textContent!==s) e.textContent=s; }
function rpAB(){ const a=$('t-a'), b=$('t-b'); a.classList.toggle('on',RP.a!=null); b.classList.toggle('on',RP.b!=null); a.textContent=RP.a!=null?'A '+fmtT(RP.a):'A'; b.textContent=RP.b!=null?'B '+fmtT(RP.b):'B'; MV.reset(); RP.dirty=true; }
function evMenu(){ const old=$('evpop'); if(old){ old.remove(); return; } const L=RP.L; if(!L||!L.allEv||!L.allEv.length){ toast('No events in this log'); return; }
  const b=$('t-evb').getBoundingClientRect(), d=mk('div','',document.body); d.id='evpop'; d.innerHTML='<input class="evq" placeholder="Search events"><div class="evl"></div>';
  const q=d.querySelector('.evq'), lst=d.querySelector('.evl'), open=UI.evOpen||(UI.evOpen={});
  const draw=()=>{ const w=q.value.toLowerCase().trim(), g={}; L.allEv.forEach((e,i)=>{ if(w&&!(e.kind+' '+e.label).toLowerCase().includes(w)) return; (g[e.kind]=g[e.kind]||[]).push([e,i]); });
    lst.innerHTML=Object.keys(g).map(k=>{ const shut=!w&&open[k]===false, worst=g[k].reduce((a,[e])=>e.sev==='crit'?'crit':a==='crit'?a:e.sev==='warn'?'warn':a,'info');
      return `<div class="evg" data-k="${esc(k)}"><i style="background:${sevC(worst)}"></i><b>${esc(k)}</b><em>${g[k].length}</em><u>${shut?'▸':'▾'}</u></div>`+(shut?'':g[k].map(([e,i])=>`<button class="evi${Math.abs(e.t-RP.playT)<1500?' now':''}" data-i="${i}"><i style="background:${sevC(e.sev)}"></i><span class="t">${fmtT(e.t)}</span><span class="l">${esc(e.label)}</span></button>`).join('')); }).join('')||'<div class="evg dim">No match</div>'; };
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
  if(RP.dirty){ RP.dirty=false; if(UI.sync.graph!==false||RP.playing===false) GV.draw(); MV.draw(); SV.draw(); GVb.draw(); drawTL($('tl'),false); if(RP.B) drawTLB(); if(!$('tlpop').classList.contains('hidden')) drawTL($('tlpop-cv'),true); }
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
  cv.addEventListener('pointerup',()=>{ const d=RP.drag; RP.drag=null; if(!d) return; if(d.ab&&Math.abs(d.t1-d.t0)>200){ RP.a=Math.min(d.t0,d.t1); RP.b=Math.max(d.t0,d.t1); rpAB(); }
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
    if(/\.ejlab$/i.test(f.name)){ busy(false); await loadSession(text,f.name); return; } if(/\.(tune|json)$/i.test(f.name)||/^\s*\{/.test(text.slice(0,50))){ await loadTuneText(text,f.name); continue; }
    const k=fp(text); if(ST.logs.some(L=>L.fp===k)||ST.queue.some(q=>q.fp===k)){ errs.push(f.name+': already loaded'); continue; }
    if(!TUNE){ ST.queue.push({name:f.name,text,fp:k}); continue; }
    busy(true,'Processing',f.name); await sleep(40); if(await ingest({name:f.name,text,fp:k},true,errs)) added++; }
  if(added){ busy(true,'Analysing',ST.logs.length+' log'+(ST.logs.length>1?'s':'')+' pooled'); await sleep(40); try{ afterLogs(); }catch(e){ elog('analysis: '+(e&&e.stack||e)); busy(false); toast('Analysis hit an error. It is in the error log (About → Bug report).'); return; }
    const nb=ST.bins?ST.bins.filter(b=>b.n).length:0; busy(true,'Analysis complete',`${ST.logs.reduce((s,L)=>s+L.N,0).toLocaleString()} frames · ${nb} / ${BP.length} bins`); await sleep(1100); }
  busy(false); if(errs.length){ toast(errs.join(' · ')); elog('load: '+errs.join(' | ')); } landRefresh(); }
function afterLogs(){ ST.fixes.clear(); recompute(false); if(!RP.L||!ST.logs.includes(RP.L)) selectLog(ST.logs.find(L=>L.fp===UI.fp)||ST.logs[0],false); enterApp(); }
function removeLog(L){ if(RP.B===L){ RP.B=null; cmpUI(); } ST.logs.splice(ST.logs.indexOf(L),1); IDB.del(L.fp); if(!ST.logs.length){ RP.L=null; showLanding(); recompute(false); return; } ST.fixes.clear(); recompute(false); if(RP.L===L) selectLog(ST.logs[0],false); }
async function loadTuneText(text,name){
  try{ const T=parseTune(text,name); TUNE=T; profAuto(T); if(!window.__keepEdits) edReset(); if(!window.__treeSwitch) revRoot(text,name); try{ localStorage.setItem('rrlab_tune_v1',JSON.stringify({name,text})); }catch(_){}
    if(!UI.axis) applyTuneAxis();
    for(const L of ST.logs) computePicks(L); const q=ST.queue.splice(0), errs=[]; if(q.length){ busy(true,'Processing',q.length+' queued log'+(q.length>1?'s':'')); await sleep(60); } for(const o of q) await ingest(o,true,errs); if(q.length) busy(false); if(errs.length) toast(errs.join(' · '));
    mergeLimits(); if(ST.logs.length){ recompute(true); if(q.length||!RP.L) afterLogs(); else { TV.setTune(); } } toast('Tune loaded · '+T.cal); landRefresh(); drawerRefresh(); }
  catch(e){ toast('Tune: '+(e&&e.message?e.message:e)); } }
function busy(on,t,s){ const b=$('land-busy'); if(on){ $('busy-t').textContent=t||'Processing'; $('busy-s').textContent=s||''; b.classList.remove('hidden','out'); BGFX.set(true,'busy'); } else { b.classList.add('out'); setTimeout(()=>{ if(b.classList.contains('out')){ b.classList.add('hidden'); BGFX.set(!$('land').classList.contains('hidden'),'land'); } },450); } }

// ── landing ─────────────────────────────────────────────────────────────────
function showLanding(){ $('app').classList.add('hidden'); $('land').classList.remove('hidden'); landRefresh(); BGFX.set(true,'land'); }
function enterApp(){ if(!ST.logs.length&&!TUNE) return; if(ST.logs.length&&UI.seenVer!==APP_VER){ UI.seenVer=APP_VER; save(); setTimeout(whatsNew,700); } setTimeout(profBanner,0); $('land').classList.add('hidden'); $('app').classList.remove('hidden'); BGFX.set(false); buildStage(); if(!RP.raf) RP.raf=requestAnimationFrame(loop); }
function landRefresh(){ $('steps').classList.toggle('stack',!!TUNE); $('steps').classList.remove('lift'); $('land-tune-s').textContent=TUNE?`${TUNE.cal} · ${TUNE.read||TUNE.name}`:'Project Lambda .tune'; $('land-tune-b').textContent=TUNE?'Replace':'Load tune';
  { let e=$('land-edit'); if(TUNE&&!e){ e=mk('button','btn',$('st-tune')); e.id='land-edit'; e.textContent='Open in editor'; e.title='Open Tables to edit this tune, no log needed'; e.onclick=ev=>{ ev.stopPropagation(); openEditorOnly(); }; } if(!TUNE&&e) e.remove(); }
  $('st-tune').classList.toggle('done',!!TUNE); $('st-logs').classList.toggle('locked',!TUNE);
  $('land-logs-s').textContent=ST.queue.length?`${ST.queue.length} log${ST.queue.length>1?'s':''} queued — processing once the tune loads`:'Drop RomRaider or Project Lambda CSV logs';
  $('land-back').classList.toggle('hidden',!ST.logs.length); if(DESK) DESK.land(); }

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
  const lim=fams.sort().map(f=>{ const l=ULIM[f]||{}, tl=TLIM[f]||{}, set=(l.lo||[]).concat(l.hi||[]).some(Number.isFinite)||(tl.hi||[]).some(Number.isFinite), inp=(s,i)=>{ const uv=l[s]&&Number.isFinite(l[s][i])?l[s][i]:null, tv=tl[s]&&Number.isFinite(tl[s][i])?tl[s][i]:null; return `<input class="num xs${uv==null&&tv!=null?' tl':''}" type="number" step="any" data-lim="${esc(f)}" data-side="${s}" data-k="${i}" value="${uv!=null?uv:tv!=null?tv:''}" placeholder="${['appr','warn','crit'][i]}"${uv==null&&tv!=null?' title="from tune"':''}>`; };
    return `<details class="lim"${UI.open['lim:'+f]?' open':''} data-lf="${esc(f)}"><summary>${esc(f)}${set?' <span class="dot"></span>':''}</summary><div class="limg"><span>Low ≤</span>${[0,1,2].map(i=>inp('lo',i)).join('')}<span>High ≥</span>${[0,1,2].map(i=>inp('hi',i)).join('')}</div></details>`; }).join('');
  const S=(tab,...a)=>sec(...a).replace('<details class="dsec"',`<details class="dsec" data-tab="${tab}"`);
  const sg=(key,opts)=>`<div class="seg" data-u="${key}">${opts.map(([v,l])=>`<button data-v="${v}" class="${UI[key]===v?'on':''}">${l}</button>`).join('')}</div>`;
  const row=(lab,html,tip)=>`<div class="drow"${tip?` title="${tip}"`:''}><span>${lab}</span>${html}</div>`;
  const q=UI.dq||'', ae=document.activeElement, refocus=ae&&ae.dataset&&ae.dataset.dsearch!=null, tabs=[['session','Session'],['analysis','Analysis'],['settings','Settings'],['about','About']];
  const tuneB=T?`<div class="kv"><span>CAL</span><b>${esc(T.cal)}</b><span>ROM</span><b>${esc(T.rom)}</b><span>Read</span><b>${esc(T.read)}</b><span>File</span><b>${esc(T.name)}</b><span>MAF axis</span><b>${AXIS_SRC==='tune'?'from tune':AXIS_SRC==='custom'?'custom override':'built-in'} · ${BP.length} bins</b></div><button class="btn sm" data-act="tune">Replace tune</button>`:'<button class="btn acc sm" data-act="tune">Load tune</button>';
  const logsB=ST.logs.map((x,i)=>`<div class="lrow${x===L?' on':''}"><input type="checkbox" data-pool="${i}"${pooled(x)?' checked':''} title="Pool into MAF scaling"><button class="lplay" data-log="${i}" title="Replay this log">${x===L?'▶':'▷'}</button><span class="lname" title="${esc(x.name)}">${esc(x.name)}</span><span class="lmeta"><b>${x.an.aud.kept.toLocaleString()}</b>/${x.N.toLocaleString()}</span><button class="lplay${x===RP.B?' on':''}" data-cmp="${i}" title="${x===RP.B?'End compare':'Compare as log B'}"${x===RP.B?` style="color:${logC('b')};border-color:${logC('b')}"`:''}${x===L?' disabled':''}>B</button><button class="lx" data-rm="${i}" title="Remove">×</button></div>${typeof logRevHtml==='function'?logRevHtml(x,i):''}`).join('')
    +`<div class="drow"><button class="btn sm" data-act="logs" title="CSV logs or an .ejlab session">Add logs</button><button class="btn sm" data-act="sess" title="Tune, revisions, logs, layout, flags, trims, notes and vehicle profile in one .ejlab file (Ctrl+S)">Save session</button><button class="btn sm" data-act="rep" title="Plain-text session report">Report</button></div>`;
  const covB=`${cov}<div class="achips">${chip(agg.nowb,'no wideband')}${chip(agg.notgt,'no target λ')}${chip(agg.notrim,'no trims')}${chip(agg.warmup,'warmup')}${chip(agg.cut,'fuel cut')}${chip(agg.recover,'cut recovery')}${chip(agg.overrun,'OL overrun')}${chip(agg.trans,'transient')}${chip(agg.rail,'WB rail')}${chip(agg.idle,'idle/crank')}${chip(agg.nan,'unreadable')}${chip(agg.bad,'malformed')}</div>`
    +`<div class="note">Fuel-cut detection: <b>${tier||'—'}</b>${agg.lean?` · <span class="warn">${agg.lean} lean-outlier frames flagged</span>`:''}</div>`+(lmc?`<div class="note warn">Load comp active in tune · MAP not logged</div>`:'')
    +(ST.ipw?`<div class="note">${ST.ipw.verdict?`IPW check: AFL <b>${ST.ipw.verdict}</b> in open loop (fuel ratio ${ST.ipw.ratio.toFixed(3)} vs 1+AFL ${ST.ipw.afl.toFixed(3)})`:'IPW check: not enough frames'}</div>`:'');
  const diagB=[['knock','Knock classification'],['boost','Boost / WGDC health'],['tip','Tip-in / tip-out'],['avcs','AVCS tracking'],['clol','CL/OL transitions'],['fuel','Fuel saturation']].map(([g,l])=>`<div class="drow"><span>${l}</span><div class="seg"><button data-dg="${g}" data-on="1" class="${UI.diagOn[g]!==false?'on':''}">On</button><button data-dg="${g}" data-on="0" class="${UI.diagOn[g]===false?'on':''}">Off</button></div></div>`).join('')
    +thr('tipRate','Tip-in throttle rate ≥',CFG.tipRate,10,'%/s')+thr('knockWin','Transient knock window',CFG.knockWin,0.1,'s')+thr('lowLoad','Low load below',CFG.lowLoad,0.05,'g/rev')+thr('bErr','Boost error ≥',CFG.bErr,0.5,'psi')+thr('bDur','Boost error for',CFG.bDur,0.1,'s')
    +thr('tipAfr','AFR spike ≥',CFG.tipAfr,0.1,'AFR')+thr('avcsErr','AVCS error ≥',CFG.avcsErr,0.5,'°')+thr('clVal','Closed loop status',CFG.clVal,1,'')+thr('olVal','Open loop status ≥',CFG.olVal,1,'')+thr('clolWin','CL/OL window',CFG.clolWin,50,'ms');
  const fltB=thr('cutMafv','Closed-throttle MAF V',CFG.cutMafv,0.01,'V')+thr('transVs','Transient limit',CFG.transVs,0.1,'V/s')+thr('recoverS','Cut recovery',CFG.recoverS,0.1,'s')
    +thr('railLo','WB rail low',(CFG.railLo*k).toFixed(dp),'any',wu)+thr('railHi','WB rail high',(CFG.railHi*k).toFixed(dp),'any',wu)+thr('olEnr','OL counts at FFB ≤',CFG.olEnr.toFixed(3),'any','λ')+thr('leanLam','Lean outlier above',(CFG.leanLam*k).toFixed(dp),'any',wu)
    +thr('richFloor','Rich floor warning',(CFG.richFloor*k).toFixed(dp),'any',wu)+thr('solidN','Solid bin at n ≥',CFG.solidN,1,'')+thr('kinkTol','Kink tolerance',(CFG.kinkTol*100).toFixed(1),0.5,'%')+`<button class="btn sm ghost" data-act="cfgreset">Defaults</button>`;
  const colsB=L?`<div class="kv"><span>Mapped</span><b>${Object.keys(L.map||{}).length} of ${L.headers.length-1}</b><span>Format</span><b>${L.fmt==='lambda'?'Project Lambda':'RomRaider / CSV'}</b>${L.wiped?`<span>Wiped</span><b>${L.wiped} lead rows</b>`:''}</div><div class="drow"><button class="btn sm" data-act="mapedit">Edit mapping</button>${MAPS[L.sig]?'<button class="btn sm ghost" data-act="mapforget">Forget saved</button>':''}</div>`:'';
  const unitsB=row('Wideband',sg('wbDisp',[['lambda','λ'],['afr','AFR']]))+row('FFB target',sg('ffbDisp',[['lambda','λ'],['afr','AFR']]))+row('Temperature',sg('tu',[['C','°C'],['F','°F']]))+row('Pressure',sg('pu',[['psi','psi'],['kPa','kPa'],['bar','bar']]));
  const colB=row('Flag severity',['info','warn','crit'].map(c=>`<input type="color" data-sev="${c}" value="${sevC(c)}" title="${{info:'Info',warn:'Warning',crit:'Critical'}[c]}">`).join(''))+row('Log A / B',['a','b'].map(c=>`<input type="color" data-lc="${c}" value="${logC(c)}" title="Log ${c.toUpperCase()}">`).join(''));
  const homeB=`<label class="drow" title="Used to fetch weather for each log"><span>Home location</span><input class="num" style="width:160px;text-align:left" data-home="1" value="${esc(UI.home?UI.home.name:'')}" placeholder="City"></label>`;
  const rpB=`<label class="drow"><span>WB smoothing (graph)</span><input class="num" type="number" min="0" max="3000" step="100" data-ui="tau" value="${UI.tau}"><em>ms</em></label><label class="drow" title="Opacity of the expanded timeline"><span>Expanded timeline opacity</span><input class="num" type="number" min="30" max="100" step="5" data-ui="tlop" value="${UI.tlop??70}"><em>%</em></label>`;
  const advB=`<div class="vlab">MAF axis override</div><textarea class="axis" spellcheck="false" placeholder="Paste breakpoints (space / comma / newline)">${UI.axis?UI.axis.join(' '):''}</textarea><div class="drow"><button class="btn sm ghost" data-act="axis">Apply override</button><button class="btn sm ghost" data-act="axisclr">Use tune axis</button></div>`;
  d.innerHTML=`<div class="dtabs">${tabs.map(([v,l])=>`<button data-dtab="${v}">${l}</button>`).join('')}</div><input class="tt-q dsq" type="search" data-dsearch placeholder="Search settings" value="${esc(q)}">`
   +S('session','tune','Tune',tuneB)+(typeof treeHtml==='function'?S('session','tree','Tuning tree',treeHtml()):'')
   +S('session','logs','Logs',logsB,`<em>${agg.kept.toLocaleString()} / ${agg.total.toLocaleString()} frames</em>`)
   +(DESK?S('session','watch','Log folder',DESK.section(),DESK.st.folder?`<em>${DESK.st.auto?'watching':'manual'}</em>`:''):'')
   +S('session','veh','Vehicle',profHtml(),profNow()?`<em>${esc(profNow().name||'')}</em>`:'')
   +(L?S('session','meta','Session notes',metaHtml(L)):'')+(L?S('session','pf','Pulls · flags · trim',pfHtml(L),`<em>${(L.pulls||[]).length} pulls</em>`):'')
   +S('session','cov','Coverage',covB,`<em>${nb} / ${BP.length} bins</em>`)
   +S('analysis','diag','Diagnostics',diagB)+S('analysis','flt','MAF filters',fltB)
   +S('analysis','pull','Pull detection',thr('pullThr','Throttle ≥',CFG.pullThr,1,'%')+thr('pullDur','Min length',CFG.pullDur,0.1,'s')+thr('pullSpan','Min RPM sweep',CFG.pullSpan,50,'rpm'))
   +S('analysis','fuel','Fuel saturation',thr('idcWarn','IDC warning at',CFG.idcWarn,1,'%')+thr('idcCrit','IDC critical at',CFG.idcCrit,1,'%')+thr('fpDrop','Fuel pressure drop ≥',CFG.fpDrop,1,'%'))
   +S('analysis','lim','Warning limits',fams.length?lim:'<div class="note">Load a log to set limits</div>')+(L?S('analysis','cols','Column mapping',colsB,MAPS[L.sig]?'<em>saved</em>':''):'')
   +S('settings','disp','UI scale',`<div class="drow">${SCALES.map(f=>`<button class="btn sm${(UI.scale||1)===f?' acc':''}" data-act="sc${Math.round(f*100)}" title="Ctrl+= / Ctrl+− to step · Ctrl+0 resets">${Math.round(f*100)}%</button>`).join('')}</div>`)+S('settings','units','Units',unitsB)+S('settings','colours','Colours',colB)+S('settings','home','Location',homeB)+S('settings','rp','Replay',rpB)
   +(typeof editorSettingsHtml==='function'?S('settings','ed','Table editor',editorSettingsHtml()):'')+S('settings','keys','Shortcuts',keysHtml())+S('settings','adv','Advanced',advB)
   +S('settings','reset','Reset','<button class="btn sm danger" data-act="reset">Reset everything</button>')
   +S('about','about','ejStudio',aboutHtml())+S('about','upd','Updates & bug reports',updHtml());
  dApply(); if(refocus){ const e=d.querySelector('[data-dsearch]'); e.focus(); e.setSelectionRange(q.length,q.length); } }
function dApply(){ const d=$('drawer-bd'), q=(UI.dq||'').trim().toLowerCase(), t=UI.dtab||'session';
  d.querySelectorAll('.dtabs button').forEach(b=>b.classList.toggle('on',!q&&b.dataset.dtab===t));
  d.querySelectorAll('.dsec[data-tab]').forEach(x=>{ const hit=q&&(x.textContent.toLowerCase().includes(q)||[...x.querySelectorAll('input')].some(i=>(i.placeholder||'').toLowerCase().includes(q)));
    x.style.display=(q?hit:x.dataset.tab===t)?'':'none'; if(hit) x.open=true; }); }
function drawerBind(){ const d=$('drawer-bd');
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
    else if(a==='sess') saveSession(); else if(a==='rep') saveReport(); else if(/^sc\d+$/.test(a)){ uiScale(+a.slice(2)/100); drawerRefresh(); } else if(a==='news') whatsNew(); else if(a==='bug') bugReport(); else if(a==='updchk') checkUpdates(true); else if(a==='reps'){ if(window.rrlab&&window.rrlab.openReports) window.rrlab.openReports(''); }
    else if(a==='odata'){ if(window.rrlab&&window.rrlab.openData) window.rrlab.openData(); } else if(a==='updopen'){ if(UI.upd&&UI.upd.url&&window.rrlab&&window.rrlab.openUrl) window.rrlab.openUrl(UI.upd.url); } else if(a==='csvx') exportCSV(); else if(a==='wx') fetchWeather(RP.L,false); else if(a==='cfadd'){ const m=metaOf(RP.L); (m.custom=m.custom||[]).push({k:'',v:''}); save(); drawerRefresh(); }
    else if(a==='pnew'){ const p={id:'p'+Date.now().toString(36),name:'New profile',engine:'',gears:'',fd:'',tire:'',inj:'',fuel:'',mafd:'',wbLag:0,rom:''}; (UI.profiles=UI.profiles||[]).push(p); UI.profSel=p.id; profChanged(); drawerRefresh(); }
    else if(a==='pdel'){ const p=profNow(); if(p&&confirm('Delete profile "'+(p.name||'')+'"?')){ UI.profiles=UI.profiles.filter(x=>x!==p); UI.profSel=null; profChanged(); drawerRefresh(); } }
    else if(a==='plag'){ const v=wbLagEst(RP.L), p=profNow(); if(v==null) toast('Not enough fuel-cut events with IPW and wideband in this log'); else { p.wbLag=v; profChanged(); drawerRefresh(); toast('Wideband lag ≈ '+v+' ms'); } }
    else if(a==='prom'){ const p=profNow(); UI.profiles.forEach(x=>{ if(x.rom===TUNE.rom) x.rom=''; }); p.rom=TUNE.rom; save(); drawerRefresh(); profBanner(); }
    else if(a==='keyreset'){ UI.keys={}; save(); drawerRefresh(); } else if(a==='trima') trimSet('a'); else if(a==='trimb') trimSet('b'); else if(a==='trimx') trimSet('clear');
    else if(a==='cfgreset'){ const ol=CFG.olAfl; Object.assign(CFG,CFG_DEF); CFG.olAfl=ol; UI.cfg={olAfl:ol}; save(); recompute(true); }
    else if(a==='axis'){ const v=d.querySelector('.axis').value.trim().split(/[\s,]+/).filter(Boolean).map(Number); if(v.length<2||v.some(x=>!Number.isFinite(x))||v.some((x,i)=>i&&x<=v[i-1])){ toast('Axis must be ≥ 2 strictly increasing numbers'); return; }
      UI.axis=v; BP=v.slice(); AXIS_SRC='custom'; save(); recompute(true); toast('Custom MAF axis applied'); }
    else if(a==='axisclr'){ UI.axis=null; BP=BP_DEFAULT.slice(); AXIS_SRC='default'; applyTuneAxis(); save(); recompute(true); }
    else if(a==='reset'){ if(!confirm('Reset ejStudio? Clears the tune, stored logs, layouts, limits and settings.')) return; try{ localStorage.removeItem('rrlab_ui_v1'); localStorage.removeItem('rrlab_tune_v1'); }catch(_){} IDB.clear().then(()=>location.reload()); } });
  d.addEventListener('change',e=>{ const t=e.target;
    if(t.dataset.cfg){ const id=t.dataset.cfg, x=parseFloat(t.value); if(!Number.isFinite(x)) return; const lam=['railLo','railHi','leanLam','richFloor'].includes(id);
      const v=lam?x/lamK(UI.wbDisp):id==='kinkTol'?x/100:x; CFG[id]=v; UI.cfg[id]=v; save(); recompute(true); }
    else if(t.dataset.lim){ const f=t.dataset.lim, s=t.dataset.side, k=+t.dataset.k, x=parseFloat(t.value), tv=TLIM[f]&&TLIM[f][s]?TLIM[f][s][k]:null, l=ULIM[f]||(ULIM[f]={lo:[null,null,null],hi:[null,null,null]});
      (l[s]=l[s]||[null,null,null])[k]=Number.isFinite(x)&&x!==tv?x:null; if(!l.lo.concat(l.hi).some(Number.isFinite)) delete ULIM[f]; mergeLimits(); save(); fillEvents(); RP.dirty=true; drawerRefresh(); }
    else if(t.dataset.meta){ const m=metaOf(RP.L), k=t.dataset.meta; m[k]=t.type==='number'?(t.value===''?'':+t.value):t.value; if(k==='ambient'&&UI.tu==='F'&&m[k]!=='') m[k]=+((m[k]-32)/1.8).toFixed(2); if(k==='date') delete m.wx; save(); }
    else if(t.dataset.cf!=null){ metaOf(RP.L).custom[+t.dataset.cf][t.dataset.part]=t.value; save(); }
    else if(t.dataset.lrev!=null){ const x=ST.logs[+t.dataset.lrev]; UI.lrev[x.fp]=t.value; save(); recompute(true); TV.setTune(); toast(x.name+' → rev '+REV.nodes.find(n=>n.id===t.value).rev); }
    else if(t.dataset.pool!=null){ const x=ST.logs[+t.dataset.pool]; UI.pool[x.fp]=t.checked; if(t.checked) delete UI.pool[x.fp]; save(); ST.fixes.clear(); recompute(false); }
    else if(t.dataset.rail){ UI.rails=UI.rails||{}; const x=parseFloat(t.value); if(Number.isFinite(x)) UI.rails[t.dataset.rail]=x; else delete UI.rails[t.dataset.rail]; save(); }
    else if(t.dataset.lc){ UI.logCol[t.dataset.lc]=t.value; save(); RP.tlbK=null; cmpUI(); RP.dirty=true; }
    else if(t.dataset.home){ geoHome(t.value); }
    else if(t.dataset.prof==='sel'){ UI.profSel=t.value||null; profChanged(); drawerRefresh(); }
    else if(t.dataset.pf){ const p=profNow(); if(p){ const k=t.dataset.pf; p[k]=t.type==='number'?(t.value===''?'':+t.value):t.value; profChanged(); if(k==='name') drawerRefresh(); } }
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
  +'<div class="vlab" style="margin-top:.6rem">Table editor (Edit mode)</div>'+ACTIONS.filter(a=>a[0].startsWith('ed:')).map(([id,lab,d])=>{ const k=UI.keys[id]??d; return `<div class="drow"><span>${lab}</span><button class="btn sm" data-key="${id}" title="Click, then press the new keys · Backspace clears · Esc cancels">${keyCapture===id?'Press keys…':esc(k||'—')}</button></div>`; }).join('')+'<div class="note">In Edit mode, typing a number sets the selected cells.</div>'
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
const PROF_FIELDS=[['name','Name','text'],['engine','Engine','text'],['gears','Gear ratios','text','3.454 1.947 1.296 0.972 0.738'],['fd','Final drive','number'],['tire','Tire size','text','225/45R17'],
  ['inj','Injector size (cc/min)','number'],['fuel','Fuel','text','91'],['mafd','MAF housing (mm)','number'],['wbLag','Wideband lag (ms)','number']];
function profNow(){ return (UI.profiles||[]).find(p=>p.id===UI.profSel)||null; }
function profApply(){ PROF=profNow(); }
function profAuto(T){ const m=(UI.profiles||[]).find(p=>p.rom&&T&&p.rom===T.rom); if(m){ UI.profSel=m.id; profApply(); } }
function profChanged(){ profApply(); save(); recompute(true); profBanner(); }
function profHtml(){ const ps=UI.profiles||[], p=profNow();
  let h=`<div class="drow"><select class="sel sm" data-prof="sel" style="flex:1"><option value="">— none —</option>${ps.map(x=>`<option value="${x.id}"${p&&x.id===p.id?' selected':''}>${esc(x.name||'Unnamed')}</option>`).join('')}</select><button class="btn sm" data-act="pnew">New</button>${p?'<button class="btn sm ghost" data-act="pdel">Delete</button>':''}</div>`;
  if(!p) return h;
  h+=PROF_FIELDS.map(([k,l,t,ph])=>`<label class="drow"><span>${l}</span><input class="num" style="width:150px;text-align:left" type="${t}" step="any" data-pf="${k}" value="${esc(p[k]??'')}"${ph?` placeholder="${ph}"`:''}></label>`).join('');
  return h+`<div class="drow"><button class="btn sm" data-act="plag" title="Measure from fuel-cut events in the current log (needs IPW + wideband)">Estimate lag</button>${TUNE?`<button class="btn sm${p.rom===TUNE.rom?' acc':''}" data-act="prom" title="Pick this profile automatically whenever a tune with ROM ${esc(TUNE.rom)} loads">${p.rom===TUNE.rom?'Linked to this ROM':'Link to this ROM'}</button>`:''}</div>`; }
function wbLagEst(L){ if(!L||!L.c.ipw||!L.c.wb) return null; const C=L.c, T=L.t, d=[];
  for(let i=1;i<L.N;i++) if(C.ipw[i]<0.3&&C.ipw[i-1]>=0.3) for(let j=i;j<L.N&&T[j]-T[i]<=1500;j++){ if(C.ipw[j]>=0.3) break; if(L.wb[j]>1.15){ d.push(T[j]-T[i]); break; } }
  return d.length>=3?Math.round(median(d)):null; }
// ── sessions (.ejlab): gzip+base64 inside a JSON wrapper ──────────────────────
async function gzB64(str){ const b=await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(), u=new Uint8Array(b); let o='';
  for(let i=0;i<u.length;i+=0x8000) o+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(o); }
async function unGzB64(b64){ const bin=atob(b64), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
function sessionObj(){ const fps=ST.logs.map(L=>L.fp), pick=o=>{ const r={}; for(const f of fps) if(o&&o[f]!=null) r[f]=o[f]; return r; }; let tune=null;
  try{ tune=JSON.parse(localStorage.getItem('rrlab_tune_v1')||'null'); }catch(_){}
  return {app:'ejStudio',v:2,tnotes:UI.tnotes||{},names:UI.names||{},saved:new Date().toISOString(),tune,logs:ST.logs.map(L=>({name:L.name,text:L.src,fp:L.fp})),active:RP.L?RP.L.fp:null,playT:RP.playT,
    ui:JSON.parse(JSON.stringify({layout:UI.layout,panes:UI.panes,sizes:UI.sizes,g:UI.g,tt:UI.tt,m:UI.m,sc:UI.sc})),trims:pick(UI.trims),flags:pick(UI.flags),meta:pick(UI.meta),lrev:pick(UI.lrev),profile:profNow(),rev:REV,edits:edSnapshot()}; }
async function saveSession(){ if(!ST.logs.length){ toast('Nothing to save'); return; } busy(true,'Saving session',''); await sleep(30);
  try{ const txt=JSON.stringify({format:'ejlab',v:1,gz:await gzB64(JSON.stringify(sessionObj()))}); if(txt.length>50e6) toast('Large session: '+(txt.length/1e6).toFixed(0)+' MB');
    const a=mk('a','',document.body); a.href=URL.createObjectURL(new Blob([txt],{type:'application/octet-stream'})); a.download=(RP.L?RP.L.name.replace(/\.csv$/i,''):'session')+'.ejlab'; a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },3000); }
  catch(e){ toast('Save failed'); } busy(false); }
async function loadSession(text,name){ let o; try{ const w=JSON.parse(text); o=w.gz?JSON.parse(await unGzB64(w.gz)):w; if(o.app!=='ejStudio'&&o.app!=='ejLab') throw 0; }catch(_){ toast(name+': not an ejStudio session'); return; } await openSession(o,name); }
async function openSession(o,name){
  if((o.v||1)>=2){ if(o.tnotes) UI.tnotes=Object.assign(UI.tnotes||{},o.tnotes); if(o.names) for(const c in o.names) (UI.names=UI.names||{})[c]=Object.assign((UI.names||{})[c]||{},o.names[c]); }
  if(o.profile){ const ps=UI.profiles||(UI.profiles=[]), same=ps.find(p=>p.id===o.profile.id||p.name===o.profile.name);
    if(!same){ ps.push(Object.assign({},o.profile)); UI.profSel=o.profile.id; }
    else if(JSON.stringify(same)!==JSON.stringify(o.profile)){
      if(confirm(`Vehicle profile "${o.profile.name}" in this session differs from yours.\n\nOK = keep yours\nCancel = more options`)) UI.profSel=same.id;
      else if(confirm(`OK = use the session's "${o.profile.name}" (replaces yours)\nCancel = save it as a copy`)){ Object.assign(same,o.profile,{id:same.id}); UI.profSel=same.id; }
      else { const c=Object.assign({},o.profile,{id:'p'+Date.now().toString(36),name:o.profile.name+' (copy)'}); ps.push(c); UI.profSel=c.id; } }
    else UI.profSel=same.id; profApply(); }
  for(const k of ['trims','flags','meta','lrev']) Object.assign(UI[k],o[k]||{});
  if(o.ui) for(const k in o.ui){ const v=o.ui[k]; if(v&&typeof v==='object'&&!Array.isArray(v)&&UI[k]&&typeof UI[k]==='object') Object.assign(UI[k],v); else UI[k]=v; }
  ST.logs.length=0; ST.queue.length=0; RP.L=null;
  if(o.rev&&o.rev.nodes&&o.rev.nodes.length){ REV=o.rev; REVP={}; const n=curNode(); window.__treeSwitch=1; await loadTuneText(n.src,n.file); window.__treeSwitch=0; revSave(); } else if(o.tune&&o.tune.text) await loadTuneText(o.tune.text,o.tune.name);
  const errs=[]; for(const g of o.logs||[]){ busy(true,'Opening session',g.name); await sleep(30); await ingest(g,false,errs); } busy(false);
  if(!ST.logs.length){ toast('Session had no readable logs'); return; }
  edRestore(o.edits); save(); ST.fixes.clear(); recompute(false); enterApp(); GV.build(); selectLog(ST.logs.find(L=>L.fp===o.active)||ST.logs[0],false); if(o.playT) rpSeek(o.playT,true);
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
   +inp('octane','Octane','text','91')+inp('intake','Intake setup','text','Stock airbox')+inp('notes','Notes','text','')
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
  const name=`${RP.L?RP.L.name.replace(/\.csv$/i,''):'ejlab'}_${k}_${fmtT(RP.playT).replace(/[:.]/g,'-')}.png`;
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
const CHANGES=['<b>Dock</b> on the cluster: QR, Reset peaks, Profiles and Record on a side rail that wakes with a tap and hides itself (3 s moving, 10 s parked)','<b>Profile picker</b> side sheet: glyph, gauge count, last used and a mini layout per profile; Reset layout takes two taps','<b>QR overlay</b> in two numbered steps: join the Wi-Fi, then open the panel at ejlogger.local (uses your own QR images)','Designer: cluster theme presets (ejLogger Amber, Track Red, STI Gold, Night Ops) and Dock presets, picked separately so they mix and match; every colour, wall, outline, corner and Dock setting is adjustable, plus copy a theme from another profile and copy a tile style to other tiles','Column walls match the original cluster again: one short wall per row, only between neighbouring gauges. Optional row dividers','<b>Logs tab</b>: select all, none, by date or by profile; export to a folder or USB stick, save a zip, open in Graph, move to .old, restore or delete','Logs are now named ejlogger_2026-11-06_1755_master.csv (_split when a profile switch cuts one); each log\'s details (profile, ECU, rows, true rate, why it stopped) sit in a hidden .meta folder, and a log cut by a power loss is marked on the next start','Car mode: plug in your USB stick and a prompt offers to sync the logs to it, then moves the synced ones to .old','Config → Log storage: move logs to .old after N days, delete from .old after N days, and warn when free space runs low'];
const OLDER=[['3.0.4',['<b>Car mode</b> (Config → This PC): from the next launch ejStudio opens straight into ejLogger, full screen on the cluster, connects on its own and keeps retrying until the ECU answers','In car mode, tap the top edge of the screen or press Esc for the full ejLogger (Parameters, Designer, Config, COM ports), and ⤢ returns to the full-screen cluster. Everything is usable on a small in-car screen','Auto-record in car mode: recording starts once data has settled, and on a cold start waits until coolant reaches 60 °C (or 75 s) so the secondary air pump does not pollute the log','Config → Auto-record holds the timing and the cold-start rules. Ctrl+Shift+Q closes ejStudio in car mode']],['3.0.3',['<b>Screensavers</b>, chosen per profile: Header Pulses (the boxer\'s unequal-length headers firing 1-3-2-4), Ink (drops unfurling in water) and Night Sky (wheeling stars, a shooting star on every blip)','RPM sets the pace, a throttle blip brightens the scene and coolant sets the colour, from blue through green to amber','Starts after you have been stopped below the idle rpm for a set time, and wakes at a set speed or with a touch. Car cluster only','Config → Screensaver: style, timing, wake speed, coolant colours, clock (size, opacity, corner or centre) and fades, with a Preview button']],['3.0.2',['<b>Designer</b>: click a tile to set its title, colours (title, digits, min/max, unit), sizes and bottom row (Min+Max, Min, Max, Poll rate, Off). Saved per profile','Designer layout: drag tiles to reorder, add logged gauges, remove tiles, and pick the grid (Auto, 2 × 2, 3 × 2, 3 × 3, 4 × 3)','TRIMS settings (title, CL/OL closed value, tag position, grey when open loop) live in the Designer','Config → Cluster: Warm-up, Warn limits, Night dimming and Wideband fuel cut are now editable and update the cluster live','Night dimming dims the cluster after sunset and before sunrise (worked out offline), or on demand','Wideband fuel cut shows - - - - again, as on the original cluster','Every change saves straight to the cluster .properties files, keeping your comments and the rest of each file']],['3.0.1',['ejLogger Live shows your real cluster: layout pages, gauge titles and units, TRIMS (AFC + AFL with total and CL/OL tag), MIN/MAX rows, poll rate and the rec timer','Warn limits colour and flash the gauges in three tiers, with the digit colour easing toward amber as a value nears its limit. The wideband warns on deviation from commanded fuel','Warm-up: WARMING UP pill with time to warm, and a progress ring around the cluster that runs from red to green','Smooth number motion, which always snaps instantly in a warn tier so knock is never lagged','Profiles (master, boost, testdiag and your own) switch the logged parameters and the cluster page together. Long pages split into swipeable pages','Config → Cluster files: import an existing ClusterConfig folder, or open the cluster folder to edit the .properties files','PLX wideband column name fixed']],['3.0.0',['ejLab is now <b>ejStudio</b>, with a new name, logo and installer. Your settings, tune and saved sessions carry over','New: <b>ejLogger</b>, a live logger built in. Hover the logo to switch. Standard SSM fast poll, standard logger definitions, and standard CSV logs that open in any log tool','ejLogger Live: cluster view or Basic View with min/max, the true logged rate, ECU and wideband status, and Open last log in Graph','ejLogger Parameters: grouped by category, units per parameter, bytes and expected rate, and saved profiles','External widebands on their own port: AEM UEGO, Innovate LC-2 and PLX. A missing port is retried every second and logging carries on','The logger runs in the background, so switching to ejStudio keeps recording (red dot on the logo). Closing while recording asks first','Connect connects straight away; ▾ beside it sets the ECU port, logger definition and wideband. The Config tab holds the rest: auto-connect, log folder, open in Graph when recording stops']],['2.1.11',['Logs keep every logged sample: fast-poll rows that arrive together over Bluetooth are real ECU samples (about 3× the data), spread evenly in time for the maths. Auto table picks, model checks, MAF transient and knock windows keep their old timing','What\'s new keeps older versions in a closed Older list']],['2.1.10',['Timing variant chips and the Reference tables menu no longer show knock counts','Update checks now look at the public ejLab releases page; Open download page goes straight to it','Bug reports send straight to the ejLab issue tracker, nothing to set up; an attached log CSV is zipped into your reports folder','GitHub repo and token fields removed from Updates & bug reports']],['2.1.9',['Applied suggestions clear: timing pulls are measured from the loaded revision, so applying never stacks a second pull','Tables follow the playhead again by default (the table crosshair was hidden when Follow was off)','Fixed: knock marks drawing over the axis labels when zoomed in','Knock heat and knock marks only show on the table the ECU was using when the knock happened','Cruise / Non-Cruise chips show how many knock frames happened on each table, so you know which one to edit','Fixed: analysis getting stuck on "Analysing" when the pooled logs were recorded on a different revision','An error during analysis now closes the loading screen and is written to the error log','New transparent ejLab icon for the desktop, taskbar and installer','Startup: the window now always appears, and startup crashes are written to the error log','Landing animations rebuilt: ten feature previews with camera moves, each joined by its own transition (the playhead dives into a table cell, the Suggestions window applies onto the table, the table folds into the MAF strip, a MAF bar flies into the curve, the curve bursts into a scatter cloud, and more)','Tables overlays pool every pooled log on the current revision: knock heat, knock marks, fuel cut and visited cells, with log counts on hover','Knock mark is simply on or off and shows every mark; Live marks last removed','Knock windows: thinner lines that follow the cell edges','Jump to event is now a styled, searchable menu','Clicking the scrubber or a graph no longer pauses playback; dragging in Full log scrubs and keeps the full view','Removed: table notes, Suggest zone. Fixed: selected MAF row losing its layout','Suggestions window redesigned as grouped cards with switches, evidence chips and live totals','Clearer Tables labels: Non-Cruise (TGV open) / Cruise (TGV closed) with an ECU marker, Reference tables in their own menu, Calculated total, Knock pull, plainer edit bar buttons','<b>MAF Scaling</b> redesigned: zoned list (Idle, Cruise, Load, Boost) with zone averages, a side panel that stays in view, an overview strip, and Suggest zone','One-axis tables like MAF scaling are now vertical, with a tall graph beside them','Edit mode: right-click menu (maths, interpolate, smooth, copy/paste, undo, revert, copy from another revision), selection stats, - subtracts, and * / + work inside Set value','Timing suggestions follow strict rules: repeated sustained knock only, blocked when IAM drops, spread over the cells the ECU blends, max 2° per cell, tapered with no humps, fuel-cut areas left alone, base timing only','Suggestions: Select all / Unselect all per category','Build: the note is now placeholder text in the box','Build: self-test report readable in the console, and a 3-minute self-test timeout','<b>MAF Tools</b> tab replaces MAF Scaling and MAF Curve: Scaling | Curve | Both per pane, and a Corrected / Current curve filter','Edit tune button shows unbuilt changes; error dot on the settings button','UI scale setting in the drawer','Fixed: pop-out table going blank after closing, drawer under the window buttons, ejLab wordmark spacing','<b>Edit tune</b> button in the top bar; the pane you are editing gets an amber border','Setting cards edit inline with Project Lambda labels (Min/Max, Low/High, AT/MT)','Rename tables and cards per car (double-click the title) and add notes to any table',
  '<b>MAF Scaling</b> focus list: bigger voltage and multiplier, severity tint, a live <b>Now</b> strip, and jump links to the curve and table','Knock windows now use both the lower and upper bounds from the tune','Timing variants show Cruise / Non-Cruise; a chip flags logs that fit the VVT On tables',
  'Tables: dim unvisited cells with dwell time on hover, and a fuel-cut overlay','Graph: Full log shows the whole log, event ticks with hover, right-click an event to open its table','Edit history, read-only compare against any revision, arrow keys in Edit mode, automatic backups on Build',
  'Command palette (Ctrl+K), UI scale (Ctrl+= / Ctrl+− / Ctrl+0), title-bar status, drop files to open or compare as B','Scatter colour legend, MAF Curve legend, smart defaults for new logs','Fixed: What\'s new button, MAF Scaling playback highlight, zoom now stops following']]];
function whatsNew(){ modal(`What's new in ejStudio ${APP_VER}`,`<ul>${CHANGES.map(c=>`<li>${c}</li>`).join('')}</ul>`+(OLDER.length?`<details class="wn-old"><summary>Older</summary>${OLDER.map(([v,l])=>`<div class="vlab">${v}</div><ul>${l.map(c=>`<li>${c}</li>`).join('')}</ul>`).join('')}</details>`:''),[['ok','Close','acc']]); }
function aboutHtml(){ const i=INFO||{}; return `<div class="kv"><span>Version</span><b>${APP_VER}</b><span>Built</span><b>${BUILD_DATE}</b>${i.electron?`<span>Electron</span><b>${esc(i.electron)}</b><span>Chromium</span><b>${esc(i.chrome)}</b>`:''}</div>`
  +`<div class="note">ejStudio grew out of tooling built around <b>RomRaider</b> (romraider.com) and <b>Project Lambda</b> (lambdatuning.com). Weather data by <b>Open-Meteo.com</b>, CC BY 4.0.</div>`
  +`<div class="note">Private build for personal use. Not for sale or redistribution.</div><div class="drow"><button class="btn sm" data-act="news">What's new</button>${i.userData?'<button class="btn sm" data-act="odata">Open data folder</button>':''}</div>`; }
function updHtml(){ const u=UI.upd;
  return `<div class="note">${u&&u.newer?`Update available: <b>${esc(u.tag)}</b>`:'Checks for updates at launch'}</div>`
   +`<div class="drow"><button class="btn sm" data-act="updchk">Check for updates</button>${u&&u.newer?'<button class="btn sm acc" data-act="updopen">Open download page</button>':''}<button class="btn sm" data-act="bug">Bug report</button>${window.rrlab&&window.rrlab.openReports?'<button class="btn sm" data-act="reps">Reports folder</button>':''}</div>`; }
const GH_REPO='lupeloop/ejLab';
const semv=v=>String(v).replace(/^v/i,'').split('.').map(n=>parseInt(n)||0), newer=(a,b)=>{ const x=semv(a), y=semv(b); for(let i=0;i<3;i++){ if((x[i]||0)!==(y[i]||0)) return (x[i]||0)>(y[i]||0); } return false; };
async function checkUpdates(manual){
  try{ const r=await fetch(`https://api.github.com/repos/${GH_REPO}/releases/latest`,{headers:{Accept:'application/vnd.github+json'}}); if(!r.ok) throw r.status; const j=await r.json();
    UI.upd={tag:j.tag_name,url:j.html_url,newer:newer(j.tag_name,APP_VER)}; save(); drawerRefresh(); if(UI.upd.newer) toast('Update available: '+j.tag_name); else if(manual) toast('ejStudio is up to date'); }
  catch(e){ elog('update check failed '+e); if(manual) toast('Update check failed'); } }
async function gzBlob(str){ return new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); }
const b64=async blob=>{ const b=new Uint8Array(await blob.arrayBuffer()); let o=''; for(let k=0;k<b.length;k+=0x8000) o+=String.fromCharCode.apply(null,b.subarray(k,k+0x8000)); return btoa(o); };
async function bugReport(){ const L=RP.L, i=INFO||{}, R=window.rrlab; let log=''; try{ log=R&&R.readLog?await R.readLog():''; }catch(_){} log=log||ERRS.join('\n')||'(no errors logged)';
  let on=false; try{ on=!!(R&&R.ghReady&&await R.ghReady()); }catch(_){}
  const sys=`ejStudio ${APP_VER} (built ${BUILD_DATE}) · Electron ${i.electron||'—'} · Chromium ${i.chrome||'—'} · ${navigator.userAgent}`, ch=L?L.name+': '+L.headers.join(', '):'(no log loaded)';
  const p=modal('Bug report',`<input class="tt-q" style="margin:0" data-f="who" placeholder="Your name / contact" value="${esc(UI.bugWho||'')}"><textarea class="axis" style="height:90px" data-f="desc" placeholder="What happened, and what were you doing?"></textarea>`
    +`<label class="drow"><input type="checkbox" data-f="sys" checked><span>System info</span></label><label class="drow"><input type="checkbox" data-f="log" checked><span>Error log (last 5 days)</span></label><label class="drow"><input type="checkbox" data-f="ch" checked><span>Channel list of the current log</span></label>${L?'<label class="drow"><input type="checkbox" data-f="csv"><span>Attach the current log CSV</span></label>':''}`
    +`<div class="vlab">Will be sent</div><pre data-prev></pre>`,[['x','Cancel','ghost'],['file','Save to file',''],...(on?[['send','Send','acc']]:[])]);
  const body=(v,f)=>[`Reported by: ${v.who||'—'}`,'',v.desc||'(no description)',...(v.sys?['','## System',sys]:[]),...(v.ch?['','## Channels',ch]:[]),...(v.log?['','## Error log','```',log.slice(-60000),'```']:[]),...(v.csv&&L?['',`Log CSV saved on the reporter's PC: reports\\${f||'<file>.csv.gz'}`]:[])].join('\n');
  const d=MODAL; d._upd=x=>{ const v={}; x.querySelectorAll('[data-f]').forEach(e=>v[e.dataset.f]=e.type==='checkbox'?e.checked:e.value); x.querySelector('[data-prev]').textContent=body(v); }; d._upd(d);
  const {v,vals}=await p; if(!v||v==='x') return; UI.bugWho=vals.who; save(); const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  let fname='', saved=false; if(vals.csv&&L){ fname=`ejlab_bug_${stamp}_${L.name.replace(/[^\w.-]/g,'_')}.gz`; const gz=await gzBlob(L.src);
    if(R&&R.saveReport){ try{ saved=!!(await R.saveReport(fname,await b64(gz))); }catch(e){ elog('report save failed '+e); } } if(!saved){ dl(gz,fname); saved=true; } }
  const txt=body(vals,fname);
  if(v==='file'){ dl(new Blob([txt],{type:'text/plain'}),`ejlab_bug_${stamp}.txt`); if(fname&&R&&R.openReports) R.openReports(fname); return; }
  busy(true,'Sending report',''); try{ const r=await R.ghIssue(`[${APP_VER}] ${(vals.desc||'Bug report').split('\n')[0].slice(0,80)}`,txt); if(!r||!r.ok) throw 'issue '+(r&&r.status);
    busy(false); toast(fname?'Bug report sent. Send the zipped log from your reports folder':'Bug report sent'); if(fname&&R.openReports) R.openReports(fname); }
  catch(e){ busy(false); elog('bug report failed '+e); toast('Send failed, saved to file instead'); dl(new Blob([txt],{type:'text/plain'}),`ejlab_bug_${stamp}.txt`); } }
// ── plain-text session report ──
function saveReport(){ if(!ST.logs.length&&!TUNE){ toast('Nothing to report'); return; }
  const o=[], H=t=>o.push('',t.toUpperCase(),'-'.repeat(t.length)), pad=(x,n)=>String(x).padEnd(n), P=profNow();
  o.push('ejStudio session report',`${new Date().toLocaleString()} · ejStudio ${APP_VER}`);
  H('Tune'); if(TUNE){ o.push(`File   ${TUNE.name}`,`CAL    ${TUNE.cal} · ROM ${TUNE.rom}`); if(window.__tuneInfo) o.push(...window.__tuneInfo()); } else o.push('(none)');
  H('Vehicle'); if(P) for(const [k,l] of PROF_FIELDS){ if(P[k]!==''&&P[k]!=null) o.push(pad(l,24)+P[k]); } else o.push('(none)');
  for(const L of ST.logs){ H('Log · '+L.name); const m=UI.meta[L.fp]||{}, dt=logDate(L);
    o.push(`Logged      ${dt&&!isNaN(dt)?dt.toLocaleString():'—'}`,`Frames      ${L.N.toLocaleString()} · ${fmtT(L.dur)}`+(trimOf(L)?' · trimmed':'')+(pooled(L)?'':' · not pooled'));
    if(window.__logRev) o.push('Recorded on '+window.__logRev(L));
    for(const [k,l,u] of [['ambient','Ambient','°C'],['baro','Baro','kPa'],['hum','Humidity','%'],['octane','Octane',''],['intake','Intake',''],['notes','Notes','']]) if(m[k]!==''&&m[k]!=null) o.push(pad(l,12)+m[k]+(u?' '+u:''));
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
  const nm=(RP.L?RP.L.name.replace(/\.csv$/i,''):TUNE?TUNE.name.replace(/\.tune$/i,''):'session')+'_report.txt'; dl(new Blob([o.join('\r\n')],{type:'text/plain'}),nm); }

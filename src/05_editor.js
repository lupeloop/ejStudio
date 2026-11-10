// ════════ table editor ════════
const EDIT={on:false,T:null,undo:[],redo:[],ver:0,overlays:true,onlyEd:false,ok:new Set()};
function edReset(){ EDIT.T=null; EDIT.undo=[]; EDIT.redo=[]; EDIT.ver++; EDIT.ok.clear(); if(typeof TV!=='undefined'&&TV) TV.edRefresh(); }
const RAIL_DEF={timing:2,fuel:5,maf:5,boost:2,wg:10}, rails=()=>Object.assign({},RAIL_DEF,UI.rails||{});
function editorSettingsHtml(){ const R=rails(), f=(k,l,u)=>`<label class="drow"><span>${l}</span><input class="num" type="number" step="any" data-rail="${k}" value="${R[k]}"><em>${u}</em></label>`;
  return ''+f('timing','Timing per cell','°')+f('fuel','Fuel target per cell','%')+f('maf','MAF scaling per bin','%')+f('boost','Boost target per cell','psi')+f('wg','Wastegate duty per cell','%'); }
const same=(a,b)=>a===b||Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a));
const baseOf=t=>{ if(t&&t.__src){ const b=TUNE&&TUNE.byId[t.id]; return b&&b.z&&{z:b.z[0].map(v=>[v]),x:[0],y:b.x}; } return t&&TUNE&&TUNE.byId[t.id]; };
function vT(t){ if(!t||t.yin||!t.z||t.z.length!==1||UI.vert1d===false) return t; const p=Object.create(t); p.__src=t; p.vert=true; p.x=[0]; p.y=t.x; p.yin=t.xin; p.z=t.z[0].map(v=>[v]); return p; }
function unV(t,z,k){ if(!t||!t.__src) return [t,z,k]; return [t.__src,k==='y'?z:[z.map(r=>r[0])],k==='y'?'x':k]; }
function edDisp(t){ if(t.lam) return {k:lamK(UI.wbDisp),o:0,dp:dpOf(UI.wbDisp),u:uLbl(UI.wbDisp)}; if(t.pk) return pDisp(t.pk); if(t.unit==='°C'&&UI.tu==='F') return {k:1.8,o:32,dp:t.dp,u:'°F'}; return {k:1,o:0,dp:t.dp,u:t.unit}; }
function axDisp(key){ if(PK[key]) return pDisp(PK[key]); if((key==='ect'||key==='iat')&&UI.tu==='F') return {k:1.8,o:32}; return {k:1,o:0}; }
const toD=(d,v)=>v*d.k+(d.o||0), toR=(d,x)=>(x-(d.o||0))/d.k, fmtRaw=v=>String(+(+v).toPrecision(10));
function cardEdited(c){ const b=TUNE&&TUNE.cards.find(x=>x.id===c.id); return !!(EDIT.T&&b&&JSON.stringify(c.v)!==JSON.stringify(b.v)); }
let EDC={ver:-1};
function edChanges(){ if(EDC.ver===EDIT.ver) return EDC.list; const out=[]; if(EDIT.T&&TUNE){
  for(const t of EDIT.T.tables){ const b=baseOf(t); if(!b) continue; const cells=[]; t.z.forEach((r,i)=>r.forEach((v,j)=>{ if(b.z[i]&&!same(v,b.z[i][j])) cells.push([i,j,b.z[i][j],v]); }));
    const ax=[]; t.x.forEach((v,j)=>{ if(!same(v,b.x[j])) ax.push(['x',j,b.x[j],v]); }); if(t.yin) t.y.forEach((v,j)=>{ if(!same(v,b.y[j])) ax.push(['y',j,b.y[j],v]); });
    if(cells.length||ax.length) out.push({t,cells,ax}); }
  for(const c of EDIT.T.cards) if(cardEdited(c)) out.push({card:c,base:TUNE.cards.find(x=>x.id===c.id)}); }
  EDC={ver:EDIT.ver,list:out}; return out; }
function edCount(){ return edChanges().reduce((n,x)=>n+(x.card?1:x.cells.length+x.ax.length),0); }
function grpEdited(g){ return edChanges().some(x=>x.t&&x.t.group===g); }
const isCareful=t=>t.cat==='Sensors'||t.cat==='Limits'||t.group==='blim';
function railFor(t){ const R=rails(), g=t.group;
  if(g==='timing'||g==='kca') return {lim:R.timing,txt:R.timing+'°',d:(a,b)=>Math.abs(a-b),f:v=>v.toFixed(1)+'°'};
  if(g==='fuel'||g==='fbase'||g==='maf'){ const L=g==='maf'?R.maf:R.fuel; return {lim:L,txt:L+'%',d:(a,b)=>b?Math.abs(a/b-1)*100:0,f:v=>v.toFixed(1)+'%'}; }
  if(g==='boost') return {lim:R.boost,txt:R.boost+' psi',d:(a,b)=>Math.abs(a-b)*0.1450377,f:v=>v.toFixed(1)+' psi'};
  if(g==='wgb'||g==='wgm') return {lim:R.wg,txt:R.wg+'% duty',d:(a,b)=>Math.abs(a-b),f:v=>v.toFixed(1)+'%'}; return null; }
function careOK(id,name,kind){ if(EDIT.ok.has(id)) return true; if(!confirm(`${name} is a ${kind} setting. Changing it can affect engine protection or sensor readings.\n\nEdit anyway?`)) return false; EDIT.ok.add(id); return true; }
function edGuard(t,z){ [t,z]=unV(t,z); if(isCareful(t)&&!careOK(t.id,t.gname,t.cat==='Sensors'?'sensor':'limit')) return false;
  const b=baseOf(t), rl=railFor(t); if(rl&&b){ let n=0, w=0; z.forEach((r,i)=>r.forEach((v,j)=>{ if(!b.z[i]) return; const d=rl.d(v,b.z[i][j]); if(d>rl.lim+1e-9){ n++; if(d>w) w=d; } }));
    if(n&&!confirm(`${n} cell${n>1?'s':''} in ${t.gname} would change by more than ${rl.txt} from the loaded tune (largest ${rl.f(w)}).\n\nApply anyway?`)) return false; }
  if(t.group==='maf'&&z[0].some((v,i)=>i&&v<=z[0][i-1])&&!confirm('MAF scaling would no longer increase at every step.\n\nApply anyway?')) return false; return true; }
function snap(t,k){ return k==='z'?t.z.map(r=>r.slice()):t[k].slice(); }
function edCommit(items,label){ items=items.map(it=>{ if(!it.t||!it.t.__src||it.card) return it; const [t,after,k]=unV(it.t,it.after,it.k); return {...it,t,after,k}; }).filter(it=>it.k!=='x'||!it.t.__src); const u=items.map(it=>({id:it.t.id,card:!!it.card,k:it.k,before:it.card?JSON.parse(JSON.stringify(it.t.v)):snap(it.t,it.k),after:it.after}));
  EDIT.undo.push({label,u}); if(EDIT.undo.length>500) EDIT.undo.shift(); EDIT.redo=[]; edApply(u,'after'); }
function edApply(u,w){ const E=EDIT.T; for(const x of u){ const v=x[w];
    if(x.card){ const c=E.cards.find(q=>q.id===x.id); if(c){ c.v=JSON.parse(JSON.stringify(v)); E.m[x.id]=JSON.parse(JSON.stringify(v)); } continue; }
    const t=E.tables.find(q=>q.id===x.id); if(!t) continue;
    if(x.k==='z'){ const put=z=>z.forEach((r,i)=>r.splice(0,r.length,...v[i])); put(t.z); for(const id of t._ids){ const o=E.byId[id]; if(o&&o.z!==t.z) put(o.z); } }
    else { const aid=t[x.k==='x'?'xid':'yid'], all=E.tables.concat(Object.values(E.byId));
      for(const q of all){ if(q.xid===aid&&q.x) q.x.splice(0,q.x.length,...v); if(q.yid===aid&&q.y&&q.yin) q.y.splice(0,q.y.length,...v); }
      if(E.m[aid]) E.m[aid][0]=v.slice(); } }
  EDIT.ver++; TV.edRefresh(); RP.dirty=true; if(window.__edChanged) window.__edChanged(); }
function askVal(title,init,hint,ph){ return new Promise(res=>{ const d=mk('div','',document.body); d.id='mapdlg';
  d.innerHTML=`<div class="md-card" style="width:min(380px,100%)"><div class="md-h"><b>${esc(title)}</b>${hint?`<span>${esc(hint)}</span>`:''}</div><div style="padding:.5rem 1.1rem"><input class="tt-q" style="margin:0;width:100%" value="${esc(init??'')}"${ph?` placeholder="${esc(ph)}"`:''}></div><div class="md-f"><button class="btn ghost" data-a="x">Cancel</button><span class="vfill"></span><button class="btn acc" data-a="ok">Apply</button></div></div>`;
  const i=d.querySelector('input'); setTimeout(()=>{ i.focus(); const n=i.value.length; i.setSelectionRange(n,n); },0);
  const done=ok=>{ document.removeEventListener('keydown',kd,true); const v=i.value; d.remove(); res(ok?v:null); };
  const kd=e=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); done(false); } else if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); done(true); } };
  document.addEventListener('keydown',kd,true); d.onclick=e=>{ const b=e.target.closest('[data-a]'); if(b) done(b.dataset.a==='ok'); }; }); }
function cellMenu(e){ closeCtx(); const B=selBox(); if(!B) return; const n=(B.r1-B.r0+1)*(B.c1-B.c0+1), cur=REV.cur, revs=REV.nodes.filter(x=>x.id!==cur&&x.src);
  const items=[['Set value…','set','='],['Add / subtract…','add','+'],['Multiply…','mul','*'],['Change by %…','pct','%'],null,['Interpolate','interp','I'],['Interpolate horizontally','interpH','Shift+I'],['Interpolate vertically','interpV','Alt+I'],['Smooth','smooth','S'],null,
    ['Copy','copy','Ctrl+C'],['Copy with axes','copyax','Ctrl+Shift+C'],['Paste','paste','Ctrl+V'],null,['Undo','undo','Ctrl+Z',!EDIT.undo.length],['Redo','redo','Ctrl+Y',!EDIT.redo.length],null,['Revert to loaded','revert','Del'],...revs.map(x=>['Copy from rev'+x.rev+(x.note?' · '+x.note:''),'rev:'+x.id,''])];
  const m=mk('div','ctxm cellm',document.body); m.id='ctxm'; m.innerHTML=`<i>${n} cell${n>1?'s':''} · ${esc(B.t.gname)}</i>`+items.map((x,k)=>x?`<button data-k="${k}"${x[3]?' disabled':''}><span>${esc(x[0])}</span><kbd>${esc(x[2])}</kbd></button>`:'<hr>').join('');
  m.style.left=Math.min(e.clientX,innerWidth-m.offsetWidth-8)+'px'; m.style.top=Math.max(8,Math.min(e.clientY,innerHeight-m.offsetHeight-8))+'px';
  m.onclick=ev=>{ const b=ev.target.closest('button[data-k]'); if(!b||b.disabled) return; const a=items[+b.dataset.k][1]; closeCtx();
    if(a.startsWith('rev:')){ const T=revTune(a.slice(4)), o=T&&T.byId[B.t.id]; if(!o){ toast('That revision has no '+B.t.gname); return; } const z=B.t.__src?o.z[0].map(v=>[v]):o.z; edOp((r,c)=>z[r]?z[r][c]:NaN,'copy from revision in '+B.t.gname); return; }
    EDITOR.act(a); };
  setTimeout(()=>document.addEventListener('pointerdown',function f(ev){ if(!ev.target.closest('#ctxm')){ closeCtx(); document.removeEventListener('pointerdown',f,true); } },true),0); }
function selBox(){ const t=TV.cur(), S=TV.sel(); if(!t||!S||S.r0==null) return null; return {t,r0:Math.min(S.r0,S.r1),r1:Math.max(S.r0,S.r1),c0:Math.min(S.c0,S.c1),c1:Math.max(S.c0,S.c1)}; }
function edOp(fn,label){ const B=selBox(); if(!B){ toast('Select cells first'); return; } const t=B.t, z=t.z.map(r=>r.slice());
  for(let r=B.r0;r<=B.r1;r++) for(let c=B.c0;c<=B.c1;c++){ const v=fn(r,c,t.z,B); if(Number.isFinite(v)) z[r][c]=v; }
  if(z.every((r,i)=>r.every((v,j)=>same(v,t.z[i][j])))) return; if(!edGuard(t,z)) return; edCommit([{t,k:'z',after:z}],label); }
function parseGrid(txt){ const L=String(txt).replace(/\r/g,'').split('\n'); while(L.length&&!L[L.length-1].trim()) L.pop(); if(!L.length) return null;
  const kind=(/^\[(Table[123]D)\]/.exec(L[0])||[])[1]; let rows=L.map(l=>l.split(/\t|,(?=\s*-?[\d.])/).map(x=>x.trim()));
  if(kind==='Table3D') rows=rows.slice(2).map(r=>r.slice(1)); else if(kind==='Table2D') rows=rows.slice(2,3); else if(kind==='Table1D') rows=rows.slice(1,2);
  const g=rows.map(r=>r.filter(x=>x!=='').map(Number)); if(!g.length||g.some(r=>!r.length||r.some(v=>!Number.isFinite(v)))) return null; return {kind,g}; }
const EDITOR={
  on(v){ if(v&&!TUNE){ toast('Load a tune first'); return; } EDIT.on=!!v; if(v&&!EDIT.T) EDIT.T=structuredClone(TUNE);
    if(v&&!UI.panes.slice(0,paneCount()).includes('table')&&!POP.table) setPaneView(UI.focus,'table'); TV.edRefresh(); RP.dirty=true; },
  key(e){ if(!EDIT.on||!TV.isShown()) return false; const k=keyOf(e); if(!k) return false;
    if(/^Arrow/.test(e.key)&&!e.ctrlKey&&!e.altKey&&!e.metaKey){ const S=TV.sel(), t=TV.cur(); if(t&&S&&S.r0!=null){ e.preventDefault(); const dr=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0, dc=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0, R=t.z.length-1, C=t.x.length-1, cl=(v,m)=>Math.max(0,Math.min(m,v));
      if(e.shiftKey) TV.setSel({r1:cl(S.r1+dr,R),c1:cl(S.c1+dc,C)}); else { const r=cl(S.r1+dr,R), c=cl(S.c1+dc,C); TV.setSel({r0:r,r1:r,c0:c,c1:c}); } return true; } }
    for(const [id,,d] of ACTIONS) if(id.startsWith('ed:')&&(UI.keys[id]??d)===k){ e.preventDefault(); this.act(id.slice(3)); return true; }
    if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&/^[0-9.\-]$/.test(e.key)&&selBox()){ e.preventDefault(); if(e.key==='-') this.ask('add','-'); else this.ask('set',e.key); return true; } return false; },
  act(a){ switch(a){ case 'mul': case 'div': case 'set': case 'add': case 'pct': this.ask(a); break; case 'interp': this.interp(''); break; case 'interpH': this.interp('h'); break; case 'interpV': this.interp('v'); break;
    case 'smooth': this.smooth(); break; case 'revert': this.revert(); break; case 'undo': this.undo(); break; case 'redo': this.redo(); break; case 'copy': this.copy(false); break; case 'copyax': this.copy(true); break;
    case 'paste': this.paste(); break; case 'all': { const t=TV.cur(); if(t) TV.setSel({r0:0,c0:0,r1:t.z.length-1,c1:t.x.length-1}); break; }
    case 'hist': this.hist(); break; case 'diff': revDiff(); break; case 'build': if(window.__build) window.__build(); else toast('Build is not available'); break; case 'sug': if(HR.open) hrClose(); else hrOpen(); break;
    case 'exit': { const S=TV.sel(); if(S&&S.r0!=null) TV.setSel({r0:null}); else this.on(false); break; } } },
  async ask(kind,init){ const B=selBox(); if(!B){ toast('Select cells first'); return; } const t=B.t, d=edDisp(t), n=(B.r1-B.r0+1)*(B.c1-B.c0+1);
    const T={set:['Set value',d.u],mul:['Multiply by','×'],div:['Divide by','÷'],add:['Add (negative subtracts)',d.u],pct:['Change by %','%']}[kind];
    let v=await askVal(T[0],init??(kind==='set'&&n===1?dv1(d,t.z[B.r0][B.c0]):''),`${n} cell${n>1?'s':''} · ${T[1]}`); if(v==null) return; v=String(v).trim(); if(kind==='set'){ const p={'*':'mul','/':'div','+':'add'}[v[0]]; if(p){ kind=p; v=v.slice(1); } else if(v[0]==='='){ v=v.slice(1); } } const x=parseFloat(String(v).replace(',','.')); if(!Number.isFinite(x)){ toast('Not a number'); return; }
    if(kind==='div'&&!x){ toast('Cannot divide by 0'); return; }
    const f={set:()=>toR(d,x),mul:(r,c,z)=>toR(d,toD(d,z[r][c])*x),div:(r,c,z)=>toR(d,toD(d,z[r][c])/x),add:(r,c,z)=>toR(d,toD(d,z[r][c])+x),pct:(r,c,z)=>toR(d,toD(d,z[r][c])*(1+x/100))}[kind];
    edOp(f,{set:'set '+x,mul:'× '+x,div:'÷ '+x,add:(x>0?'+':'')+x,pct:(x>0?'+':'')+x+'%'}[kind]+' in '+t.gname); },
  interp(mode){ const B=selBox(); if(!B){ toast('Select cells first'); return; } const t=B.t, h=B.c1>B.c0, v=B.r1>B.r0;
    if(!mode) mode=h&&v?'2d':h?'h':v?'v':''; if(!mode||(mode==='h'&&!h)||(mode==='v'&&!v)){ toast('Select at least two cells along the direction'); return; }
    const fx=c=>{ const a=t.x[B.c0], b=t.x[B.c1]; return b!==a?(t.x[c]-a)/(b-a):(c-B.c0)/(B.c1-B.c0); }, fy=r=>{ const a=t.y[B.r0], b=t.y[B.r1]; return t.yin&&b!==a?(t.y[r]-a)/(b-a):(r-B.r0)/((B.r1-B.r0)||1); };
    edOp((r,c,z)=>{ if(mode==='h') return z[r][B.c0]+(z[r][B.c1]-z[r][B.c0])*fx(c); if(mode==='v') return z[B.r0][c]+(z[B.r1][c]-z[B.r0][c])*fy(r);
      const a=fx(c), b=fy(r); return (z[B.r0][B.c0]*(1-a)+z[B.r0][B.c1]*a)*(1-b)+(z[B.r1][B.c0]*(1-a)+z[B.r1][B.c1]*a)*b; },'interpolate '+t.gname); },
  smooth(){ edOp((r,c,z)=>{ let s=0,n=0; for(let i=r-1;i<=r+1;i++) for(let j=c-1;j<=c+1;j++) if(z[i]&&z[i][j]!=null){ s+=z[i][j]; n++; } return s/n; },'smooth '+(TV.cur()||{}).gname); },
  revert(){ const B=selBox(); if(!B) return; const b=baseOf(B.t); if(!b) return; edOp((r,c)=>b.z[r]?b.z[r][c]:NaN,'revert in '+B.t.gname); },
  undo(){ const x=EDIT.undo.pop(); if(!x){ toast('Nothing to undo'); return; } EDIT.redo.push(x); edApply(x.u,'before'); if(!this._q) toast('Undid: '+x.label); },
  redo(){ const x=EDIT.redo.pop(); if(!x){ toast('Nothing to redo'); return; } EDIT.undo.push(x); edApply(x.u,'after'); toast('Redid: '+x.label); },
  copy(ax){ const t=TV.cur(); if(!t) return; const j=r=>r.map(fmtRaw).join('\t');
    if(ax){ const txt=t.yin?['[Table3D]','\t'+j(t.x),...t.z.map((r,i)=>fmtRaw(t.y[i])+'\t'+j(r))]:['[Table2D]',j(t.x),j(t.z[0])]; copyText(txt.join('\r\n'),'Table copied with axes'); return; }
    const B=selBox(); if(!B){ toast('Select cells first'); return; } const o=[]; for(let r=B.r0;r<=B.r1;r++) o.push(j(t.z[r].slice(B.c0,B.c1+1))); copyText(o.join('\r\n'),`${o.length} × ${B.c1-B.c0+1} copied`); },
  async paste(){ const t=TV.cur(); if(!t) return; let txt=''; try{ txt=window.rrlab&&window.rrlab.paste?await window.rrlab.paste():await navigator.clipboard.readText(); }catch(_){ toast('Clipboard not readable'); return; }
    const P=parseGrid(txt); if(!P){ toast('Clipboard has no number grid'); return; } const g=P.g, gr=g.length, gc=Math.max(...g.map(r=>r.length)), ny=t.z.length, nx=t.x.length;
    let r0=0, c0=0; const B=selBox(); if(P.kind){ if(gr!==ny||gc!==nx){ if(!confirm(`The pasted table is ${gr} × ${gc} but ${t.gname} is ${ny} × ${nx}.\n\nPaste the part that fits from the top-left?`)) return; } } else if(B){ r0=B.r0; c0=B.c0; }
    if(!P.kind&&(r0+gr>ny||c0+gc>nx)&&!confirm(`The pasted block (${gr} × ${gc}) runs past the edge of ${t.gname}.\n\nPaste the part that fits?`)) return;
    const z=t.z.map(r=>r.slice()); g.forEach((row,i)=>row.forEach((v,j)=>{ if(z[r0+i]&&z[r0+i][c0+j]!=null) z[r0+i][c0+j]=v; }));
    if(!edGuard(t,z)) return; edCommit([{t,k:'z',after:z}],'paste in '+t.gname); TV.setSel({r0,c0,r1:Math.min(ny-1,r0+gr-1),c1:Math.min(nx-1,c0+gc-1)}); },
  async axis(t,w,i,name){ const aid=t[w==='x'?'xid':'yid'], key=w==='x'?t.xin:t.yin; if(!aid||aid==='#'){ toast('This axis is a plain index and cannot be edited'); return; }
    const arr=t[w], d=axDisp(key), n=EDIT.T.tables.filter(q=>q.xid===aid||(q.yin&&q.yid===aid)).length;
    const v=await askVal(`${name} axis, breakpoint ${i+1}`,fmtRaw(toD(d,arr[i])),n>1?`shared by ${n} tables`:''); if(v==null) return; const x=parseFloat(String(v).replace(',','.')); if(!Number.isFinite(x)) return;
    const nv=arr.slice(); nv[i]=toR(d,x); if(nv.some((q,k)=>k&&q<=nv[k-1])&&!confirm('The axis would no longer increase at every step. The ECU needs increasing breakpoints.\n\nApply anyway?')) return;
    if(aid==='maf_scale_index'&&!confirm('Changing the MAF axis moves the MAF Scaling bins once this revision is built and loaded.\n\nContinue?')) return;
    if(isCareful(t)&&!careOK(t.id,t.gname,t.cat==='Sensors'?'sensor':'limit')) return; edCommit([{t,k:w,after:nv}],`${name} axis in ${t.gname}`); },
  cardOK(id){ const c=EDIT.T&&EDIT.T.cards.find(q=>q.id===id); if(!c) return false; return !((c.cat==='Limits'||c.cat==='Sensors')&&!careOK(id,nm('c:'+id,c.label),c.cat==='Sensors'?'sensor':'limit')); },
  cardSet(id,rows){ const c=EDIT.T.cards.find(q=>q.id===id); if(!c) return; const d=c.pk?pDisp(c.pk):c.unit==='°C'&&UI.tu==='F'?{k:1.8,o:32}:{k:1,o:0};
    const after=rows.map(r=>r.map(x=>toR(d,x))); if(JSON.stringify(after)===JSON.stringify(c.v)){ TV.edRefresh(); return; } edCommit([{t:c,card:true,k:'v',after}],nm('c:'+id,c.label)); },
  hist(){ if(!EDIT.undo.length) return; const d=mk('div','',document.body); d.id='mapdlg';
    d.innerHTML=`<div class="md-card" style="width:min(460px,100%)"><div class="md-h"><b>Edit history</b><span>click a step to go back to it</span></div><div class="md-list">${EDIT.undo.map((x,k)=>[x,k]).reverse().map(([x,k])=>`<button class="hrow${k===EDIT.undo.length-1?' on':''}" data-k="${k+1}">${k+1}. ${esc(x.label)}</button>`).join('')}<button class="hrow" data-k="0">0. Loaded revision</button></div><div class="md-f"><button class="btn ghost" data-x>Close</button></div></div>`;
    const done=()=>{ document.removeEventListener('keydown',kd,true); d.remove(); }, kd=e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(); } }; document.addEventListener('keydown',kd,true);
    d.onclick=e=>{ if(e.target.closest('[data-x]')) return done(); const b=e.target.closest('[data-k]'); if(!b) return; const k=+b.dataset.k; this._q=1; while(EDIT.undo.length>k) this.undo(); this._q=0; done(); toast('Back to step '+k); }; } };

function dv1(d,v){ return (+toD(d,v).toFixed(Math.max(0,d.dp??3))).toString(); }
ACTIONS.push(['ed:set','Set value','='],['ed:mul','Multiply','*'],['ed:div','Divide','/'],['ed:add','Add / subtract','+'],['ed:pct','Change by %','%'],['ed:interp','Interpolate','I'],['ed:interpH','Interpolate horizontally','Shift+I'],
  ['ed:interpV','Interpolate vertically','Alt+I'],['ed:smooth','Smooth','S'],['ed:revert','Revert to loaded tune','Delete'],['ed:undo','Undo','Ctrl+Z'],['ed:redo','Redo','Ctrl+Y'],['ed:copy','Copy cells','Ctrl+C'],['ed:copyax','Copy table with axes','Ctrl+Shift+C'],
  ['ed:paste','Paste','Ctrl+V'],['ed:all','Select whole table','Ctrl+A'],['ed:build','Build revision','Ctrl+B'],['ed:sug','Helpers','H'],['ed:exit','Clear selection / leave Edit','Escape']);
window.__tuneChanges=()=>{ const ch=edChanges(); if(!ch.length) return ['No unbuilt edits']; const o=['Unbuilt edits:'];
  for(const x of ch){ if(x.card){ o.push(`  ${x.card.label}: ${x.base.v.map(r=>r.join(' / ')).join(' · ')} → ${x.card.v.map(r=>r.map(fmtRaw).join(' / ')).join(' · ')}`); continue; }
    const d=edDisp(x.t); let lo=Infinity, hi=-Infinity; for(const [,,a,b] of x.cells){ const q=toD(d,b)-toD(d,a); lo=Math.min(lo,q); hi=Math.max(hi,q); }
    o.push(`  ${x.t.gname}${x.t.name&&x.t.name!==x.t.gname?' · '+x.t.name:''}: ${x.cells.length} cell${x.cells.length!==1?'s':''}`+(x.cells.length?` (${lo.toFixed(2)} to ${hi>0?'+':''}${hi.toFixed(2)} ${d.u})`:'')+(x.ax.length?`, ${x.ax.length} axis value${x.ax.length>1?'s':''}`:'')); }
  return o; };
// ════════ revisions · Build · Tuning tree · suggestions ════════
let REV={nodes:[],cur:null}, REVP={};
const curNode=()=>REV.nodes.find(n=>n.id===REV.cur)||REV.nodes[0];
const revNum=n=>{ const m=/_rev(\d+)\.tune$/i.exec(n||''); return m?+m[1]:1; }, revBase=()=>{ const r=REV.nodes.find(n=>!n.parent)||curNode(); return String(r.file||'tune').replace(/\.tune$/i,'').replace(/_rev\d+$/i,''); };
const nid=()=>'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
function revSave(){ try{ localStorage.setItem('ejlab_rev_v1',JSON.stringify(REV)); }catch(_){ toast('Revision history is too big to keep between launches. Save a session to keep it.'); } }
function revRoot(text,name){ const id=nid(); REV={nodes:[{id,rev:revNum(name),parent:null,file:name,note:'',time:Date.now(),src:text}],cur:id}; REVP={}; UI.lrev={}; revSave(); }
function revBoot(text,name){ let r=null; try{ r=JSON.parse(localStorage.getItem('ejlab_rev_v1')||'null'); }catch(_){} if(r&&r.nodes&&r.nodes.some(n=>n.id===r.cur&&n.src===text)){ REV=r; REVP={}; } else revRoot(text,name); }
function revTune(id){ if(!id||id===REV.cur) return TUNE; if(REVP[id]) return REVP[id]; const n=REV.nodes.find(x=>x.id===id); if(!n) return TUNE; try{ return REVP[id]=parseTune(n.src,n.file); }catch(_){ return TUNE; } }
function withLogTune(L,fn){ if(!UI.lrev[L.fp]&&REV.cur) UI.lrev[L.fp]=REV.cur; L.rev=UI.lrev[L.fp]||REV.cur; const T=TUNE?revTune(L.rev):null; L.tuneT=T&&T!==TUNE?T:null;
  if(!L.tuneT) return fn(); const sv=TUNE; TUNE=L.tuneT; try{ fn(); } finally{ TUNE=sv; }
  const a=L.an, C=L.c, A=L.tuneT, B=TUNE; if(!a||!C.mafv||!A.mafScale||!B||!B.mafScale||!A.axis||!B.axis) return;
  for(let i=0;i<L.N;i++){ if(!a.loop[i]) continue; const k=lerpArr(A.axis,A.mafScale,C.mafv[i])/lerpArr(B.axis,B.mafScale,C.mafv[i]); a.mCL[i]*=k; a.mOLa[i]*=k; a.mOLr[i]*=k; } }
function logRevHtml(x,i){ if(REV.nodes.length<2) return ''; const cur=UI.lrev[x.fp]||REV.cur;
  return `<div class="drow lrev" title="The tune this log was recorded on. Scaling and helpers use it."><span>Recorded on</span><select class="sel sm" data-lrev="${i}">${REV.nodes.map(n=>`<option value="${n.id}"${n.id===cur?' selected':''}>rev ${n.rev}${n.note?' · '+esc(n.note.slice(0,24)):''}</option>`).join('')}</select></div>`; }
function treeHtml(){ if(!TUNE||!REV.nodes.length) return '<div class="note">Load a tune</div>'; const kids={}, out=[]; for(const n of REV.nodes) (kids[n.parent||'_']=kids[n.parent||'_']||[]).push(n);
  const walk=(p,d)=>{ for(const n of kids[p]||[]){ out.push([n,d]); walk(n.id,d+1); } }; walk('_',0); const ec=edCount();
  return out.map(([n,d])=>`<div class="lrow${n.id===REV.cur?' on':''}" style="padding-left:${d*14}px"><button class="lplay" data-rvo="${n.id}" title="${n.id===REV.cur?'Current revision':'Open this revision (new edits branch from here)'}"${n.id===REV.cur?' disabled':''}>${n.id===REV.cur?'▶':'▷'}</button><span class="lname" title="${esc(n.file+(n.note?'\n'+n.note:''))}">rev ${n.rev} · ${esc(n.note||n.file)}</span><span class="lmeta">${new Date(n.time).toLocaleDateString([], {month:'short',day:'numeric'})}</span><button class="lx" data-rvs="${n.id}" title="Save this revision's .tune file again">⤓</button></div>`).join('')
    +(ec?`<div class="note"><b>${ec}</b> unbuilt change${ec>1?'s':''} on rev ${curNode().rev}</div>`:''); }
async function revOpen(id){ const n=REV.nodes.find(x=>x.id===id); if(!n||id===REV.cur) return; const ec=edCount(); if(ec&&!confirm(`Discard ${ec} unbuilt change${ec>1?'s':''} on rev ${curNode().rev}?`)) return;
  REV.cur=id; window.__treeSwitch=1; await loadTuneText(n.src,n.file); window.__treeSwitch=0; if(EDIT.on) EDIT.T=structuredClone(TUNE); revSave(); TV.edRefresh(); drawerRefresh(); toast('Opened rev '+n.rev); }
function tuneText(){ const j=JSON.parse(TUNE.src), E=EDIT.T, put=new Map();
  for(const t of E.tables){ for(const id of t._ids){ const o=E.byId[id]; if(o) put.set(id,o.z); } if(t.xid&&t.xid!=='#') put.set(t.xid,[t.x]); if(t.yin&&t.yid&&t.yid!=='#') put.set(t.yid,[t.y]); }
  for(const c of E.cards) put.set(c.id,c.v);
  for(const m of j.maps){ const v=m&&put.get(m.id); if(!v||!Array.isArray(m.data)) continue; const old=m.data.map(r=>String(r).split(',')); if(old.length!==v.length) continue; let ch=false;
    const nd=old.map((r,i)=>r.map((tok,k)=>{ const nv=v[i]&&v[i][k]; if(nv==null||same(+tok,nv)) return tok; ch=true; const lead=/^\s*/.exec(tok)[0], dp=(/\.(\d+)/.exec(tok)||['',''])[1].length; return lead+(dp?(+nv).toFixed(dp):String(Math.round(nv))); }).join(',')); if(ch) m.data=nd; }
  const ind=/\n([ \t]+)"/.exec(TUNE.src), out=JSON.stringify(j,null,ind?ind[1]:undefined); return /\r\n/.test(TUNE.src)?out.replace(/\n/g,'\r\n'):out; }
window.__build=async()=>{ if(!TUNE||!EDIT.T){ toast('Nothing to build'); return; } const n=edCount(); if(!n){ toast('No changes to build'); return; }
  const next=Math.max(...REV.nodes.map(x=>x.rev))+1, file=`${revBase()}_rev${next}.tune`;
  const note=await askVal(`Build ${file}`,'','',`Note for the Tuning tree (optional) · ${n} change${n>1?'s':''}`); if(note==null) return;
  let txt; try{ txt=tuneText(); JSON.parse(txt); }catch(e){ elog('build '+(e&&e.stack||e)); toast('Build failed'); return; }
  const sum=window.__tuneChanges().slice(1).map(x=>x.trim()), node={id:nid(),rev:next,parent:REV.cur,file,note:note.trim(),time:Date.now(),src:txt,sum};
  dl(new Blob([txt],{type:'application/json'}),file); try{ if(window.rrlab&&window.rrlab.backup) window.rrlab.backup(TUNE.car||'tune',file,txt); }catch(_){} REV.nodes.push(node); REV.cur=node.id; const on=EDIT.on;
  window.__treeSwitch=1; await loadTuneText(txt,file); window.__treeSwitch=0; if(on){ EDIT.on=true; EDIT.T=structuredClone(TUNE); } revSave(); TV.edRefresh(); drawerRefresh(); toast(`Built ${file} · open it in Lambda, run Test Write, then Write`); };
function revDiff(){ const cur=curNode(), others=REV.nodes.filter(n=>n!==cur&&n.src); if(!cur){ toast('Load a tune'); return; }
  const d=mk('div','',document.body); d.id='mapdlg'; const done=()=>{ document.removeEventListener('keydown',kd,true); d.remove(); }, kd=e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(); } }; document.addEventListener('keydown',kd,true);
  const show=id=>{ const o=REV.nodes.find(n=>n.id===id); let A, B=TUNE; try{ A=parseTune(o.src,o.file); }catch(_){ toast('Could not read that revision'); return; } const rows=[];
    for(const k of new Set([...Object.keys(A.m),...Object.keys(B.m)])){ const a=A.m[k], b=B.m[k]; if(JSON.stringify(a)===JSON.stringify(b)) continue; let n=0, mx=0;
      if(a&&b) a.forEach((r,i)=>r.forEach((v,j)=>{ const w=b[i]&&b[i][j]; if(v!==w){ n++; if(Number.isFinite(v)&&Number.isFinite(w)) mx=Math.max(mx,Math.abs(w-v)); } }));
      rows.push(`<div class="hrow"><b>${esc(k)}</b> <span class="dim">${a&&b?n+' value'+(n>1?'s':'')+(mx?' · max Δ '+(+mx.toPrecision(4)):''):'only in one revision'}</span></div>`); }
    d.querySelector('.md-list').innerHTML=rows.length?rows.join(''):'<div class="hrow dim">No differences</div>'; d.querySelectorAll('[data-cmp]').forEach(b=>b.classList.toggle('on',b.dataset.cmp===id)); };
  const kids={}, tree=[]; for(const n of REV.nodes) (kids[n.parent||'_']=kids[n.parent||'_']||[]).push(n); const walk=(p,dp)=>{ for(const n of kids[p]||[]){ tree.push([n,dp]); walk(n.id,dp+1); } }; walk('_',0);
  const rows=tree.map(([n,dp])=>`<div class="rvr${n.id===REV.cur?' cur':''}" style="padding-left:${dp*14+6}px"><button class="rvn" ${n.id===REV.cur?'disabled':`data-cmp="${n.id}"`} title="${esc(n.file)}">rev ${n.rev}${n.note?' · '+esc(n.note):''}${n.id===REV.cur?' · current':''}</button>${n.id===REV.cur?'':`<button class="ibtn" data-rvo="${n.id}" title="Open this revision">▷</button>`}<button class="ibtn" data-rvs="${n.id}" title="Save .tune">⤓</button></div>`).join('');
  d.innerHTML=`<div class="md-card" style="width:min(560px,100%)"><div class="md-h"><b>Revisions · rev${cur.rev} vs</b></div><div class="rvt">${rows}</div><div class="md-list"></div><div class="md-f"><button class="btn ghost" data-x>Close</button></div></div>`;
  d.onclick=e=>{ if(e.target.closest('[data-x]')||e.target===d) return done(); const c=e.target.closest('[data-cmp]'); if(c) return show(c.dataset.cmp); const o=e.target.closest('[data-rvo]'); if(o){ done(); return revOpen(o.dataset.rvo); }
    const v=e.target.closest('[data-rvs]'); if(v){ const n=REV.nodes.find(x=>x.id===v.dataset.rvs); if(n) dl(new Blob([n.src],{type:'application/json'}),n.file); } };
  if(others.length) show((others.find(n=>n.id===cur.parent)||others[others.length-1]).id); else d.querySelector('.md-list').innerHTML=''; }
window.__selftest=async files=>{ const out=[]; let fail=0; const ok=(c,m)=>{ out.push((c?'PASS  ':'FAIL  ')+m); if(!c) fail++; };
  try{ for(const f of files.filter(f=>/\.tune$/i.test(f.name))){ const T=parseTune(f.text,f.name), n=Object.keys(T.m).length; ok(n>100,`${f.name}: parses (${n} maps, ${T.tables.length} tables, ${T.cards.length} cards)`);
      TUNE=T; EDIT.T=structuredClone(TUNE); ok(tuneText()===f.text,`${f.name}: unedited write is byte-identical`);
      const c=EDIT.T.cards.find(x=>x.id==='rev_limit'); if(c){ const was=c.v[0][0]; c.v[0][0]=was+10; const t2=tuneText(), A=f.text.split(/\r?\n/), B=t2.split(/\r?\n/), d=A.filter((l,i)=>l!==B[i]).length;
        let back=null; try{ back=parseTune(t2,f.name).cards.find(x=>x.id==='rev_limit').v[0][0]; }catch(_){}
        ok(d===1&&A.length===B.length&&back===was+10,`${f.name}: one-value edit changes exactly one line and reads back (${was} → ${back})`); ok(/\r\n/.test(f.text)===/\r\n/.test(t2),`${f.name}: line endings kept`); c.v[0][0]=was; } }
    const tf=files.find(f=>/\.tune$/i.test(f.name)); if(tf){ TUNE=parseTune(tf.text,tf.name); applyTuneAxis(); EDIT.T=null; }
    for(const f of files.filter(f=>/\.csv$/i.test(f.name))){ const errs=[], n0=ST.logs.length; let L=null; try{ await ingest({name:f.name,text:f.text,fp:fp(f.text)},false,errs); L=ST.logs.length>n0?ST.logs[ST.logs.length-1]:null; }catch(e){ errs.push(String(e&&e.message||e)); }
      ok(!!L&&L.N>100,`${f.name}: parses${L?` (${L.N.toLocaleString()} frames, ${(L.dur/60000).toFixed(1)} min)`:' · '+errs.join(' ')}`); if(!L) continue;
      ok(!!(L.c.rpm&&L.c.mafv),`${f.name}: RPM and MAF voltage found`); ok(!!L.an&&!L.an.aud.na,`${f.name}: MAF analysis ran`); }
    if(ST.logs.length){ afterLogs(); ok(!!ST.bins&&ST.bins.some(b=>b.n),`pooled MAF bins: ${ST.bins?ST.bins.filter(b=>b.n).length:0} / ${BP.length} with data`);
      for(const L of ST.logs){ const ev=(L.allEv||[]), k={}; for(const e of ev) k[e.kind]=(k[e.kind]||0)+1; out.push(`      ${L.name}: events ${Object.entries(k).map(([a,b])=>a+' '+b).join(', ')||'none'}`); } } }
  catch(e){ ok(false,'exception: '+(e&&e.stack||e)); } return {fail,out}; };
function edSnapshot(){ return edChanges().map(x=>x.card?{card:x.card.id,v:x.card.v}:{id:x.t.id,z:x.t.z,x:x.ax.some(a=>a[0]==='x')?x.t.x:null,y:x.ax.some(a=>a[0]==='y')?x.t.y:null}); }
function edRestore(list){ if(!list||!list.length||!TUNE) return; if(!EDIT.T) EDIT.T=structuredClone(TUNE); const u=[];
  for(const e of list){ if(e.card){ u.push({id:e.card,card:true,after:e.v}); continue; } if(e.z) u.push({id:e.id,k:'z',after:e.z}); if(e.x) u.push({id:e.id,k:'x',after:e.x}); if(e.y) u.push({id:e.id,k:'y',after:e.y}); }
  edApply(u,'after'); }
const _tc=window.__tuneChanges;
window.__tuneChanges=()=>{ const path=[]; let n=curNode(); while(n){ path.unshift(n); n=REV.nodes.find(x=>x.id===n.parent); } const o=[];
  for(const x of path){ if(!x.parent){ o.push(`rev ${x.rev} · ${x.file} (loaded)`); continue; } o.push(`rev ${x.rev} · ${x.file}${x.note?' · '+x.note:''} · built ${new Date(x.time).toLocaleString()}`,...(x.sum||[]).map(l=>'  '+l)); }
  return o.concat(_tc()); };
window.__tuneInfo=()=>[`Revision  rev ${curNode().rev} · ${curNode().file}`];
window.__logRev=L=>{ const n=REV.nodes.find(x=>x.id===(UI.lrev[L.fp]||REV.cur)); return n?`rev ${n.rev} · ${n.file}`:'—'; };
let edTm=0; window.__edChanged=()=>{ clearTimeout(edTm); edTm=setTimeout(()=>{ const on=EDIT.T&&edCount();
  for(const L of ST.logs){ if(!on||(L!==RP.L&&L!==RP.B)){ L.rbP=null; continue; } const sv=TUNE; TUNE=EDIT.T; try{ L.rbP=rebuildLog(L); }catch(e){ L.rbP=null; elog('what-if '+e); } TUNE=sv; }
  RP.dirty=true; if($('drawer').classList.contains('open')) drawerRefresh(); },250); };
function mafSugs(){ const R=ST.row, t=EDIT.T&&EDIT.T.tables.find(q=>q.group==='maf'); if(!R||!t||t.z[0].length!==R.nv.length) return [];
  const o=[]; R.nv.forEach((v,i)=>{ if(ST.bins[i].n&&Math.abs(v/t.z[0][i]-1)>0.0005) { const E=Array.isArray(UI.mafZones)&&UI.mafZones.length===3?UI.mafZones:[1.2,1.9,2.5], zi=E.filter(z=>t.x[i]>=z).length; o.push({t,r:0,c:i,to:v,g:'MAF scaling',grp:'m'+zi,zone:['Idle','Cruise','Load','Boost'][zi],bin:ST.bins[i],lbl:t.x[i].toFixed(3)+' V',why:`n ${ST.bins[i].n.toFixed(0)} · ×${R.f[i].toFixed(4)}`}); } }); return o; }
function knockSugs(){ const out=[], notes=[], acc=new Map(), prot=new Map(), byT=new Map(); if(!EDIT.T) return {out,notes};
  const logs=ST.logs.filter(L=>(UI.lrev[L.fp]||REV.cur)===REV.cur&&L.c.fbkc&&L.c.load&&L.c.rpm);
  for(const L of logs){ const I=L.c.iam; if(I){ let mx=-Infinity; for(let i=0;i<L.N;i++) if(Number.isFinite(I[i])) mx=Math.max(mx,I[i]); let drop=false; for(let i=1;i<L.N;i++) if(L.t[i]-L.t[0]>20000&&Number.isFinite(I[i])&&Number.isFinite(I[i-1])&&I[i]<I[i-1]-1e-6){ drop=true; break; }
      if(drop){ notes.push(`IAM dropped in ${L.name}. Knock is broad, so no per-cell timing suggestions until IAM holds at ${mx.toFixed(2)}.`); return {out:[],notes}; } } }
  const tblOf=pid=>EDIT.T.tables.find(q=>q._ids.includes(pid)&&q.yin), wts=(t,ld,rpm)=>{ const fx=fi(t.x,ld), fy=fi(t.y,rpm), c0=Math.floor(fx), r0=Math.floor(fy), ax=fx-c0, ay=fy-r0, o=[];
      for(const [r,c,w] of [[r0,c0,(1-ax)*(1-ay)],[r0,c0+1,ax*(1-ay)],[r0+1,c0,(1-ax)*ay],[r0+1,c0+1,ax*ay]]) if(w>=0.15&&r<t.y.length&&c<t.x.length) o.push([r,c,w]); return o; };
  for(const L of logs){ const C=L.c, cut=L.an&&L.an.cutF; if(!L.pick) continue;
    if(cut) for(let i=0;i<L.N;i++) if(cut[i]&&L.pick[i]){ const t=tblOf(L.pick[i]); if(!t) continue; const p=prot.get(t)||new Set(); for(const [r,c] of wts(t,C.load[i],C.rpm[i]).concat([[Math.round(fi(t.y,C.rpm[i])),Math.round(fi(t.x,C.load[i]))]])) p.add(r+','+c); prot.set(t,p); }
    for(const e of L.events){ if(e.kind!=='Knock'||!(e.sev==='warn'||e.sev==='crit')||!/sustained/.test(e.label)) continue; const i=rpIdxL(L,e.t); if(cut&&cut[i]) continue;
      let w=0, j=i; for(;j<L.N&&C.fbkc[j]<-0.005;j++) w=Math.min(w,C.fbkc[j]); const fl=C.flkc&&Number.isFinite(C.flkc[i])?Math.min(0,C.flkc[i]):0, need=-(w+fl); if(!(need>0)) continue;
      const pid=L.pick[i]; if(!pid){ continue; } const t=tblOf(pid); if(!t) continue; const W=wts(t,C.load[i],C.rpm[i]); if(!W.length) continue; const mw=Math.max(...W.map(x=>x[2]));
      const k=t.id+'|'+Math.round(fi(t.y,C.rpm[i]))+'|'+Math.round(fi(t.x,C.load[i])), a=acc.get(k)||{t,ev:[],cells:new Map(),w:0,fl:0}; if(a.ev.some(q=>q.L===L&&Math.abs(q.t-e.t)<10000)) continue;
      a.ev.push({L,t:e.t}); a.w=Math.min(a.w,w); a.fl=Math.min(a.fl,fl); for(const [r,c,wt] of W){ const key=r+','+c, o=a.cells.get(key)||{r,c,p:0,wt:0}; o.p=Math.max(o.p,need*wt/mw); o.wt=Math.max(o.wt,wt); a.cells.set(key,o); } acc.set(k,a); } }
  for(const a of acc.values()){ if(a.ev.length<2) continue; const m=byT.get(a.t)||new Map(); for(const o of a.cells.values()){ const key=o.r+','+o.c, q=m.get(key)||{r:o.r,c:o.c,p:0,ev:0,w:0,fl:0,wt:0,logs:new Set()}; q.p=Math.max(q.p,o.p); q.ev+=a.ev.length; q.w=Math.min(q.w,a.w); q.fl=Math.min(q.fl,a.fl); q.wt=Math.max(q.wt,o.wt); a.ev.forEach(x=>q.logs.add(x.L.name)); m.set(key,q); } byT.set(a.t,m); }
  const areas=[...acc.values()].filter(a=>a.ev.length>=2).map((a,ix)=>{ const [, r, c2]=[...[...acc.entries()].find(e=>e[1]===a)[0].split('|')].map(Number); return {a,ix,r,c:c2,logs:new Set(a.ev.map(x=>x.L.name))}; });
  const q35=v=>Math.min(2,Math.ceil(v/0.35-1e-6)*0.35);
  for(const [t,m] of byT){ const P=new Map(), pr=prot.get(t)||new Set(), ny=t.y.length, nx=t.x.length; for(const [k,o] of m) if(!pr.has(k)) P.set(k,q35(o.p));
    for(let it=0;it<8;it++){ let ch=false; for(const [k,p] of [...P]){ const [r,c]=k.split(',').map(Number); for(const [rr,cc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]){ if(rr<0||cc<0||rr>=ny||cc>=nx) continue; const kk=rr+','+cc; if(pr.has(kk)) continue; const need=p-1; if(need>0&&(P.get(kk)||0)<need-1e-9){ P.set(kk,q35(need)); ch=true; } } } if(!ch) break; }
    for(let r=0;r<ny;r++) for(let c=0;c+1<nx;c++){ const k=r+','+c, k2=r+','+(c+1); if(!P.has(k)&&!P.has(k2)) continue; if(pr.has(k2)) continue; const BZ=(baseOf(t)||t).z, a0=BZ[r][c], b0=BZ[r][c+1], a1=a0-(P.get(k)||0), b1=b0-(P.get(k2)||0); if(b0<=a0+1e-9&&b1>a1+1e-9) P.set(k2,Math.min(2,b0-a1)); }
    for(const [k,p] of P){ if(!(p>0)) continue; const [r,c]=k.split(',').map(Number), o=m.get(k);
      let ar=null, bd=1e9; for(const A of areas){ if(A.a.t!==t) continue; const d2=Math.hypot(A.r-r,A.c-c); if(d2<bd){ bd=d2; ar=A; } }
      const bz=((baseOf(t)||t).z[r]||[])[c]??t.z[r][c], to=bz-p; if(t.z[r][c]<=to+1e-6) continue;   // already applied (or pulled further by hand)
      out.push({t,r,c,to,g:'Knock timing',grp:'k'+(ar?ar.ix:0),area:ar,pull:p,lbl:`${t.x[c].toFixed(2)} g/rev · ${Math.round(t.y[r])} rpm`,why:o?`blend ${Math.round(o.wt*100)}% · −${p.toFixed(2)}°`:`taper from neighbouring pull · −${p.toFixed(2)}°`}); } }
  return {out,notes}; }
window.__sug=opt=>hrOpen(opt&&opt.maf?'MAF scaling':null,opt);
const CARD_LAB={knock_load:{rows:[''],cols:['Low','High']},knock_rpm_range:{rows:['Min','Max'],cols:['Low','High']},spark_fine_load_limit:{rows:['Min','Max'],cols:['Low','High']},
  spark_fine_rpm_min:{rows:[''],cols:['Low','High']},spark_fine_rpm_max:{rows:[''],cols:['Low','High']},iam_load_limit:{rows:['Min','Max'],cols:['Low','High']},iam_rpm_limit:{rows:['Min','Max'],cols:['Low','High']},
  stft_rear_limit:{rows:[''],cols:['Max','Min']},ltft_rear_limit:{rows:[''],cols:['Max','Min']},wg_enable_rpm_min:{rows:['AT','MT'],cols:['Off','On']},wg_enable_boost_min:{rows:['AT','MT'],cols:['Off','On']},
  wg_dc_int_deadzone:{rows:['A','B'],cols:['Min','Max']},wg_dc_int_limit:{rows:[''],cols:['Min','Max']},rev_limit:{rows:[''],cols:['Cut','Resume']},speed_limit_on:{rows:[''],cols:['A','B']},speed_limit_off:{rows:[''],cols:['A','B']},map_voltage_limit:{rows:[''],cols:['High','Low']}};
const EVT_TBL={Knock:'timing',IAM:'timing','Timing model':'timing',Boost:'boost','Over boost':'boost','Under boost':'boost','Boost model':'boost','WG model':'wgb',AVCS:'avcsi','CL/OL':'fuel','Lean outlier':'fuel','Tip-in':'tipin',Fuel:'set:Fuel','Throttle model':'thr'};
function vShort(t){ const n=t.name||''; const z=/Non-Cruise/i.test(n)?'Non-Cruise (TGV open)':/Cruise/i.test(n)?'Cruise (TGV closed)':n; return /VVT On/i.test(n)?z+' · VVT On':z; }
function vTiny(t){ const n=t&&t.name||''; return (/Non-Cruise/i.test(n)?'Non-Cruise':/Cruise/i.test(n)?'Cruise':n)+(/VVT On/i.test(n)?' · VVT On':''); }
function nm(key,def){ const n=UI.names&&TUNE&&UI.names[TUNE.car||'_']; return (n&&n[key])||def; }
async function renameTitle(key,def){ if(!TUNE) return; const cur=nm(key,def), v=await askVal('Rename',cur,'Use the name Project Lambda shows · leave empty to reset'); if(v==null) return;
  const car=TUNE.car||'_', N=(UI.names=UI.names||{})[car]=(UI.names[car]||{}); if(v.trim()&&v.trim()!==def) N[key]=v.trim(); else delete N[key]; save(); TV.edRefresh(); if(typeof TVb!=='undefined') TVb.edRefresh(); drawerRefresh(); }
function poolL(cur){ const P=ST.logs.filter(L=>pooled(L)&&(UI.lrev[L.fp]||REV.cur)===REV.cur); return P.length?P:(cur?[cur]:[]); }
function showView(v){ if(!UI.panes.slice(0,paneCount()).includes(v)&&!POP[v]) setPaneView(UI.focus,v); }
function tstat(){ const eb=$('ed-top'), db=$('drawer-btn'); const n=typeof edCount==='function'&&EDIT.T?edCount():0;
  if(eb){ const t=(EDIT.on?'Editing':'Edit tune')+(n?' · '+n:''), sp=eb.querySelector('span'); if(sp.textContent!==t) sp.textContent=t; eb.title=n?`${n} unbuilt change${n>1?'s':''}`:'Edit this tune in Tables'; }
}
const SCALES=[0.9,1,1.15,1.3];
function uiScale(f){ UI.scale=f; save(); try{ if(window.rrlab&&window.rrlab.zoom) window.rrlab.zoom(f); else document.body.style.zoom=f; }catch(_){} RP.dirty=true; if(typeof drawerRefresh==='function') drawerRefresh(); toast('UI scale '+Math.round(f*100)+'%'); }
function uiStep(d){ const i=SCALES.indexOf(UI.scale||1); uiScale(SCALES[Math.max(0,Math.min(SCALES.length-1,(i<0?1:i)+d))]); }
// ════════════════════════════════════════════════════════════════════════════
//  Helpers: fuel / octane, boost control and injectors. Each one reads the logs on the current revision,
//  feeds the Helpers rail in Tables edit mode.
// ════════════════════════════════════════════════════════════════════════════
const HLP={};
const hMed=a=>{ const s=a.filter(Number.isFinite).sort((x,y)=>x-y); return s.length?s[Math.floor(s.length/2)]:NaN; };
const hMean=a=>{ const s=a.filter(Number.isFinite); return s.length?s.reduce((x,y)=>x+y,0)/s.length:NaN; };
const hLogs=()=>ST.logs.filter(L=>(UI.lrev[L.fp]||REV.cur)===REV.cur);
const q35=v=>Math.round(v/0.35)*0.35;
function carNow(){ return (UI.cars||[]).find(c=>c.id===UI.car)||null; }
// stoichiometric AFR of a petrol/ethanol blend (ethanol % by volume, from the pump label)
function stoich(eth){ const e=Math.max(0,Math.min(100,+eth||0))/100, me=e*0.789/(e*0.789+(1-e)*0.745); return 1/((1-me)/14.7+me/9.0); }
// ── fuel / octane: compares the car's current fuel with the one before it ──
function fuelHelper(){ const car=carNow(), H=car&&car.fuelHist||[], cur=H[H.length-1], prev=H[H.length-2]; const r={car,cur,prev,cells:null,notes:[]};
  if(!cur) return r; if(!EDIT.T&&!TUNE) return r;
  const T=EDIT.T||TUNE, tbl=pid=>T.tables.find(q=>q._ids&&q._ids.includes(pid)&&q.yin), cnt=new Map(), bad=new Map();
  for(const L of hLogs()){ const C=L.c; if(!C.fbkc||!C.load||!C.rpm||!L.pick) continue;
    for(let i=0;i<L.N;i++){ const pid=L.pick[i]; if(!pid) continue; const t=tbl(pid); if(!t) continue; const r0=Math.round(fi(t.y,C.rpm[i])), c0=Math.round(fi(t.x,C.load[i])), k=t.id+'|'+r0+'|'+c0;
      const knock=C.fbkc[i]<-0.005||(C.flkc&&C.flkc[i]<-0.005); if(knock){ for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++) bad.set(t.id+'|'+(r0+a)+'|'+(c0+b),1); } else cnt.set(k,(cnt.get(k)||0)+1); } }
  r.cells={cnt,bad,tbl}; const dOct=prev?(+cur.octane||0)-(+prev.octane||0):0, dEth=prev?(+cur.eth||0)-(+prev.eth||0):0; r.dOct=dOct; r.dEth=dEth;
  if(prev&&Math.abs(dEth)>=1){ const s0=stoich(prev.eth), s1=stoich(cur.eth); r.notes.push(`Ethanol ${prev.eth||0}% → ${cur.eth||0}%: stoichiometric AFR ${s0.toFixed(2)} → ${s1.toFixed(2)}. Closed loop corrects this on its own; open-loop fuelling runs about ${Math.abs((1-s1/s0)*100).toFixed(1)}% ${s1<s0?'leaner':'richer'} until the MAF and fuel tables are corrected from new logs.`); }
  if(prev&&dOct<0) r.notes.push(`Fuel octane dropped ${prev.octane} → ${cur.octane}: reset or re-learn IAM after the first tank.`);
  return r; }
function fuelSugs(){ const out=[], F=HLP.fuel=fuelHelper(); if(!F.cur||!F.prev||!F.cells||!EDIT.T) return {out,notes:F.notes||[]}; const {cnt,bad}=F.cells, name=`${F.prev.brand||''} ${F.prev.octane} → ${F.cur.brand||''} ${F.cur.octane}`.trim();
  const used=new Set([...cnt.keys(),...bad.keys()].map(k=>k.split('|')[0]));
  for(const t of EDIT.T.tables.filter(q=>q.group==='timing'&&q.yin&&used.has(q.id))){ const BZ=(baseOf(t)||t).z, ny=t.y.length, nx=t.x.length, ld=Math.max(...t.x);
    for(let r=0;r<ny;r++) for(let c=0;c<nx;c++){ const k=t.id+'|'+r+'|'+c, n=cnt.get(k)||0, b=(BZ[r]||[])[c]??t.z[r][c];
      if(F.dOct>0){ if(n<20||bad.has(k)) continue; const add=Math.min(1,q35(Math.min(1,0.35*2))); const to=b+add; if(t.z[r][c]>=to-1e-6) continue;
        out.push({t,r,c,to,g:'Fuel timing',grp:'fadd',off:true,gtitle:'Better fuel · add timing',gmeta:name,lbl:`${t.x[c].toFixed(2)} g/rev · ${Math.round(t.y[r])} rpm`,why:`${n} clean samples · +${add.toFixed(2)}°`}); }
      else if(F.dOct<0){ if(t.x[c]<ld*0.55||t.y[r]<2500) continue; const pull=Math.min(2,q35(0.7*-F.dOct)); if(!(pull>0)) continue; const to=b-pull; if(t.z[r][c]<=to+1e-6) continue;
        out.push({t,r,c,to,g:'Fuel timing',grp:'fpull',gtitle:'Lower octane · pull timing',gmeta:name,pull,lbl:`${t.x[c].toFixed(2)} g/rev · ${Math.round(t.y[r])} rpm`,why:`high load · −${pull.toFixed(2)}°`}); } } }
  return {out,notes:F.notes}; }
// ── boost control: target vs actual by RPM at wide-open throttle ──
function boostHelper(){ const bins=[]; for(let r=2000;r<=7500;r+=500) bins.push({r,n:0,err:[],ovr:0,wg:[],atMax:0}); let used=0;
  const wmax=TUNE&&TUNE.byId&&TUNE.byId.wg_max;
  for(const L of hLogs()){ const C=L.c; if(!C.map||!C.tboost||!C.rpm) continue;
    for(let i=0;i<L.N;i++){ if(C.thr&&!(C.thr[i]>=80)) continue; const tg=C.tboost[i], mp=C.map[i]; if(!Number.isFinite(tg)||!Number.isFinite(mp)||tg<ATM+20) continue;
      const b=bins.find(x=>Math.abs(C.rpm[i]-x.r)<=250); if(!b) continue; used++; b.n++; b.err.push(mp-tg); if(mp-tg>10) b.ovr++; if(C.wgdc){ b.wg.push(C.wgdc[i]); } } }
  for(const b of bins){ b.e=hMean(b.err); b.peak=b.err.length?Math.max(...b.err):NaN; b.w=hMean(b.wg); b.verdict=!b.n?'':b.e<-7?'short of target':b.peak>12?'overshoots':Math.abs(b.e)<=7?'on target':''; }
  return {bins:bins.filter(b=>b.n),used,wmax}; }
function boostSugs(){ const out=[], B=HLP.boost=boostHelper(); if(!EDIT.T||!B.bins.length) return {out,notes:[]};
  const wm=EDIT.T.tables.find(q=>q.id==='wg_max'), wb=EDIT.T.tables.find(q=>q.id==='wg_base');
  for(const b of B.bins){ if(b.n<15) continue;
    if(b.verdict==='short of target'&&wm){ const r=Math.round(fi(wm.y,b.r)); if(Number.isFinite(b.w)&&b.w<((wm.z[r]||[]).reduce((m,v)=>Math.max(m,v),0))-2) continue; // duty never reached the max: not a max problem
      (wm.z[r]||[]).forEach((v,c)=>{ const base=((baseOf(wm)||wm).z[r]||[])[c]??v, to=Math.min(100,base+3); if(v<to-1e-6) out.push({t:wm,r,c,to,g:'Boost control',grp:'bmax',off:true,gtitle:'Boost short of target · raise wastegate max',gmeta:`${B.bins.filter(x=>x.verdict==='short of target').length} RPM range(s)`,lbl:`${Math.round(wm.y[r])} rpm · ${wm.x[c]}`,why:`boost ${b.e.toFixed(1)} kPa under target · +3%`}); }); }
    if(b.verdict==='overshoots'&&wb){ const r=Math.round(fi(wb.y,b.r)); (wb.z[r]||[]).forEach((v,c)=>{ const base=((baseOf(wb)||wb).z[r]||[])[c]??v, to=Math.max(0,base-3); if(v>to+1e-6) out.push({t:wb,r,c,to,g:'Boost control',grp:'bbase',off:true,gtitle:'Boost overshoots · lower wastegate base',gmeta:`peak +${b.peak.toFixed(1)} kPa`,lbl:`${Math.round(wb.y[r])} rpm · ${wb.x[c]}`,why:`overshoot ${b.peak.toFixed(1)} kPa · −3%`}); }); } }
  return {out,notes:[]}; }
// ── injectors: closed-loop trims by pulse width ──
function injHelper(){ const bands=[[0,2.5,'Short (< 2.5 ms)'],[2.5,5,'Mid (2.5–5 ms)'],[5,99,'Long (> 5 ms)']].map(([a,b,l])=>({a,b,l,tr:[],ipw:[],bat:[]}));
  for(const L of hLogs()){ const C=L.c, an=L.an; if(!C.ipw||!C.afl||!an||!an.loop) continue;
    for(let i=0;i<L.N;i++){ if(an.loop[i]!==1) continue; const t=(C.afl[i]||0)+(C.afc&&Number.isFinite(C.afc[i])?C.afc[i]:0), w=C.ipw[i]; if(!Number.isFinite(t)||!Number.isFinite(w)) continue; const B=bands.find(x=>w>=x.a&&w<x.b); if(!B) continue; B.tr.push(t); B.ipw.push(w); if(C.batt) B.bat.push(C.batt[i]); } }
  bands.forEach(B=>{ B.n=B.tr.length; B.t=hMed(B.tr); B.w=hMed(B.ipw); });
  const S=bands[0], M=bands[1], Lg=bands[2], r={bands,scale:null,lat:null,verdict:'Not enough closed-loop data yet'};
  if(M.n>=200){ const ref=Lg.n>=100?(M.t+Lg.t)/2:M.t; if(Math.abs(ref)>=2) r.scale=-ref; if(S.n>=100&&Math.abs(S.t-M.t)>=3) r.lat=(S.t-M.t)/100*S.w;
    r.verdict=r.lat!=null&&r.scale!=null?'Latency and scaling both look off':r.lat!=null?'Short pulses trim differently: latency looks off':r.scale!=null?'Trims are offset at every pulse width: scaling looks off':'Injector scaling and latency look right'; }
  return r; }
function injSugs(){ const out=[], notes=[], I=HLP.inj=injHelper(); if(!EDIT.T) return {out,notes};
  const lt=EDIT.T.tables.find(q=>q.id==='inj_latency');
  if(I.lat!=null&&lt){ const Z=lt.z, B=(baseOf(lt)||lt).z; (Z[0]||[]).forEach((v,c)=>{ const base=(B[0]||[])[c]??v, to=+(base+I.lat).toFixed(4); if(Math.abs(v-to)>1e-6) out.push({t:lt,r:0,c,to,g:'Injectors',grp:'ilat',off:true,gtitle:'Injector latency',gmeta:`${I.lat>0?'+':''}${I.lat.toFixed(3)} ms`,lbl:`${lt.x[c]} V`,why:`short-pulse trims ${I.bands[0].t.toFixed(1)}% vs mid ${I.bands[1].t.toFixed(1)}%`}); }); }
  if(I.scale!=null&&TUNE&&TUNE.injFlow) notes.push(`Injectors: closed-loop trims sit at ${(-I.scale).toFixed(1)}% across pulse widths. Injector flow scaling ${TUNE.injFlow} → about ${Math.round(TUNE.injFlow*(1+I.scale/100))} (${I.scale>0?'+':''}${I.scale.toFixed(1)}%) would bring them near zero; change it in the injector setting card.`);
  return {out,notes}; }
// ── Helpers rail: lives beside the table in edit mode; every change is previewed on the table before Apply ──
const HR={open:false,cat:'Knock timing',data:null,sig:'',done:[],doneRoot:null}, HCATS=[['Knock timing','Knock timing'],['MAF scaling','MAF scaling'],['Fuel timing','Fuel & octane'],['Boost control','Boost control'],['Injectors','Injectors']];
function hrSig(){ return [REV.cur,ST.logs.map(L=>L.fp+':'+(UI.lrev[L.fp]||'')+':'+(typeof pooled==='function'&&pooled(L)?1:0)).join(','),edCount(),JSON.stringify(carNow()||0)].join('|'); }
function hrData(){ if(!TUNE||!EDIT.T) return null; const s=hrSig(); if(HR.data&&HR.sig===s) return HR.data;
  const tr=f=>{ try{ return f(); }catch(_){ return {out:[],notes:[]}; } }, K=tr(knockSugs), F=tr(fuelSugs), Bo=tr(boostSugs), In=tr(injSugs); let M=[]; try{ M=mafSugs(); }catch(_){}
  const L=K.out.concat(M,F.out,Bo.out,In.out), key=x=>x.t.id+'|'+x.r+'|'+x.c+'|'+x.to, was=new Map(); if(HR.data) HR.data.L.forEach((x,k)=>was.set(key(x),HR.data.ON[k]));
  { const rt=REV.nodes&&REV.nodes[0]&&REV.nodes[0].id; if(HR.doneRoot!==rt){ HR.done=[]; HR.doneRoot=rt; } const lk=new Set(L.map(x=>x.t.id+'|'+x.r+'|'+x.c)); HR.done.forEach(d=>{ if(!lk.has(d.tid+'|'+d.r+'|'+d.c)) L.push(d); }); }
  const ON=L.map(x=>x.done?false:was.has(key(x))?was.get(key(x)):!x.off), G=new Map(); L.forEach((x,k)=>{ const g=G.get(x.grp)||{id:x.grp,cat:x.g,items:[]}; g.items.push(k); G.set(x.grp,g); });
  if(HR.data) for(const g of G.values()){ const o=HR.data.G.get(g.id); if(o) g.open=o.open; }
  HR.data={L,ON,G,groups:[...G.values()],notes:{'Knock timing':K.notes,'Fuel timing':F.notes,'Boost control':Bo.notes,'Injectors':In.notes,'MAF scaling':[]}}; HR.sig=s; return HR.data; }
function hrCount(){ const D=hrData(); return D?D.L.length:0; }
function hrGroupN(g){ const D=HR.data; return D&&EDIT.on?D.L.filter(x=>!x.done&&x.t.group===g).length:0; }
function hrJump(){ const D=HR.data; if(!D) return; const k=D.L.findIndex(x=>x.g===HR.cat); if(k>=0&&TV.showTable) TV.showTable(D.L[k].t.id); }
function hrOpen(cat,opt){ if(!TUNE) return; if(!EDIT.on) EDITOR.on(true); showView('table'); const D=hrData(); HR.open=true;
  if(!cat){ const f=HCATS.find(([c])=>D&&D.L.some(x=>x.g===c)); cat=f?f[0]:HR.cat; } HR.cat=cat;
  if(opt&&opt.maf&&D) D.L.forEach((x,k)=>{ if(x.g==='MAF scaling') D.ON[k]=x.t.x[x.c]>=opt.maf[0]-1e-9&&x.t.x[x.c]<opt.maf[1]-1e-9; });
  hrJump(); TV.edRefresh(); }
function hrClose(){ HR.open=false; TV.edRefresh(); }
function hrApply(){ const D=HR.data; if(!D) return; const rt=REV.nodes&&REV.nodes[0]&&REV.nodes[0].id; if(HR.doneRoot!==rt){ HR.done=[]; HR.doneRoot=rt; }
  D.L.forEach((x,k)=>{ if(!D.ON[k]||x.done) return; const id=x.t.id+'|'+x.r+'|'+x.c; HR.done=HR.done.filter(d=>d.tid+'|'+d.r+'|'+d.c!==id); HR.done.push(Object.assign({},x,{done:true,from:x.t.z[x.r][x.c],tid:x.t.id,grp:'done:'+x.grp})); });
  const by=new Map(); D.L.forEach((x,k)=>{ if(!D.ON[k]||x.done) return; const z=by.get(x.t)||x.t.z.map(r=>r.slice()); z[x.r][x.c]=x.to; by.set(x.t,z); });
  const items=[]; for(const [t,z] of by) if(edGuard(t,z)) items.push({t,k:'z',after:z}); if(items.length){ edCommit(items,'apply helpers'); toast(`Applied to ${items.length} table${items.length!==1?'s':''}`); } TV.edRefresh(); }
function hrEvidence(cat,D){ const fu=f=>f?`${esc(f.brand||'')} ${esc(String(f.octane||''))}${f.eth?' · E'+esc(String(f.eth)):''}`.trim():'—', notes=(D.notes[cat]||[]).map(n=>`<p class="hm">${esc(n)}</p>`).join('');
  if(cat==='Fuel timing'){ const F=HLP.fuel||{}; if(!F.car) return `<div class="hc"><button class="btn sm" data-h="car">Create car profile</button></div>`;
    const logs=hLogs(), has=k=>logs.some(L=>L.c[k]), need=[['FBKC',has('fbkc')],['FLKC',has('flkc')],['RPM · load',has('rpm')&&has('load')],['Timing table in use',logs.some(L=>L.pick)]], ready=F.cells?[...F.cells.cnt].filter(([k,c])=>c>=20&&!F.cells.bad.has(k)).length:0;
    const row=(l,v,c)=>`<div class="hnd"><span>${l}</span><b class="${c||''}">${v}</b></div>`;
    return `<div class="hc"><div class="hk"><div><em>Now</em><b>${fu(F.cur)}</b></div><div><em>Before</em><b>${fu(F.prev)}</b></div><div><em>Stoich</em><b>${F.cur?stoich(F.cur.eth).toFixed(2):'—'}</b></div></div>
      <div class="hns">${need.map(([l,ok])=>row(l,ok?'✓ logged':'✗ not logged',ok?'y':'x')).join('')}${row('Logs on this revision',logs.length,logs.length?'':'x')}${row('Clean cells (20+ samples)',ready)}</div>
      <div class="hns">${row('Pull after lower octane',!F.prev?'needs a previous fuel':F.dOct<0?'on':'off',F.dOct<0?'y':'')}${row('Added timing',!F.prev?'needs a previous fuel':F.dOct>0?(ready?ready+' cells ready':'needs clean samples'):'off',F.dOct>0&&ready?'y':'')}</div>${notes}<button class="btn sm" data-h="fuel">Change fuel…</button></div>`; }
  if(cat==='Boost control'){ const B=HLP.boost||{bins:[]}; return B.bins.length?`<div class="hc"><table class="ht"><tr><th>RPM</th><th>n</th><th>vs target</th><th>Peak</th><th>WGDC</th></tr>${B.bins.map(b=>`<tr title="${esc(b.verdict)}"><td>${b.r}</td><td>${b.n}</td><td class="${b.e<-7?'r':b.e>7?'a':''}">${b.e>0?'+':''}${b.e.toFixed(1)}</td><td>${b.peak>0?'+':''}${b.peak.toFixed(1)}</td><td>${Number.isFinite(b.w)?b.w.toFixed(0)+'%':'—'}</td></tr>`).join('')}</table>${notes}</div>`:`<div class="hc"><p class="hm">Needs WOT logs with manifold pressure and target boost.</p></div>`; }
  if(cat==='Injectors'){ const I=HLP.inj||{bands:[]}; let pk=0, pr=0; for(const L of hLogs()){ const a=idcOf(L); if(a) for(let i=0;i<L.N;i++) if(a[i]>pk){ pk=a[i]; pr=L.c.rpm?L.c.rpm[i]:0; } }
    const inp=(k,l,u)=>`<label class="hin"><span>${l}</span><input class="num" type="number" step="1" data-icfg="${k}" value="${CFG[k]}"><em>${u}</em></label>`;
    const sat=`<div class="hc"><div class="hk"><div><em>Peak duty</em><b class="${pk>=CFG.idcCrit?'r':''}">${pk?pk.toFixed(1)+'%':'—'}</b></div><div><em>At</em><b>${pr?Math.round(pr)+' rpm':'—'}</b></div></div>${inp('idcWarn','Duty warning at','%')}${inp('idcCrit','Duty critical at','%')}${inp('fpDrop','Fuel pressure drop ≥','%')}</div>`;
    return sat+(I.bands.some(b=>b.n)?`<div class="hc"><table class="ht"><tr><th>Pulse width</th><th>n</th><th>CL trims</th></tr>${I.bands.map(b=>`<tr><td>${esc(b.l)}</td><td>${b.n}</td><td>${b.n?(b.t>0?'+':'')+b.t.toFixed(1)+'%':'—'}</td></tr>`).join('')}</table><p class="hv2">${esc(I.verdict)}</p>${notes}</div>`:`<div class="hc"><p class="hm">Needs closed-loop logs with injector pulse width and fuel trims.</p></div>`); }
  return notes?`<div class="hc">${notes}</div>`:''; }
function hrGroup(g,D,kn,nK){ const L=D.L, ON=D.ON, x0=L[g.items[0]], open=g.open, chip=(t,w)=>`<span class="sgc${w?' w':''}">${esc(t)}</span>`, sgn=v=>(v>0?'+':'')+v;
  const tName=t=>nm('g:'+t.group,t.gname)+(t.group==='timing'?' · '+vTiny(t):''); let title, meta, chips='';
  if(g.cat==='Knock timing'){ const A=x0.area; title=nK>1?'Knock area '+kn:'Knock area'; meta=`${esc(tName(x0.t))} · ${g.items.length} cell${g.items.length>1?'s':''}`;
    if(A){ const a=A.a; chips=chip(`${a.ev.length} events`,1)+chip(`${A.logs.size} log${A.logs.size>1?'s':''}`)+chip(`FBKC ${a.w.toFixed(2)}°`,1)+(a.fl<0?chip(`FLKC ${a.fl.toFixed(2)}°`,1):''); } if(g.items.some(k=>L[k].pull>=2-1e-9)) chips+=chip('capped at 2°'); }
  else if(x0.gtitle){ title=x0.gtitle; meta=`${esc(tName(x0.t))} · ${g.items.length} cell${g.items.length>1?'s':''}${x0.gmeta?' · '+esc(x0.gmeta):''}`; }
  else { title='MAF · '+x0.zone+' zone'; meta=`${esc(tName(x0.t))} · ${g.items.length} bin${g.items.length>1?'s':''}`; let sw=0,sn=0; const lp=new Set(); g.items.forEach(k=>{ const q=L[k]; sw+=(q.to/q.t.z[0][q.c]-1)*100*q.bin.n; sn+=q.bin.n; if(q.bin.src) lp.add(q.bin.src); });
    chips=chip('avg '+sgn((sw/sn).toFixed(2))+'%')+chip('n '+Math.round(sn).toLocaleString())+(lp.size?chip([...lp].join(' + ')):''); }
  const rows=g.items.map((k,j)=>{ const x=L[k], d=edDisp(x.t), a=toD(d,x.done?x.from:x.t.z[x.r][x.c]), b=toD(d,x.to), u=d.u==='deg'?'°':'';
    return `<div class="sgi${x.done?' dn':''}${j>=4&&!open?' fold':''}" data-j="${k}" title="${esc(x.why)}"><span>${esc(x.lbl)}</span><span class="sga">${a.toFixed(d.dp)}${u}</span><span class="sgar">→</span><span class="sgb">${b.toFixed(d.dp)}${u}</span>${x.done?'<span class="sgd">Done</span>':`<button class="sw${ON[k]?' on':''}" data-k="${k}"></button>`}</div>`; }).join('');
  return `<div class="sgg"><div class="sggh${x0.done?' dn':''}">${x0.done?'<span class="sgd">Done</span>':`<button class="sw${g.items.every(k=>ON[k])?' on':''}" data-gs="${esc(g.id)}"></button>`}<b>${esc(title)}</b></div><div class="sgm">${meta}</div>${chips?`<div class="sgch">${chips}</div>`:''}${rows}${g.items.length>4?`<div class="sgmore" data-more="${esc(g.id)}">${open?'▾ fewer':'▸ '+(g.items.length-4)+' more'}</div>`:''}</div>`; }
function hrPaint(el){ const D=hrData(); if(!D){ el.innerHTML=''; el._k=''; return; } const key=HR.sig+HR.cat+D.ON.join('')+D.groups.map(g=>g.open?1:0).join(''); if(el._k===key) return; el._k=key;
  const bd=el.querySelector('.hrbd'), top=bd?bd.scrollTop:0, cat=HR.cat, gs=D.groups.filter(g=>g.cat===cat), nK=gs.length, sel=D.L.filter((x,k)=>D.ON[k]&&!x.done), tb=new Set(sel.map(x=>x.t.id)).size;
  let h=`<div class="hrh"><b>Helpers</b><button class="ibtn" data-hx title="Close">✕</button></div><div class="hrc">`+HCATS.map(([c,l])=>{ const n=D.L.filter(x=>x.g===c&&!x.done).length, on=D.L.filter((x,k)=>x.g===c&&D.ON[k]&&!x.done).length; return `<button class="hrb${c===cat?' on':''}${n?'':' z'}" data-hc="${c}"><span>${l}</span><i>${n?on+' / '+n:'—'}</i></button>`; }).join('')+'</div><div class="hrbd">';
  h+=hrEvidence(cat,D); if(gs.length) h+=`<div class="sgcat"><span>${gs.length} group${gs.length>1?'s':''}</span><button class="btn sm ghost" data-ca>All</button><button class="btn sm ghost" data-cn>None</button>${HR.done.length?'<button class="btn sm ghost" data-dclr>Clear done</button>':''}</div>`+gs.map((g,i)=>hrGroup(g,D,i+1,nK)).join('');
  h+=`</div><div class="hrft"><span>${sel.length} change${sel.length!==1?'s':''} · ${tb} table${tb!==1?'s':''}</span><button class="btn sm acc" data-ok${sel.length?'':' disabled'}>Apply</button></div>`;
  el.innerHTML=h; const nb=el.querySelector('.hrbd'); if(nb) nb.scrollTop=top;
  el.onchange=e=>{ const k=e.target.dataset.icfg; if(!k) return; const x=parseFloat(e.target.value); if(!Number.isFinite(x)) return; CFG[k]=x; UI.cfg[k]=x; save(); recompute(true); el._k=''; TV.edRefresh(); };
  el.onclick=e=>{ const t=e.target, D=HR.data; if(!D) return; const r=()=>TV.edRefresh();
    if(t.closest('[data-hx]')) return hrClose(); if(t.closest('[data-ok]')) return hrApply(); if(t.closest('[data-dclr]')){ HR.done=[]; HR.sig=''; el._k=''; return r(); }
    const hc=t.closest('[data-hc]'); if(hc){ HR.cat=hc.dataset.hc; hrJump(); return r(); }
    const hb=t.closest('[data-h]'); if(hb) return carDialog(hb.dataset.h==='car'?null:UI.car,hb.dataset.h==='fuel'?'fuel':null);
    const k=t.closest('[data-k]'); if(k){ D.ON[+k.dataset.k]=!D.ON[+k.dataset.k]; return r(); }
    const gs=t.closest('[data-gs]'); if(gs){ const g=D.G.get(gs.dataset.gs), v=!g.items.every(q=>D.ON[q]); g.items.forEach(q=>D.ON[q]=v); const x=D.L[g.items[0]]; TV.showTable(x.t.id); return r(); }
    const mo=t.closest('[data-more]'); if(mo){ const g=D.G.get(mo.dataset.more); g.open=!g.open; return r(); }
    if(t.closest('[data-ca],[data-cn]')){ const v=!!t.closest('[data-ca]'); D.L.forEach((x,q)=>{ if(x.g===HR.cat) D.ON[q]=v; }); return r(); }
    const j=t.closest('[data-j]'); if(j){ const x=D.L[+j.dataset.j]; TV.showTable(x.t.id,x.r,x.c); } }; }
// table overlay: amber corner on every pending cell; with the rail open, ticked cells show the new value over the old one, unticked get a dashed outline
function hrDraw(c,g,t,W){ const D=HR.data; if(!D||!EDIT.on) return; const id=(t.__src||t).id, d=edDisp(t), A=INK().sel;
  D.L.forEach((x,k)=>{ if(x.done||(x.t.id!==id&&x.t.id!==t.id)) return; const R=t.vert?x.c:x.r, Cc=t.vert?0:x.c; if(R<W.r0||R>=W.r0+W.vy||Cc<W.c0||Cc>=W.c0+W.vx) return; const x0=g.hw+(Cc-W.c0)*g.cw, y0=g.hh+(R-W.r0)*g.ch, cw=g.cw, ch=g.ch;
    if(!HR.open){ c.fillStyle=A; c.beginPath(); const s1=Math.min(9,cw*.3), s2=Math.min(9,ch*.45); c.moveTo(x0+cw-2,y0+2); c.lineTo(x0+cw-2-s1,y0+2); c.lineTo(x0+cw-2,y0+2+s2); c.fill(); return; }
    if(!D.ON[k]){ if(x.g!==HR.cat) return; c.setLineDash([3,3]); c.strokeStyle=A; c.lineWidth=1.4; c.strokeRect(x0+2,y0+2,cw-4,ch-4); c.setLineDash([]); return; }
    c.fillStyle='#1a1306'; c.fillRect(x0+1,y0+1,cw-2,ch-2); c.strokeStyle=A; c.lineWidth=1.5; c.strokeRect(x0+1.5,y0+1.5,cw-3,ch-3);
    const nv=toD(d,x.to).toFixed(d.dp), ov=toD(d,x.t.z[x.r][x.c]).toFixed(d.dp); c.textAlign='center'; c.textBaseline='middle';
    if(ch>=30){ c.font='600 '+Math.min(10,ch*.28)+'px system-ui,sans-serif'; c.fillStyle='#8a8a92'; const oy=y0+ch*.3, ow=c.measureText(ov).width; c.fillText(ov,x0+cw/2,oy); c.strokeStyle='#8a8a92'; c.lineWidth=1; c.beginPath(); c.moveTo(x0+cw/2-ow/2-1,oy); c.lineTo(x0+cw/2+ow/2+1,oy); c.stroke();
      c.font='800 '+Math.min(13,ch*.36)+'px system-ui,sans-serif'; c.fillStyle=A; c.fillText(nv,x0+cw/2,y0+ch*.66); }
    else { c.font='800 '+Math.max(8,Math.min(12,ch*.62))+'px system-ui,sans-serif'; c.fillStyle=A; c.fillText(nv,x0+cw/2,y0+ch/2+.5); } }); }
// ── car profiles: several cars, each with its fuel history; sessions are kept per car ──
function carDialog(id,focus){ const cars=UI.cars||(UI.cars=[]), c=cars.find(x=>x.id===id)||null, f=(c&&c.fuelHist&&c.fuelHist[c.fuelHist.length-1])||{};
  const d=mk('div','cardlg',document.body), v=(k,def)=>esc(c&&c[k]!=null?c[k]:def||'');
  const fld=(k,l,ph,val)=>`<label><span>${l}</span><input data-k="${k}" value="${val!=null?esc(val):v(k)}" placeholder="${esc(ph||'')}"></label>`;
  d.innerHTML=`<div class="cd"><h3>${c?'Car profile':'Create car profile'}</h3><div class="cdg">
    ${fld('name','Name','2008 STI')}${fld('engine','Engine','EJ257')}<label class="ck"><input type="checkbox" data-k="avcs" ${c&&c.avcs?'checked':''}><span>Dual AVCS</span></label>
    ${fld('inj','Injectors','Optional')}${fld('maf','MAF housing','Optional')}${fld('turbo','Turbo','Optional')}</div>
    <h4>Drivetrain</h4><div class="cdg">${fld('gears','Gear ratios','3.454 1.947 1.296 0.972 0.738')}${fld('fd','Final drive','3.900')}${fld('tire','Tire size','225/45R17')}${fld('wbLag','Wideband lag (ms)','0')}<label class="ck"><input type="checkbox" data-k="wbLock" ${c&&c.wbLock?'checked':''}><span>Lock lag</span></label>${c&&c.wbAuto?`<div class="cdm">Measured ${c.wbAuto.ms} ms · ${c.wbAuto.n} edge${c.wbAuto.n!==1?'s':''}${c.wbAuto.xc!=null?' · correlation '+c.wbAuto.xc+' ms':''}${c.wbAuto.ok===false?' · methods disagree':''}</div>`:''}</div>
    <h4>Fuel</h4><div class="cdg">${fld('f.brand','Brand','Shell',f.brand||'')}${fld('f.octane','Octane','93',f.octane||'')}${fld('f.eth','Ethanol %','From the pump label',f.eth!=null?f.eth:'')}</div>
    <div class="cdft">${c?'<button class="btn sm" data-c="del">Delete</button>':(cars.length?'':'<button class="btn sm" data-c="skip">Skip</button>')}<span class="vfill"></span><button class="btn sm" data-c="x">Cancel</button><button class="btn sm acc" data-c="ok">Save</button></div></div>`;
  setTimeout(()=>{ const q=d.querySelector(focus==='fuel'?'[data-k="f.brand"]':'[data-k=name]'); if(q) q.focus(); },30);
  d.onclick=e=>{ const b=e.target.closest('[data-c]'); if(!b) return; const a=b.dataset.c;
    if(a==='x'){ d.remove(); return; } if(a==='skip'){ UI.carSkip=true; save(); d.remove(); return; }
    if(a==='del'){ if(!confirm('Delete the car profile '+c.name+'? Its sessions stay in the list.')) return; UI.cars=cars.filter(x=>x!==c); if(UI.car===c.id) UI.car=UI.cars[0]&&UI.cars[0].id||null; save(); d.remove(); carChanged(); return; }
    const g=k=>{ const i=d.querySelector(`[data-k="${k}"]`); return i?(i.type==='checkbox'?i.checked:i.value.trim()):''; }; const name=g('name'); if(!name){ d.querySelector('[data-k=name]').focus(); return; }
    const o=c||{id:'car'+Date.now().toString(36),fuelHist:[]}; Object.assign(o,{name,engine:g('engine'),avcs:g('avcs'),inj:g('inj'),maf:g('maf'),turbo:g('turbo'),gears:g('gears'),fd:g('fd'),tire:g('tire'),wbLag:g('wbLag')===''?'':+g('wbLag')||0,wbLock:g('wbLock')});
    const nf={brand:g('f.brand'),octane:g('f.octane'),eth:g('f.eth')===''?'':+g('f.eth')}, last=o.fuelHist[o.fuelHist.length-1];
    if((nf.brand||nf.octane||nf.eth!=='')&&(!last||last.brand!==nf.brand||String(last.octane)!==String(nf.octane)||String(last.eth)!==String(nf.eth))) o.fuelHist.push(Object.assign({t:Date.now()},nf));
    if(!c) cars.push(o); UI.car=o.id; save(); d.remove(); carChanged(); toast('Saved '+name); }; }
function carChanged(){ try{ profApply(); recompute(true); }catch(_){} try{ if(typeof landRefresh==='function') landRefresh(); }catch(_){} try{ if(EDIT.on) TV.edRefresh(); }catch(_){} try{ drawerRefresh(); }catch(_){} }
// drawer: car switcher at the top
{ const _dr=drawerRefresh; drawerRefresh=function(){ _dr.apply(this,arguments); const d=$('drawer-bd'); if(!d) return; const cars=UI.cars||[]; let row=d.querySelector('.dcar'); if(!row){ row=document.createElement('div'); row.className='dcar'; d.prepend(row); }
    row.innerHTML=`<span>Car</span>${cars.length?`<select>${cars.map(c=>`<option value="${esc(c.id)}" ${c.id===UI.car?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button class="btn sm" data-dc="edit">Edit</button>`:''}<button class="btn sm" data-dc="add">＋</button>`;
    row.querySelector('select')&&(row.querySelector('select').onchange=e=>{ UI.car=e.target.value; save(); carChanged(); });
    row.onclick=e=>{ const b=e.target.closest('[data-dc]'); if(!b) return; carDialog(b.dataset.dc==='add'?null:UI.car); }; }; }

// ── wideband lag: measured from the car's logs and kept on the car unless locked ──
// edges: injector cut → lean spike and tip-in → rich dip; correlation: expected AFR (MAF / fuel per rev) vs wideband over the whole log
function wbEdges(L){ const C=L.c, T=L.t, W=L.wb, d=[]; if(!C.ipw||!W) return d;
  for(let i=1;i<L.N;i++){ if(C.ipw[i]<0.3&&C.ipw[i-1]>=0.3) for(let j=i;j<L.N&&T[j]-T[i]<=1500;j++){ if(C.ipw[j]>=0.3) break; if(W[j]>1.15){ d.push(T[j]-T[i]); break; } }
    if(C.thr&&C.thr[i]-C.thr[i-1]>=15&&W[i]>0.9){ const w0=W[i]; for(let j=i;j<L.N&&T[j]-T[i]<=1500;j++){ if(w0-W[j]>=0.08){ d.push(T[j]-T[i]); break; } } } }
  return d.filter(x=>x>=20&&x<=1200); }
function wbXcorr(L){ const C=L.c, T=L.t, W=L.wb; if(!C.ipw||!C.rpm||!C.maf||!W||L.N<200) return null; const dt=20, t0=T[0], t1=T[L.N-1], n=Math.floor((t1-t0)/dt); if(n<300) return null;
  const x=new Float64Array(n), y=new Float64Array(n), ok=new Uint8Array(n); let j=0;
  for(let k=0;k<n;k++){ const t=t0+k*dt; while(j<L.N-2&&T[j+1]<=t) j++; const ip=C.ipw[j], rp=C.rpm[j], mf=C.maf[j], w=W[j]; if(ip>0.5&&rp>900&&mf>2&&w>0.5&&w<1.6){ x[k]=Math.log(mf/(ip*rp)); y[k]=Math.log(w); ok[k]=1; } }
  const dx=new Float64Array(n), dy=new Float64Array(n); for(let k=1;k<n;k++) if(ok[k]&&ok[k-1]){ dx[k]=x[k]-x[k-1]; dy[k]=y[k]-y[k-1]; }
  let best=-1, bl=null; for(let l=0;l<=50;l++){ let sxy=0,sxx=0,syy=0; for(let k=1;k+l<n;k++){ const a=dx[k], b=dy[k+l]; sxy+=a*b; sxx+=a*a; syy+=b*b; } const r=sxx&&syy?sxy/Math.sqrt(sxx*syy):0; if(r>best){ best=r; bl=l*dt; } }
  return best>=0.15?{ms:bl,r:best}:null; }
function wbLagAuto(){ const car=carNow(); if(!car||car.wbLock||!ST.logs.length) return; const E=[], X=[];
  for(const L of ST.logs){ if(L._wbm===undefined){ try{ L._wbm={e:wbEdges(L),x:wbXcorr(L)}; }catch(_){ L._wbm={e:[],x:null}; } } E.push(...L._wbm.e); if(L._wbm.x) X.push(L._wbm.x.ms); }
  const em=E.length>=3?Math.round(median(E)):null, xm=X.length?Math.round(median(X)):null; if(em==null&&xm==null) return;
  const ok=em!=null&&xm!=null?Math.abs(em-xm)<=80:null, ms=em!=null&&xm!=null?(ok?Math.round((em+xm)/2):em):(em??xm);
  car.wbAuto={ms,n:E.length,xc:xm,edge:em,ok,at:Date.now()}; const was=+car.wbLag||0; if(Math.abs(was-ms)>=10){ car.wbLag=ms; save(); profApply(); recompute(true); toast(`Wideband lag ${ms} ms (${car.name})`); } else save(); }

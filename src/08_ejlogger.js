// ════════════════════════════════════════════════════════════════════════════
//  ejLogger — the live logger mode inside ejStudio (full takeover behind the logo)
//  The engine (ejLogger/engine/engine.js) runs as its own process; this only draws what it sends.
// ════════════════════════════════════════════════════════════════════════════
const EJL=(()=>{
  const API=window.rrlab&&window.rrlab.ejl;
  const SV={
    studio:'<svg class="mk-ic" viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="9" width="46" height="46" rx="8" fill="#0c0c10" stroke="#111" stroke-width="5"/><rect x="9" y="9" width="46" height="46" rx="8" fill="none" stroke="#e8e8ea" stroke-width="2.6"/><rect x="14" y="14" width="10.5" height="10.5" rx="2" fill="#5a9fd4"/><rect x="26.5" y="14" width="10.5" height="10.5" rx="2" fill="#48a8ac"/><rect x="39" y="14" width="10.5" height="10.5" rx="2" fill="#3baf84"/><rect x="14" y="26.5" width="10.5" height="10.5" rx="2" fill="#48a8ac"/><rect x="26.5" y="26.5" width="10.5" height="10.5" rx="2" fill="#3baf84"/><rect x="39" y="26.5" width="10.5" height="10.5" rx="2" fill="#e4aa28"/><rect x="14" y="39" width="10.5" height="10.5" rx="2" fill="#3baf84"/><rect x="26.5" y="39" width="10.5" height="10.5" rx="2" fill="#e4aa28"/><rect x="39" y="39" width="10.5" height="10.5" rx="2" fill="#eb5a3c"/><path d="M32 4v56M4 32h56" fill="none" stroke="#111" stroke-width="4.6" stroke-linecap="round"/><path d="M32 4v56M4 32h56" fill="none" stroke="#e8e8ea" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="32" r="4.2" fill="#ff1e1e" stroke="#000" stroke-width="1.7"/></svg>',
    logger:'<svg class="mk-ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M14 6h26l12 12v40H14z" fill="#0c0c10" stroke="#111" stroke-width="5" stroke-linejoin="round"/><path d="M14 6h26l12 12v40H14z" fill="none" stroke="#e8e8ea" stroke-width="2.6" stroke-linejoin="round"/><path d="M40 6v12h12" fill="none" stroke="#e8e8ea" stroke-width="2.2" stroke-linejoin="round"/><path d="M20 16h14M20 46h26M20 52h20" stroke="#e8e8ea" stroke-width="2.2" stroke-linecap="round" opacity=".6"/><path d="M19 34h5l3-9 4 14 4-11 3 6h8" fill="none" stroke="#111" stroke-width="5.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M19 34h5l3-9 4 14 4-11 3 6h8" fill="none" stroke="#e4aa28" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="47" cy="34" r="4.2" fill="#ff1e1e" stroke="#000" stroke-width="1.7"/></svg>'};
  const WORD={studio:'<span class="mk-w"><b>ej</b>Studio</span>',logger:'<span class="mk-w"><b>ej</b>Logger</span>'};
  const MENU='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';

  // ── styles (ejStudio's top bar classes are reused as-is; everything else is scoped to #ejl) ──
  const css=`
.brand{display:inline-grid;position:relative;flex:none}
.brand>.mark{grid-area:1/1;background:none;border:0;padding:0;color:var(--tx);cursor:pointer;white-space:nowrap;font:inherit;font-weight:800;letter-spacing:.06em;transition:opacity .45s ease,transform .6s cubic-bezier(.2,.9,.25,1),filter .45s ease}
.top .brand>.mark{font-size:17px}.brand>.mark .mk-ic{height:1.45em;width:1.45em}
.brand>.mark.bk{opacity:0;transform:translateX(-16px) scale(.8);filter:blur(2px);pointer-events:none}
.brand:hover>.mark.fr,.brand.pv>.mark.fr{opacity:0;transform:translateX(10px) scale(.86);filter:blur(3px)}
.brand:hover>.mark.bk,.brand.pv>.mark.bk{opacity:1;transform:none;filter:none}
.brand.go>.mark.fr{opacity:0;transform:translateX(14px) scale(.8);filter:blur(4px)}.brand.go>.mark.bk{opacity:1;transform:scale(1.06);filter:none}
.brand .bgdot{position:absolute;right:-9px;top:-1px;width:7px;height:7px;border-radius:50%;background:#eb2323;box-shadow:0 0 6px #eb2323;display:none;pointer-events:none}
body.ejl-bg .brand .bgdot{display:block}body.ejl-bgrec .brand .bgdot{animation:ejlp 1s steps(2) infinite}
.ejl-pop{position:fixed;z-index:400;background:var(--card);border:1px solid var(--ctl-b);border-radius:10px;padding:10px 12px;box-shadow:0 12px 34px rgba(0,0,0,.7);display:flex;flex-direction:column;gap:9px;font-size:12.5px;animation:ejlpi .18s ease-out;max-width:260px}
.ejl-pop .r{display:flex;gap:6px;justify-content:flex-end}.ejl-pop small{color:var(--mut)}@keyframes ejlpi{from{opacity:0;transform:translateY(4px) scale(.97)}}@keyframes ejlp{50%{opacity:.45}}
body.ejl-on #app,body.ejl-on #land{display:none!important}
#ejl{position:fixed;inset:0;z-index:50;background:var(--bg);display:none;flex-direction:column;--dig:"Barlow Semi Condensed","Arial Narrow","Roboto Condensed",sans-serif}
body.ejl-on #ejl{display:flex}#ejl.in{animation:ejlin .35s ease}@keyframes ejlin{from{opacity:0;transform:translateY(6px)}}
#ejl .lbl{font:600 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--mut)}
#ejl .edtop.wait{animation:ejlp 1s steps(2) infinite}#ejl .edtop.rec{border-color:var(--red);color:var(--red);background:var(--red-d);box-shadow:0 0 0 3px rgba(255,107,107,.12)}#ejl .edtop.rec.on{background:var(--red);color:#000}
#ejl .edtop:disabled{opacity:.35;box-shadow:none;cursor:default}
#ejl .tabs{display:flex;gap:2px;margin-left:.6rem}
#ejl .sub{display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid var(--card-b);min-height:40px;flex-wrap:wrap;flex:none}
#ejl select,#ejl input[type=text],#ejl input[type=search]{background:var(--ctl);border:1px solid var(--ctl-b);color:var(--tx);border-radius:6px;padding:4px 8px;font:12px var(--sans);min-width:0}
#ejl .chip{font:700 10.5px var(--mono);letter-spacing:.05em;padding:4px 9px;border-radius:11px;background:var(--ctl);color:var(--mut2);border:1px solid var(--ctl-b);white-space:nowrap;display:inline-flex;gap:6px;align-items:center;cursor:default}
#ejl .chip i{width:6px;height:6px;border-radius:50%;background:currentColor}#ejl .chip.ok{color:var(--green);background:var(--green-d);border-color:#1d5a30}
#ejl .chip.wait{color:var(--amber);background:var(--acc-d);border-color:var(--acc-b)}#ejl .chip.wait i{animation:ejlp 1s steps(2) infinite}#ejl .chip.bad{color:var(--red);background:var(--red-d);border-color:var(--red-b)}
#ejl .xb{background:var(--ctl);border:1px solid var(--ctl-b);border-radius:6px;padding:4px 10px;font:700 11px var(--mono);letter-spacing:.06em;color:var(--tx);cursor:pointer;white-space:nowrap}#ejl .xb.acc{background:var(--acc);color:#000;border-color:var(--acc)}#ejl .xb:disabled{opacity:.4;cursor:default}
#ejl .views{flex:1;min-height:0;display:flex}#ejl .view{display:none;flex:1;min-height:0;min-width:0}#ejl .view.on{display:flex;flex-direction:row}
#ejl .stage{flex:1;display:grid;place-items:center;padding:14px;min-width:0;background:radial-gradient(ellipse at center,#0a0a0d,#000 70%)}
#ejl .clu{width:min(100%,calc((100vh - 140px)*1024/600));aspect-ratio:1024/600;background:#000;border:1px solid #17171b;border-radius:6px;position:relative;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:4px;padding:4px;container-type:inline-size}
#ejl .ct{background:#030304;border:1px solid #121216;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;overflow:hidden;position:relative}
#ejl .ct .t{font:700 1.45cqw var(--mono);letter-spacing:.06em;color:#9a9aa2;white-space:nowrap}
#ejl .ct .v{font:700 7.2cqw/1 var(--dig);font-variant-numeric:tabular-nums;color:#f2f2f2;white-space:nowrap}#ejl .ct.na .v{color:#3a3a40}
#ejl .ct .u{font:600 1.3cqw var(--mono);color:#6a6a72}#ejl .ct .mm{font:600 1.35cqw var(--mono);color:#7d7d85;display:flex;gap:1.4cqw;margin-top:.4cqw}
#ejl .ct.hero{grid-column:span 2}#ejl .ct.hero .v{font-size:11cqw}
#ejl .tri3{display:flex;gap:1.4cqw;align-items:baseline;font:700 4.3cqw/1 var(--dig);font-variant-numeric:tabular-nums;color:#f2f2f2}#ejl .tri3 span{display:flex;flex-direction:column;align-items:center}#ejl .tri3 small{font:700 1.1cqw var(--mono);color:#7d7d85}
#ejl .recdot{position:absolute;right:1.2cqw;top:1cqw;display:flex;gap:.6cqw;align-items:center;font:700 1.3cqw var(--mono);z-index:2;color:#eb2323}#ejl .recdot i{width:1.3cqw;height:1.3cqw;border-radius:50%;background:#eb2323}#ejl .recdot.off i{background:#555}
#ejl .clnote{position:absolute;left:1cqw;bottom:-2.2em;font:11px var(--mono);color:var(--mut)}
#ejl .basic{flex:1;overflow:auto;padding:12px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-content:center}#ejl .basic>.bt{flex:0 0 calc((100% - 40px)/6);text-align:center}#ejl .basic .bt .mm{justify-content:center;gap:14px}
#ejl .csplit{display:inline-flex;gap:2px}#ejl .csplit .edtop:first-child{border-top-right-radius:3px;border-bottom-right-radius:3px}#ejl #ejl-cset{padding:.36rem .5rem;border-top-left-radius:3px;border-bottom-left-radius:3px}
#ejl .dside{width:310px;border-left:1px solid var(--card-b);overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;flex:0 0 auto}
#ejl .dk{display:grid;grid-template-columns:80px 1fr 44px;gap:8px;align-items:center;font-size:12.5px}#ejl .dk input[type=range]{accent-color:var(--acc);width:100%}#ejl .dk output{font:11.5px var(--mono);text-align:right}#ejl .dk input[type=color]{width:100%;height:24px;border:1px solid var(--ctl-b);background:var(--ctl);border-radius:5px;padding:1px}#ejl .kv{display:flex;justify-content:space-between;font:12px var(--mono);color:var(--mut2)}
#ejl .ejl-cpop{position:fixed;z-index:300;width:540px;max-width:calc(100vw - 16px);max-height:calc(100vh - 70px);overflow:auto;background:var(--card);border:1px solid var(--ctl-b);border-radius:10px;padding:12px 14px;box-shadow:0 14px 40px rgba(0,0,0,.75);display:flex;flex-direction:column;gap:10px;animation:ejlpi .16s ease-out}
#ejl .ejl-cpop .cph{display:flex;align-items:baseline;gap:10px}#ejl .ejl-cpop .cph b{font-size:13px}#ejl .ejl-cpop .sec h2{margin-bottom:2px}#ejl .ejl-cpop .cpf{display:flex;align-items:center;gap:8px;border-top:1px solid var(--grid);padding-top:10px}
#ejl .bt{background:var(--card);border:1px solid var(--card-b);border-radius:8px;padding:10px 12px;min-width:0}#ejl .bt .lbl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
#ejl .bt .v{font:700 28px var(--dig);font-variant-numeric:tabular-nums}#ejl .bt .v small{font:11px var(--mono);color:var(--mut)}#ejl .bt .mm{display:flex;justify-content:space-between;font:11px var(--mono);color:var(--mut2)}
#ejl .empty{flex:1;display:grid;place-items:center;color:var(--mut);font:12px var(--mono);letter-spacing:.06em;text-align:center;padding:30px;line-height:1.8}
#ejl .enav{width:220px;border-right:1px solid var(--card-b);overflow:auto;padding:8px;flex:0 0 auto}
#ejl .enav .g{font:700 10px var(--mono);letter-spacing:.12em;color:var(--mut);text-transform:uppercase;padding:10px 6px 3px}
#ejl .enav button{display:flex;width:100%;text-align:left;background:none;border:0;padding:4px 8px;border-radius:4px;color:#c9c9ce;cursor:pointer;font-size:12.5px;gap:6px}#ejl .enav button span{margin-left:auto;opacity:.6;font:11px var(--mono)}
#ejl .enav button.on{background:var(--acc);color:#000;font-weight:700}#ejl .enav button.dim{color:#5a5a62}
#ejl .ebody{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px;min-width:0}
#ejl .sec h2{font:700 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--acc);margin:0 0 8px}
#ejl .card{background:var(--card);border:1px solid var(--card-b);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
#ejl .knob{display:grid;grid-template-columns:minmax(0,1fr) minmax(160px,300px) auto;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--grid)}#ejl .knob:first-child{border-top:0}
#ejl .knob label{font-size:12.5px}#ejl .knob .note{grid-column:1/-1;font-size:11.5px;color:var(--mut)}#ejl .knob .path{font:11.5px var(--mono);color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ejl .knob input[type=checkbox],#ejl .pcard input{accent-color:var(--acc)}#ejl .soon{opacity:.45}
#ejl .pc{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
#ejl .pcard{background:var(--card);border:1px solid var(--card-b);border-radius:8px;padding:9px 11px;display:flex;gap:9px;cursor:pointer;align-items:flex-start}#ejl .pcard.on{border-color:var(--acc-b);background:var(--acc-d)}
#ejl .pcard b{display:block;font-size:12.5px;font-weight:600}#ejl .pcard small{color:var(--mut);font-size:11.5px}#ejl .pcard select{margin-top:4px;font-size:11px;padding:1px 4px}
#ejl .ext{color:var(--wb)}#ejl .xt{font:700 9px var(--mono);color:var(--cl);margin-left:4px;letter-spacing:.06em}
#ejl .msg{font:11.5px var(--mono);color:var(--mut2);max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ejl .msg.err{color:var(--red)}
`;
  mk('style',null,document.head).textContent=css;

  // ── state ──
  const S={num:{},clu:null,page:0,recT0:0,dsel:null,dpage:0,cver:0,mode:'studio',view:'live',live:'cluster',cat:null,sec:'This PC',q:'',pq:'',
    cfg:null,ports:[],params:[],byId:{},verified:false,ecuId:null,state:'idle',msg:'',err:'',rec:false,file:null,last:null,
    stats:{hz:0,theo:0,bytes:0},wb:{state:'off'},cur:{},mn:{},mx:{},dirty:true,started:false};
  const keyOf=s=>s.id+'|'+(s.units||'');
  const sel=()=>(S.cfg&&S.cfg.sel)||[];

  // ── brand switch (both top bars + landing) ──
  function brand(front){ const back=front==='studio'?'logger':'studio';
    return `<div class="brand" data-front="${front}"><button class="mark fr" title="${front==='studio'?'Switch to ejLogger':'Back to ejStudio'}">${SV[front]}${WORD[front]}</button><button class="mark bk" tabindex="-1" aria-hidden="true">${SV[back]}${WORD[back]}</button><i class="bgdot" title="ejLogger is logging in the background"></i></div>`; }
  function restyleMarks(){
    document.querySelectorAll('.mark').forEach(m=>{ if(m.closest('.brand')||m.closest('#ejl')) return; const ic=m.querySelector('.mk-ic'), w=m.querySelector('.mk-w'); if(ic) ic.outerHTML=SV.studio; if(w) w.outerHTML=WORD.studio; });
    const hm=document.querySelector('#app header.top .mark'); if(hm){ const t=document.createElement('div'); t.innerHTML=brand('studio'); hm.replaceWith(t.firstChild); }
    const lm=document.querySelector('#land .mark'); if(lm&&!lm.closest('.brand')){ lm.style.cursor='pointer'; lm.title='Hover to switch to ejLogger'; const t=document.createElement('div'); t.innerHTML=brand('studio'); const b=t.firstChild; b.style.fontSize=getComputedStyle(lm).fontSize; lm.replaceWith(b); }
    try{ document.title='ejStudio'; }catch(_){}
  }
  let pop=null;
  function closePop(){ if(pop){ pop.remove(); pop=null; } document.querySelectorAll('.brand.pv').forEach(b=>b.classList.remove('pv')); }
  function ask(e,html,okTxt,go,br){ closePop(); if(br) br.classList.add('pv'); pop=mk('div','ejl-pop',document.body);
    pop.style.left=Math.max(8,Math.min(innerWidth-270,e.clientX+12))+'px'; pop.style.top=Math.min(innerHeight-120,e.clientY+12)+'px';
    pop.innerHTML=`<span>${html}</span><div class="r"><button class="btn sm ghost" data-a="x">Cancel</button><button class="btn sm acc" data-a="go">${okTxt}</button></div>`;
    pop.onclick=ev=>{ const a=ev.target.dataset.a; if(a==='x') closePop(); if(a==='go'){ closePop(); go(); } };
    setTimeout(()=>pop&&pop.querySelector('[data-a=go]').focus(),0); }
  document.addEventListener('pointerdown',e=>{ if(pop&&!pop.contains(e.target)&&!e.target.closest('.brand')) closePop(); },true);
  document.addEventListener('click',e=>{ const b=e.target.closest('.brand>.mark.fr'); if(!b) return; e.stopPropagation(); const br=b.parentNode;
    if(br.dataset.front==='studio') ask(e,'Launch <b>ejLogger</b>?','Launch',()=>setMode('logger',br),br);
    else ask(e,'Back to <b>ejStudio</b>?'+(S.state!=='idle'?'<br><small>Logging keeps running.</small>':''),'Switch',()=>setMode('studio',br),br); },true);

  function setMode(m,br){ if(m===S.mode) return; const go=()=>{ S.mode=m; document.body.classList.toggle('ejl-on',m==='logger');
      if(m==='logger'){ if(typeof drawer==='function'){ try{ drawer(false); }catch(_){} } const r=$('ejl'); r.classList.remove('in'); void r.offsetWidth; r.classList.add('in'); start(); S.dirty=true; paintAll(); }
      bg(); document.querySelectorAll('.brand.go').forEach(b=>b.classList.remove('go')); };
    if(br){ br.classList.add('go'); setTimeout(go,280); } else go(); }
  function bg(){ document.body.classList.toggle('ejl-bg',S.mode==='studio'&&S.state!=='idle'); document.body.classList.toggle('ejl-bgrec',S.mode==='studio'&&S.rec); }

  // ── ejLogger window ──
  const root=mk('div',null,document.body); root.id='ejl';
  root.innerHTML=`<header class="top">${brand('logger')}
    <span class="csplit"><button class="edtop" id="ejl-conn" title="Connect to the ECU">● Connect</button><button class="edtop" id="ejl-cset" title="Connection settings (ECU port, wideband)">▾</button></span><button class="edtop rec" id="ejl-rec" disabled title="Record a log">● Rec</button>
    <nav class="tabs" id="ejl-tabs"><button data-v="live">Live</button><button data-v="params">Parameters</button><button data-v="cluster">Designer</button><button data-v="set">Config</button></nav>
    <span class="fill"></span><span class="msg" id="ejl-msg"></span></header>
    <div class="sub" id="ejl-sub"></div>
    <div class="views"><div class="view" id="ejlv-live"><div class="stage" id="ejl-stage"></div><div class="basic" id="ejl-basic"></div></div>
    <div class="view" id="ejlv-params"><div class="enav" id="ejl-pnav"></div><div class="ebody" id="ejl-pbody"></div></div>
    <div class="view" id="ejlv-cluster"><div class="stage" id="ejl-dstage"></div><div class="dside" id="ejl-dside"></div></div>
    <div class="view" id="ejlv-set"><div class="enav" id="ejl-snav"></div><div class="ebody" id="ejl-sbody"></div></div></div>`;
  $('ejl-tabs').onclick=e=>{ const v=e.target.dataset.v; if(v) show(v); };
  $('ejl-conn').onclick=()=>{ if(!API) return toast('ejLogger runs in the desktop app'); closeCpop(); if(S.state==='idle') connect(); else API.send({t:'disconnect'}); };
  $('ejl-cset').onclick=e=>{ e.stopPropagation(); if(!API) return toast('ejLogger runs in the desktop app'); cpop?closeCpop():openCpop(); };
  $('ejl-rec').onclick=()=>{ if(API) API.send({t:'rec',on:!S.rec}); };
  // ejStudio's shortcuts must not fire behind the logger
  document.addEventListener('keydown',e=>{ if(S.mode!=='logger') return; if(e.key==='Escape'&&pop){ closePop(); } if(!/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)&&!(e.ctrlKey&&e.shiftKey)) e.stopPropagation(); },true);

  function show(v){ S.view=v; root.querySelectorAll('#ejl-tabs button').forEach(b=>b.classList.toggle('foc',b.dataset.v===v));
    root.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='ejlv-'+v)); if(v==='set'&&!S.ports.length) rescan(); S.dirty=true; paintAll(); }

  // ── engine link ──
  function loadCluster(){ if(API&&API.cluster) API.cluster().then(r=>{ try{ S.clu=CLU.parse(r); CLU.reset(); }catch(e){ S.clu=null; toast('Cluster files: '+e.message); } S.dirty=true; paintAll(); }); }
  function start(){ if(S.started||!API) return; S.started=true; loadCluster(); API.send({t:'state'}); API.send({t:'params'}); rescan();
    if(sel().length) API.send({t:'select',list:sel()}); if(S.cfg&&S.cfg.autoConnect&&S.state==='idle') setTimeout(connect,300); }
  function connect(){ const c=S.cfg||{}; if(!c.defPath){ openCpop(); return toast('Choose the logger definition file first'); }
    if(!c.ecuPort){ openCpop(); return toast('Choose the ECU port first'); }
    S.err=''; S.cur={}; S.mn={}; S.mx={}; API.send({t:'select',list:sel()}); API.send({t:'connect'}); }
  function rescan(){ if(API) API.send({t:'ports'}); }
  function setCfg(p){ if(!API) return Promise.resolve(); return API.set(p).then(c=>{ S.cfg=c; S.dirty=true; paintAll(); }); }
  if(API){
    API.cfg().then(c=>{ S.cfg=c; S.dirty=true; paintAll(); });
    API.state().then(s=>{ if(s&&s.running){ S.state=s.state; S.rec=s.rec; S.file=s.file; S.last=s.last; bg(); } });
    API.on(m=>{
      switch(m.t){
        case 'status': S.state=m.state||'idle'; if(m.msg) S.msg=m.msg; if(S.state==='connecting') S.err=''; if(S.state==='idle'){ S.rec=false; S.stats.hz=0; } bg(); break;
        case 'msg': S.msg=m.text; if(S.mode==='logger') paintTop(); return;
        case 'error': S.err=m.text; if(S.mode==='logger'&&!/^engine:/.test(m.text)) toast(m.text); break;
        case 'ports': S.ports=m.list||[]; break;
        case 'params': S.params=m.list||[]; S.byId={}; S.params.forEach(p=>S.byId[p.id]=p); S.verified=m.verified; if(m.ecuId) S.ecuId=m.ecuId; break;
        case 'init': S.ecuId=m.ecuId; break;
        case 'stats': S.stats=m; if(S.mode==='logger'){ if(S.view==='params'&&$('ejl-pstat')) $('ejl-pstat').innerHTML=pstat(); else if(S.view==='live') S.dirty=true; } return;
        case 'wb': S.wb=m; if(S.mode==='logger'&&S.view==='live') S.dirty=true; return;
        case 'rec': { const was=S.rec; S.rec=!!m.on; if(m.on&&!was) S.recT0=Date.now(); if(m.file) S.file=m.file; if(was&&!m.on){ S.last=m.file; toast('Log saved: '+String(m.file).split(/[\\/]/).pop()); if(S.cfg&&S.cfg.openOnStop&&S.cfg.role!=='car') openInGraph(); } bg(); break; }
        case 'frame': for(const k in m.f){ S.cur[k]=m.f[k]; const v=m.v[k]; S.num[k]=v; if(Number.isFinite(v)){ if(!(k in S.mn)||v<S.mn[k].v) S.mn[k]={v,f:m.f[k]}; if(!(k in S.mx)||v>S.mx[k].v) S.mx[k]={v,f:m.f[k]}; } } if(S.mode==='logger'&&S.view==='live') S.dirty=true; return;
      }
      S.dirty=true; if(S.mode==='logger') paintAll(); else bg();
    });
  }
  function openInGraph(){ if(!API) return; API.openLast().then(ok=>{ if(!ok) return toast('The last log was not found'); setMode('studio');
    setTimeout(()=>{ try{ if($('app').classList.contains('hidden')) enterApp(); setPaneView(UI.focus,'graph'); }catch(_){} },900); }); }

  // ── selection: CSV column order = RomRaider's table order (by name), externals last ──
  function setSel(list){ const P=S.byId; list=list.filter(s=>P[s.id]||String(s.id).startsWith('wb:'));
    list.sort((a,b)=>{ const ea=String(a.id).startsWith('wb:'), eb=String(b.id).startsWith('wb:'); if(ea!==eb) return ea?1:-1; const na=(P[a.id]||{name:a.id}).name, nb=(P[b.id]||{name:b.id}).name; return na<nb?-1:na>nb?1:0; });
    S.cfg.sel=list; if(API) API.send({t:'select',list}); S.dirty=true; paintAll(); }
  const isSel=id=>sel().some(s=>s.id===id);
  function toggleParam(id,on){ const p=S.byId[id]; if(!p) return; let l=sel().filter(s=>s.id!==id); if(on) l.push({id,units:p.units[0]}); setSel(l); }
  function setUnits(id,u){ setSel(sel().map(s=>s.id===id?{id,units:u}:s)); }
  const CATS=[['Engine',/engine speed|engine load|throttle|accelerator|vehicle speed|gear|neutral|cam |camshaft|idle|isc|rpm/i],['Airflow',/mass air|maf|air flow|airflow/i],['Boost',/boost|manifold|wastegate|turbo|atmospheric|pressure/i],['Timing',/timing|ignition|advance/i],['Knock',/knock|iam|roughness/i],['Fuel',/a\/f|fuel|injector|afr|lambda|o2|cl\/ol|learning|purge|tgv/i],['Temps',/temperature|temp\b/i],['Electrical',/voltage|battery|alternator|current/i]];
  function catOf(p){ if(p.kind==='external') return 'External'; if(p.kind==='switch') return 'Switches'; if(/temperature/i.test(p.name)) return 'Temps'; for(const [c,re] of CATS) if(re.test(p.name)) return c; return 'Other'; }
  const CAT_ORDER=['Engine','Airflow','Boost','Timing','Knock','Fuel','Temps','Electrical','Other','Switches','External'];

  // ── painting ──
  let paintAll=function(){ if(!S.dirty&&S.mode!=='logger') return; paintTop(); paintSub(); if(S.view==='live') paintLive(); else if(S.view==='params') paintParams(); else if(S.view==='set') paintSet(); else if(S.view==='cluster') paintDside(); S.dirty=false; };
  function paintTop(){ const c=$('ejl-conn'), st=S.state; $('ejl-cset').className='edtop'+(st==='logging'?' on':st==='idle'?'':' wait');
    c.className='edtop'+(st==='logging'?' on':st==='idle'?'':' wait'); c.textContent=st==='idle'?'● Connect':st==='logging'?'● Logging':st==='settling'?'● Settling…':'● Connecting…';
    c.title=st==='idle'?'Connect to the ECU':'Disconnect';
    const r=$('ejl-rec'); r.disabled=st!=='logging'&&!S.rec; r.className='edtop rec'+(S.rec?' on':''); r.textContent=S.rec?'■ Stop':'● Rec';
    const m=$('ejl-msg'); m.textContent=S.err||(st!=='idle'?S.msg:''); m.className='msg'+(S.err?' err':''); m.title=m.textContent; }
  function pstat(){ return `${sel().length} logged · ${S.stats.bytes} bytes · <b style="color:var(--tx)">${S.stats.theo?S.stats.theo.toFixed(1):'–'} Hz</b>`; }
  function chip(cls,txt,title){ return `<span class="chip ${cls}" title="${esc(title||'')}"><i></i>${esc(txt)}</span>`; }
  function allProfiles(){ return Object.assign({},(S.clu&&S.clu.profiles)||{},(S.cfg&&S.cfg.profiles)||{}); }
  function profSel(){ const pr=allProfiles(), names=Object.keys(pr); return `<span class="lbl">Profile</span><select id="ejl-prof"><option value="">${names.length?'—':'No profiles yet'}</option>${names.map(n=>`<option ${S.cfg.profile===n?'selected':''}>${esc(n)}</option>`).join('')}</select><button class="xb" id="ejl-psave" title="Save the ticked parameters as a profile">SAVE AS…</button>`; }
  function paintSub(){ let h=''; const st=S.state, c=S.cfg||{};
    if(S.view==='live'){ const ecu=st==='idle'?chip('','ECU'):st==='logging'?chip('ok','ECU '+c.ecuPort+(S.ecuId?' · '+S.ecuId:'')):chip('wait','ECU '+(c.ecuPort||''));
      const wbs=S.wb.state, wbl=c.wbType&&c.wbType!=='none'?'WB '+(c.wbPort||'?'):'WB'; const wb=!c.wbType||c.wbType==='none'||st==='idle'?chip('',wbl,'No wideband running'):S.wb.ok?chip('ok',wbl):S.wb.state==='open'?chip('wait',wbl,'Port open, no data yet'):chip('bad',wbl,'Port missing; retrying every second');
      h=`<span class="lbl">View</span><div class="seg" id="ejl-lm"><button data-m="cluster" class="${S.live==='cluster'?'on':''}">Cluster</button><button data-m="basic" class="${S.live==='basic'?'on':''}">Basic View</button></div>${profSel()}
        <span class="lbl">Rate</span><b style="font:700 12px var(--mono)" title="Counted by the logger. K-Line limit 480/(6+${S.stats.bytes}) = ${S.stats.theo?S.stats.theo.toFixed(1):'–'} Hz">${st==='logging'&&S.stats.hz?S.stats.hz.toFixed(1)+' Hz':'–'}</b>${ecu}${wb}<span class="fill"></span>
        <span class="lbl" style="color:${S.rec?'var(--red)':'var(--mut)'}">${S.rec?'● recording '+esc(String(S.file||'').split(/[\\/]/).pop()):''}</span>${S.last&&!S.rec?'<button class="xb acc" id="ejl-og">OPEN LAST LOG IN GRAPH</button>':''}`; }
    else if(S.view==='params'){ h=`${profSel()}<input type="search" id="ejl-pq" placeholder="Search parameters…" value="${esc(S.pq)}" style="width:220px"><span class="lbl">${S.verified?'ECU '+esc(S.ecuId||'')+' · supported only':'Connect once to show only what this ECU supports'}</span><span class="fill"></span><span class="lbl" id="ejl-pstat">${pstat()}</span>`; }
    else if(S.view==='cluster'){ const pg=S.clu?CLU.pageOf(S.clu,curProf()):{}, g=String(pg.grid||'auto').toLowerCase();
      h=`${profSel()}<span class="lbl">Grid</span><div class="seg" id="ejl-grid">${[['auto','Auto'],['2x2','2 × 2'],['3x2','3 × 2'],['3x3','3 × 3'],['4x3','4 × 3']].map(([k,l])=>`<button data-g="${k}" class="${g===k?'on':''}">${l}</button>`).join('')}</div><span class="fill"></span><span class="lbl">Click a tile to style it · drag to reorder · saved as you change them</span>`; }
    else if(S.view==='set') h=`<span class="lbl">Config</span><input type="search" id="ejl-ss" placeholder="Search all settings…" value="${esc(S.q)}" style="width:240px"><span class="fill"></span><span class="lbl">Saved as you change them</span>`;
    const sub=$('ejl-sub'), foc=document.activeElement&&document.activeElement.id; sub.innerHTML=h; if(foc&&$(foc)&&sub.contains($(foc))){ const el=$(foc); el.focus(); if(el.setSelectionRange) el.setSelectionRange(el.value.length,el.value.length); } }
  $('ejl-sub').onclick=e=>{ const gb=e.target.closest('[data-g]'); if(gb&&S.clu){ setProp('page-'+curProf(),'grid',gb.dataset.g==='auto'?null:gb.dataset.g); S.dpage=0; S.dirty=true; paintAll(); return; } const m=e.target.dataset.m; if(m){ S.live=m; S.dirty=true; paintAll(); }
    if(e.target.id==='ejl-og') openInGraph();
    if(e.target.id==='ejl-psave') ask(e,'Save the ticked parameters as<br><input type="text" id="ejl-pname" placeholder="Profile name" style="width:100%;margin-top:6px" value="'+esc(S.cfg.profile||'')+'">','Save',()=>{},null)||setTimeout(()=>{ const b=pop&&pop.querySelector('[data-a=go]'), inp=$('ejl-pname'); if(!b||!inp) return; inp.focus(); inp.select();
      const save=()=>{ const n=inp.value.trim(); if(!n) return; const pr=Object.assign({},S.cfg.profiles||{}); pr[n]=sel().slice(); closePop(); setCfg({profiles:pr,profile:n,sel:sel()}); toast('Profile saved: '+n); };
      b.onclick=e2=>{ e2.stopPropagation(); save(); }; inp.onkeydown=k=>{ if(k.key==='Enter') save(); }; },0); };
  $('ejl-sub').onchange=e=>{ if(e.target.id==='ejl-prof'){ const n=e.target.value, l=allProfiles()[n]; if(l){ S.cfg.profile=n; S.page=0; CLU.reset(); setSel(l.slice()); const w=l.find(x=>String(x.id).startsWith('wb:')), p={profile:n,sel:S.cfg.sel}; if(w&&S.cfg.wbType!==w.id.slice(3)){ p.wbType=w.id.slice(3); p.wbUnits=w.units||S.cfg.wbUnits; } setCfg(p); } } };
  $('ejl-sub').oninput=e=>{ if(e.target.id==='ejl-pq'){ S.pq=e.target.value; paintParams(); } if(e.target.id==='ejl-ss'){ S.q=e.target.value; paintSet(); } };

  // Live: default cluster layout (stand-in until the rrOS layout import lands with the Cluster build) + Basic View
  const selItems=()=>sel().map(s=>({s,k:keyOf(s),p:S.byId[s.id]||{name:s.id,units:[s.units]}}));
  function paintLive(){ const items=selItems(), on=S.state==='logging';
    $('ejl-stage').style.display=S.live==='cluster'?'':'none'; $('ejl-basic').style.display=S.live==='basic'?'':'none';
    if(S.live==='basic'){ $('ejl-basic').innerHTML=!items.length?'<div class="empty">No parameters ticked.<br>Open Parameters to choose what to log.</div>':items.map(({s,k,p})=>`<div class="bt"><span class="lbl ${p.kind==='external'?'ext':''}" title="${esc(p.name)}">${esc(p.name)}</span><div class="v">${S.cur[k]!=null?esc(S.cur[k]):'--'} <small>${esc(s.units||'')}</small></div><div class="mm"><span>MIN ${S.mn[k]?esc(S.mn[k].f):'--'}</span><span>MAX ${S.mx[k]?esc(S.mx[k].f):'--'}</span></div></div>`).join(''); return; }
    if(!S.clu){ $('ejl-stage').innerHTML='<div class="empty">Loading the cluster files…</div>'; return; }
    drawCluster(16); }
  let lastT=performance.now();
  const curProf=()=>(S.cfg&&S.cfg.profile)||'master';
  function drawDesigner(dt){ CLU.frame($('ejl-dstage'),{C:S.clu,profile:curProf(),edit:true,selected:S.dsel,ver:S.cver,page:S.dpage,sel:sel(),byId:S.byId,cur:S.cur,num:S.num,mn:S.mn,mx:S.mx,rec:S.rec,recT0:S.recT0,hz:S.stats.hz,logging:S.state==='logging',
    onSelect:cid=>{ S.dsel=S.dsel===cid?null:cid; CLU.reset(); paintDside(); }, onMove:moveSlot, onPage:k=>{ S.dpage=k; CLU.reset(); }},dt); }
  // ── sidecar edits: applied in memory at once (cluster redraws), written to disk shortly after ──
  const pend={}; let pendT=0;
  function setProp(file,key,val){ if(!S.clu) return; const P=S.clu.P, o=P[file]||(P[file]=Object.defineProperty({},'_order',{value:[]})); if(val===null) delete o[key]; else { if(!(key in o)) o._order.push(key); o[key]=String(val); }
    S.cver++; CLU.reset(); (pend[file]=pend[file]||{})[key]=val; clearTimeout(pendT); pendT=setTimeout(flushProps,400); }
  function flushProps(){ if(!API||!API.writeProp) return; const files=Object.keys(pend); let reparse=false; Promise.all(files.map(f=>{ const p=pend[f]; delete pend[f]; if(/^(warnlimits|gauges|labels)$/.test(f)) reparse=true; return API.writeProp(f,p); }))
    .then(r=>{ if(r.some(x=>!x)) toast('Could not save a cluster setting'); if(reparse) loadCluster(); }); }
  function curSlots(){ const C=S.clu; return CLU.slotsFor(C,curProf())||sel().map(x=>C.alias[x.id]||x.id); }
  function saveSlots(list){ setProp('page-'+curProf(),'slots',list.join(', ')); }
  function moveSlot(a,b){ const l=curSlots(), i=l.indexOf(a), j=l.indexOf(b); if(i<0||j<0) return; l.splice(i,1); l.splice(j,0,a); saveSlots(l); }
  const DEF={tc:'#f2f2f2',vc:'#f2f2f2',mc:'#f2f2f2',uc:'#8a8a92'};
  function paintDside(){ const el=$('ejl-dside'); if(!el) return; if(!S.clu){ el.innerHTML='<div class="lbl">Loading the cluster files…</div>'; return; }
    const C=S.clu, prof=curProf(), th=CLU.themeOf(C,prof), slots=curSlots(), tg=k=>th['tile.'+S.dsel+'.'+k];
    const logged=sel().map(x=>({id:C.alias[x.id]||x.id,name:(S.byId[x.id]||{name:x.id}).name})).filter(x=>!slots.includes(x.id));
    let h=`<div class="card"><span class="lbl">Page · ${esc(prof)}</span><div class="kv"><span>${slots.length} gauge${slots.length===1?'':'s'}</span></div>
      <div style="display:flex;gap:6px"><select id="ejl-dadd" style="flex:1"><option value="">Add a logged gauge…</option>${logged.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><button class="xb" data-d="add">ADD</button></div>
      <div class="note lbl" style="text-transform:none;letter-spacing:0">Only logged parameters can be added. Tick more in Parameters.</div></div>`;
    if(S.dsel){ const trims=S.dsel===C.roles.AFC_SOURCE&&slots.includes(C.roles.AFL_SOURCE), T=S.clu.P.trim||{};
      const col=(k,l)=>`<div class="dk"><label>${l}</label><input type="color" data-ts="${k}" value="${/^#[0-9a-f]{6}$/i.test(tg(k)||'')?tg(k):DEF[k]}"><span></span></div>`;
      const sz=(k,l)=>{ const v=Math.max(.6,Math.min(1.5,parseFloat(tg(k))||1)); return `<div class="dk"><label>${l}</label><input type="range" min=".6" max="1.5" step=".05" data-ts="${k}" value="${v}"><output>${Math.round(v*100)}%</output></div>`; };
      const name=(CLU.find({C,sel:sel()},S.dsel)&&S.byId[CLU.find({C,sel:sel()},S.dsel).id]||{}).name||(C.gauge[S.dsel]||{}).name||S.dsel, bot=tg('bottom')||'';
      h+=`<div class="card"><span class="lbl">Tile</span><b style="font-size:14px">${esc(trims?(T.title||'TRIMS'):(tg('title')||CLU.titleOf(C,S.dsel,name)))}</b><span class="lbl" style="text-transform:none;letter-spacing:0">${esc(trims?'A/F Correction #1 + A/F Learning #1':name)}</span>
        ${trims?'':`<div class="dk"><label>Title</label><input type="text" data-tt="1" value="${esc(tg('title')||'')}" placeholder="${esc(CLU.titleOf(C,S.dsel,name))}"><span></span></div>`}
        <div style="display:flex;gap:6px"><button class="xb" data-d="rm">REMOVE FROM PAGE</button><button class="xb" data-d="reset">RESET STYLE</button></div></div>
        <div class="card"><span class="lbl">Colour</span>${col('tc','Title')}${col('vc','Digits')}${trims?'':col('mc','Min / Max')+col('uc','Unit')}</div>
        <div class="card"><span class="lbl">Size</span>${sz('ts','Title')}${sz('vs','Digits')}${trims?'':sz('ms','Min / Max')+sz('us','Unit')}</div>`;
      if(trims) h+=`<div class="card"><span class="lbl">Total Trim</span>${tg2('trim','enabled','Enabled',true)}<div class="dk"><label>Title</label><input type="text" data-pf="trim" data-pk="title" value="${esc(T.title||'TRIMS')}"><span></span></div>
        ${rng2('trim','clol.closed','CL/OL closed value',0,255,1,8)}${tg2('trim','grey.when.open','Grey when open loop',false)}${tg2('trim','clol.label','CL / OL tag',true)}${rng2('trim','clol.x','Tag across (%)',0,100,1,86)}${rng2('trim','clol.y','Tag down (%)',0,100,1,7)}</div>`;
      else h+=`<div class="card"><span class="lbl">Bottom row</span><div class="seg" id="ejl-dbot" style="flex-wrap:wrap">${[['','Default'],['minmax','Min+Max'],['min','Min'],['max','Max'],['poll','Poll rate'],['off','Off']].map(([k,l])=>`<button data-b="${k}" class="${bot===k?'on':''}">${l}</button>`).join('')}</div></div>`; }
    else h+=`<div class="card"><span class="lbl">Tile</span><span class="lbl" style="text-transform:none;letter-spacing:0">Click a tile on the cluster to style it.</span></div>`;
    const ae=document.activeElement; if(ae&&el.contains(ae)&&(ae.type==='range'||ae.type==='color'||ae.type==='text')) return; el.innerHTML=h; }
  const tg2=(f,k,l,d)=>{ const P=(S.clu&&S.clu.P[f])||{}, v=P[k]==null||P[k]===''?d:String(P[k]).toLowerCase()==='true'; return `<div class="dk"><label>${l}</label><span></span><input type="checkbox" data-pf="${f}" data-pk="${k}" ${v?'checked':''} style="justify-self:end;accent-color:var(--acc)"></div>`; };
  const rng2=(f,k,l,mn,mx,st,d)=>{ const P=(S.clu&&S.clu.P[f])||{}; let v=parseFloat(P[k]); if(!Number.isFinite(v)) v=d; return `<div class="dk"><label>${l}</label><input type="range" min="${mn}" max="${mx}" step="${st}" value="${v}" data-pf="${f}" data-pk="${k}"><output>${v}</output></div>`; };
  function tileSet(k,v){ setProp('theme-'+curProf(),'tile.'+S.dsel+'.'+k,v); }
  $('ejl-dside').addEventListener('input',e=>{ const t=e.target, d=t.dataset;
    if(d.ts){ if(t.type==='range'){ const v=Math.max(.6,Math.min(1.5,+t.value)); t.nextElementSibling.textContent=Math.round(v*100)+'%'; tileSet(d.ts,v===1?null:v.toFixed(2)); } else if(/^#[0-9a-f]{6}$/i.test(t.value)) tileSet(d.ts,t.value.toUpperCase()===DEF[d.ts].toUpperCase()?null:t.value.toUpperCase()); }
    if(d.tt) tileSet('title',t.value.trim()||null);
    propInput(e); });
  $('ejl-dside').addEventListener('change',propInput);
  $('ejl-dside').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const d=b.dataset;
    if(d.d==='add'){ const v=$('ejl-dadd').value; if(v){ saveSlots(curSlots().concat(v)); paintDside(); } }
    if(d.d==='rm'&&S.dsel){ const C=S.clu, rm=[S.dsel]; if(S.dsel===C.roles.AFC_SOURCE) rm.push(C.roles.AFL_SOURCE); saveSlots(curSlots().filter(x=>!rm.includes(x))); S.dsel=null; paintDside(); }
    if(d.d==='reset'&&S.dsel){ for(const k of ['tc','vc','mc','uc','ts','vs','ms','us','title','bottom']) tileSet(k,null); paintDside(); }
    if(d.b!=null&&S.dsel){ tileSet('bottom',d.b||null); paintDside(); } });
  // generic sidecar inputs: data-pf (file) + data-pk (key); ranges live, toggles and text on change
  function propInput(e){ const t=e.target, d=t.dataset; if(!d.pf||!d.pk) return;
    if(t.type==='checkbox'){ if(e.type==='change') setProp(d.pf,d.pk,t.checked?'true':'false'); return; }
    if(t.type==='range'){ const v=Math.max(+t.min,Math.min(+t.max,+t.value)); if(t.nextElementSibling) t.nextElementSibling.textContent=v; setProp(d.pf,d.pk,String(v)); return; }
    if(e.type!=='change') return; let v=t.value.trim();
    if(d.kind==='warn'){ const parts=v.split(',').map(x=>x.trim()); if(!parts.every(x=>x===''||Number.isFinite(+x))){ toast('Warn limits: numbers separated by commas'); return; } v=parts.join(', '); }
    if(d.kind==='num'){ const n=+v; if(!Number.isFinite(n)){ toast('Enter a number'); return; } v=String(Math.max(+t.min||-1e9,Math.min(+t.max||1e9,n))); }
    if(d.kind==='color'&&!/^#[0-9a-f]{6}$/i.test(v)){ return; }
    setProp(d.pf,d.pk,v); }
  $('ejl-sbody').addEventListener('input',propInput); $('ejl-sbody').addEventListener('change',propInput);
  function drawCluster(dt){ CLU.frame($('ejl-stage'),{C:S.clu,profile:(S.cfg&&S.cfg.profile)||'master',page:S.page,sel:sel(),byId:S.byId,cur:S.cur,num:S.num,mn:S.mn,mx:S.mx,rec:S.rec,recT0:S.recT0,hz:S.stats.hz,logging:S.state==='logging',onPage:k=>{ S.page=k; CLU.reset(); }},dt); }

  // Parameters: Grouped (categories down the side, tickable cards)
  function paintParams(){ const q=S.pq.trim().toLowerCase(), cfg=S.cfg||{};
    if(!S.params.length){ $('ejl-pnav').innerHTML=''; $('ejl-pbody').innerHTML=`<div class="empty">${cfg.defPath?'Loading the logger definition…':'Choose the logger definition (logger_METRIC_EN_v370.xml)<br>in ☰ → Connection → ECU.'}</div>`; return; }
    const list=S.params.filter(p=>p.kind!=='external'||p.wb===cfg.wbType), by={}; list.forEach(p=>{ const c=catOf(p); (by[c]=by[c]||[]).push(p); });
    const cats=CAT_ORDER.filter(c=>by[c]); if(!S.cat||!by[S.cat]) S.cat=cats[0];
    $('ejl-pnav').innerHTML=`<div class="g">Categories</div>`+cats.map(c=>`<button data-c="${c}" class="${c===S.cat&&!q?'on':''}">${c}<span>${by[c].filter(p=>isSel(p.id)).length}/${by[c].length}</span></button>`).join('')+(by.External?'':'<div class="g">External</div><button data-go="Wideband" class="dim">Set up a wideband…</button>');
    const shown=q?list.filter(p=>(p.name+' '+p.desc+' '+p.id).toLowerCase().includes(q)):by[S.cat];
    const card=p=>{ const s=sel().find(x=>x.id===p.id), on=!!s, u=s?s.units:p.units[0];
      return `<label class="pcard ${on?'on':''}"><input type="checkbox" data-id="${esc(p.id)}" ${on?'checked':''}><span style="min-width:0"><b class="${p.kind==='external'?'ext':''}">${esc(p.name)}${p.kind==='ecuparam'?'<span class="xt">EXT</span>':''}</b><small>${p.kind==='external'?'external · no K-Line bytes':p.bytes+' byte'+(p.bytes>1?'s':'')}${p.units.length<2?' · '+esc(p.units[0]||''):''}</small>${p.units.length>1?`<br><select data-u="${esc(p.id)}">${p.units.map(x=>`<option ${x===u?'selected':''}>${esc(x)}</option>`).join('')}</select>`:''}</span></label>`; };
    $('ejl-pbody').innerHTML=`<div class="sec"><h2>${q?'Search':S.cat}</h2><div class="pc">${(shown||[]).map(card).join('')||'<span class="lbl">Nothing matches</span>'}</div></div>`; }
  $('ejl-pnav').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.c){ S.cat=b.dataset.c; S.pq=''; S.dirty=true; paintAll(); } if(b.dataset.go){ S.sec=b.dataset.go; show('set'); } };
  $('ejl-pbody').onchange=e=>{ const d=e.target.dataset; if(d.id){ toggleParam(d.id,e.target.checked); if(String(d.id).startsWith('wb:')&&e.target.checked&&S.cfg.wbUnits){ setUnits(d.id,S.cfg.wbUnits); } } if(d.u) { setUnits(d.u,e.target.value); if(String(d.u).startsWith('wb:')) setCfg({wbUnits:e.target.value}); } };
  $('ejl-pbody').addEventListener('click',e=>{ if(e.target.tagName==='SELECT') e.preventDefault(); });

  // ☰ logger settings (Tables-style sidebar with search)
  const portOpts=cur=>{ const l=S.ports.slice(); if(cur&&!l.some(p=>p.path===cur)) l.unshift({path:cur,name:'not connected'}); return `<option value="">Choose…</option>`+l.map(p=>`<option value="${esc(p.path)}" ${p.path===cur?'selected':''}>${esc(p.path)}${p.name?' · '+esc(p.name):''}</option>`).join(''); };
  const tick=(k,l,note,dis)=>`<div class="knob ${dis?'soon':''}"><label for="ejl-k-${k}">${l}</label><span></span><input type="checkbox" id="ejl-k-${k}" data-k="${k}" ${S.cfg&&S.cfg[k]?'checked':''} ${dis?'disabled':''} style="justify-self:end">${note?`<div class="note">${note}</div>`:''}</div>`;
  const cl=()=>S.clu&&S.clu.P;
  const tg3=(f,k,l,d)=>{ const P=(cl()&&cl()[f])||{}, v=P[k]==null||P[k]===''?d:String(P[k]).toLowerCase()==='true'; return `<div class="knob"><label>${l}</label><span></span><input type="checkbox" data-pf="${f}" data-pk="${k}" ${v?'checked':''} style="justify-self:end"></div>`; };
  const rng3=(f,k,l,mn,mx,st,d)=>{ const P=(cl()&&cl()[f])||{}; let v=parseFloat(P[k]); if(!Number.isFinite(v)) v=d; return `<div class="knob"><label>${l}</label><input type="range" min="${mn}" max="${mx}" step="${st}" value="${v}" data-pf="${f}" data-pk="${k}" style="accent-color:var(--acc)"><output>${v}</output></div>`; };
  const soon=t=>`<div class="knob soon"><label>${t}</label><span class="lbl">Later build</span><span></span></div>`;
  const SECS=[
    ['THIS PC',[['This PC',()=>`<div class="knob"><label>This PC is</label><div class="seg" id="ejl-role"><button data-r="car" class="${S.cfg.role==='car'?'on':''}">Car cluster</button><button data-r="laptop" class="${S.cfg.role!=='car'?'on':''}">Laptop</button></div><span></span><div class="note">Car: boots straight into ejLogger full-screen, auto-record, screensaver, phone panel (car mode arrives in a later build; the installer will ask once). Laptop: this window, manual recording.</div></div>`]]],
    ['CONNECTION',[['ECU',()=>`<div class="knob"><label>ECU port (Tactrix / K-Line)</label><select data-c="ecuPort">${portOpts(S.cfg.ecuPort)}</select><button class="xb" data-a="rescan" title="Rescan ports">↻</button><div class="note">Every serial port on this PC. Serial only (J2534 is not used). "MOCK" is a simulated ECU for testing at the desk.</div></div>
        <div class="knob"><label>Logger definition</label><span class="path" title="${esc(S.cfg.defPath||'')}">${S.cfg.defPath?esc(S.cfg.defPath.split(/[\\/]/).pop()):'None chosen'}</span><button class="xb" data-a="def">CHOOSE…</button><div class="note">The standard logger definitions file (logger_METRIC_EN_v370.xml). A copy is kept with ejStudio's settings.${S.verified?' ECU '+esc(S.ecuId||'')+': showing supported parameters only.':''}</div></div>
        ${tick('autoConnect','Connect automatically when ejLogger opens')}${tick('fastPoll','Fast poll (continuous A8 stream)','Continuous streaming from the ECU. Leave on.')}`],
      ['Wideband',()=>`<div class="knob"><label>Wideband sensor</label><select data-c="wbType"><option value="none">None</option><option value="aem" ${S.cfg.wbType==='aem'?'selected':''}>AEM UEGO</option><option value="innovate" ${S.cfg.wbType==='innovate'?'selected':''}>Innovate LC-2 (MTS)</option><option value="plx" ${S.cfg.wbType==='plx'?'selected':''}>PLX</option></select><span></span></div>
        <div class="knob ${S.cfg.wbType==='none'?'soon':''}"><label>Wideband port</label><select data-c="wbPort" ${S.cfg.wbType==='none'?'disabled':''}>${portOpts(S.cfg.wbPort)}</select><button class="xb" data-a="rescan" title="Rescan ports">↻</button><div class="note">If the port isn't there yet, it retries every second and logging carries on without it.</div></div>`]]],
    ['CLUSTER',[['Cluster files',()=>`<div class="knob"><label>Cluster folder</label><span class="path" title="${esc((S.clu&&S.clu.dir)||'')}">${esc((S.clu&&S.clu.dir)||'Loading…')}</span><span style="display:flex;gap:6px"><button class="xb" data-a="cimp">IMPORT…</button><button class="xb" data-a="copen">OPEN</button></span><div class="note">Layout pages, gauge titles, labels, warn limits, trims, warm-up and display settings, as key = value .properties files, plus RomRaider-style profiles. IMPORT copies them from an existing ClusterConfig folder.</div></div>`],['Screensaver',()=>{ if(!cl()) return ''; const sp=cl().screensaver||{}, pk='style.'+curProf(), st=sp[pk]||'header';
        return `<div class="knob"><label>Style for profile “${esc(curProf())}”</label><select data-pf="screensaver" data-pk="${esc(pk)}">${Object.entries(SS.STYLES).map(([k,l])=>`<option value="${k}" ${k===st?'selected':''}>${l}</option>`).join('')}</select><button class="xb" data-a="sspv">PREVIEW</button><div class="note">Header Pulses: the boxer's unequal-length headers firing 1-3-2-4. Ink: drops unfurling in water. Night Sky: wheeling stars with a shooting star on every blip. Coolant sets the colour. Touch or press a key to close the preview.</div></div>
        ${tg3('screensaver','enabled','Screensaver',true)}${rng3('screensaver','idle.minutes','Start after stopped for (min)',0.25,60,0.25,5)}${rng3('screensaver','idle.rpm.max','…and below (rpm)',600,4000,50,1800)}${rng3('screensaver','dismiss.speed','Wake at (km/h)',1,30,1,5)}
        ${rng3('screensaver','cold.c','Blue at or below (°C)',-20,90,1,40)}${rng3('screensaver','warm.c','Green at (°C)',0,100,1,65)}${rng3('screensaver','normal.c','Amber from (°C)',20,110,1,80)}
        ${tg3('screensaver','clock.enabled','Clock',true)}${rng3('screensaver','clock.size','Clock size',0.05,0.4,0.01,0.16)}${rng3('screensaver','clock.alpha','Clock opacity',0,1,0.05,0.22)}
        <div class="knob"><label>Clock position</label><select data-pf="screensaver" data-pk="clock.position">${['corner','centre'].map(x=>`<option ${String(sp['clock.position']||'corner')===x?'selected':''}>${x}</option>`).join('')}</select><span></span></div>
        ${rng3('screensaver','fadein.ms','Fade in (ms)',0,5000,100,1200)}${rng3('screensaver','dissipate.ms','Fade out (ms)',100,5000,100,1600)}
        <div class="knob"><label></label><span></span><span></span><div class="note">Engages on the car cluster only (Config → This PC). Touch the screen or reach the wake speed to dismiss.</div></div>`; }],
      ['Warm-up',()=>cl()?`${tg3('warmup','enabled','Warm-up display',true)}${rng3('warmup','threshold.c','Ready temperature (°C)',40,110,1,80)}${rng3('warmup','coldstart.c','Cold start (°C)',0,90,1,20)}<div class="knob"><label>Caption</label><input type="text" data-pf="warmup" data-pk="text" value="${esc(cl().warmup&&cl().warmup.text||'WARMING UP')}"><span></span></div>${tg3('warmup','eta.enabled','Show time to warm',true)}${tg3('warmup','ring.enabled','Progress ring around the cluster',true)}${rng3('warmup','ring.px','Ring thickness (px)',2,20,1,5)}`:''],
      ['Warn limits',()=>{ if(!cl()) return ''; const W=cl().warnlimits||{}; return `<div class="knob"><label>How it works</label><span></span><span></span><div class="note">Approach, warn, critical (an optional 4th = hard critical). Lower than approach means lower is worse, like knock. Matched on the parameter name.</div></div>`+(W._order||[]).filter(k=>!k.includes('.')).map(k=>`<div class="knob"><label>${esc(k)}</label><input type="text" data-pf="warnlimits" data-pk="${esc(k)}" data-kind="warn" value="${esc(W[k])}"><span></span></div>`).join('')+rng3('warnlimits','hysteresis.frac','Tier hysteresis',0,0.5,0.01,0.05); }],
      ['Night',()=>{ if(!cl()) return ''; const D=cl().dimming||{}, m=String(D.mode||'auto').toLowerCase(); return `<div class="knob"><label>Mode</label><div class="seg" id="ejl-dmode">${['auto','day','night'].map(x=>`<button data-dm="${x}" class="${m===x?'on':''}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><span></span><div class="note">Auto follows sunrise and sunset for the location below, worked out offline.</div></div>${rng3('dimming','brightness','Night brightness (%)',10,100,1,42)}${rng3('dimming','sunrise.offset.min','Sunrise offset (min)',-120,120,5,15)}${rng3('dimming','sunset.offset.min','Sunset offset (min)',-120,120,5,15)}<div class="knob"><label>Latitude</label><input type="text" data-pf="dimming" data-pk="lat" data-kind="num" min="-90" max="90" value="${esc(parseFloat(D.lat)||49.2827)}"><span></span></div><div class="knob"><label>Longitude</label><input type="text" data-pf="dimming" data-pk="lon" data-kind="num" min="-180" max="180" value="${esc(parseFloat(D.lon)||-123.1207)}"><span></span></div>`; }],
      ['Wideband fuel cut',()=>cl()?rng3('display','wb.cut.afr','Show - - - - at or above (AFR)',16,40,0.5,24)+`<div class="knob"><label></label><span></span><span></span><div class="note">On overrun the wideband reads very lean; at or above this AFR the WB tile shows - - - - instead of a number.</div></div>`:'']]],
    ['RECORDING',[['Auto-record',()=>`<div class="knob soon"><label>Auto-record</label><span class="lbl">Car only</span><span></span><div class="note">On this laptop, recording is manual (● Rec).</div></div>`],
      ['Log files',()=>`<div class="knob"><label>Log folder</label><span class="path" title="${esc(S.cfg.logDir||'')}">${esc(S.cfg.logDir||'')}</span><span style="display:flex;gap:6px"><button class="xb" data-a="dir">CHANGE…</button><button class="xb" data-a="open">OPEN</button></span><div class="note">Files are named romraiderlog_YYYYMMDD_HHMMSS.csv, in the standard logger format.</div></div>${tick('openOnStop','Open in Graph when recording stops')}`]]],
    ['PHONE & NETWORK',[['Phone panel',()=>soon('ejlogger.local · passcode (on hold until the laptop UI is done)')]]]];
  function paintSet(){ if(!S.cfg) return; const q=S.q.trim().toLowerCase(), all=SECS.flatMap(s=>s[1]);
    $('ejl-snav').innerHTML=SECS.map(([g,it])=>`<div class="g">${g}</div>`+it.map(([n])=>`<button data-n="${n}" class="${n===S.sec&&!q?'on':''} ${g==='PHONE & NETWORK'?'dim':''}">${n}</button>`).join('')).join('');
    let h; if(q){ const tmp=document.createElement('div'); h=all.map(([n,f])=>{ tmp.innerHTML=f(); const ks=[...tmp.querySelectorAll('.knob')].filter(k=>(n+' '+k.textContent).toLowerCase().includes(q)); return ks.length?`<div class="sec"><h2>${n}</h2><div class="card">${ks.map(k=>k.outerHTML).join('')}</div></div>`:''; }).join('')||'<span class="lbl">No settings match</span>'; }
    else { const it=all.find(x=>x[0]===S.sec)||all[0]; S.sec=it[0]; h=`<div class="sec"><h2>${it[0]}</h2><div class="card">${it[1]()}</div></div>`; }
    $('ejl-sbody').innerHTML=h; }
  $('ejl-snav').onclick=e=>{ const n=e.target.closest('button'); if(n&&n.dataset.n){ S.sec=n.dataset.n; S.q=''; S.dirty=true; paintAll(); } };
  function setClick(e){ const b=e.target.closest('button'); if(!b) return; const a=b.dataset.a;
    if(a==='go'){ closeCpop(); connect(); return; } if(a==='stop'){ closeCpop(); API.send({t:'disconnect'}); return; } if(a==='more'){ closeCpop(); S.sec='ECU'; show('set'); return; }
    if(b.dataset.r) setCfg({role:b.dataset.r}); if(b.dataset.dm){ setProp('dimming','mode',b.dataset.dm); S.dirty=true; paintAll(); }
    if(a==='cimp'&&API) API.importCluster().then(ok=>{ if(ok){ toast('Cluster files imported'); loadCluster(); } }); if(a==='copen'&&API) API.openCluster();
    if(a==='sspv'&&S.clu){ const sp=S.clu.P.screensaver||{}; SS.showPreview(sp['style.'+curProf()]||'header',sp); }
    if(a==='rescan') rescan(); if(a==='open'&&API) API.openDir();
    if(a==='def'&&API) API.pickDef().then(c=>{ S.cfg=c; S.dirty=true; paintAll(); });
    if(a==='dir'&&API) API.pickDir().then(c=>{ S.cfg=c; S.dirty=true; paintAll(); }); }
  function setChange(e){ const d=e.target.dataset;
    if(d.k) setCfg({[d.k]:e.target.checked});
    if(d.c){ const v=e.target.value, p={[d.c]:v};
      if(d.c==='wbType'){ const l=sel().filter(s=>!String(s.id).startsWith('wb:')); if(v!=='none') l.push({id:'wb:'+v,units:S.cfg.wbUnits||'AFR Gasoline'}); setSel(l); p.sel=S.cfg.sel; }
      setCfg(p); } }
  $('ejl-sbody').onclick=setClick; $('ejl-sbody').onchange=setChange;

  // Connection pop-out under the Connect button: ECU, logger definition, wideband, then Connect / Disconnect
  let cpop=null;
  function openCpop(){ if(cpop) return; rescan(); cpop=mk('div','ejl-cpop',root); cpop.onclick=setClick; cpop.onchange=setChange; paintCpop(); }
  function closeCpop(){ if(cpop){ cpop.remove(); cpop=null; } }
  function paintCpop(){ if(!cpop||!S.cfg) return; const r=$('ejl-conn').getBoundingClientRect(), all=SECS.flatMap(x=>x[1]), f=n=>all.find(x=>x[0]===n)[1](), idle=S.state==='idle';
    cpop.style.left=Math.max(8,Math.min(innerWidth-548,r.left))+'px'; cpop.style.top=(r.bottom+8)+'px';
    const ae=document.activeElement, keep=ae&&cpop.contains(ae)&&ae.tagName==='SELECT'; if(keep) return; // don't rebuild under an open dropdown
    cpop.innerHTML=`<div class="cph"><b>Connection</b><span class="lbl">${idle?'Not connected':esc(S.state)+(S.ecuId?' · ECU '+esc(S.ecuId):'')}</span></div>
      <div class="sec"><h2>ECU</h2>${f('ECU')}</div><div class="sec"><h2>Wideband</h2>${f('Wideband')}</div>
      <div class="cpf"><button class="xb" data-a="more">MORE IN CONFIG</button><span class="fill"></span>${idle?'<button class="edtop" data-a="go">● Connect</button>':'<button class="edtop rec" data-a="stop">■ Disconnect</button>'}</div>`; }
  document.addEventListener('pointerdown',e=>{ if(cpop&&!cpop.contains(e.target)&&e.target.id!=='ejl-cset') closeCpop(); },true);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeCpop(); });
  addEventListener('resize',()=>cpop&&paintCpop());

  // frames arrive ~13 Hz; paint at most once per animation frame
  function roleVal(r,re){ const C=S.clu; let id=C&&C.roles[r], it=id&&sel().find(x=>x.id===id||(C.alias[x.id]===id)); if(!it&&re) it=sel().find(x=>re.test((S.byId[x.id]||{}).name||'')); return it?S.num[it.id+'|'+(it.units||'')]:undefined; }
  (function loop(now){ const dt=Math.min(100,(now||0)-lastT); lastT=now||0;
    if(S.mode==='logger'&&S.clu&&!SS.preview){ const sp=S.clu.P.screensaver||{}; SS.tick({P:sp,style:sp['style.'+curProf()]||'header',enabled:!!(S.cfg&&S.cfg.role==='car'),logging:S.state==='logging',rpm:roleVal('RPM_SOURCE',/^Engine Speed/),speed:roleVal('SPEED_SOURCE',/^Vehicle Speed/),load:roleVal('LOAD_SOURCE',/^Engine Load/),clt:roleVal('COOLANT_SOURCE',/^Coolant Temp/),dt,now:now||performance.now()}); } if(S.mode==='logger'&&S.view==='cluster'&&S.clu) drawDesigner(dt); if(S.mode==='logger'&&S.view==='live'){ if(S.dirty){ if(S.live==='basic') paintLive(); paintSub(); S.dirty=false; } if(S.live==='cluster'&&S.clu) drawCluster(dt); } requestAnimationFrame(loop); })();
  setInterval(()=>{ if(S.mode==='logger'&&S.view==='live'&&S.state==='logging') { S.dirty=true; } },1000);
  // keep the pop-out current (ports, state, config)
  const _pa=paintAll; paintAll=function(){ _pa(); if(cpop) paintCpop(); };

  restyleMarks(); show('live');
  return { S, setMode, show };
})();

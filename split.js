// Splits ejstudio.html into src/ (run once after receiving a bundled ejstudio.html): node split.js
const fs=require('fs'), s=fs.readFileSync('ejstudio.html','utf8'), a=s.indexOf('<script>\n')+9, b=s.lastIndexOf('</script>');
const js=s.slice(a,b), cut=['//  rrLab core','//  rrLab views','//  Background FX','//  rrLab app','// ════════ table editor ════════','function unitsChanged(){','//  Desktop integration'];
const names=['01_core.js','02_views.js','03_bg.js','04_app.js','05_editor.js','06_shell.js','07_desktop.js'], at=[0];
for(const m of cut.slice(1)){ let i=js.indexOf(m); if(i<0) throw 'marker '+m; if(m.startsWith('//  ')) i=js.lastIndexOf('// ═',i); at.push(i); }
fs.mkdirSync('src',{recursive:true}); fs.writeFileSync('src/00_head.html',s.slice(0,a)); fs.writeFileSync('src/99_tail.html',s.slice(b));
names.forEach((n,k)=>fs.writeFileSync('src/'+n,js.slice(at[k],at[k+1]))); console.log('split into',names.length+2,'files');

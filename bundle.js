// Builds ejstudio.html from src/ in file-name order: node bundle.js
const fs=require('fs'), f=fs.readdirSync('src').filter(n=>/^\d\d_/.test(n)).sort();
fs.writeFileSync('ejstudio.html',f.map(n=>fs.readFileSync('src/'+n,'utf8')).join('')); console.log('ejstudio.html built from',f.length,'source files');

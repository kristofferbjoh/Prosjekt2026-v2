const fs=require('node:fs');
const assets=['index.html','style.css','coach-core.js','storage.js','programs.js','app.js','pwa.js','service-worker.js','manifest.json','icon-192.png','icon-512.png'];
fs.mkdirSync('dist',{recursive:true});
for(const file of assets)fs.copyFileSync(file,`dist/${file}`);
console.log(`Built ${assets.length} public assets; no server or production dependencies.`);

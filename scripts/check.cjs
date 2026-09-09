const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const name of ['coach-core.js','storage.js','programs.js','app.js','pwa.js','service-worker.js'])new vm.Script(fs.readFileSync(name,'utf8'),{filename:name});
const html=fs.readFileSync('index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const [,url] of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g))assert.ok(fs.existsSync(url.slice(1).split('?')[0]),`Missing ${url}`);
const manifest=JSON.parse(fs.readFileSync('manifest.json'));
for(const icon of manifest.icons){const data=fs.readFileSync(icon.src.slice(1));assert.equal(icon.sizes,`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,'Icon dimensions must be truthful');}
assert(!/<script>/.test(html),'Inline scripts violate CSP');
console.log('Syntax, local assets, unique IDs, manifest dimensions and CSP-compatible scripts verified.');

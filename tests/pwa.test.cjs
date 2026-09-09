const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function worker({fail=false}={}){
  const handlers={},entries=new Map(),calls=[],origin='https://example.test';let skips=0;
  class Request extends global.Request{constructor(path,opts){super(new URL(path,origin),opts);}}
  const cache={put:async(key,response)=>{entries.set(typeof key==='string'?key:new URL(key.url).pathname+new URL(key.url).search,response);},match:async key=>entries.get(typeof key==='string'?key:new URL(key.url).pathname+new URL(key.url).search)};
  const self={location:{origin},addEventListener:(k,f)=>handlers[k]=f,skipWaiting:async()=>skips++,clients:{claim:async()=>{}}};
  vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self,caches:{open:async()=>cache},Request,Response,URL,fetch:async request=>{calls.push(request.url);if(fail)return new Response('missing',{status:404});return new Response(new URL(request.url).pathname,{status:200});}});
  return{handlers,entries,calls,skips:()=>skips,request:(path,mode='navigate',method='GET')=>({url:origin+path,mode,method})};
}
test('offline shell installs completely without force-activating mid-session',async()=>{const w=worker();let promise;w.handlers.install({waitUntil:p=>promise=p});await promise;assert(w.entries.size>=10);assert.equal(w.skips(),0);w.handlers.message({data:{type:'ACTIVATE_UPDATE'},waitUntil:p=>promise=p});await promise;assert.equal(w.skips(),1);});
test('HTTP error during install rejects release without caching error response',async()=>{const w=worker({fail:true});let promise;w.handlers.install({waitUntil:p=>promise=p});await assert.rejects(promise);assert.equal(w.entries.size,0);});
test('query-tab navigation uses coherent cached shell, third-party requests ignored',async()=>{const w=worker();w.entries.set('/index.html',new Response('shell'));let promise;w.handlers.fetch({request:w.request('/?tab=training'),respondWith:p=>promise=p});assert.equal(await(await promise).text(),'shell');let handled=false;w.handlers.fetch({request:{url:'https://other.test/pixel',method:'GET'},respondWith:()=>handled=true});assert.equal(handled,false);});
test('unrelated assets and POSTs never receive cached HTML',()=>{const w=worker();let handled=false;for(const req of [w.request('/missing.js','cors'),w.request('/','navigate','POST')])w.handlers.fetch({request:req,respondWith:()=>handled=true});assert.equal(handled,false);});

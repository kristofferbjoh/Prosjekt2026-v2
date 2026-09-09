/* One coherent offline release, activated when the user accepts the update. */
const RELEASE = "2.1.0";
const CACHE = `prosjekt2026-shell-${RELEASE}`;
const SHELL = ["/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png", ...["style.css","coach-core.js","storage.js","programs.js","app.js","pwa.js"].map(p=>`/${p}?v=${RELEASE}`)];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    const responses=await Promise.all(SHELL.map(path=>fetch(new Request(path,{cache:"reload"})).then(response=>{
      if(!response.ok || response.type==="opaque")throw Error(`Missing shell asset: ${path}`);
      return response;
    })));
    await Promise.all(SHELL.map((path,i)=>cache.put(path,responses[i])));
  }));
});
self.addEventListener("message",event=>{if(event.data?.type==="ACTIVATE_UPDATE")event.waitUntil(self.skipWaiting());});
self.addEventListener("activate",event=>{
  // Retain old assets for open tabs. Never delete unrelated application caches.
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET" || url.origin!==self.location.origin)return;
  const navigation=request.mode==="navigate" && ["/","/index.html"].includes(url.pathname);
  const asset=SHELL.includes(url.pathname+url.search) || SHELL.includes(url.pathname);
  if(!navigation && !asset)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(navigation?"/index.html":request);
    if(cached)return cached;
    try{return await fetch(request);}catch(_){return new Response("Offline asset unavailable",{status:503,headers:{"Content-Type":"text/plain"}});}
  })());
});

(() => {
  "use strict";
  const el=id=>document.getElementById(id);
  let registration=null,installPrompt=null,requestedUpdate=false;
  const status=()=>el("connection-status").textContent=navigator.onLine?"Data lagres på denne enheten":"Frakoblet · logger fungerer når appen er lagret for offlinebruk";
  status();window.addEventListener("online",status);window.addEventListener("offline",status);
  function offerUpdate(){el("update-banner").classList.remove("hidden");}
  el("apply-update").onclick=()=>{
    if(!window.P2026BeforeUpdate?.())return;
    requestedUpdate=true;
    if(registration?.waiting)registration.waiting.postMessage({type:"ACTIVATE_UPDATE"});else location.reload();
  };
  if("serviceWorker" in navigator){
    navigator.serviceWorker.addEventListener("controllerchange",()=>{if(requestedUpdate)location.reload();else offerUpdate();});
    window.addEventListener("load",async()=>{
      try{
        registration=await navigator.serviceWorker.register("/service-worker.js",{updateViaCache:"none"});
        if(registration.waiting)offerUpdate();
        registration.addEventListener("updatefound",()=>{const worker=registration.installing;worker?.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)offerUpdate();});});
        await registration.update();
      }catch(_){el("connection-status").textContent="Offlineoppdatering kunne ikke fullføres. Loggene dine beholdes. Prøv igjen når nettet er stabilt.";}
    });
  }
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;el("install-app").classList.remove("hidden");});
  el("install-app").onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;el("install-app").classList.add("hidden");};
  window.addEventListener("appinstalled",()=>{el("install-app").classList.add("hidden");el("install-help").textContent="Appen er installert.";});
  el("persist-data").onclick=async()=>{
    try{const granted=await navigator.storage?.persist?.();el("persistence-status").textContent=granted?"Nettleseren har innvilget vedvarende lagring. Eksporter fortsatt backup før du bytter enhet eller sletter nettleserdata.":"Nettleseren ga ikke varig lagringstillatelse. Vanlig lagring fungerer fortsatt; ta jevnlig backup.";}catch(_){el("persistence-status").textContent="Lagringstillatelsen kunne ikke kontrolleres. Ta en nedlastet backup.";}
  };
})();

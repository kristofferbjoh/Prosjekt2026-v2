/* Local-only storage. A failed write must never masquerade as durable saving. */
(function(root,factory){
  if(typeof module==="object" && module.exports) module.exports=factory(require("./coach-core.js"));
  else root.P2026Storage=factory(root.P2026Core);
})(typeof globalThis!=="undefined"?globalThis:this,function(C){
  "use strict";
  function create(getStorage) {
    let expected=null, blocked=false, error="", loaded=false;
    const key=C.STORE_KEY;
    function read() {
      try {
        expected=getStorage().getItem(key); loaded=true;
        const state=expected===null?C.defaultState():C.normalizeState(JSON.parse(expected));
        blocked=false;error="";return state;
      } catch(e) {blocked=true;error=`Data kunne ikke leses: ${e.message} Eksisterende data er ikke overskrevet.`;return C.defaultState();}
    }
    function save(state) {
      if(blocked || !loaded)return false;
      try {
        const storage=getStorage(), current=storage.getItem(key);
        if(current!==expected){blocked=true;throw Error("En annen fane har endret data. Eksporter eventuelt ditt utkast og last appen på nytt.");}
        const raw=JSON.stringify(state);
        storage.setItem(key,raw);expected=raw;error="";return true;
      } catch(e){error=`Ikke lagret på enheten. ${e.message} Behold appen åpen og eksporter backup.`;return false;}
    }
    function checkpoint(label) {
      if(blocked)return false;
      try {
        const storage=getStorage();
        if(storage.getItem(key)!==expected)throw Error("Data er endret i en annen fane.");
        // Dedicated slot: never rotate the pre-upgrade snapshot away on normal saves.
        const target=label==="migration"?`${key}_before_v3`:`${key}_recovery`;
        if(label!=="migration" || !storage.getItem(target)) storage.setItem(target,JSON.stringify({label,savedAt:new Date().toISOString(),raw:expected}));
        return true;
      }catch(e){error=`Sikkerhetskopi kunne ikke lagres: ${e.message}`;return false;}
    }
    function legacy() {
      const result={};
      try {const s=getStorage();for(let i=0;i<s.length;i++){const k=s.key(i);if(k?.startsWith("p2026_") && !k.startsWith(key))result[k]=s.getItem(k);}}catch(_){}
      return result;
    }
    function recovery() {try {return getStorage().getItem(`${key}_recovery`) || getStorage().getItem(`${key}_before_v3`);}catch(_){return null;}}
    function raw(){try{return getStorage().getItem(key);}catch(_){return expected;}}
    function replace(state) {
      try {
        C.normalizeState(state);
        const storage=getStorage(),current=storage.getItem(key);
        storage.setItem(`${key}_recovery`,JSON.stringify({label:"restore",savedAt:new Date().toISOString(),raw:current}));
        expected=current;loaded=true;blocked=false;return save(state);
      }catch(e){error=`Gjenoppretting avbrutt: ${e.message}`;return false;}
    }
    return {read,save,replace,checkpoint,legacy,recovery,raw,get blocked(){return blocked;},get error(){return error;}};
  }
  return {create};
});

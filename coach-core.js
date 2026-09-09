/* Pure, deterministic rules shared by the app and regression tests. */
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.P2026Core = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  const VERSION = 3;
  const STORE_KEY = "p2026_v2_state"; // Never change: existing installations own this key.
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const number = (v, fallback = null) => {
    if (v === null || v === undefined || String(v).trim() === "") return fallback;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  };
  const object = v => !!v && typeof v === "object" && !Array.isArray(v);
  const clone = v => structuredClone(v);
  function localISO(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }
  function dateFromISO(s) {
    const [y,m,d] = String(s).split("-").map(Number);
    return new Date(y,m-1,d,12); // Local noon avoids DST midnight gaps.
  }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && localISO(dateFromISO(s)) === s; }
  function addDays(s,n) { const d = typeof s === "string" ? dateFromISO(s) : new Date(s); d.setDate(d.getDate()+n); return d; }
  function dayDistance(a,b) { return Math.round((Date.parse(`${a}T12:00:00Z`)-Date.parse(`${b}T12:00:00Z`))/86400000); }
  const DEFAULT_SETTINGS = { protein:170, kcalLow:1800, kcalHigh:2100, weekendLow:2400, weekendHigh:2800, weightGoal:88, scoreThreshold:70, weeklyStrength:3, footballLow:null, footballHigh:null, weeklyPlan:["REST","W1","FOOTBALL","REST","W2","REST","W3"] };
  function defaultState() {
    return {version:VERSION,createdAt:new Date().toISOString(),legacyMigrated:false,phase:"phase2",settings:clone(DEFAULT_SETTINGS),days:{},foods:{},favorites:[],metrics:[],workouts:[],drafts:{},formDrafts:{},legacyExerciseMeta:{}};
  }
  function settingsError(s) {
    const ranges = {protein:[80,300],kcalLow:[1200,5000],kcalHigh:[1200,5000],weekendLow:[1200,5000],weekendHigh:[1200,5000],weightGoal:[50,200],scoreThreshold:[1,100],weeklyStrength:[1,5]};
    for (const [k,[min,max]] of Object.entries(ranges)) if (typeof s[k]!=="number" || !Number.isFinite(s[k]) || s[k]<min || s[k]>max) return `Ugyldig mål: ${k}.`;
    if (s.kcalLow>s.kcalHigh || s.weekendLow>s.weekendHigh) return "Min kcal må være lavere enn eller lik maks.";
    if (!Array.isArray(s.weeklyPlan) || s.weeklyPlan.length!==7 || s.weeklyPlan.some(k=>!["W1","W2","W3","W4","REST","FOOTBALL","CARDIO","MOBILITY","OTHER","CUSTOM"].includes(k))) return "Ugyldig ukeplan.";
    if (s.footballLow != null || s.footballHigh != null) {
      if (![s.footballLow,s.footballHigh].every(v=>typeof v==="number" && Number.isFinite(v) && v>=1200 && v<=5000) || s.footballLow>s.footballHigh) return "Fyll ut begge fotballmålene, eller la begge stå tomme.";
    }
    return "";
  }
  function normalizeState(input) {
    if (!object(input) || !object(input.settings) || !object(input.days)) throw Error("Filen er ikke en Prosjekt 2026-backup.");
    if (input.version != null && (!Number.isInteger(input.version) || input.version<1 || input.version>VERSION)) throw Error("Backupen bruker en annen dataversjon. Oppdater appen først.");
    const s = {...defaultState(),...clone(input),settings:{...DEFAULT_SETTINGS,...input.settings}};
    if (!["phase1","phase2"].includes(s.phase)) throw Error("Ukjent treningsfase i dataene.");
    const error = settingsError(s.settings); if (error) throw Error(error);
    for (const k of ["foods","drafts","formDrafts","legacyExerciseMeta"]) if (!object(s[k])) throw Error(`Ugyldige data: ${k}.`);
    for (const k of ["workouts","metrics","favorites"]) if (!Array.isArray(s[k])) throw Error(`Ugyldige data: ${k}.`);
    for (const [date,day] of Object.entries(s.days)) {
      if (!validDate(date) || !object(day) || (day.habits!=null && !object(day.habits))) throw Error("Ugyldig dagslogg.");
      if (day.readiness!=null) {
        if (!object(day.readiness)) throw Error("Ugyldig innsjekk.");
        for (const key of ["energy","ankle","achilles","back"]) if (day.readiness[key]!=null && (number(day.readiness[key])===null || number(day.readiness[key])<0 || number(day.readiness[key])>(key==="energy"?5:10))) throw Error("Ugyldig innsjekkverdi.");
      }
      if (!day.targets) day.targets = targetsFor(s,date,day.plannedKey);
      if (!object(day.targets) || !["low","high","protein","threshold"].every(k=>typeof day.targets[k]==="number" && Number.isFinite(day.targets[k]) && day.targets[k]>0) || day.targets.low>day.targets.high) throw Error("Ugyldige historiske mål.");
    }
    for (const [date,foods] of Object.entries(s.foods)) {
      if (!validDate(date) || !Array.isArray(foods)) throw Error("Ugyldig matdato.");
      foods.forEach(validateFood);
    }
    s.favorites.forEach(f=>validateFood({...f,qty:f.qty??1}));
    for (const m of s.metrics) if (!object(m) || !validDate(m.date) || ["weight","waist"].some(k=>m[k]!=null && (number(m[k])===null || number(m[k])<=0 || number(m[k])>500))) throw Error("Ugyldig kroppsmåling.");
    for (const w of s.workouts) {
      if (!object(w) || !validDate(w.date) || typeof w.key!=="string" || !Array.isArray(w.entries)) throw Error("Ugyldig treningslogg.");
      for (const e of w.entries) {
        if (!object(e) || typeof e.exId!=="string" || !Array.isArray(e.sets)) throw Error("Ugyldige øvelsesdata.");
        for (const set of e.sets) if (!object(set) || ["weight","reps"].some(k=>set[k]!=null && (number(set[k])===null || number(set[k])<0 || number(set[k])>2000))) throw Error("Ugyldige settdata.");
      }
    }
    for (const draft of Object.values(s.drafts)) {
      if (!object(draft) || !validDate(draft.date) || !Array.isArray(draft.entries) || draft.entries.some(e=>!object(e) || typeof e.exId!=="string" || !Array.isArray(e.sets) || e.sets.some(set=>!object(set)))) throw Error("Ugyldig øktutkast.");
    }
    s.version = VERSION;
    return s;
  }
  function validateFood(f) {
    if (!object(f) || typeof f.name!=="string" || !f.name.trim() || f.name.length>300 || typeof f.id!=="string" || !f.id) throw Error("Matlinjen mangler navn eller ID.");
    const qty=f.qty===undefined?1:number(f.qty);
    if (number(f.kcal)===null || number(f.protein)===null || qty===null || qty<=0 || qty>1000 || number(f.kcal)<0 || number(f.kcal)>20000 || number(f.protein)<0 || number(f.protein)>2000) throw Error("Bruk positive, gyldige matmengder og næringsverdier.");
    return f;
  }
  function defaultPlanKey(date,plan=DEFAULT_SETTINGS.weeklyPlan) { return plan[date.getDay()] || "REST"; }
  function targetsFor(state,date,key) {
    const s=state.settings, weekend=[0,5,6].includes(dateFromISO(date).getDay());
    const football=key==="FOOTBALL" && s.footballLow!=null && s.footballHigh!=null;
    return {low:football?s.footballLow:weekend?s.weekendLow:s.kcalLow,high:football?s.footballHigh:weekend?s.weekendHigh:s.kcalHigh,protein:s.protein,threshold:s.scoreThreshold};
  }
  function foodTotals(state,date) {
    return (state.foods[date]||[]).reduce((a,f)=>({kcal:a.kcal+number(f.kcal,0)*number(f.qty,1),protein:a.protein+number(f.protein,0)*number(f.qty,1)}),{kcal:0,protein:0});
  }
  function readinessInfo(r) {
    if (!r) return {score:null,status:"neutral",label:"Ikke sjekket inn",advice:"Start med innsjekken før du vurderer progresjon.",reasons:[]};
    const maxSymptom=Math.max(number(r.ankle,0),number(r.achilles,0),number(r.back,0));
    const reasons=[];
    if (r.redFlags) reasons.push("ny kraftig smerte, svakhet eller problemer med å belaste");
    if (r.swelling) reasons.push("hevelse");
    if (r.reaction==="worse") reasons.push("forverring siden forrige økt");
    if (maxSymptom>=3) reasons.push("symptomer som bør styre dosen");
    if (number(r.energy,3)<=2) reasons.push("lav energi");
    if (number(r.sleepHours)!==null && number(r.sleepHours)<6) reasons.push("lite søvn");
    if (r.footballIncreased) reasons.push("økt fotballbelastning");
    const bad=!!r.redFlags || maxSymptom>=7;
    const status=bad?"bad":reasons.length?"warn":"good";
    const score=Math.round(clamp(40+number(r.energy,3)*12-maxSymptom*6-(r.swelling?20:0)-(r.reaction==="worse"?15:0),0,100));
    const label=bad?"Stopp og vurder":status==="warn"?"Tilpass belastningen":"Rolig utgangspunkt";
    let advice=status==="good"?"Ingen tydelige varsler i innsjekken. Dette er ingen medisinsk klarering. Hold igjen i oppvarmingen og vurder reaksjonen senere i dag og i morgen.":"Behold eller reduser belastningen. Velg en aktivitet som ikke øker symptomene; minimumsmodus gjør ikke en smertefull øvelse trygg.";
    if (r.swelling || r.reaction==="worse") advice+=" Unngå å øke beinbelastning eller fotball nå. Ta vedvarende smerte/hevelse opp med fysioterapeut eller lege.";
    if (bad) advice="Avstå fra øvelser som belaster området. Ny kraftig smerte, tydelig svakhet eller manglende evne til å belaste bør vurderes raskt av helsepersonell.";
    return {score,status,label,advice,reasons,maxSymptom};
  }
  const LOWER_KEYS=["W2","W3","W4","FOOTBALL","CARDIO"];
  const LOWER_IDS=new Set(["goblet_squat","rdl","hip_thrust","stepups","leg_curl","leg_press","kb_deadlift","trapbar_deadlift","bulgarian","ham_curl","farmers"]);
  function recentLegLoad(state,date) { return state.workouts.some(w=>LOWER_KEYS.includes(w.key) && dayDistance(date,w.date)>0 && dayDistance(date,w.date)<=2); }
  function exerciseHistory(state,id,date) { return state.workouts.filter(w=>w.date<date && (w.entries||[]).some(e=>e.exId===id)).sort((a,b)=>`${b.date}${b.savedAt||""}`.localeCompare(`${a.date}${a.savedAt||""}`)).map(w=>({workout:w,entry:w.entries.find(e=>e.exId===id)})); }
  function recommendation(state,ex,date) {
    const history=exerciseHistory(state,ex.id,date), last=history[0], ready=readinessInfo(state.days[date]?.readiness);
    const weight=last?.entry.sets.find(s=>number(s.weight)>0)?.weight ?? null;
    const result=(text,action="hold",nextWeight=weight)=>({text,action,prefill:weight,nextWeight});
    if (!last) return result("Første registrering: velg en kontrollert startvekt. Logg bare sett du gjennomfører.","start",null);
    if (ready.status!=="good") return result("Ingen økning foreslås før dagens innsjekk gir et rolig utgangspunkt. Behold eller reduser etter symptomer.");
    if (!["same","better"].includes(state.days[date]?.readiness?.reaction)) return result("Vurder reaksjonen siden forrige økt før du øker. Ingen automatisk økning når toleransen ennå ikke er vurdert.");
    if (LOWER_IDS.has(ex.id) && recentLegLoad(state,date)) return result("Beina har vært belastet de siste to dagene. Behold belastningen og vurder reaksjonen før en økning.");
    if (dayDistance(date,last.workout.date)>21) return result("Over tre uker siden sist. Bruk en rolig oppstart og vurder lavere belastning.");
    if (last.entry.feel==="hard") return result("Sist var tungt. Behold eller reduser litt, og stopp med reps i reserve.");
    const qualified=row=>{
      if (!row || row.workout.legacy || row.workout.mode!=="normal" || row.workout.schemaVersion!==VERSION || row.workout.phase!==state.phase) return false;
      const sets=row.entry.sets.filter(s=>s.done===true);
      return sets.length===ex.sets && sets.every(s=>number(s.reps)>=ex.repMax && number(s.weight)>0 && Math.abs(number(s.weight)-number(weight))<.01) && ["easy","ok"].includes(row.entry.feel) && number(row.entry.rir)>=2 && !row.entry.pain;
    };
    if (ex.weight && !ex.unit && qualified(last) && qualified(history[1]) && dayDistance(last.workout.date,history[1].workout.date)<=21) {
      const step=weight<20?.5:weight<50?1:2.5;
      return result(`To fulle økter på ${weight} kg i toppen av repområdet, med minst 2 reps i reserve. Vurder ${Math.round((number(weight)+step)*10)/10} kg ved neste økt hvis kroppen tåler det.`,"increase",number(weight)+step);
    }
    return result(weight!=null?`Sist ${weight} kg. Bygg reps med kontroll først. En vektøkning krever to fulle økter i toppen av repområdet og god toleranse.`:"Bygg kontroll og reps før du vurderer ekstra belastning.");
  }
  function scoreDay(state,date) {
    const day=state.days[date]||{}, habits=day.habits||{}, totals=foodTotals(state,date), targets=day.targets||targetsFor(state,date,day.plannedKey);
    const protein=Math.round(25*clamp(totals.protein/targets.protein,0,1));
    const complete=day.nutritionComplete===true && (state.foods[date]||[]).length>0;
    let calories=0;
    if (complete && totals.kcal>=targets.low && totals.kcal<=targets.high) calories=25;
    else if (complete && totals.kcal>targets.high) calories=Math.round(clamp(25-(totals.kcal-targets.high)/targets.high*65,0,24));
    const plan=habits.plan?25:0,readiness=day.readiness?10:0,water=habits.water?5:0,mobility=habits.mobility?5:0,sleep=habits.sleep?5:0;
    return {total:protein+calories+plan+readiness+water+mobility+sleep,protein,calories,plan,readiness,water,mobility,sleep,provisional:!complete};
  }
  function streakStats(state,today) {
    const good=new Set(Object.entries(state.days).filter(([date,d])=>date<=today && d.completed && number(d.score,0)>=number(d.targets?.threshold,70)).map(([date])=>date));
    let best=number(state.legacyBestStreak,0),run=0,previous=null;
    [...good].sort().forEach(date=>{run=previous && dayDistance(date,previous)===1?run+1:1;best=Math.max(best,run);previous=date;});
    let cursor=good.has(today)?today:localISO(addDays(today,-1)),current=0;
    while(good.has(cursor)){current++;cursor=localISO(addDays(cursor,-1));}
    return {current,best};
  }
  function weightSummary(state,today) {
    const rows=state.metrics.filter(m=>number(m.weight)>0 && m.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
    const window=(from,to)=>rows.filter(m=>dayDistance(today,m.date)>=from && dayDistance(today,m.date)<=to);
    const current=window(0,6),previous=window(7,13),average=list=>list.length?list.reduce((s,m)=>s+number(m.weight),0)/list.length:null;
    return {last:rows.at(-1)||null,count:current.length,average:average(current),change:current.length>=3 && previous.length>=3?average(current)-average(previous):null};
  }
  function mergeState(current,incoming) {
    const out=clone(current);
    const union=(a,b,key)=>{const seen=new Set(a.map(key));return [...a,...b.filter(x=>{const id=key(x);if(seen.has(id))return false;seen.add(id);return true;})];};
    out.workouts=union(out.workouts,incoming.workouts,w=>w.id||`${w.date}:${w.key}:${w.savedAt||"legacy"}`);
    out.metrics=union(out.metrics,incoming.metrics,m=>m.date);
    out.favorites=union(out.favorites,incoming.favorites,f=>f.id);
    out.days={...incoming.days,...out.days};
    for(const [date,foods] of Object.entries(incoming.foods))out.foods[date]=union(out.foods[date]||[],foods,f=>f.id);
    out.drafts={...incoming.drafts,...out.drafts};out.formDrafts={...incoming.formDrafts,...out.formDrafts};
    out.legacyExerciseMeta={...incoming.legacyExerciseMeta,...out.legacyExerciseMeta};
    return normalizeState(out);
  }
  return {VERSION,STORE_KEY,DEFAULT_SETTINGS,defaultState,normalizeState,settingsError,validateFood,number,clamp,localISO,dateFromISO,validDate,addDays,dayDistance,defaultPlanKey,targetsFor,foodTotals,readinessInfo,LOWER_KEYS,LOWER_IDS,recentLegLoad,exerciseHistory,recommendation,scoreDay,streakStats,weightSummary,mergeState};
});

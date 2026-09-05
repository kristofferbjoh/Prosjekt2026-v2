/* Prosjekt 2026 v2 – personlig coach, lokalt og gratis */
(() => {
  "use strict";

  const STORE_KEY = "p2026_v2_state";
  const VERSION = 2;
  const el = id => document.getElementById(id);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const round1 = n => Math.round(n * 10) / 10;
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
  const memoryStore = new Map();
  const storage = {
    getItem(key) { try { return window.localStorage.getItem(key); } catch (_) { return memoryStore.has(key) ? memoryStore.get(key) : null; } },
    setItem(key, value) { try { window.localStorage.setItem(key, String(value)); } catch (_) { memoryStore.set(key, String(value)); } },
    removeItem(key) { try { window.localStorage.removeItem(key); } catch (_) { memoryStore.delete(key); } },
    keys() { try { return Object.keys(window.localStorage); } catch (_) { return [...memoryStore.keys()]; } }
  };
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function localISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function dateFromISO(s) {
    const [y,m,d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(dateOrIso, amount) {
    const d = typeof dateOrIso === "string" ? dateFromISO(dateOrIso) : new Date(dateOrIso);
    d.setDate(d.getDate() + amount);
    return d;
  }
  function niceDate(iso = localISO()) {
    return new Intl.DateTimeFormat("nb-NO", { weekday:"short", day:"2-digit", month:"short" }).format(dateFromISO(iso));
  }
  function fullDate(date = new Date()) {
    return new Intl.DateTimeFormat("nb-NO", { weekday:"long", day:"numeric", month:"long" }).format(date);
  }

  const PHASE1 = {
    W1: { name:"Økt 1 – Overkropp", type:"Overkropp", note:"Teknikk, styrke og skulderrobusthet.", duration:"45–55 min", warmup:["Armcircles 20 sek","Lette face pulls 20 reps","Strikk pull-aparts 20 reps"], main:[
      {id:"row_seated",name:"Sittende roing",sets:3,repMin:10,repMax:10,weight:true},
      {id:"bench_press",name:"Benkpress / pushups",sets:3,repMin:8,repMax:8,weight:true},
      {id:"arnold_press",name:"Arnold press",sets:3,repMin:10,repMax:10,weight:true},
      {id:"one_arm_row",name:"Enarms roing",sets:3,repMin:12,repMax:12,weight:true},
      {id:"incline_db_press",name:"Incline dumbbell press",sets:3,repMin:10,repMax:10,weight:true}
    ], prehab:["External rotations 3×12","Face pulls 3×12","Full-can raises 2×12"] },
    W2: { name:"Økt 2 – Underkropp + akilles", type:"Underkropp", note:"Bygg kapasitet kontrollert. Ankel/akilles styrer belastningen.", duration:"45–60 min", warmup:["2 min rask gange / sykkel","Lett ankelmobilisering","10 rolige tåhev"], main:[
      {id:"goblet_squat",name:"Goblet squat",sets:3,repMin:10,repMax:10,weight:true},
      {id:"rdl",name:"Rumensk markløft",sets:3,repMin:10,repMax:10,weight:true},
      {id:"hip_thrust",name:"Hip thrust",sets:3,repMin:10,repMax:10,weight:true},
      {id:"stepups",name:"Step-ups",sets:3,repMin:10,repMax:10,weight:true},
      {id:"leg_curl",name:"Leg curl",sets:3,repMin:12,repMax:12,weight:true}
    ], prehab:["Rolige tåhev 3×10","Balanse på én fot 2×45 sek","Ankelarbeid innen toleranse"] },
    W3: { name:"Økt 3 – Fullkropp", type:"Fullkropp", note:"Allround styrke og kjerne uten unødvendig utmattelse.", duration:"45–55 min", warmup:["Cat/cow","Hoftecirkler","Lett skuldermobilitet"], main:[
      {id:"pulldown",name:"Nedtrekk / pullups",sets:3,repMin:8,repMax:8,weight:true},
      {id:"leg_press",name:"Benpress",sets:3,repMin:10,repMax:10,weight:true},
      {id:"shoulder_press",name:"Skulderpress",sets:3,repMin:10,repMax:10,weight:true},
      {id:"kb_deadlift",name:"Kettlebell deadlift",sets:3,repMin:12,repMax:12,weight:true},
      {id:"pallof",name:"Pallof press",sets:3,repMin:12,repMax:12,weight:false},
      {id:"plank",name:"Planke",sets:3,repMin:45,repMax:45,weight:false,unit:"sek"}
    ], prehab:["Ryggrotasjoner","Hofteåpner"] },
    W4: { name:"Økt 4 – Stabilitet + lett styrke", type:"Robusthet", note:"Bufferøkten som bygger kontinuitet uten mye restitusjonskostnad.", duration:"35–45 min", warmup:["Lett goblet squat","Ankelmobilitet","Skulderstabilisering"], main:[
      {id:"bulgarian",name:"Bulgarsk split squat",sets:3,repMin:8,repMax:8,weight:true},
      {id:"landmine_press",name:"Landmine press",sets:3,repMin:8,repMax:8,weight:true},
      {id:"cable_row",name:"Sittende kabelroing",sets:3,repMin:12,repMax:12,weight:true},
      {id:"ham_curl",name:"Hamstring curl",sets:3,repMin:10,repMax:10,weight:true},
      {id:"farmers",name:"Farmers carry",sets:2,repMin:40,repMax:40,weight:true,unit:"m"}
    ], prehab:["Akilles/ankel etter toleranse","Y-raises 2×12","Dead bug 3×10"] },
    REST: { name:"Hvile / mobilitet", type:"Restitusjon", note:"Rolig aktivitet og målrettet mobilitet. Hviledager er del av planen.", duration:"10–30 min", warmup:[], main:[], prehab:["Rolig gåtur","Open book","Hoftebøyer","Kne-mot-vegg hvis ankelen tolererer det","Veggslides"] }
  };
  const PHASE2 = {
    W1: { ...PHASE1.W1, name:"Økt 1 – Overkropp", note:"Styrkefokus med 1–2 reps i reserve.", main:[
      {id:"row_seated",name:"Sittende roing",sets:4,repMin:6,repMax:8,weight:true},
      {id:"bench_press",name:"Benkpress / pushups",sets:4,repMin:6,repMax:8,weight:true},
      {id:"arnold_press",name:"Arnold press",sets:3,repMin:8,repMax:10,weight:true},
      {id:"one_arm_row",name:"Enarms roing",sets:3,repMin:8,repMax:10,weight:true},
      {id:"incline_db_press",name:"Incline dumbbell press",sets:3,repMin:8,repMax:10,weight:true}
    ], prehab:["External rotations 2–3×12","Face pulls 3×15","Full-can raises 2×12"] },
    W2: { ...PHASE1.W2, name:"Økt 2 – Underkropp + akilles", note:"Baksidekjede og fotballkapasitet. Ikke øk beinbelastning og fotball samtidig.", main:[
      {id:"goblet_squat",name:"Front squat / goblet squat",sets:4,repMin:6,repMax:8,weight:true},
      {id:"rdl",name:"Rumensk markløft",sets:4,repMin:6,repMax:8,weight:true},
      {id:"hip_thrust",name:"Hip thrust",sets:3,repMin:6,repMax:8,weight:true},
      {id:"stepups",name:"Step-ups",sets:3,repMin:8,repMax:10,weight:true},
      {id:"leg_curl",name:"Leg curl",sets:3,repMin:8,repMax:10,weight:true}
    ], prehab:["Tåhev/soleus kontrollert 3×10–12","Balanse 2×45 sek","Ankelarbeid etter symptomer"] },
    W3: { ...PHASE1.W3, name:"Økt 3 – Fullkropp", note:"Atletisk fullkropp med kontrollert hinge og god kvalitet.", main:[
      {id:"pulldown",name:"Nedtrekk / pullups",sets:4,repMin:6,repMax:8,weight:true},
      {id:"leg_press",name:"Benpress",sets:3,repMin:8,repMax:10,weight:true},
      {id:"shoulder_press",name:"Skulderpress",sets:3,repMin:6,repMax:8,weight:true},
      {id:"trapbar_deadlift",name:"Trap bar / markløft",sets:4,repMin:5,repMax:5,weight:true},
      {id:"pallof",name:"Pallof press",sets:3,repMin:10,repMax:12,weight:false},
      {id:"plank",name:"Planke",sets:3,repMin:45,repMax:60,weight:false,unit:"sek"}
    ] },
    W4: { ...PHASE1.W4, name:"Økt 4 – Robusthet / buffer", note:"Lavere kostnad, høy verdi. Perfekt når uka allerede er tung." },
    REST: PHASE1.REST
  };
  const PHASES = { phase1:{name:"Fase 1 – Oppbygging",workouts:PHASE1}, phase2:{name:"Fase 2 – Fotballklar",workouts:PHASE2} };
  const ALT = {
    FOOTBALL:{name:"⚽ Fotball",type:"Fotball",note:"Fotball teller. Belastning på ankel/akilles følges dagen etter.",duration:"60–90 min"},
    CARDIO:{name:"🏃 Kondisjon",type:"Kondisjon",note:"Rolig eller moderat kondisjon etter dagsform.",duration:"20–45 min"},
    MOBILITY:{name:"🧘 Mobilitet / restitusjon",type:"Restitusjon",note:"Kort økt er fortsatt en investering i neste gode økt.",duration:"10–25 min"},
    OTHER:{name:"🏋️ Annen styrke",type:"Styrke",note:"Logg varighet og et kort notat.",duration:"30–60 min"},
    CUSTOM:{name:"📝 Egendefinert",type:"Annet",note:"Alt som faktisk bidrar til planen kan logges.",duration:"–"}
  };
  const ALL_KEYS = ["W1","W2","W3","W4","REST","FOOTBALL","CARDIO","MOBILITY","OTHER","CUSTOM"];

  const DEFAULT_STATE = {
    version: VERSION,
    createdAt: new Date().toISOString(),
    legacyMigrated: false,
    phase: "phase2",
    settings: { protein:170, kcalLow:1800, kcalHigh:2100, weekendLow:2400, weekendHigh:2800, weightGoal:88, scoreThreshold:70 },
    days: {}, foods: {}, favorites: [], metrics: [], workouts: []
  };

  let state = loadState();
  migrateLegacy();
  saveState();

  function loadState() {
    try {
      const raw = storage.getItem(STORE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE), ...parsed,
        settings:{...DEFAULT_STATE.settings,...(parsed.settings||{})},
        days:parsed.days||{}, foods:parsed.foods||{}, favorites:parsed.favorites||[], metrics:parsed.metrics||[], workouts:parsed.workouts||[]
      };
    } catch (_) { return structuredClone(DEFAULT_STATE); }
  }
  function saveState() { storage.setItem(STORE_KEY, JSON.stringify(state)); }
  function ensureDay(iso = localISO()) {
    if (!state.days[iso]) state.days[iso] = { plannedKey:defaultPlanKey(dateFromISO(iso)), readiness:null, habits:{plan:false,water:false,mobility:false,sleep:false}, completed:false, score:0 };
    state.days[iso].habits = {plan:false,water:false,mobility:false,sleep:false,...(state.days[iso].habits||{})};
    if (!state.days[iso].plannedKey) state.days[iso].plannedKey = defaultPlanKey(dateFromISO(iso));
    return state.days[iso];
  }
  function defaultPlanKey(date) {
    return ({0:"FOOTBALL",1:"W1",2:"REST",3:"W2",4:"REST",5:"W3",6:"REST"})[date.getDay()] || "REST";
  }
  function getWorkout(key, phase = state.phase) { return PHASES[phase]?.workouts[key] || ALT[key] || PHASES[phase].workouts.REST; }
  function targetRange(date = new Date()) {
    const weekend = [0,5,6].includes(date.getDay());
    return weekend ? [state.settings.weekendLow,state.settings.weekendHigh] : [state.settings.kcalLow,state.settings.kcalHigh];
  }
  function foodTotals(iso = localISO()) {
    return (state.foods[iso] || []).reduce((a,x) => ({ kcal:a.kcal + num(x.kcal)*num(x.qty,1), protein:a.protein + num(x.protein)*num(x.qty,1) }), {kcal:0,protein:0});
  }
  function toast(message) {
    const node = el("toast"); if (!node) return;
    node.textContent = message; node.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => node.classList.remove("show"), 1900);
  }

  function migrateLegacy() {
    if (state.legacyMigrated) return;
    const legacyPhase = storage.getItem("p2026_phase");
    if (legacyPhase && PHASES[legacyPhase]) state.phase = legacyPhase;
    storage.keys().filter(k => /^p2026_day_\d{4}-\d{2}-\d{2}$/.test(k)).forEach(k => {
      try {
        const old = JSON.parse(storage.getItem(k));
        const date = k.slice("p2026_day_".length);
        const day = ensureDay(date);
        if (old?.workoutKey) day.plannedKey = old.workoutKey;
        if (old?.success && !day.completed) { day.completed = true; day.score = 70; day.habits = {plan:true,water:true,mobility:true,sleep:true}; }
        const entries = old?.draft?.entries || {};
        if (old?.workoutKey && Object.keys(entries).length && !state.workouts.some(w => w.legacy && w.date===date && w.key===old.workoutKey)) {
          state.workouts.push({ id:uid(), legacy:true, date, key:old.workoutKey, phase:legacyPhase||"phase1", mode:"legacy", feel:"", note:old?.draft?.altNote||"", entries:Object.entries(entries).map(([exId,e]) => ({ exId, sets:[{weight:num(e?.weight)||null,reps:null}], feel:e?.feel||"", note:e?.note||"" })) });
        }
      } catch (_) {}
    });
    state.legacyMigrated = true;
  }

  function readinessInfo(r) {
    if (!r) return {score:null,status:"neutral",label:"Ikke sjekket inn",advice:""};
    const maxSymptom = Math.max(num(r.ankle),num(r.achilles),num(r.back));
    let score = 40 + num(r.energy,3) * 12 - num(r.ankle)*3 - num(r.achilles)*3 - num(r.back)*2;
    score = Math.round(clamp(score,0,100));
    let status = score >= 75 && maxSymptom < 5 ? "good" : score >= 55 && maxSymptom < 7 ? "warn" : "bad";
    let label = status === "good" ? `Grønn ${score}%` : status === "warn" ? `Juster ${score}%` : `Rolig ${score}%`;
    let advice = "";
    if (status === "good") advice = "Grønt lys for planen. Hold 1–2 reps i reserve og la reaksjonen under og etter økten styre videre progresjon.";
    if (status === "warn") advice = "Kjør kontrollert. Behold belastning fremfor å jage progresjon, og velg minimumsmodus hvis energien eller symptomene øker underveis.";
    if (status === "bad") advice = "Gjør dette til en justeringsdag. Velg overkropp eller rolig restitusjon fremfor tung/eksplosiv beinbelastning. Tydelig forverring, betydelig hevelse, ny svakhet eller skarp smerte bør vurderes av helsepersonell.";
    if (num(r.ankle) >= 5) advice += " Ankelen er dagens tydeligste varsellampe.";
    else if (num(r.achilles) >= 5) advice += " Akilles er dagens tydeligste varsellampe.";
    return {score,status,label,advice,maxSymptom};
  }

  function scoreDay(iso = localISO()) {
    const day = ensureDay(iso), totals = foodTotals(iso), [low,high] = targetRange(dateFromISO(iso));
    const protein = Math.round(25 * clamp(totals.protein / state.settings.protein, 0, 1));
    let calories = 0;
    if (totals.kcal > 0) {
      if (totals.kcal >= low && totals.kcal <= high) calories = 25;
      else if (totals.kcal < low) calories = Math.round(clamp(25 - ((low - totals.kcal) / low) * 55, 0, 24));
      else calories = Math.round(clamp(25 - ((totals.kcal - high) / high) * 65, 0, 24));
    }
    const plan = day.habits.plan ? 25 : 0;
    const readiness = day.readiness ? 10 : 0;
    const water = day.habits.water ? 5 : 0;
    const mobility = day.habits.mobility ? 5 : 0;
    const sleep = day.habits.sleep ? 5 : 0;
    return {total:protein+calories+plan+readiness+water+mobility+sleep,protein,calories,plan,readiness,water,mobility,sleep};
  }

  function streakStats() {
    const good = Object.entries(state.days).filter(([,d]) => d.completed && num(d.score) >= state.settings.scoreThreshold).map(([date]) => date).sort();
    let best=0, run=0, prev=null;
    good.forEach(date => {
      if (prev && localISO(addDays(prev,1)) === date) run += 1; else run = 1;
      best = Math.max(best,run); prev=date;
    });
    const today = localISO(), yesterday = localISO(addDays(today,-1));
    let cursor = good.includes(today) ? today : good.includes(yesterday) ? yesterday : null;
    let current = 0;
    while (cursor && good.includes(cursor)) { current++; cursor = localISO(addDays(cursor,-1)); }
    return {current,best};
  }

  function setTab(tab) {
    const valid = ["today","training","food","progress"].includes(tab) ? tab : "today";
    qsa(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${valid}`));
    qsa(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === valid));
    const screen = el(`screen-${valid}`); el("top-title").textContent = screen?.dataset.title || "Prosjekt 2026";
    const url = new URL(location.href); url.searchParams.set("tab",valid); history.replaceState({},"",url);
    window.scrollTo({top:0,behavior:"smooth"});
    if (valid === "training") renderTraining();
    if (valid === "food") renderFood();
    if (valid === "progress") renderProgress();
    if (valid === "today") renderToday();
  }

  function renderTop() {
    el("top-date").textContent = fullDate();
    const info = readinessInfo(ensureDay().readiness), badge=el("readiness-badge");
    badge.textContent = info.label; badge.className = `status-badge ${info.status}`;
  }

  function planOptions(select, selected) {
    select.innerHTML = ALL_KEYS.map(key => `<option value="${key}">${esc(getWorkout(key).name)}</option>`).join("");
    select.value = selected;
  }

  function renderToday() {
    const iso = localISO(), day=ensureDay(iso), workout=getWorkout(day.plannedKey), totals=foodTotals(iso), [low,high]=targetRange(new Date()), score=scoreDay(iso), ready=readinessInfo(day.readiness);
    renderTop();
    el("today-score").textContent = score.total; el("score-ring").style.setProperty("--score",score.total);
    el("plan-name").textContent = workout.name; el("plan-tag").textContent = workout.type || "Plan"; el("plan-note").textContent = workout.note || "";
    planOptions(el("today-plan-select"),day.plannedKey);
    el("go-training").textContent = day.plannedKey === "REST" ? "Åpne restitusjon" : "Åpne økten";
    el("today-kcal").textContent = Math.round(totals.kcal); el("kcal-target-label").textContent = `${low}–${high} kcal`;
    el("today-protein").textContent = Math.round(totals.protein); el("protein-target-label").textContent = `${state.settings.protein} g`;
    el("kcal-progress").style.width = `${clamp(totals.kcal/high*100,0,100)}%`; el("protein-progress").style.width = `${clamp(totals.protein/state.settings.protein*100,0,100)}%`;

    ["energy","ankle","achilles","back"].forEach(id => {
      const v = day.readiness?.[id] ?? (id==="energy"?3:0); el(id).value=v; el(`${id}-out`).textContent=`${v}/${id==="energy"?5:10}`;
    });
    el("readiness-score-pill").textContent = ready.score===null ? "–" : `${ready.score}%`;
    const adv=el("readiness-advice"); adv.className = `callout ${ready.status} ${ready.advice?"":"hidden"}`; adv.textContent=ready.advice;
    const warn=el("plan-warning");
    const lowerBody = ["W2","FOOTBALL"].includes(day.plannedKey);
    if (day.readiness && (ready.status==="bad" || (lowerBody && Math.max(num(day.readiness.ankle),num(day.readiness.achilles))>=4))) {
      warn.className=`callout ${ready.status==="bad"?"bad":"warn"}`;
      warn.textContent = lowerBody ? "Dagens plan belaster bein/ankel. Basert på innsjekken er det smart å holde igjen eller bytte til minimum/overkropp hvis symptomene ikke roer seg i oppvarmingen." : "Dagens readiness tilsier at kvalitet og restitusjon er viktigere enn progresjon.";
    } else warn.className="callout hidden";

    Object.entries(day.habits).forEach(([k,v]) => { const node=el(`habit-${k}`); if(node) node.checked=!!v; });
    el("score-breakdown").innerHTML = [
      ["Protein",score.protein,25],["Kalorier",score.calories,25],["Plan",score.plan,25],["Innsjekk",score.readiness,10],["Vann",score.water,5],["Mobilitet",score.mobility,5],["Søvn",score.sleep,5]
    ].map(([n,v,m])=>`<span class="score-chip ${v===m?"good":""}">${n} ${v}/${m}</span>`).join("");
    const streak=streakStats(); el("streak-current").textContent=streak.current; el("streak-best").textContent=streak.best;
    renderWeekDots(); renderCoach(score,ready,day,totals,[low,high]);
  }

  function renderCoach(score, ready, day, totals, range) {
    const hour = new Date().getHours();
    let kicker = hour < 12 ? "MORGENCOACH" : hour < 18 ? "DAGENS COACH" : "KVELDSCOACH";
    let title="Planen din er klar", copy="Gjør det viktigste først; resten er bonus.";
    if (!day.readiness) { title="Start med 30 sekunder innsjekk"; copy="Da kan planen justeres etter energi, ankel, akilles og rygg i stedet for ren autopilot."; }
    else if (ready.status==="bad") { title="I dag vinner du på å justere"; copy="Kontinuitet betyr også å velge riktig dose når kroppen gir tydelige signaler."; }
    else if (hour >= 18 && score.total < state.settings.scoreThreshold) {
      const missing=[]; if(totals.protein < state.settings.protein) missing.push(`${Math.ceil(state.settings.protein-totals.protein)} g protein`); if(!day.habits.plan) missing.push("dagens plan"); if(!day.habits.mobility) missing.push("kort mobilitet");
      title=`${score.total}/100 – du kan fortsatt lande dagen`;
      copy = missing.length ? `Størst effekt nå: ${missing.slice(0,2).join(" + ")}.` : "Du er nær en god dag. Hold det enkelt.";
    } else if (score.total >= state.settings.scoreThreshold) { title="Dette er en god dag"; copy="Du har passert terskelen for kontinuitet. Ikke gjør en god dag vanskeligere enn den trenger å være."; }
    else if (totals.kcal > range[1]) { title="Ingen panikk – styr resten av dagen"; copy="Du er over dagens kaloriområde. Prioriter proteinrike, mettende valg videre fremfor å kompensere aggressivt."; }
    el("coach-kicker").textContent=kicker; el("coach-title").textContent=title; el("coach-copy").textContent=copy;
  }

  function renderWeekDots() {
    const box=el("week-dots"); let html="";
    for(let i=6;i>=0;i--) {
      const date=localISO(addDays(new Date(),-i)), d=state.days[date], score=d?.completed?num(d.score):null;
      const cls=score===null?"":score>=state.settings.scoreThreshold?"good":"warn";
      html += `<div class="day-dot ${cls}"><i>${score===null?"·":score}</i><small>${niceDate(date).split(" ")[0].slice(0,2)}</small></div>`;
    }
    box.innerHTML=html;
  }

  function fillWorkoutSelect() {
    const select=el("workout-select"), todayPlan=ensureDay().plannedKey;
    planOptions(select, ALL_KEYS.includes(select.value) ? select.value : todayPlan);
  }
  function lastExercise(exId) {
    const sorted=[...state.workouts].sort((a,b)=>`${b.date}${b.savedAt||""}`.localeCompare(`${a.date}${a.savedAt||""}`));
    for(const w of sorted) { const e=(w.entries||[]).find(x=>x.exId===exId); if(e) return {workout:w,entry:e}; }
    return null;
  }
  function recommendation(ex) {
    const last=lastExercise(ex.id); if(!last) return {text:"Første registrering: velg en kontrollert startvekt og stopp med 1–2 reps i reserve.",prefill:null};
    const sets=(last.entry.sets||[]).filter(s=>num(s.weight)>0 || num(s.reps)>0), weights=sets.map(s=>num(s.weight)).filter(Boolean), reps=sets.map(s=>num(s.reps)).filter(Boolean);
    const weight=weights.length?weights[0]:null, hitTop=reps.length && reps.every(r=>r>=ex.repMax), sameWeight=weights.length && weights.every(w=>Math.abs(w-weight)<0.01), feel=last.entry.feel;
    if(ex.weight && weight && hitTop && sameWeight && feel==="easy") {
      const jump = weight < 20 ? 1 : weight < 60 ? 2.5 : 5;
      return {text:`🙂 Sist: ${weight} kg og topp av repområdet. Forslag: prøv ca. ${round1(weight+jump)} kg hvis oppvarmingen kjennes normal.`,prefill:weight+jump};
    }
    if(feel==="hard") return {text:`🙁 Sist var tung. Forslag: behold eller reduser litt og prioriter rene reps.`,prefill:weight};
    if(weight) return {text:`Sist: ${weight} kg${reps.length?` × ${reps.join("/")}`:""}. Forslag: behold og slå reps før du øker vekten.`,prefill:weight};
    return {text:"Bruk forrige opplevelse som styring. Ingen vektdata registrert ennå.",prefill:null};
  }

  function renderTraining() {
    const day=ensureDay(), ready=readinessInfo(day.readiness);
    el("phase-select").value=state.phase; fillWorkoutSelect();
    const selected=el("workout-select").value || day.plannedKey; const mode=el("training-mode").value;
    const w=getWorkout(selected); el("workout-name").textContent=w.name; el("workout-type").textContent=(w.type||"ØKT").toUpperCase(); el("workout-note").textContent=w.note||""; el("workout-duration").textContent=mode==="minimum"?"ca. 20 min":w.duration||"–";
    el("training-readiness-pill").textContent=ready.score===null?"Readiness –":`Readiness ${ready.score}%`;
    const call=el("training-callout"), lower=["W2","FOOTBALL"].includes(selected);
    if(day.readiness && (ready.status==="bad" || (lower && Math.max(num(day.readiness.ankle),num(day.readiness.achilles))>=4))) { call.className=`callout ${ready.status==="bad"?"bad":"warn"}`; call.textContent="Innsjekken tilsier at dagens dose bør vurderes under oppvarmingen. Minimumsmodus eller en annen økt er en helt gyldig seier."; } else call.className="callout hidden";

    const strength=!!PHASES[state.phase].workouts[selected];
    el("alt-workout").classList.toggle("hidden",strength);
    el("exercise-list").classList.toggle("hidden",!strength);
    el("warmup-list").classList.toggle("hidden",!strength);
    el("prehab-list").classList.toggle("hidden",!strength);
    if(!strength) { el("exercise-list").innerHTML=""; el("warmup-list").innerHTML=""; el("prehab-list").innerHTML=""; renderWorkoutHistory(); return; }

    const warmup=mode==="minimum" ? (w.warmup||[]).slice(0,2) : (w.warmup||[]);
    const main=mode==="minimum" ? (w.main||[]).slice(0,3) : (w.main||[]);
    const prehab=mode==="minimum" ? (w.prehab||[]).slice(0,1) : (w.prehab||[]);
    el("warmup-list").innerHTML=warmup.map(x=>`<span class="mini-item">${esc(x)}</span>`).join("");
    el("prehab-list").innerHTML=prehab.map(x=>`<span class="mini-item">${esc(x)}</span>`).join("");
    el("exercise-list").innerHTML=main.map(ex => exerciseHTML(ex,mode)).join("");
    qsa(".feel-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const exId=btn.closest(".exercise").dataset.exid;
      qsa(`.exercise[data-exid="${exId}"] .feel-btn`).forEach(b=>b.classList.toggle("active",b===btn));
    }));
    renderWorkoutHistory();
  }

  function exerciseHTML(ex,mode) {
    const rec=recommendation(ex), last=lastExercise(ex.id)?.entry, setCount=mode==="minimum"?Math.min(2,ex.sets):ex.sets;
    const lastSets=last?.sets||[];
    const rows=Array.from({length:setCount},(_,i)=>{
      const lw=num(lastSets[i]?.weight) || num(lastSets[0]?.weight) || rec.prefill || "";
      const lr=num(lastSets[i]?.reps) || "";
      return `<div class="set-row"><span>Sett ${i+1}</span>${ex.weight?`<input class="set-weight" data-set="${i}" type="number" step="0.5" min="0" inputmode="decimal" placeholder="kg" value="${lw||""}" />`:`<input class="set-weight" data-set="${i}" type="hidden" value="0" /><span></span>`}<input class="set-reps" data-set="${i}" type="number" min="0" inputmode="numeric" placeholder="${ex.unit||"reps"}" value="${lr||""}" /></div>`;
    }).join("");
    return `<div class="exercise" data-exid="${ex.id}" data-name="${esc(ex.name)}"><div class="exercise-head"><h3>${esc(ex.name)}</h3><span class="target">${setCount}×${ex.repMin===ex.repMax?ex.repMax:`${ex.repMin}–${ex.repMax}`} ${esc(ex.unit||"reps")}</span></div><div class="recommend">${esc(rec.text)}</div>${rows}<div class="exercise-bottom"><div class="feel-group"><button type="button" class="feel-btn ${last?.feel==="easy"?"active":""}" data-feel="easy">🙂</button><button type="button" class="feel-btn ${last?.feel==="ok"?"active":""}" data-feel="ok">😐</button><button type="button" class="feel-btn ${last?.feel==="hard"?"active":""}" data-feel="hard">🙁</button></div><input class="exercise-note" type="text" placeholder="Kort notat (valgfritt)" value="${esc(last?.note||"")}" /></div></div>`;
  }

  function saveWorkout() {
    const date=localISO(), key=el("workout-select").value, mode=el("training-mode").value;
    let record={id:uid(),date,key,phase:state.phase,mode,savedAt:new Date().toISOString(),entries:[]};
    if(PHASES[state.phase].workouts[key]) {
      record.entries=qsa("#exercise-list .exercise").map(card=>({
        exId:card.dataset.exid,name:card.dataset.name,
        sets:qsaWithin(card,".set-row").map(row=>({weight:num(row.querySelector(".set-weight")?.value)||null,reps:num(row.querySelector(".set-reps")?.value)||null})),
        feel:card.querySelector(".feel-btn.active")?.dataset.feel||"", note:card.querySelector(".exercise-note")?.value||""
      }));
    } else {
      record.duration=num(el("alt-duration").value)||null; record.intensity=el("alt-intensity").value; record.note=el("alt-note").value||"";
    }
    state.workouts=state.workouts.filter(w=>!(w.date===date && w.key===key && !w.legacy)); state.workouts.push(record);
    const day=ensureDay(date); day.habits.plan=true; day.plannedKey=key; saveState(); toast("Økten er lagret"); renderTraining(); renderToday();
  }
  function qsaWithin(root,sel){ return Array.from(root.querySelectorAll(sel)); }

  function renderWorkoutHistory() {
    const box=el("workout-history"), list=[...state.workouts].sort((a,b)=>`${b.date}${b.savedAt||""}`.localeCompare(`${a.date}${a.savedAt||""}`)).slice(0,8);
    if(!list.length){box.innerHTML='<div class="chart-empty">Ingen økter logget ennå.</div>';return;}
    box.innerHTML=list.map(w=>{
      const name=getWorkout(w.key,w.phase||state.phase).name||w.key, count=(w.entries||[]).length;
      return `<div class="history-item"><div><strong>${esc(name)}</strong><small>${niceDate(w.date)} · ${w.mode==="minimum"?"minimum":w.duration?`${w.duration} min`:w.legacy?"importert":"full økt"}${count?` · ${count} øvelser`:""}</small></div><span class="pill">${w.key}</span></div>`;
    }).join("");
  }

  function renderFood() {
    const iso=localISO(), totals=foodTotals(iso), [low,high]=targetRange(new Date()), foods=state.foods[iso]||[];
    el("food-kcal-total").textContent=Math.round(totals.kcal); el("food-protein-total").textContent=Math.round(totals.protein);
    el("food-kcal-target").textContent=`mål ${low}–${high}`; el("food-protein-target").textContent=`mål ${state.settings.protein} g`;
    el("food-kcal-progress").style.width=`${clamp(totals.kcal/high*100,0,100)}%`; el("food-protein-progress").style.width=`${clamp(totals.protein/state.settings.protein*100,0,100)}%`;
    el("food-entry-count").textContent=`${foods.length} ${foods.length===1?"linje":"linjer"}`;
    const list=el("food-list");
    list.innerHTML=foods.length?foods.map(x=>`<div class="food-item"><div><strong>${esc(x.name)}</strong><small>${round1(num(x.qty,1))} porsj · ${Math.round(num(x.kcal)*num(x.qty,1))} kcal · ${Math.round(num(x.protein)*num(x.qty,1))} g protein</small></div><div class="row-actions"><button class="icon-btn" data-fav-food="${x.id}">★</button><button class="icon-btn" data-edit-food="${x.id}">Rediger</button><button class="icon-btn danger" data-del-food="${x.id}">×</button></div></div>`).join(""):'<div class="chart-empty">Ingen mat logget ennå. Start med det som er lett å gjenta.</div>';
    qsa("[data-del-food]").forEach(b=>b.onclick=()=>{state.foods[iso]=foods.filter(x=>x.id!==b.dataset.delFood);saveState();renderFood();renderToday();});
    qsa("[data-fav-food]").forEach(b=>b.onclick=()=>favoriteFood(b.dataset.favFood));
    qsa("[data-edit-food]").forEach(b=>b.onclick=()=>editFood(b.dataset.editFood));
    const fav=el("favorite-list"); fav.innerHTML=state.favorites.length?state.favorites.map(x=>`<div class="favorite-item"><div><strong>${esc(x.name)}</strong><small>${Math.round(x.kcal)} kcal · ${round1(x.protein)} g protein</small></div><div class="row-actions"><button class="icon-btn" data-add-fav="${x.id}">Legg til</button><button class="icon-btn danger" data-del-fav="${x.id}">×</button></div></div>`).join(""):'<div class="chart-empty">Trykk ★ på en matlinje for å lagre den her.</div>';
    qsa("[data-add-fav]").forEach(b=>b.onclick=()=>{const f=state.favorites.find(x=>x.id===b.dataset.addFav);if(f){addFoodEntry({...f,id:uid(),qty:1});toast("Favoritt lagt til");}});
    qsa("[data-del-fav]").forEach(b=>b.onclick=()=>{state.favorites=state.favorites.filter(x=>x.id!==b.dataset.delFav);saveState();renderFood();});
  }

  function addFoodEntry(entry) {
    const iso=localISO(); state.foods[iso]=state.foods[iso]||[]; state.foods[iso].push(entry); saveState(); renderFood(); renderToday();
  }
  function addFoodFromForm() {
    const name=el("food-name").value.trim(), kcal=num(el("food-kcal").value), protein=num(el("food-protein").value), qty=Math.max(.1,num(el("food-qty").value,1));
    if(!name || (!kcal && !protein)) { toast("Legg inn navn og kcal/protein"); return; }
    addFoodEntry({id:uid(),name,kcal,protein,qty}); el("food-name").value=""; el("food-kcal").value=""; el("food-protein").value=""; el("food-qty").value="1"; toast("Lagt til i dag");
  }
  function favoriteFood(id) {
    const food=(state.foods[localISO()]||[]).find(x=>x.id===id); if(!food)return;
    if(state.favorites.some(x=>x.name.toLowerCase()===food.name.toLowerCase())) { toast("Allerede lagret"); return; }
    state.favorites.push({id:uid(),name:food.name,kcal:num(food.kcal),protein:num(food.protein)}); saveState(); renderFood(); toast("Lagret som favoritt");
  }
  function editFood(id) {
    const food=(state.foods[localISO()]||[]).find(x=>x.id===id); if(!food)return;
    const name=prompt("Navn",food.name); if(name===null)return;
    const kcal=prompt("Kcal per porsjon",String(food.kcal)); if(kcal===null)return;
    const protein=prompt("Protein per porsjon (g)",String(food.protein)); if(protein===null)return;
    const qty=prompt("Antall porsjoner",String(food.qty)); if(qty===null)return;
    food.name=name.trim()||food.name; food.kcal=Math.max(0,num(kcal,food.kcal)); food.protein=Math.max(0,num(protein,food.protein)); food.qty=Math.max(.1,num(qty,food.qty)); saveState(); renderFood(); renderToday();
  }
  function copyYesterday() {
    const src=state.foods[localISO(addDays(new Date(),-1))]||[]; if(!src.length){toast("Ingen mat å kopiere fra i går");return;}
    state.foods[localISO()]=src.map(x=>({...x,id:uid()})); saveState(); renderFood(); renderToday(); toast("Gårsdagen er kopiert");
  }

  function upsertMetric() {
    const weight=num(el("metric-weight").value)||null, waist=num(el("metric-waist").value)||null; if(!weight&&!waist){toast("Legg inn vekt eller midjemål");return;}
    const date=localISO(); let m=state.metrics.find(x=>x.date===date); if(!m){m={date};state.metrics.push(m);} if(weight)m.weight=weight;if(waist)m.waist=waist;
    state.metrics.sort((a,b)=>a.date.localeCompare(b.date));saveState();renderProgress();toast("Måling lagret");
  }
  function recentWeightAverage() {
    const weights=state.metrics.filter(x=>num(x.weight)>0).sort((a,b)=>a.date.localeCompare(b.date)); if(!weights.length)return null;
    const end=dateFromISO(weights.at(-1).date), start=addDays(end,-6); const vals=weights.filter(x=>dateFromISO(x.date)>=start && dateFromISO(x.date)<=end).map(x=>num(x.weight)); return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
  }
  function rollingWeightSeries() {
    const rows=state.metrics.filter(x=>num(x.weight)>0).sort((a,b)=>a.date.localeCompare(b.date));
    return rows.map((row,i)=>{const end=dateFromISO(row.date), start=addDays(end,-6);const vals=rows.filter(x=>dateFromISO(x.date)>=start&&dateFromISO(x.date)<=end).map(x=>num(x.weight));return {date:row.date,value:vals.reduce((a,b)=>a+b,0)/vals.length};});
  }
  function renderChart(node, points, suffix="") {
    if(!points.length){node.innerHTML='<div class="chart-empty">Logg noen målinger, så dukker trenden opp her.</div>';return;}
    const data=points.slice(-30), vals=data.map(x=>x.value), min=Math.min(...vals), max=Math.max(...vals), pad=Math.max((max-min)*.18,.4), lo=min-pad, hi=max+pad;
    const W=800,H=170,L=38,R=14,T=16,B=24, x=i=>data.length===1?(W-L-R)/2+L:L+i*(W-L-R)/(data.length-1), y=v=>T+(hi-v)*(H-T-B)/(hi-lo||1);
    const path=data.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const circles=data.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="#ff8a1f" />`).join("");
    node.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Trendgraf"><line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#2d3950"/><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#2d3950"/><path d="${path}" fill="none" stroke="#ff8a1f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${circles}<text x="4" y="${T+7}" fill="#8997ae" font-size="14">${round1(max)}${suffix}</text><text x="4" y="${H-B}" fill="#8997ae" font-size="14">${round1(min)}${suffix}</text><text x="${L}" y="${H-5}" fill="#8997ae" font-size="13">${niceDate(data[0].date)}</text><text x="${W-110}" y="${H-5}" fill="#8997ae" font-size="13">${niceDate(data.at(-1).date)}</text></svg>`;
  }

  function renderProgress() {
    const weights=state.metrics.filter(x=>num(x.weight)>0).sort((a,b)=>a.date.localeCompare(b.date)), waists=state.metrics.filter(x=>num(x.waist)>0).sort((a,b)=>a.date.localeCompare(b.date)), avg=recentWeightAverage();
    el("last-weight").textContent=weights.length?`${round1(weights.at(-1).weight)} kg`:"–"; el("avg-weight").textContent=avg?`${round1(avg)} kg`:"–"; el("last-waist").textContent=waists.length?`${round1(waists.at(-1).waist)} cm`:"–"; el("weight-goal-pill").textContent=`Mål ${round1(state.settings.weightGoal)} kg`;
    const todayMetric=state.metrics.find(x=>x.date===localISO()); el("metric-weight").value=todayMetric?.weight||""; el("metric-waist").value=todayMetric?.waist||"";
    renderChart(el("weight-chart"),rollingWeightSeries()," kg"); renderChart(el("waist-chart"),waists.map(x=>({date:x.date,value:x.waist}))," cm");
    const signals=buildProgressSignals(); el("progress-signals").innerHTML=signals.length?signals.map(s=>`<div class="history-item"><div><strong>${esc(s.title)}</strong><small>${esc(s.text)}</small></div><span class="pill">${s.icon}</span></div>`).join(""):'<div class="chart-empty">Logg noen styrkeøkter for å få konkrete progresjonssignaler.</div>';
    el("setting-protein").value=state.settings.protein; el("setting-kcal-low").value=state.settings.kcalLow; el("setting-kcal-high").value=state.settings.kcalHigh; el("setting-weekend-low").value=state.settings.weekendLow; el("setting-weekend-high").value=state.settings.weekendHigh; el("setting-weight-goal").value=state.settings.weightGoal;
  }
  function buildProgressSignals() {
    const ids=[]; [...state.workouts].sort((a,b)=>b.date.localeCompare(a.date)).forEach(w=>(w.entries||[]).forEach(e=>{if(!ids.includes(e.exId))ids.push(e.exId);}));
    return ids.slice(0,6).map(id=>{const last=lastExercise(id), e=last?.entry;if(!e)return null; const name=e.name||id, weights=(e.sets||[]).map(s=>num(s.weight)).filter(Boolean), reps=(e.sets||[]).map(s=>num(s.reps)).filter(Boolean); if(e.feel==="easy")return{title:name,text:`Sist kjentes lett${weights[0]?` på ${weights[0]} kg`:""}. Se etter mulighet til å slå reps eller øke litt.`,icon:"🙂"}; if(e.feel==="hard")return{title:name,text:"Sist var tung. Stabiliser kvaliteten før neste økning.",icon:"🙁"}; return{title:name,text:`Sist ${weights[0]?`${weights[0]} kg`:"uten vekt"}${reps.length?` · ${reps.join("/")} reps`:""}. Bygg reps før vekt.`,icon:e.feel==="ok"?"😐":"→"};}).filter(Boolean);
  }

  function saveSettings() {
    const next={ protein:num(el("setting-protein").value,state.settings.protein), kcalLow:num(el("setting-kcal-low").value,state.settings.kcalLow), kcalHigh:num(el("setting-kcal-high").value,state.settings.kcalHigh), weekendLow:num(el("setting-weekend-low").value,state.settings.weekendLow), weekendHigh:num(el("setting-weekend-high").value,state.settings.weekendHigh), weightGoal:num(el("setting-weight-goal").value,state.settings.weightGoal) };
    if(next.kcalLow>next.kcalHigh || next.weekendLow>next.weekendHigh){toast("Min kcal må være lavere enn maks");return;} Object.assign(state.settings,next);saveState();renderProgress();renderToday();toast("Målene er lagret");
  }
  function exportData() {
    const blob=new Blob([JSON.stringify({app:"Prosjekt 2026",exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"}); const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`prosjekt-2026-backup-${localISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function importData(file) {
    if(!file)return; const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);const incoming=parsed.state||parsed;if(!incoming||!incoming.settings||!incoming.days)throw new Error();state={...structuredClone(DEFAULT_STATE),...incoming,settings:{...DEFAULT_STATE.settings,...incoming.settings}};saveState();renderAll();toast("Backup importert");}catch(_){toast("Kunne ikke lese backupfilen");}};reader.readAsText(file);
  }

  function completeDay() {
    const iso=localISO(), day=ensureDay(iso), s=scoreDay(iso); day.score=s.total;day.completed=true;day.completedAt=new Date().toISOString();saveState();renderToday(); toast(s.total>=state.settings.scoreThreshold?`God dag: ${s.total}/100 🔥`:`Dagen er lagret: ${s.total}/100`);
  }

  function bind() {
    qsa(".nav-btn").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
    el("go-training").onclick=()=>{el("workout-select").value=ensureDay().plannedKey;setTab("training");}; el("go-food").onclick=()=>setTab("food"); el("go-food-protein").onclick=()=>setTab("food");
    el("today-plan-select").onchange=e=>{ensureDay().plannedKey=e.target.value;saveState();renderToday();};
    ["energy","ankle","achilles","back"].forEach(id=>el(id).addEventListener("input",e=>el(`${id}-out`).textContent=`${e.target.value}/${id==="energy"?5:10}`));
    el("save-readiness").onclick=()=>{const day=ensureDay();day.readiness={energy:num(el("energy").value),ankle:num(el("ankle").value),achilles:num(el("achilles").value),back:num(el("back").value),savedAt:new Date().toISOString()};saveState();renderToday();renderTraining();toast("Innsjekk lagret");};
    ["plan","water","mobility","sleep"].forEach(k=>el(`habit-${k}`).addEventListener("change",e=>{ensureDay().habits[k]=e.target.checked;saveState();renderToday();}));
    el("complete-day").onclick=completeDay;
    el("phase-select").onchange=e=>{state.phase=e.target.value;saveState();fillWorkoutSelect();renderTraining();renderToday();};
    el("workout-select").onchange=renderTraining; el("training-mode").onchange=renderTraining; el("save-workout").onclick=saveWorkout;
    el("add-food").onclick=addFoodFromForm; el("copy-yesterday").onclick=copyYesterday; el("food-name").addEventListener("keydown",e=>{if(e.key==="Enter")addFoodFromForm();});
    el("save-metric").onclick=upsertMetric; el("save-settings").onclick=saveSettings; el("export-data").onclick=exportData; el("import-data").onchange=e=>importData(e.target.files?.[0]);
    el("reset-data").onclick=()=>{if(confirm("Nullstille alle v2-data? Eldre p2026-data beholdes, men kan bli importert på nytt ved neste oppstart.")){storage.removeItem(STORE_KEY);state=structuredClone(DEFAULT_STATE);state.legacyMigrated=true;saveState();renderAll();toast("v2-data er nullstilt");}};
  }

  function renderAll() { renderTop(); renderToday(); renderTraining(); renderFood(); renderProgress(); }

  document.addEventListener("DOMContentLoaded",()=>{
    bind(); renderAll();
    const tab=new URL(location.href).searchParams.get("tab")||"today"; setTab(tab);
  });
})();

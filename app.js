/* Prosjekt 2026 v2 – personlig coach, lokalt og gratis */
(() => {
  "use strict";

  const C = window.P2026Core;
  const { STORE_KEY, VERSION, clamp } = C;
  const el = id => document.getElementById(id);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const num = (v, fallback = 0) => C.number(v, fallback);
  const round1 = n => Math.round(n * 10) / 10;
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const repository = window.P2026Storage.create(() => window.localStorage);
  const storage = { getItem:key=>repository.legacy()[key] ?? null, keys:()=>Object.keys(repository.legacy()) };
  let activeDate=C.localISO(), trainingContext=null, foodEditId=null, undoFood=null;
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

  const { PHASES, ALT, ALL_KEYS } = window.P2026Programs;

  const DEFAULT_STATE = C.defaultState();
  let state = repository.read();
  let migrationReady=true;
  if (!repository.blocked && state.legacyMigrationVersion !== VERSION) {
    migrationReady=repository.checkpoint("migration");
    if(migrationReady) { migrateLegacy(); state.legacyMigrationVersion=VERSION; repository.save(state); }
  }
  function saveState() {
    const ok=migrationReady && repository.save(state);
    const node=el("storage-warning");
    if(node){node.textContent=repository.error;node.classList.toggle("hidden",!repository.error);}
    return ok;
  }
  function touchDay(date=localISO()) {
    const day=ensureDay(date);
    if(day.completed){day.score=scoreDay(date).total;day.scoreVersion=VERSION;}
    day.updatedAt=new Date().toISOString();
  }
  function ensureDay(iso = localISO()) {
    if (!state.days[iso]) state.days[iso] = { plannedKey:defaultPlanKey(dateFromISO(iso)), readiness:null, habits:{plan:false,water:false,mobility:false,sleep:false}, completed:false, score:0 };
    state.days[iso].habits = {plan:false,water:false,mobility:false,sleep:false,...(state.days[iso].habits||{})};
    if (!state.days[iso].plannedKey) state.days[iso].plannedKey = defaultPlanKey(dateFromISO(iso));
    state.days[iso].targets ||= C.targetsFor(state,iso,state.days[iso].plannedKey);
    return state.days[iso];
  }
  function defaultPlanKey(date) { return C.defaultPlanKey(date,state.settings.weeklyPlan); }
  function getWorkout(key, phase=state.phase) { return PHASES[phase]?.workouts[key] || ALT[key] || PHASES.phase2.workouts.REST; }
  function targetRange(date=new Date()) { const d=ensureDay(localISO(date));return [d.targets.low,d.targets.high]; }
  function foodTotals(date=localISO()) { return C.foodTotals(state,date); }
  function toast(message) {
    const node = el("toast"); if (!node) return;
    node.textContent = repository.error || message; node.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => node.classList.remove("show"), 1900);
  }

  function migrateLegacy() {
    const firstMigration = !state.legacyMigrated;
    const legacyPhase = storage.getItem("p2026_phase");
    if (firstMigration && legacyPhase && PHASES[legacyPhase]) state.phase = legacyPhase;
    storage.keys().filter(k => /^p2026_day_\d{4}-\d{2}-\d{2}$/.test(k)).forEach(k => {
      try {
        const old = JSON.parse(storage.getItem(k));
        const date = k.slice("p2026_day_".length);
        const existed=!!state.days[date];
        const day = ensureDay(date);
        if (firstMigration && ALL_KEYS.includes(old?.workoutKey)) day.plannedKey = old.workoutKey;
        if ((firstMigration || !existed) && old?.success && !day.completed) { day.completed = true; day.score = 70; day.habits = {plan:true,water:true,mobility:true,sleep:true}; }
        const entries = old?.draft?.entries || {};
        if (old?.workoutKey && !state.workouts.some(w => w.legacy && w.date===date && w.key===old.workoutKey)) {
          state.workouts.push({ id:uid(), legacy:true, date, key:old.workoutKey, phase:legacyPhase||"phase1", mode:"legacy", feel:"", note:old?.draft?.altNote||"", entries:Object.entries(entries).map(([exId,e]) => ({ exId, sets:[{weight:num(e?.weight)||null,reps:null}], feel:e?.feel||"", note:e?.note||"" })) });
        }
      } catch (_) {}
    });
    const legacy=repository.legacy();
    state.legacyBestStreak=Math.max(num(state.legacyBestStreak),num(legacy.p2026_bestStreak));
    Object.entries(legacy).forEach(([key,raw])=>{
      try {
        if(key.startsWith("p2026_lastMeta_")) state.legacyExerciseMeta[key.slice(15)]=JSON.parse(raw);
        if(/^p2026_draft_\d{4}-\d{2}-\d{2}$/.test(key)) {
          const d=JSON.parse(raw),date=key.slice(12),phase=PHASES[legacyPhase]?legacyPhase:"phase2";
          if(C.validDate(date) && ALL_KEYS.includes(d.workoutKey)) {
            const id=`${date}|${phase}|${d.workoutKey}|normal`;
            state.drafts[id] ||= {date,key:d.workoutKey,phase,mode:"normal",note:d.altNote||"",entries:Object.entries(d.entries||{}).map(([exId,e])=>({exId,sets:[{weight:e.weight??null,reps:null,done:false}],feel:"",note:e.note||""}))};
          }
        }
      }catch(_){}
    });
    state.legacyMigrated = true;
  }

  function readinessInfo(r) { return C.readinessInfo(r); }
  function scoreDay(date=localISO()) { ensureDay(date); return C.scoreDay(state,date); }
  function streakStats() { return C.streakStats(state,localISO()); }

  function setTab(tab) {
    const valid = ["today","training","food","progress"].includes(tab) ? tab : "today";
    qsa(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${valid}`));
    qsa(".nav-btn").forEach(b => (b.classList.toggle("active", b.dataset.tab === valid), b.setAttribute("aria-current",b.dataset.tab===valid?"page":"false")));
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

  function captureForm(key,ids) {
    state.formDrafts[key]=Object.fromEntries(ids.map(id=>[id,el(id).type==="checkbox"?el(id).checked:el(id).value]));saveState();
  }
  function restoreForm(key) {
    for(const [id,value] of Object.entries(state.formDrafts[key]||{})){const node=el(id);if(!node)continue;if(node.type==="checkbox")node.checked=!!value;else node.value=value;}
  }
  function guardToday(){if(localISO()===activeDate)return true;rollover();toast("Det er en ny dag. Kontroller dagens dato og prøv igjen.");return false;}
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
    el("readiness-score-pill").textContent = ready.score===null ? "–" : ready.label;
    const adv=el("readiness-advice"); adv.className = `callout ${ready.status} ${ready.advice?"":"hidden"}`; adv.textContent=ready.advice;
    const warn=el("plan-warning");
    const lowerBody = C.LOWER_KEYS.includes(day.plannedKey);
    if (day.readiness && (ready.status==="bad" || (lowerBody && Math.max(num(day.readiness.ankle),num(day.readiness.achilles))>=4))) {
      warn.className=`callout ${ready.status==="bad"?"bad":"warn"}`;
      warn.textContent = lowerBody ? "Planen belaster bein/ankel. Velg en aktivitet som ikke øker symptomene; færre sett alene er ikke nok ved smerte eller hevelse." : "Dagens readiness tilsier at kvalitet og restitusjon er viktigere enn progresjon.";
    } else warn.className="callout hidden";

    el("readiness-swelling").checked=!!day.readiness?.swelling;
    el("readiness-redflags").checked=!!day.readiness?.redFlags;
    el("readiness-football").checked=!!day.readiness?.footballIncreased;
    el("readiness-reaction").value=day.readiness?.reaction||"unknown";
    el("readiness-sleep").value=day.readiness?.sleepHours??"";
    el("score-note").textContent=score.provisional?"Foreløpig dagsscore. Kaloripoeng beregnes først når hele matdagen er logget.":"Innsatspoeng, ikke en helsemåling. Planlagt restitusjon teller like mye som trening.";
    el("complete-day").textContent=day.completed?"Oppdater avsluttet dag":"Avslutt dagen";
    el("streak-threshold").textContent=`${day.targets.threshold}+ = kontinuitet`;
    restoreForm(`readiness:${localISO()}`);
    ["energy","ankle","achilles","back"].forEach(id=>el(`${id}-out`).textContent=`${el(id).value}/${id==="energy"?5:10}`);
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
    if(hour>=18 && totals.kcal>range[1]) { title="Gå videre med en vanlig dag";copy="Ingen straffetrening eller måltider som må hoppes over. Se på flere dager samlet."; }
    el("coach-action").textContent=!day.readiness?"Ta innsjekken":ready.status!=="good"?"Velg en tilpasset plan":!day.habits.plan?"Åpne dagens plan":"Åpne matloggen";
    el("coach-action").onclick=()=>{if(!day.readiness)el("readiness-card").scrollIntoView({behavior:"smooth"});else if(!day.habits.plan||ready.status!=="good"){el("workout-select").value=day.plannedKey;setTab("training");}else setTab("food");};
    const weekStart=C.localISO(C.addDays(localISO(),-((new Date().getDay()+6)%7)));
    const week=state.workouts.filter(w=>w.date>=weekStart&&w.date<=localISO());
    const strengthDays=new Set(week.filter(w=>["W1","W2","W3","W4","OTHER"].includes(w.key)).map(w=>w.date)).size;
    el("weekly-summary").textContent=`Denne uka: ${strengthDays} av ${state.settings.weeklyStrength} planlagte styrkedager · ${week.filter(w=>w.key==="FOOTBALL").length} fotballøkter. En travel uke kan være en vedlikeholdsuke.`;
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
  function recommendation(ex) { return C.recommendation(state,ex,trainingContext?.date||localISO()); }

  function draftId(c) { return `${c.date}|${c.phase}|${c.key}|${c.mode}`; }
  function captureTraining() {
    if(!trainingContext)return;
    const old=state.drafts[draftId(trainingContext)]||{};
    const entries=qsa("#exercise-list .exercise").map(card=>({
      exId:card.dataset.exid,name:card.dataset.name,
      sets:Array.from(card.querySelectorAll(".set-row:not(.set-heading)")).map(row=>({weight:C.number(row.querySelector(".set-weight")?.value),reps:C.number(row.querySelector(".set-reps")?.value),done:row.querySelector(".set-done").checked})),
      feel:card.querySelector(".feel-btn.active")?.dataset.feel||"",note:card.querySelector(".exercise-note").value,
      rir:C.number(card.querySelector(".exercise-rir").value),pain:card.querySelector(".exercise-pain").checked
    }));
    state.drafts[draftId(trainingContext)]={...old,...trainingContext,entries,duration:C.number(el("alt-duration").value),intensity:el("alt-intensity").value,note:el("alt-note").value,updatedAt:new Date().toISOString()};
    el("draft-status").textContent=saveState()?`Utkast lagret · ${niceDate(trainingContext.date)}`:"Utkast er bare i denne åpne appen – eksporter backup";
  }
  function renderTraining() {
    el("phase-select").value=state.phase; fillWorkoutSelect();
    const date=el("training-date").value||localISO(),key=el("workout-select").value||ensureDay().plannedKey,mode=el("training-mode").value;
    trainingContext={date,key,mode,phase:state.phase};
    const draft=state.drafts[draftId(trainingContext)],w=getWorkout(key),ready=readinessInfo(state.days[date]?.readiness);
    el("training-date").value=date;el("training-date").max=localISO();
    el("workout-name").textContent=w.name;el("workout-type").textContent=w.type||"ØKT";el("workout-note").textContent=w.note||"";
    el("workout-duration").textContent=mode==="minimum"&&w.main?.length?"ca. 20 min":w.duration||"–";
    el("training-readiness-pill").textContent=ready.label;
    const lower=C.LOWER_KEYS.includes(key),call=el("training-callout");
    const caution=ready.status!=="good" || (lower && C.recentLegLoad(state,date));
    call.className=`callout ${ready.status==="bad"?"bad":"warn"} ${caution?"":"hidden"}`;
    call.textContent=ready.status!=="good"?ready.advice:"Beina har vært belastet de siste to dagene. Vurder en lettere dag og unngå samtidig økning i fotball og beintrening.";
    el("draft-status").textContent=draft?`${draft.recordId?"Redigerer lagret økt":"Utkast gjenopprettet"} · ${niceDate(date)}`:"Ingen sett registrert ennå. Utkast lagres automatisk.";
    const strength=!!PHASES[state.phase].workouts[key];
    el("alt-workout").classList.toggle("hidden",strength);
    el("exercise-list").innerHTML=(mode==="minimum"?(w.main||[]).slice(0,3):(w.main||[])).map(ex=>exerciseHTML(ex,mode,draft?.entries?.find(e=>e.exId===ex.id))).join("");
    el("warmup-list").innerHTML=(w.warmup||[]).map(x=>`<span class="mini-item">${esc(x)}</span>`).join("");
    el("prehab-list").innerHTML=(w.prehab||[]).map(x=>`<span class="mini-item">${esc(x)}</span>`).join("");
    el("alt-duration").value=draft?.duration??"";el("alt-intensity").value=draft?.intensity||"easy";el("alt-note").value=draft?.note||"";
    qsa(".feel-btn").forEach(btn=>btn.onclick=()=>{
      btn.closest(".feel-group").querySelectorAll("button").forEach(b=>{b.classList.toggle("active",b===btn);b.setAttribute("aria-pressed",String(b===btn));});captureTraining();
    });
    el("exercise-list").oninput=captureTraining;el("exercise-list").onchange=captureTraining;
    renderWorkoutHistory();
  }
  function exerciseHTML(ex,mode,draft) {
    const rec=recommendation(ex),setCount=mode==="minimum"?Math.min(2,ex.sets):ex.sets;
    const last=C.exerciseHistory(state,ex.id,trainingContext.date)[0]?.entry;
    const rows=Array.from({length:setCount},(_,i)=>{
      const set=draft?.sets?.[i]||{},hint=last?.sets?.[i]?.weight??rec.prefill;
      return `<div class="set-row"><span>${i+1}</span><input class="set-weight" type="${ex.weight?"text":"hidden"}" inputmode="decimal" aria-label="${esc(ex.name)}, sett ${i+1}, kg" placeholder="${hint!=null?`Sist ${hint}`:"kg"}" value="${esc(set.weight??"")}" />${ex.weight?"":"<span>–</span>"}<input class="set-reps" type="text" inputmode="numeric" aria-label="${esc(ex.name)}, sett ${i+1}, ${ex.unit||"reps"}" placeholder="${ex.unit||"reps"}" value="${esc(set.reps??"")}" /><input class="set-done" type="checkbox" aria-label="Sett ${i+1} gjennomført" ${set.done?"checked":""} /></div>`;
    }).join("");
    return `<article class="exercise" data-exid="${esc(ex.id)}" data-name="${esc(ex.name)}"><div class="exercise-head"><h3>${esc(ex.name)}</h3><span class="target">${setCount} × ${ex.repMin===ex.repMax?ex.repMax:`${ex.repMin}–${ex.repMax}`} ${ex.unit||"reps"}</span></div><p class="recommend">${esc(rec.text)}</p><div class="set-row set-heading"><span>Sett</span><span>Kg</span><span>${ex.unit||"Reps"}</span><span>Utført</span></div>${rows}<div class="exercise-bottom"><div class="feel-group">${[["easy","🙂","Lett"],["ok","😐","Passe"],["hard","🙁","Tungt"]].map(([f,e,label])=>`<button type="button" class="feel-btn ${draft?.feel===f?"active":""}" data-feel="${f}" aria-label="${label}" aria-pressed="${draft?.feel===f}">${e}</button>`).join("")}</div><label class="field"><span>Reps i reserve, siste sett</span><select class="exercise-rir"><option value="">Ikke vurdert</option>${[0,1,2,3,4,5].map(v=>`<option value="${v}" ${draft?.rir===v?"selected":""}>${v===5?"5+":v}</option>`).join("")}</select></label></div><label class="field"><span>Notat</span><input class="exercise-note" type="text" maxlength="2000" value="${esc(draft?.note||"")}" placeholder="${esc(last?.note?`Sist: ${last.note}`:"Valgfritt")}" /></label><label class="check-label"><input class="exercise-pain" type="checkbox" ${draft?.pain?"checked":""} /> Smerte / måtte tilpasse</label></article>`;
  }
  function saveWorkout() {
    captureTraining();const c=trainingContext,draft=state.drafts[draftId(c)];
    if(!C.validDate(c.date)||c.date>localISO()){toast("Velg i dag eller en tidligere dato");return;}
    const entries=draft.entries.map(e=>({...e,sets:e.sets.filter(s=>s.done)})).filter(e=>e.sets.length);
    if(getWorkout(c.key).main?.length && !entries.length){toast("Marker minst ett gjennomført sett. Utkastet er bevart.");return;}
    if(entries.some(e=>e.sets.some(s=>s.reps===null||s.reps<=0||s.reps>2000||s.weight!==null&&(s.weight<0||s.weight>2000)))){toast("Fyll inn gyldige reps/tid på gjennomførte sett");return;}
    if(ALT[c.key] && (!draft.duration||draft.duration<=0||draft.duration>600)){toast("Legg inn varighet mellom 1 og 600 minutter");return;}
    const record={...draft,id:draft.recordId||uid(),schemaVersion:VERSION,savedAt:new Date().toISOString(),entries};delete record.recordId;
    const previous=state.workouts.findIndex(w=>w.id===record.id);
    if(previous>=0)state.workouts[previous]=record;else state.workouts.push(record);
    draft.recordId=record.id;
    const day=ensureDay(c.date);day.habits.plan=true;day.plannedKey=c.key;touchDay(c.date);
    if(saveState()){toast("Økten er lagret. Du kan redigere den videre her.");renderTraining();renderToday();}
  }
  function renderWorkoutHistory() {
    const list=[...state.workouts].sort((a,b)=>`${b.date}${b.savedAt||""}`.localeCompare(`${a.date}${a.savedAt||""}`));
    el("workout-history").innerHTML=list.length?list.map(w=>`<details class="history-details"><summary><strong>${esc(getWorkout(w.key,w.phase).name)}</strong><small>${niceDate(w.date)} · ${w.legacy?"importert":w.mode==="minimum"?"minimum":w.duration?`${w.duration} min`:"styrke"}</small></summary><p>${esc(w.note||"")}</p>${(w.entries||[]).map(e=>`<p><b>${esc(e.name||e.exId)}</b>: ${e.sets.map(s=>`${s.weight??"–"} kg × ${s.reps??"–"}`).join(" / ")}<br>${esc(e.note||"")}</p>`).join("")}</details>`).join(""):'<p class="empty">Ingen økter logget ennå.</p>';
  }

  function foodDate(){return el("food-date").value||localISO();}
  function renderFood() {
    const date=foodDate(),totals=foodTotals(date),day=ensureDay(date),[low,high]=targetRange(dateFromISO(date)),foods=state.foods[date]||[];
    el("food-date").value=date;el("food-date").max=localISO();
    el("food-kcal-total").textContent=Math.round(totals.kcal);el("food-protein-total").textContent=Math.round(totals.protein);
    el("food-kcal-target").textContent=`mål ${low}–${high}`;el("food-protein-target").textContent=`mål ${day.targets.protein} g`;
    el("food-kcal-progress").style.width=`${clamp(totals.kcal/high*100,0,100)}%`;el("food-protein-progress").style.width=`${clamp(totals.protein/day.targets.protein*100,0,100)}%`;
    el("nutrition-complete").checked=!!day.nutritionComplete;el("food-entry-count").textContent=`${foods.length} linjer`;
    el("food-list").innerHTML=foods.length?foods.map(f=>`<div class="food-item"><div><strong>${esc(f.name)}</strong><small>${f.basis==="100g"?`${round1(f.qty*100)} g`:`${round1(f.qty)} porsj`} · ${Math.round(f.kcal*f.qty)} kcal · ${round1(f.protein*f.qty)} g protein</small></div><div class="row-actions"><button class="icon-btn" aria-label="Lagre ${esc(f.name)} som favoritt" data-fav-food="${esc(f.id)}">★</button><button class="icon-btn" data-edit-food="${esc(f.id)}">Rediger</button><button class="icon-btn danger" aria-label="Slett ${esc(f.name)}" data-del-food="${esc(f.id)}">×</button></div></div>`).join(""):'<p class="empty">Ingen mat logget denne dagen.</p>';
    qsa("[data-del-food]").forEach(b=>b.onclick=()=>{
      const index=foods.findIndex(f=>f.id===b.dataset.delFood);undoFood={date,index,food:foods[index]};foods.splice(index,1);day.nutritionComplete=false;touchDay(date);saveState();renderFood();renderToday();
    });
    qsa("[data-edit-food]").forEach(b=>b.onclick=()=>editFood(b.dataset.editFood));
    qsa("[data-fav-food]").forEach(b=>b.onclick=()=>favoriteFood(b.dataset.favFood));
    el("undo-food").classList.toggle("hidden",!undoFood);
    el("favorite-list").innerHTML=state.favorites.length?state.favorites.map(f=>`<div class="favorite-item"><div><strong>${esc(f.name)}</strong><small>${Math.round(f.kcal*num(f.qty,1))} kcal · ${round1(f.protein*num(f.qty,1))} g protein</small></div><div class="row-actions"><button class="icon-btn" data-add-fav="${esc(f.id)}">Legg til</button><button class="icon-btn danger" aria-label="Fjern favoritt ${esc(f.name)}" data-del-fav="${esc(f.id)}">×</button></div></div>`).join(""):'<p class="empty">Trykk ★ på et måltid for rask logging neste gang.</p>';
    qsa("[data-add-fav]").forEach(b=>b.onclick=()=>{const f=state.favorites.find(x=>x.id===b.dataset.addFav);if(f)addFoodEntry({...f,id:uid(),qty:num(f.qty,1)});});
    qsa("[data-del-fav]").forEach(b=>b.onclick=()=>{if(!confirm("Fjerne dette lagrede måltidet? Matloggen beholdes."))return;state.favorites=state.favorites.filter(f=>f.id!==b.dataset.delFav);saveState();renderFood();});
  }
  function addFoodEntry(entry) {
    try{C.validateFood(entry);}catch(e){toast(e.message);return false;}
    const date=foodDate();if(!C.validDate(date)||date>localISO()){toast("Velg en gyldig dato");return false;}
    state.foods[date] ||= [];state.foods[date].push(entry);ensureDay(date).nutritionComplete=false;touchDay(date);
    const ok=saveState();renderFood();renderToday();return ok;
  }
  function foodFormLabels() {
    const grams=el("food-basis").value==="100g";
    el("food-kcal-label").textContent=grams?"Kcal per 100 g":"Kcal per porsjon";
    el("food-protein-label").textContent=grams?"Protein per 100 g":"Protein per porsjon";
    el("food-qty-label").textContent=grams?"Spist mengde (g)":"Porsjoner";
  }
  function clearFoodForm() {
    foodEditId=null;["food-name","food-kcal","food-protein"].forEach(id=>el(id).value="");el("food-basis").value="portion";el("food-qty").value="1";el("add-food").textContent="Legg til";el("cancel-food-edit").classList.add("hidden");foodFormLabels();
    delete state.formDrafts[`food:${foodDate()}`];saveState();
  }
  function captureFoodForm() {
    state.formDrafts[`food:${foodDate()}`]={editId:foodEditId,values:Object.fromEntries(["food-name","food-kcal","food-protein","food-basis","food-qty"].map(id=>[id,el(id).value]))};saveState();
  }
  function restoreFoodForm() {
    const d=state.formDrafts[`food:${foodDate()}`];foodEditId=d?.editId||null;
    for(const id of ["food-name","food-kcal","food-protein","food-basis","food-qty"])el(id).value=d?.values?.[id]??(id==="food-basis"?"portion":id==="food-qty"?"1":"");
    el("add-food").textContent=foodEditId?"Lagre endring":"Legg til";el("cancel-food-edit").classList.toggle("hidden",!foodEditId);foodFormLabels();
  }
  function addFoodFromForm() {
    const basis=el("food-basis").value,kcal=C.number(el("food-kcal").value),protein=C.number(el("food-protein").value),amount=C.number(el("food-qty").value);
    const entry={id:foodEditId||uid(),name:el("food-name").value.trim(),kcal,protein,qty:amount===null?null:amount/(basis==="100g"?100:1),basis};
    if(kcal===null||protein===null||amount===null||amount<=0){toast("Fyll inn kcal, protein og en positiv mengde. Bruk 0 når verdien er null.");return;}
    try{C.validateFood(entry);}catch(e){toast(e.message);return;}
    if(foodEditId){
      const list=state.foods[foodDate()]||[],index=list.findIndex(f=>f.id===foodEditId);if(index<0){toast("Matlinjen finnes ikke lenger");return;}
      list[index]={...list[index],...entry};ensureDay(foodDate()).nutritionComplete=false;touchDay(foodDate());if(!saveState())return;
      renderFood();renderToday();
    }else if(!addFoodEntry(entry))return;
    clearFoodForm();toast("Matloggen er lagret");
  }
  function favoriteFood(id) {
    const food=(state.foods[foodDate()]||[]).find(f=>f.id===id);if(!food)return;
    if(state.favorites.some(f=>f.name===food.name&&f.kcal===food.kcal&&f.protein===food.protein&&num(f.qty,1)===food.qty)){toast("Måltidet er allerede lagret");return;}
    state.favorites.push({...food,id:uid()});saveState();renderFood();toast("Måltid og mengde lagret som favoritt");
  }
  function editFood(id) {
    const food=(state.foods[foodDate()]||[]).find(f=>f.id===id);if(!food)return;
    foodEditId=id;el("food-name").value=food.name;el("food-kcal").value=food.kcal;el("food-protein").value=food.protein;el("food-basis").value=food.basis||"portion";el("food-qty").value=food.qty*(food.basis==="100g"?100:1);
    el("add-food").textContent="Lagre endring";el("cancel-food-edit").classList.remove("hidden");foodFormLabels();captureFoodForm();el("food-name").focus();
  }
  function copyYesterday() {
    const date=foodDate(),src=state.foods[localISO(addDays(date,-1))]||[];
    if(!src.length){toast("Ingen mat å kopiere fra dagen før");return;}
    if(!confirm(`Legge til ${src.length} linjer fra dagen før? Eksisterende mat beholdes.`))return;
    state.foods[date]=[...(state.foods[date]||[]),...src.map(f=>({...f,id:uid()}))];ensureDay(date).nutritionComplete=false;touchDay(date);saveState();renderFood();renderToday();toast("Mat lagt til – eksisterende linjer beholdt");
  }

  function upsertMetric() {
    if(!guardToday())return;
    const weight=num(el("metric-weight").value)||null, waist=num(el("metric-waist").value)||null; if(!weight&&!waist){toast("Legg inn vekt eller midjemål");return;}
    if((weight!==null&&(weight<40||weight>250))||(waist!==null&&(waist<40||waist>200))){toast("Kontroller vekt (40–250 kg) og midje (40–200 cm)");return;}
    const date=localISO(); let m=state.metrics.find(x=>x.date===date); if(!m){m={date};state.metrics.push(m);} if(weight)m.weight=weight;if(waist)m.waist=waist;
    state.metrics.sort((a,b)=>a.date.localeCompare(b.date));delete state.formDrafts[`metrics:${localISO()}`];saveState();renderProgress();toast("Måling lagret");
  }
  function recentWeightAverage() { return C.weightSummary(state,localISO()).average; }
  function rollingWeightSeries() {
    const rows=state.metrics.filter(x=>num(x.weight)>0).sort((a,b)=>a.date.localeCompare(b.date));
    return rows.map((row,i)=>{const end=dateFromISO(row.date), start=addDays(end,-6);const vals=rows.filter(x=>dateFromISO(x.date)>=start&&dateFromISO(x.date)<=end).map(x=>num(x.weight));return {date:row.date,value:vals.reduce((a,b)=>a+b,0)/vals.length};});
  }
  function renderChart(node, points, suffix="") {
    if(!points.length){node.innerHTML='<div class="chart-empty">Logg noen målinger, så dukker trenden opp her.</div>';return;}
    const data=points.slice(-30), vals=data.map(x=>x.value), min=Math.min(...vals), max=Math.max(...vals), pad=Math.max((max-min)*.18,.4), lo=min-pad, hi=max+pad;
    const W=800,H=170,L=58,R=14,T=16,B=24, firstTime=dateFromISO(data[0].date).getTime(), span=Math.max(1,dateFromISO(data.at(-1).date).getTime()-firstTime), x=i=>data.length===1?(W-L-R)/2+L:L+(dateFromISO(data[i].date).getTime()-firstTime)*(W-L-R)/span, y=v=>T+(hi-v)*(H-T-B)/(hi-lo||1);
    const path=data.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const circles=data.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="#ff8a1f" />`).join("");
    node.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Trendgraf"><line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#2d3950"/><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#2d3950"/><path d="${path}" fill="none" stroke="#ff8a1f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${circles}<text x="4" y="${T+7}" fill="#8997ae" font-size="14">${round1(hi)}${suffix}</text><text x="4" y="${H-B}" fill="#8997ae" font-size="14">${round1(lo)}${suffix}</text><text x="${L}" y="${H-5}" fill="#8997ae" font-size="13">${niceDate(data[0].date)}</text><text x="${W-110}" y="${H-5}" fill="#8997ae" font-size="13">${niceDate(data.at(-1).date)}</text></svg>`;
  }

  function renderProgress() {
    const weights=state.metrics.filter(x=>num(x.weight)>0).sort((a,b)=>a.date.localeCompare(b.date)), waists=state.metrics.filter(x=>num(x.waist)>0).sort((a,b)=>a.date.localeCompare(b.date)), avg=recentWeightAverage();
    el("last-weight").textContent=weights.length?`${round1(weights.at(-1).weight)} kg`:"–"; el("avg-weight").textContent=avg?`${round1(avg)} kg`:"–"; el("last-waist").textContent=waists.length?`${round1(waists.at(-1).waist)} cm`:"–"; el("weight-goal-pill").textContent=`Mål ${round1(state.settings.weightGoal)} kg`;
    const todayMetric=state.metrics.find(x=>x.date===localISO()); el("metric-weight").value=todayMetric?.weight||""; el("metric-waist").value=todayMetric?.waist||"";
    renderChart(el("weight-chart"),rollingWeightSeries()," kg"); renderChart(el("waist-chart"),waists.map(x=>({date:x.date,value:x.waist}))," cm");
    const summary=C.weightSummary(state,localISO());
    el("weight-context").textContent=summary.count?`Snittet bygger på ${summary.count} målinger de siste 7 dagene.${summary.change!==null?` Endring fra forrige uke: ${round1(summary.change)} kg.`:" Logg minst tre målinger i hver av to uker før ukene sammenlignes."}`:"Ingen vektmålinger de siste 7 dagene. Eldre målinger vises fortsatt i grafen.";
    const signals=buildProgressSignals(); el("progress-signals").innerHTML=signals.length?signals.map(s=>`<div class="history-item"><div><strong>${esc(s.title)}</strong><small>${esc(s.text)}</small></div><span class="pill">${s.icon}</span></div>`).join(""):'<div class="chart-empty">Logg noen styrkeøkter for å få konkrete progresjonssignaler.</div>';
    for(let i=0;i<7;i++)planOptions(el(`plan-week-${i}`),state.settings.weeklyPlan[i]);
    el("setting-strength").value=state.settings.weeklyStrength;
    el("setting-football-low").value=state.settings.footballLow??"";el("setting-football-high").value=state.settings.footballHigh??"";
    el("setting-protein").value=state.settings.protein; el("setting-kcal-low").value=state.settings.kcalLow; el("setting-kcal-high").value=state.settings.kcalHigh; el("setting-weekend-low").value=state.settings.weekendLow; el("setting-weekend-high").value=state.settings.weekendHigh; el("setting-weight-goal").value=state.settings.weightGoal;
    restoreForm("settings");restoreForm(`metrics:${localISO()}`);
  }
  function buildProgressSignals() {
    const all=Object.values(PHASES[state.phase].workouts).flatMap(w=>w.main||[]),seen=new Set();
    return all.filter(ex=>{if(seen.has(ex.id))return false;seen.add(ex.id);return C.exerciseHistory(state,ex.id,localISO()).length;}).map(ex=>{const r=C.recommendation(state,ex,localISO());return {title:ex.name,text:r.text,icon:r.action==="increase"?"↑":"="};});
  }

  function saveSettings() {
    if(!guardToday())return;
    const next={...state.settings,protein:C.number(el("setting-protein").value),kcalLow:C.number(el("setting-kcal-low").value),kcalHigh:C.number(el("setting-kcal-high").value),weekendLow:C.number(el("setting-weekend-low").value),weekendHigh:C.number(el("setting-weekend-high").value),weightGoal:C.number(el("setting-weight-goal").value),weeklyStrength:C.number(el("setting-strength").value),footballLow:C.number(el("setting-football-low").value),footballHigh:C.number(el("setting-football-high").value)};
    const error=C.settingsError(next);if(error){toast(error);return;}
    next.weeklyPlan=Array.from({length:7},(_,i)=>el(`plan-week-${i}`).value);
    state.settings=next;delete state.formDrafts.settings;
    const day=ensureDay();day.targets=C.targetsFor(state,localISO(),day.plannedKey);touchDay();
    if(saveState()){renderProgress();renderToday();renderFood();toast("Mål lagret fra i dag. Historiske mål beholdes.");}
  }
  function downloadJSON(data,name) {
    const a=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportData() {
    downloadJSON({app:"Prosjekt 2026",exportedAt:new Date().toISOString(),state,legacy:repository.legacy(),unreadableOriginal:repository.blocked?repository.raw():undefined},`prosjekt-2026-backup-${localISO()}.json`);
    toast("Backup lastet ned – oppbevar den privat");
  }
  async function importData(file) {
    if(!file)return;
    try {
      if(file.size>10*1024*1024)throw Error("Backupen er større enn 10 MB.");
      const text=await file.text();
      const parsed=JSON.parse(text,(key,value)=>{if(["__proto__","prototype","constructor"].includes(key))throw Error("Ugyldig nøkkel i backup");return value;});
      const incoming=C.normalizeState(parsed.state||parsed),replace=el("import-mode").value==="replace";
      if(repository.blocked && !replace)throw Error("Eksporter originaldata først, og velg full gjenoppretting fra en gyldig backup.");
      const summary=`${incoming.workouts.length} økter, ${Object.values(incoming.foods).flat().length} matlinjer og ${incoming.metrics.length} målinger.`;
      if(!confirm(`${summary} ${replace?"Erstatte nåværende data? En gjenopprettingskopi lagres først.":"Legge til manglende historikk? Ved samme dato/ID beholdes eksisterende registrering."}`))return;
      const next=replace?incoming:C.mergeState(state,incoming);
      next.legacyMigrationVersion=VERSION;
      // Original legacy keys are never written over by a backup import.
      if(parsed.legacy && typeof parsed.legacy==="object")next.importedLegacy=parsed.legacy;
      if(replace?repository.replace(next):(repository.checkpoint("import")&&repository.save(next))){state=next;migrationReady=true;trainingContext=null;renderAll();restoreFoodForm();toast("Backup importert");}else toast(repository.error);
    }catch(e){toast(`Import avbrutt: ${e.message}`);}finally{el("import-data").value="";}
  }
  function completeDay() {
    if(!guardToday())return;
    const date=localISO(),day=ensureDay(date),score=scoreDay(date);
    day.score=score.total;day.completed=true;day.scoreVersion=VERSION;day.completedAt=new Date().toISOString();
    if(saveState()){renderToday();toast(`Dagen er lagret: ${score.total}/100. Hvile og tilpasning teller også.`);}
  }
  function rollover() {
    const today=localISO();if(today===activeDate)return;
    activeDate=today;
    // Training and food dates stay pinned: late entries never silently move days.
    renderToday();el("date-warning").classList.remove("hidden");el("date-warning").textContent="Det er en ny dag. Påbegynte logger beholder datoen sin. Velg dagens dato når du starter en ny logg.";
  }
  function bind() {
    qsa(".nav-btn").forEach(b=>b.addEventListener("click",()=>{rollover();setTab(b.dataset.tab);}));
    el("go-training").onclick=()=>{el("training-date").value=localISO();el("workout-select").value=ensureDay().plannedKey;setTab("training");};el("go-food").onclick=()=>setTab("food");el("go-food-protein").onclick=()=>setTab("food");
    el("today-plan-select").onchange=e=>{const day=ensureDay();day.plannedKey=e.target.value;day.targets=C.targetsFor(state,localISO(),day.plannedKey);touchDay();saveState();renderToday();};
    ["energy","ankle","achilles","back"].forEach(id=>el(id).addEventListener("input",e=>el(`${id}-out`).textContent=`${e.target.value}/${id==="energy"?5:10}`));
    el("save-readiness").onclick=()=>{
      if(!guardToday())return;
      const sleep=C.number(el("readiness-sleep").value);if(sleep!==null&&(sleep<0||sleep>24)){toast("Kontroller antall timer søvn");return;}
      ensureDay().readiness={energy:num(el("energy").value),ankle:num(el("ankle").value),achilles:num(el("achilles").value),back:num(el("back").value),swelling:el("readiness-swelling").checked,redFlags:el("readiness-redflags").checked,footballIncreased:el("readiness-football").checked,reaction:el("readiness-reaction").value,sleepHours:sleep,savedAt:new Date().toISOString()};
      delete state.formDrafts[`readiness:${localISO()}`];touchDay();saveState();renderToday();renderTraining();toast("Innsjekk lagret");
    };
    ["plan","water","mobility","sleep"].forEach(k=>el(`habit-${k}`).onchange=e=>{if(!guardToday())return;ensureDay().habits[k]=e.target.checked;touchDay();saveState();renderToday();});
    el("complete-day").onclick=completeDay;
    el("phase-select").onchange=e=>{state.phase=e.target.value;saveState();renderTraining();renderToday();};
    ["workout-select","training-mode","training-date"].forEach(id=>el(id).onchange=()=>{if(!C.validDate(el("training-date").value)||el("training-date").value>localISO()){el("training-date").value=trainingContext?.date||localISO();toast("Velg en gyldig dato");}renderTraining();});
    ["alt-duration","alt-intensity","alt-note"].forEach(id=>el(id).oninput=captureTraining);
    el("save-workout").onclick=saveWorkout;
    el("new-session").onclick=()=>{if(!confirm("Starte et nytt utkast? Lagrede økter beholdes. Ulagret utkast for denne økten fjernes."))return;delete state.drafts[draftId(trainingContext)];saveState();renderTraining();};
    el("add-food").onclick=addFoodFromForm;el("copy-yesterday").onclick=copyYesterday;
    el("cancel-food-edit").onclick=clearFoodForm;
    ["food-name","food-kcal","food-protein","food-qty"].forEach(id=>el(id).oninput=captureFoodForm);
    el("food-basis").onchange=()=>{foodFormLabels();captureFoodForm();};
    el("food-date").onchange=()=>{if(!C.validDate(foodDate())||foodDate()>localISO()){el("food-date").value=localISO();}restoreFoodForm();renderFood();};
    el("nutrition-complete").onchange=e=>{if(!(state.foods[foodDate()]||[]).length){e.target.checked=false;toast("Logg maten før du markerer dagen som komplett");return;}ensureDay(foodDate()).nutritionComplete=e.target.checked;touchDay(foodDate());saveState();renderToday();};
    el("undo-food").onclick=()=>{if(!undoFood)return;const {date,index,food}=undoFood;state.foods[date].splice(index,0,food);touchDay(date);undoFood=null;saveState();renderFood();renderToday();};
    el("save-metric").onclick=upsertMetric;el("save-settings").onclick=saveSettings;el("export-data").onclick=exportData;el("emergency-export").onclick=exportData;el("import-data").onchange=e=>importData(e.target.files?.[0]);
    el("recovery-export").onclick=()=>{const raw=repository.recovery();if(!raw){toast("Ingen gjenopprettingskopi finnes ennå");return;}try{const backup=JSON.parse(raw);downloadJSON({app:"Prosjekt 2026",state:JSON.parse(backup.raw)},`prosjekt-2026-gjenoppretting-${localISO()}.json`);}catch(_){downloadJSON({raw},"prosjekt-2026-originaldata.json");}};
    el("reset-data").onclick=()=>{if(prompt("Skriv NULLSTILL for å slette denne appens data. En lokal gjenopprettingskopi beholdes. Eksporter gjerne en egen backup først.")!=="NULLSTILL")return;const next=C.defaultState();next.legacyMigrated=true;next.legacyMigrationVersion=VERSION;if(repository.replace(next)){state=next;migrationReady=true;trainingContext=null;renderAll();restoreFoodForm();toast("Data nullstilt. Gjenopprettingskopi er tilgjengelig.");}};
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)rollover();});
    window.addEventListener("focus",rollover);
    window.addEventListener("storage",e=>{if(e.key===STORE_KEY){el("storage-warning").classList.remove("hidden");el("storage-warning").textContent="Data er endret i en annen fane. Eksporter eventuelle utkast her og last siden på nytt før du fortsetter.";}});
    const readinessIds=["energy","ankle","achilles","back","readiness-swelling","readiness-redflags","readiness-football","readiness-reaction","readiness-sleep"];
    readinessIds.forEach(id=>el(id).addEventListener("input",()=>captureForm(`readiness:${activeDate}`,readinessIds)));
    const metricIds=["metric-weight","metric-waist"];metricIds.forEach(id=>el(id).addEventListener("input",()=>captureForm(`metrics:${activeDate}`,metricIds)));
    const settingsIds=["setting-protein","setting-kcal-low","setting-kcal-high","setting-weekend-low","setting-weekend-high","setting-weight-goal","setting-strength","setting-football-low","setting-football-high",...Array.from({length:7},(_,i)=>`plan-week-${i}`)];
    settingsIds.forEach(id=>el(id).addEventListener("input",()=>captureForm("settings",settingsIds)));
    window.P2026BeforeUpdate=()=>saveState();
  }

  function renderAll() { renderTop(); renderToday(); renderTraining(); renderFood(); renderProgress(); }

  document.addEventListener("DOMContentLoaded",()=>{
    el("training-date").value=localISO();el("food-date").value=localISO();
    bind(); renderAll();restoreFoodForm();
    el("storage-warning").textContent=repository.error;el("storage-warning").classList.toggle("hidden",!repository.error);
    if(!repository.blocked)saveState();
    const tab=new URL(location.href).searchParams.get("tab")||"today"; setTab(tab);
  });
})();

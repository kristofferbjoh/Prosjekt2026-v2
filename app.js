/* Prosjekt 2026 v3 – focused strength log */
(() => {
  "use strict";

  const C = window.P2026Core;
  const { PHASES } = window.P2026Programs;
  const repository = window.P2026Storage.create(() => window.localStorage);
  const el = id => document.getElementById(id);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const clone = value => structuredClone(value);
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const strengthKeys = ["W1", "W2", "W3", "W4"];

  let state = repository.read();
  let currentTab = "home";
  let sessionContext = null;
  let programOpenKey = null;
  let editorState = null;

  const todayISO = () => C.localISO();
  const dateObj = iso => C.dateFromISO(iso);
  const niceDate = iso => new Intl.DateTimeFormat("nb-NO", { day:"2-digit", month:"short", year:"numeric" }).format(dateObj(iso));
  const shortDate = iso => new Intl.DateTimeFormat("nb-NO", { day:"2-digit", month:"short" }).format(dateObj(iso));
  const monthUpper = iso => new Intl.DateTimeFormat("nb-NO", { month:"short" }).format(dateObj(iso)).replace(".","").toUpperCase();
  const dayUpper = iso => new Intl.DateTimeFormat("nb-NO", { weekday:"long" }).format(dateObj(iso)).toUpperCase();
  const num = (value, fallback = null) => C.number(value, fallback);

  function toast(message) {
    const node = el("toast");
    if (!node) return;
    node.textContent = repository.error || message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 1800);
  }

  function saveState(message) {
    const ok = repository.save(state);
    const warning = el("storage-warning");
    if (warning) {
      warning.textContent = repository.error || "";
      warning.classList.toggle("hidden", !repository.error);
    }
    if (message && ok) toast(message);
    return ok;
  }

  function defaultTemplate(phase, key) {
    // The Phase 1 upper-body session is intentionally the default W1 in v3:
    // it is the older "opptrenings" session the user prefers.
    if (phase === "phase2" && key === "W1") {
      const template = clone(PHASES.phase1.workouts.W1);
      template.name = "Økt 1 – Overkropp";
      template.note = "Klassisk overkroppsøkt med teknikk, styrke og skulderrobusthet.";
      template.duration = "45–55 min";
      return template;
    }
    return clone(PHASES[phase]?.workouts[key] || PHASES.phase2.workouts[key]);
  }

  function ensureUiState() {
    let changed = false;
    if (!state.customTemplates || typeof state.customTemplates !== "object") {
      state.customTemplates = { phase1:{}, phase2:{} };
      changed = true;
    }
    for (const phase of ["phase1", "phase2"]) {
      if (!state.customTemplates[phase] || typeof state.customTemplates[phase] !== "object") {
        state.customTemplates[phase] = {};
        changed = true;
      }
      for (const key of strengthKeys) {
        if (!state.customTemplates[phase][key]) {
          state.customTemplates[phase][key] = defaultTemplate(phase, key);
          changed = true;
        }
      }
    }
    if (!Array.isArray(state.trainingRotation)) {
      state.trainingRotation = ["W1", "W2"];
      changed = true;
    }
    state.trainingRotation = state.trainingRotation.filter((key, i, arr) => strengthKeys.includes(key) && arr.indexOf(key) === i);
    if (!state.trainingRotation.length) { state.trainingRotation = ["W1", "W2"]; changed = true; }
    if (!strengthKeys.includes(state.lastManualWorkout || "")) state.lastManualWorkout = null;
    if (changed) saveState();
  }
  ensureUiState();

  function templateFor(key, phase = state.phase) {
    return state.customTemplates?.[phase]?.[key] || defaultTemplate(phase, key);
  }

  function allExerciseCatalog() {
    const seen = new Map();
    for (const phase of ["phase1", "phase2"]) {
      for (const key of strengthKeys) {
        const lists = [PHASES[phase].workouts[key]?.main || [], state.customTemplates?.[phase]?.[key]?.main || []];
        for (const list of lists) for (const ex of list) {
          const label = String(ex.name || "").trim();
          if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), clone(ex));
        }
      }
    }
    for (const workout of state.workouts || []) for (const entry of workout.entries || []) {
      if (entry.name && !seen.has(entry.name.toLowerCase())) seen.set(entry.name.toLowerCase(), { id:entry.exId, name:entry.name, sets:3, repMin:8, repMax:10, weight:true });
    }
    return seen;
  }

  function resolveExercise(name, current) {
    const clean = String(name || "").trim();
    const catalog = allExerciseCatalog();
    const known = catalog.get(clean.toLowerCase());
    if (known) return { ...clone(current || {}), ...clone(known), name:clean };
    if (current && clean === current.name) return { ...clone(current), name:clean };
    const slug = clean.toLowerCase().replace(/[^a-z0-9æøå]+/gi, "_").replace(/^_+|_+$/g, "").slice(0,32) || "exercise";
    return { ...clone(current || {}), id:`custom_${slug}_${uid().slice(0,6)}`, name:clean };
  }

  function nextWorkoutKey() {
    const rotation = state.trainingRotation;
    const completed = [...(state.workouts || [])]
      .filter(w => rotation.includes(w.key))
      .sort((a,b) => `${b.date}|${b.savedAt || ""}`.localeCompare(`${a.date}|${a.savedAt || ""}`));
    if (!completed.length) return rotation[0];
    const idx = rotation.indexOf(completed[0].key);
    return rotation[(idx + 1) % rotation.length];
  }

  function completedStrengthWorkouts() {
    return [...(state.workouts || [])]
      .filter(w => strengthKeys.includes(w.key))
      .sort((a,b) => `${b.date}|${b.savedAt || ""}`.localeCompare(`${a.date}|${a.savedAt || ""}`));
  }

  function workoutLabel(workout) {
    return workout.workoutName || templateFor(workout.key, workout.phase || state.phase)?.name || workout.key;
  }

  function workoutStats(workout) {
    const sets = (workout.entries || []).flatMap(e => e.sets || []).filter(s => s.done || num(s.reps,0) > 0);
    const volume = sets.reduce((sum,s) => sum + num(s.weight,0) * num(s.reps,0), 0);
    return { sets:sets.length, volume:Math.round(volume) };
  }

  function setTab(tab) {
    const valid = ["home", "session", "history", "program"].includes(tab) ? tab : "home";
    currentTab = valid;
    qsa(".screen").forEach(node => node.classList.toggle("active", node.id === `screen-${valid}`));
    qsa(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === valid));
    if (valid === "home") renderHome();
    if (valid === "session") {
      if (!sessionContext) startSession(nextWorkoutKey(), todayISO(), false);
      else renderSession();
    }
    if (valid === "history") renderHistory();
    if (valid === "program") renderProgram();
    const url = new URL(location.href);
    url.searchParams.set("tab", valid);
    history.replaceState({}, "", url);
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  function renderHome() {
    const date = todayISO();
    const key = nextWorkoutKey();
    const workout = templateFor(key);
    el("home-day").textContent = dayUpper(date);
    el("home-date").textContent = `${dateObj(date).getDate()} ${monthUpper(date)}`;
    el("next-workout-name").textContent = workout.name;
    el("next-workout-note").textContent = workout.note || "";
    el("next-workout-meta").textContent = `${workout.duration || "45–60 min"} · ${(workout.main || []).length} øvelser`;
    el("next-phase").textContent = state.phase === "phase1" ? "Fase 1" : "Fase 2";
    const preview = (workout.main || []).slice(0,5);
    el("next-exercise-preview").innerHTML = preview.map((ex,i) => `
      <div class="preview-row"><span class="preview-num">${String(i+1).padStart(2,"0")}</span><b>${esc(ex.name)}</b><span>${esc(repLabel(ex))}</span></div>
    `).join("") + ((workout.main || []).length > 5 ? `<div class="more-preview">+ ${(workout.main || []).length - 5} til</div>` : "");

    const history = completedStrengthWorkouts();
    const last = history[0];
    if (last) {
      const days = C.dayDistance(date, last.date);
      el("last-trained").textContent = days === 0 ? "I dag" : days === 1 ? "I går" : `${days}d`;
      el("last-trained-name").textContent = workoutLabel(last);
    } else {
      el("last-trained").textContent = "–";
      el("last-trained-name").textContent = "Ingen økter ennå";
    }
    const since = C.localISO(C.addDays(date, -29));
    el("month-count").textContent = history.filter(w => w.date >= since && w.date <= date).length;
    el("rotation-count").textContent = state.trainingRotation.length;
    el("home-history").innerHTML = history.length ? history.slice(0,3).map(historyRowHTML).join("") : `<div class="empty-state">Ingen lagrede styrkeøkter ennå. Første økt blir starten på historikken.</div>`;
  }

  function historyRowHTML(workout) {
    const d = dateObj(workout.date), stats = workoutStats(workout);
    return `<div class="history-row">
      <div class="history-date"><b>${d.getDate()}</b><small>${monthUpper(workout.date)}</small></div>
      <div class="history-copy"><b>${esc(workoutLabel(workout))}</b><small>${stats.sets} sett${stats.volume ? ` · ${stats.volume.toLocaleString("nb-NO")} kg volum` : ""}</small></div>
      <span class="history-arrow">›</span>
    </div>`;
  }

  function repLabel(ex) {
    const unit = ex.unit || "reps";
    const reps = ex.repMin === ex.repMax ? ex.repMax : `${ex.repMin}–${ex.repMax}`;
    return `${ex.sets} × ${reps} ${unit}`;
  }

  function showWorkoutPicker() {
    const list = el("workout-picker-list");
    list.innerHTML = strengthKeys.map(key => {
      const workout = templateFor(key);
      return `<button class="picker-item" data-pick-workout="${key}" type="button"><div><b>${esc(workout.name)}</b><small>${workout.duration || ""} · ${(workout.main || []).length} øvelser</small></div><span>→</span></button>`;
    }).join("");
    el("workout-picker").classList.remove("hidden");
  }

  function closeSheets() {
    qsa(".sheet-backdrop").forEach(node => node.classList.add("hidden"));
  }

  function draftId(ctx) { return `${ctx.date}|${ctx.phase}|${ctx.key}|normal`;
  }

  function ensureSessionDraft(ctx) {
    const id = draftId(ctx);
    const template = templateFor(ctx.key, ctx.phase);
    let draft = state.drafts[id];
    if (!draft) {
      const sessionExercises = clone(template.main || []);
      draft = {
        date:ctx.date, key:ctx.key, phase:ctx.phase, mode:"normal", note:"", sessionExercises,
        entries:sessionExercises.map(ex => ({ exId:ex.id, name:ex.name, sets:Array.from({length:ex.sets}, () => ({weight:null,reps:null,done:false})), feel:"", rir:null, note:"" })),
        updatedAt:new Date().toISOString()
      };
      state.drafts[id] = draft;
      saveState();
    }
    if (!Array.isArray(draft.sessionExercises)) draft.sessionExercises = clone(template.main || []);
    syncDraftEntries(draft);
    return draft;
  }

  function syncDraftEntries(draft) {
    const entries = Array.isArray(draft.entries) ? draft.entries : [];
    draft.entries = (draft.sessionExercises || []).map(ex => {
      let entry = entries.find(e => e.exId === ex.id);
      if (!entry) entry = { exId:ex.id, name:ex.name, sets:[], feel:"", rir:null, note:"" };
      entry.name = ex.name;
      entry.sets = Array.from({length:ex.sets}, (_,i) => ({ weight:null, reps:null, done:false, ...(entry.sets?.[i] || {}) }));
      return entry;
    });
  }

  function startSession(key, date = todayISO(), switchTab = true) {
    sessionContext = { key, date, phase:state.phase };
    state.lastManualWorkout = key;
    ensureSessionDraft(sessionContext);
    saveState();
    if (switchTab) setTab("session"); else renderSession();
  }

  function getHistoryForExercise(exId, date) {
    return C.exerciseHistory(state, exId, date || "9999-12-31");
  }

  function latestSet(entry, index) {
    if (!entry?.sets?.length) return null;
    return entry.sets[index] || entry.sets[entry.sets.length - 1] || null;
  }

  function exerciseRecommendation(ex, date) {
    const history = getHistoryForExercise(ex.id, date);
    if (!history.length) return "Første loggede økt. Finn en belastning som gir god teknikk og 1–2 reps i reserve.";
    const last = history[0];
    const gap = C.dayDistance(date, last.workout.date);
    const doneSets = (last.entry.sets || []).filter(s => s.done || num(s.reps,0) > 0);
    const weights = doneSets.map(s => num(s.weight)).filter(v => v !== null);
    const lastWeight = weights.length ? weights[weights.length - 1] : null;
    if (gap > 21) return `Sist ${shortDate(last.workout.date)}. Over tre uker siden – start kontrollert og bruk første sett som temperaturmåler.`;
    if (last.entry.feel === "hard") return `Sist kjentes tungt${lastWeight !== null ? ` på ${lastWeight} kg` : ""}. Behold eller juster ned litt før du jager progresjon.`;
    const qualifies = row => {
      const sets = (row.entry.sets || []).filter(s => s.done || num(s.reps,0) > 0);
      if (sets.length < ex.sets) return false;
      if (sets.some(s => num(s.reps,0) < ex.repMax)) return false;
      const ws = sets.map(s => num(s.weight)).filter(v => v !== null);
      if (ex.weight && ws.length < ex.sets) return false;
      if (ex.weight && !ws.every(v => v === ws[0])) return false;
      return row.entry.feel !== "hard" && (row.entry.rir == null || num(row.entry.rir,1) >= 1);
    };
    if (history.length >= 2 && qualifies(history[0]) && qualifies(history[1])) {
      const recentSets = history[0].entry.sets.filter(s => s.done || num(s.reps,0) > 0);
      const weight = num(recentSets[0]?.weight);
      if (ex.weight && weight !== null) {
        const step = weight < 20 ? .5 : weight < 50 ? 1 : 2.5;
        return `To fulle økter på toppen av repområdet. Vurder ${(weight + step).toLocaleString("nb-NO")} kg i dag hvis første sett føles bra.`;
      }
      return "To fulle økter på toppen av repområdet. Gjør øvelsen litt vanskeligere uten å ofre teknikk.";
    }
    if (qualifies(history[0])) return "Sist traff du toppen av repområdet. Gjenta kvaliteten én gang til før du øker.";
    const reps = doneSets.map(s => num(s.reps)).filter(v => v !== null);
    const repText = reps.length ? reps.join("/") : "ingen reps logget";
    return `Sist: ${lastWeight !== null ? `${lastWeight} kg · ` : ""}${repText}. Jag reps før du jager mer vekt.`;
  }

  function exerciseCardHTML(ex, index, entry, date) {
    const previous = getHistoryForExercise(ex.id, date)[0]?.entry;
    const rows = Array.from({length:ex.sets}, (_,i) => {
      const set = entry.sets[i] || {};
      const prev = latestSet(previous, i);
      const prevWeight = num(prev?.weight);
      const prevReps = num(prev?.reps);
      return `<div class="set-row" data-set-index="${i}">
        <span class="set-no">${i+1}</span>
        <div class="set-input-wrap">
          ${ex.weight ? `<input class="set-weight" type="text" inputmode="decimal" value="${set.weight ?? ""}" placeholder="${prevWeight ?? "kg"}" aria-label="Vekt sett ${i+1}" />` : `<input class="set-weight" type="hidden" value="" /><span class="muted tiny">–</span>`}
          <span class="previous-hint">${prevWeight !== null ? `sist ${prevWeight} kg` : ""}</span>
        </div>
        <div class="set-input-wrap">
          <input class="set-reps" type="number" inputmode="numeric" min="0" max="2000" value="${set.reps ?? ""}" placeholder="${prevReps ?? ex.repMax}" aria-label="Reps sett ${i+1}" />
          <span class="previous-hint">${prevReps !== null ? `sist ${prevReps}` : ""}</span>
        </div>
        <button class="set-done ${set.done ? "done" : ""}" type="button" aria-label="Marker sett ${i+1} ferdig" aria-pressed="${!!set.done}"></button>
      </div>`;
    }).join("");
    const finished = entry.sets.filter(s => s.done).length >= ex.sets;
    return `<article class="exercise-card ${finished ? "complete" : ""}" data-ex-index="${index}" data-ex-id="${esc(ex.id)}">
      <div class="exercise-card-head">
        <div class="exercise-title"><span class="exercise-index">${String(index+1).padStart(2,"0")}</span><div><h3>${esc(ex.name)}</h3><p>${esc(repLabel(ex))}</p></div></div>
        <button class="exercise-menu" type="button" data-edit-session="${index}" aria-label="Rediger ${esc(ex.name)}">•••</button>
      </div>
      <p class="recommendation">${esc(exerciseRecommendation(ex,date))}</p>
      <div class="set-head"><span>Sett</span><span>Vekt</span><span>Reps</span><span>Ferdig</span></div>
      ${rows}
      <div class="exercise-bottom">
        <div class="feel-group" aria-label="Hvordan kjentes øvelsen?">
          ${[["easy","🙂"],["ok","😐"],["hard","🙁"]].map(([f,emoji]) => `<button class="feel-btn ${entry.feel===f?"active":""}" type="button" data-feel="${f}" aria-pressed="${entry.feel===f}">${emoji}</button>`).join("")}
        </div>
        <select class="rir-select" aria-label="Reps i reserve"><option value="">RIR –</option>${[0,1,2,3,4,5].map(v => `<option value="${v}" ${String(entry.rir)===String(v)?"selected":""}>RIR ${v}</option>`).join("")}</select>
        <input class="exercise-note" type="text" value="${esc(entry.note || "")}" placeholder="Kort notat…" aria-label="Notat for ${esc(ex.name)}" />
      </div>
    </article>`;
  }

  function fillSessionSelect() {
    el("session-workout").innerHTML = strengthKeys.map(key => `<option value="${key}">${esc(templateFor(key).name)}</option>`).join("");
    el("session-workout").value = sessionContext.key;
    el("session-date").value = sessionContext.date;
  }

  function renderSession() {
    if (!sessionContext) sessionContext = { key:nextWorkoutKey(), date:todayISO(), phase:state.phase };
    if (sessionContext.phase !== state.phase) sessionContext.phase = state.phase;
    const draft = ensureSessionDraft(sessionContext);
    const workout = templateFor(sessionContext.key, sessionContext.phase);
    fillSessionSelect();
    el("session-title").textContent = workout.name;
    el("session-subtitle").textContent = `${workout.duration || "45–60 min"} · ${workout.note || ""}`;
    el("session-note").value = draft.note || "";
    el("session-exercises").innerHTML = draft.sessionExercises.map((ex,i) => exerciseCardHTML(ex,i,draft.entries[i],sessionContext.date)).join("");
    updateSessionProgress();
    el("draft-status").textContent = `Autosave · ${niceDate(sessionContext.date)}`;
  }

  function currentDraft() { return sessionContext ? ensureSessionDraft(sessionContext) : null; }

  function captureSession() {
    const draft = currentDraft();
    if (!draft) return;
    qsa("#session-exercises .exercise-card").forEach(card => {
      const index = Number(card.dataset.exIndex), entry = draft.entries[index];
      card.querySelectorAll(".set-row").forEach(row => {
        const i = Number(row.dataset.setIndex), weightNode = row.querySelector(".set-weight"), repsNode = row.querySelector(".set-reps");
        entry.sets[i] = {
          weight: weightNode?.type === "hidden" ? null : num(weightNode?.value),
          reps: num(repsNode?.value),
          done: row.querySelector(".set-done")?.classList.contains("done") || false
        };
      });
      entry.feel = card.querySelector(".feel-btn.active")?.dataset.feel || "";
      entry.rir = num(card.querySelector(".rir-select")?.value);
      entry.note = card.querySelector(".exercise-note")?.value || "";
    });
    draft.note = el("session-note").value || "";
    draft.updatedAt = new Date().toISOString();
    state.drafts[draftId(sessionContext)] = draft;
    saveState();
    el("draft-status").textContent = `Lagret lokalt · ${new Date().toLocaleTimeString("nb-NO",{hour:"2-digit",minute:"2-digit"})}`;
    updateSessionProgress();
  }

  function updateSessionProgress() {
    const draft = sessionContext ? state.drafts[draftId(sessionContext)] : null;
    if (!draft) return;
    const sets = draft.entries.flatMap(e => e.sets || []), done = sets.filter(s => s.done).length;
    const pct = sets.length ? Math.round(done / sets.length * 100) : 0;
    el("session-progress-bar").style.width = `${pct}%`;
    el("session-progress-label").textContent = `${done} av ${sets.length} sett ferdig`;
  }

  function toggleSet(button) {
    button.classList.toggle("done");
    button.setAttribute("aria-pressed", button.classList.contains("done"));
    const row = button.closest(".set-row");
    if (button.classList.contains("done")) {
      const reps = row.querySelector(".set-reps");
      if (reps && !reps.value) reps.value = reps.placeholder || "";
      const weight = row.querySelector(".set-weight");
      if (weight && weight.type !== "hidden" && !weight.value && weight.placeholder && weight.placeholder !== "kg") weight.value = weight.placeholder;
    }
    captureSession();
    const card = button.closest(".exercise-card"), all = Array.from(card.querySelectorAll(".set-done"));
    card.classList.toggle("complete", all.length > 0 && all.every(b => b.classList.contains("done")));
  }

  function saveWorkout() {
    captureSession();
    const draft = currentDraft();
    if (!draft) return;
    let anyLogged = false;
    for (const entry of draft.entries) for (const set of entry.sets) {
      if (num(set.reps,0) > 0) { set.done = true; anyLogged = true; }
      if (set.done) anyLogged = true;
    }
    if (!anyLogged) { toast("Logg minst ett sett før du lagrer økten."); return; }
    const workout = templateFor(sessionContext.key, sessionContext.phase);
    const record = {
      id:uid(), date:sessionContext.date, key:sessionContext.key, phase:sessionContext.phase,
      mode:"normal", schemaVersion:3, workoutName:workout.name, note:draft.note || "",
      entries:clone(draft.entries), savedAt:new Date().toISOString()
    };
    state.workouts.push(record);
    delete state.drafts[draftId(sessionContext)];
    state.lastManualWorkout = sessionContext.key;
    saveState();
    toast("Økten er lagret.");
    sessionContext = null;
    setTimeout(() => setTab("home"), 220);
  }

  function renderHistory() {
    const workouts = completedStrengthWorkouts();
    el("history-list").innerHTML = workouts.length ? workouts.map(historyRowHTML).join("") : `<div class="empty-state">Ingen økter å vise ennå.</div>`;
    const exercises = new Map();
    for (const workout of workouts) for (const entry of workout.entries || []) {
      if (!exercises.has(entry.exId)) exercises.set(entry.exId, entry.name || exerciseName(entry.exId));
    }
    const select = el("history-exercise");
    if (!exercises.size) {
      select.innerHTML = `<option value="">Ingen øvelser ennå</option>`;
      el("exercise-history").innerHTML = `<div class="empty-state">Øvelseshistorikk dukker opp etter første lagrede økt.</div>`;
      return;
    }
    const previous = select.value;
    select.innerHTML = [...exercises.entries()].sort((a,b) => a[1].localeCompare(b[1],"nb")).map(([id,name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
    if ([...exercises.keys()].includes(previous)) select.value = previous;
    renderExerciseTrend(select.value);
  }

  function exerciseName(id) {
    for (const ex of allExerciseCatalog().values()) if (ex.id === id) return ex.name;
    return id;
  }

  function renderExerciseTrend(exId) {
    const history = getHistoryForExercise(exId, "9999-12-31").slice(0,10).reverse();
    if (!history.length) { el("exercise-history").innerHTML = `<div class="empty-state">Ingen historikk.</div>`; return; }
    const points = history.map(row => {
      const done = (row.entry.sets || []).filter(s => s.done || num(s.reps,0)>0);
      const weights = done.map(s => num(s.weight)).filter(v => v !== null);
      const reps = done.map(s => num(s.reps)).filter(v => v !== null);
      return { date:row.workout.date, value:weights.length ? Math.max(...weights) : (reps.length ? Math.max(...reps) : 0), weighted:weights.length>0, reps:reps.length ? reps.join("/") : "–" };
    });
    const max = Math.max(...points.map(p => p.value), 1);
    el("exercise-history").innerHTML = points.map(p => `<div class="trend-row"><time>${shortDate(p.date)}</time><div class="trend-bar"><i style="width:${Math.max(5,p.value/max*100)}%"></i></div><span class="trend-value">${p.value}${p.weighted?" kg":" reps"}</span></div>`).join("");
  }

  function renderProgram() {
    el("program-phase").value = state.phase;
    renderRotation();
    el("template-list").innerHTML = strengthKeys.map(key => templateCardHTML(key)).join("");
  }

  function renderRotation() {
    const rotation = state.trainingRotation;
    el("rotation-list").innerHTML = strengthKeys.map(key => {
      const active = rotation.includes(key), position = rotation.indexOf(key);
      return `<div class="rotation-row"><span class="rotation-order">${active ? position+1 : "–"}</span><div><b>${esc(templateFor(key).name)}</b><div class="tiny muted">${active ? "Med i neste-økt-rotasjonen" : "Tilgjengelig manuelt"}</div></div><div class="rotation-actions">
        ${active ? `<button class="small-icon" type="button" data-rotation-move="up" data-key="${key}" aria-label="Flytt opp">↑</button><button class="small-icon" type="button" data-rotation-move="down" data-key="${key}" aria-label="Flytt ned">↓</button>` : ""}
        <button class="small-icon" type="button" data-rotation-toggle="${key}" aria-label="${active?"Fjern fra":"Legg til i"} rotasjon">${active?"−":"＋"}</button>
      </div></div>`;
    }).join("");
  }

  function templateCardHTML(key) {
    const workout = templateFor(key), active = state.trainingRotation.includes(key), open = programOpenKey === key;
    return `<article class="template-card" data-template-key="${key}">
      <div class="template-summary" data-template-open="${key}">
        <div><h3>${esc(workout.name)}</h3><small>${(workout.main||[]).length} øvelser · ${esc(workout.duration || "")}</small></div>
        <div class="template-tools"><button class="rotation-toggle ${active?"on":""}" type="button" data-rotation-toggle="${key}">${active?"I rotasjon":"Ikke i rotasjon"}</button><span>${open?"⌃":"⌄"}</span></div>
      </div>
      ${open ? `<div class="template-body">
        ${(workout.main||[]).map((ex,i) => `<div class="template-exercise"><span class="order">${String(i+1).padStart(2,"0")}</span><div><b>${esc(ex.name)}</b><small>${esc(repLabel(ex))}</small></div><button class="template-edit" type="button" data-edit-template="${key}" data-ex-index="${i}" aria-label="Rediger ${esc(ex.name)}">•••</button></div>`).join("")}
        <div class="template-footer"><button class="btn btn-dark" type="button" data-add-template="${key}">＋ Øvelse</button><button class="btn btn-dark" type="button" data-rename-template="${key}">Gi nytt navn</button></div>
        <button class="danger-btn" type="button" data-reset-template="${key}">Tilbakestill denne malen</button>
      </div>` : ""}
    </article>`;
  }

  function toggleRotation(key) {
    const rotation = state.trainingRotation;
    if (rotation.includes(key)) {
      if (rotation.length === 1) { toast("Minst én økt må være i rotasjonen."); return; }
      state.trainingRotation = rotation.filter(k => k !== key);
    } else state.trainingRotation.push(key);
    saveState(); renderProgram(); renderHome();
  }

  function moveRotation(key, direction) {
    const rotation = [...state.trainingRotation], index = rotation.indexOf(key);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rotation.length) return;
    [rotation[index], rotation[target]] = [rotation[target], rotation[index]];
    state.trainingRotation = rotation;
    saveState(); renderProgram(); renderHome();
  }

  function openExerciseEditor({ context, key, index = -1, session = false }) {
    let exercise = null;
    if (session) exercise = index >= 0 ? currentDraft().sessionExercises[index] : null;
    else exercise = index >= 0 ? templateFor(key).main[index] : null;
    editorState = { context, key, index, session, original:exercise ? clone(exercise) : null };
    el("editor-context").value = context;
    el("editor-index").value = index;
    el("editor-kicker").textContent = index >= 0 ? "REDIGER ØVELSE" : "NY ØVELSE";
    el("editor-title").textContent = exercise?.name || "Legg til øvelse";
    el("editor-name").value = exercise?.name || "";
    el("editor-sets").value = exercise?.sets || 3;
    el("editor-repmin").value = exercise?.repMin || 8;
    el("editor-repmax").value = exercise?.repMax || 10;
    el("editor-weight").checked = exercise?.weight !== false;
    el("editor-session-actions").classList.toggle("hidden", !session);
    el("editor-template-actions").classList.toggle("hidden", session);
    el("editor-remove").classList.toggle("hidden", index < 0);
    el("exercise-suggestions").innerHTML = [...allExerciseCatalog().values()].sort((a,b)=>a.name.localeCompare(b.name,"nb")).map(ex => `<option value="${esc(ex.name)}"></option>`).join("");
    el("exercise-editor").classList.remove("hidden");
    setTimeout(() => el("editor-name").focus(), 120);
  }

  function editorExercise() {
    const name = el("editor-name").value.trim();
    if (!name) { toast("Gi øvelsen et navn."); return null; }
    const sets = Math.max(1, Math.min(10, num(el("editor-sets").value,3)));
    const repMin = Math.max(1, num(el("editor-repmin").value,8));
    const repMax = Math.max(repMin, num(el("editor-repmax").value,repMin));
    const ex = resolveExercise(name, editorState.original);
    return { ...ex, name, sets, repMin, repMax, weight:el("editor-weight").checked, unit:ex.unit || "reps" };
  }

  function applyEditorToSession(permanent) {
    const ex = editorExercise(); if (!ex) return;
    const draft = currentDraft(), index = editorState.index;
    if (index >= 0) draft.sessionExercises[index] = ex; else draft.sessionExercises.push(ex);
    if (permanent) {
      const template = templateFor(sessionContext.key, sessionContext.phase);
      if (index >= 0) {
        const originalId = editorState.original?.id;
        const templateIndex = originalId ? template.main.findIndex(item => item.id === originalId) : -1;
        if (templateIndex >= 0) template.main[templateIndex] = clone(ex);
        else template.main.push(clone(ex));
      } else template.main.push(clone(ex));
      state.customTemplates[sessionContext.phase][sessionContext.key] = template;
    }
    syncDraftEntries(draft);
    saveState(); closeSheets(); renderSession();
    toast(permanent ? "Øktmalen er oppdatert." : "Endret kun for denne økten.");
  }

  function applyEditorToTemplate() {
    const ex = editorExercise(); if (!ex) return;
    const template = templateFor(editorState.key, state.phase), index = editorState.index;
    if (index >= 0) template.main[index] = ex; else template.main.push(ex);
    state.customTemplates[state.phase][editorState.key] = template;
    saveState(); closeSheets(); renderProgram(); renderHome();
    toast("Øktmalen er oppdatert.");
  }

  function removeEditedExercise() {
    if (!editorState || editorState.index < 0) return;
    if (editorState.session) {
      const draft = currentDraft();
      draft.sessionExercises.splice(editorState.index,1);
      syncDraftEntries(draft);
      saveState(); closeSheets(); renderSession(); toast("Fjernet fra dagens økt.");
    } else {
      const template = templateFor(editorState.key, state.phase);
      template.main.splice(editorState.index,1);
      state.customTemplates[state.phase][editorState.key] = template;
      saveState(); closeSheets(); renderProgram(); renderHome(); toast("Øvelsen er fjernet fra malen.");
    }
  }

  function resetTemplate(key) {
    if (!confirm("Tilbakestille denne øktmalen? Treningshistorikken slettes ikke.")) return;
    state.customTemplates[state.phase][key] = defaultTemplate(state.phase, key);
    saveState(); renderProgram(); renderHome(); toast("Malen er tilbakestilt.");
  }

  function renameTemplate(key) {
    const template = templateFor(key), name = prompt("Nytt navn på økten:", template.name);
    if (!name?.trim()) return;
    template.name = name.trim();
    state.customTemplates[state.phase][key] = template;
    saveState(); renderProgram(); renderHome();
  }

  function download(text, filename, type="application/json") {
    const blob = new Blob([text], {type});
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportData() {
    const payload = { app:"Prosjekt 2026", format:"p2026-v3", exportedAt:new Date().toISOString(), state };
    download(JSON.stringify(payload,null,2), `prosjekt-2026-backup-${todayISO()}.json`);
    toast("Backup lastet ned.");
  }

  function exportRecovery() {
    const raw = repository.recovery();
    if (!raw) { toast("Ingen lokal gjenopprettingskopi finnes ennå."); return; }
    download(raw, `prosjekt-2026-recovery-${todayISO()}.json`);
  }

  function mergeWithUi(current, incoming) {
    const merged = C.mergeState(current, incoming);
    // Training history is merged additively by core. Program preferences from the
    // imported backup are intentionally restored as a unit.
    if (incoming.customTemplates) merged.customTemplates = clone(incoming.customTemplates);
    if (Array.isArray(incoming.trainingRotation)) merged.trainingRotation = clone(incoming.trainingRotation);
    return merged;
  }

  async function importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text, (key,value) => {
        if (["__proto__","prototype","constructor"].includes(key)) throw Error("Ugyldig nøkkel i backup.");
        return value;
      });
      const incoming = C.isLegacyV2Backup(parsed) ? C.convertLegacyV2Backup(parsed) : C.normalizeState(parsed.state || parsed);
      const replace = el("import-mode").value === "replace";
      if (replace) {
        if (!confirm("Erstatte alle lokale data med denne backupen? En lokal gjenopprettingskopi lages først.")) return;
        if (!repository.replace(incoming)) throw Error(repository.error || "Kunne ikke gjenopprette backup.");
        state = incoming;
      } else {
        state = mergeWithUi(state, incoming);
        if (!saveState()) throw Error(repository.error || "Kunne ikke lagre importerte data.");
      }
      ensureUiState(); sessionContext = null; closeSheets(); renderAll(); toast("Backup importert.");
    } catch (error) {
      alert(`Import avbrutt: ${error.message}`);
    } finally { el("import-data").value = ""; }
  }

  function resetData() {
    if (!confirm("Nullstille alle Prosjekt 2026-data på denne enheten? Ta backup først hvis du vil beholde historikken.")) return;
    const fresh = C.defaultState();
    if (!repository.replace(fresh)) { alert(repository.error || "Kunne ikke nullstille data."); return; }
    state = fresh; ensureUiState(); sessionContext = null; closeSheets(); renderAll(); toast("Appdata er nullstilt.");
  }

  function renderAll() {
    renderHome();
    if (currentTab === "session" && sessionContext) renderSession();
    if (currentTab === "history") renderHistory();
    if (currentTab === "program") renderProgram();
  }

  function bindEvents() {
    document.addEventListener("click", event => {
      const tab = event.target.closest("[data-tab]");
      if (tab) { setTab(tab.dataset.tab); return; }
      const pick = event.target.closest("[data-pick-workout]");
      if (pick) { closeSheets(); startSession(pick.dataset.pickWorkout); return; }
      const done = event.target.closest(".set-done");
      if (done) { toggleSet(done); return; }
      const feel = event.target.closest(".feel-btn");
      if (feel) {
        const group = feel.closest(".feel-group"); group.querySelectorAll(".feel-btn").forEach(b => b.classList.remove("active")); feel.classList.add("active"); captureSession(); return;
      }
      const editSession = event.target.closest("[data-edit-session]");
      if (editSession) { openExerciseEditor({context:"session",key:sessionContext.key,index:Number(editSession.dataset.editSession),session:true}); return; }
      const openTemplate = event.target.closest("[data-template-open]");
      if (openTemplate && !event.target.closest("button")) { programOpenKey = programOpenKey === openTemplate.dataset.templateOpen ? null : openTemplate.dataset.templateOpen; renderProgram(); return; }
      const editTemplate = event.target.closest("[data-edit-template]");
      if (editTemplate) { openExerciseEditor({context:"template",key:editTemplate.dataset.editTemplate,index:Number(editTemplate.dataset.exIndex),session:false}); return; }
      const addTemplate = event.target.closest("[data-add-template]");
      if (addTemplate) { openExerciseEditor({context:"template",key:addTemplate.dataset.addTemplate,index:-1,session:false}); return; }
      const toggle = event.target.closest("[data-rotation-toggle]");
      if (toggle) { event.stopPropagation(); toggleRotation(toggle.dataset.rotationToggle); return; }
      const move = event.target.closest("[data-rotation-move]");
      if (move) { moveRotation(move.dataset.key, move.dataset.rotationMove); return; }
      const reset = event.target.closest("[data-reset-template]");
      if (reset) { resetTemplate(reset.dataset.resetTemplate); return; }
      const rename = event.target.closest("[data-rename-template]");
      if (rename) { renameTemplate(rename.dataset.renameTemplate); return; }
    });

    el("start-next").onclick = () => startSession(nextWorkoutKey());
    el("choose-workout").onclick = showWorkoutPicker;
    qsa(".close-sheet").forEach(btn => btn.onclick = closeSheets);
    qsa(".close-editor").forEach(btn => btn.onclick = closeSheets);
    qsa(".sheet-backdrop").forEach(backdrop => backdrop.addEventListener("click", e => { if (e.target === backdrop) closeSheets(); }));

    el("exit-session").onclick = () => { captureSession(); setTab("home"); };
    el("session-workout").onchange = e => { captureSession(); startSession(e.target.value, el("session-date").value, false); };
    el("session-date").onchange = e => { captureSession(); sessionContext.date = e.target.value || todayISO(); ensureSessionDraft(sessionContext); renderSession(); };
    el("session-exercises").addEventListener("input", e => { if (e.target.matches("input,select,textarea")) captureSession(); });
    el("session-exercises").addEventListener("change", e => { if (e.target.matches("input,select,textarea")) captureSession(); });
    el("session-note").addEventListener("input", captureSession);
    el("add-session-exercise").onclick = () => openExerciseEditor({context:"session",key:sessionContext.key,index:-1,session:true});
    el("save-workout").onclick = saveWorkout;

    el("history-exercise").onchange = e => renderExerciseTrend(e.target.value);
    el("program-phase").onchange = e => { state.phase = e.target.value; saveState(); sessionContext = null; renderProgram(); renderHome(); };

    el("editor-save-session").onclick = () => applyEditorToSession(false);
    el("editor-save-template").onclick = () => applyEditorToSession(true);
    el("editor-save-template-only").onclick = applyEditorToTemplate;
    el("editor-remove").onclick = removeEditedExercise;

    el("open-settings").onclick = () => el("settings-sheet").classList.remove("hidden");
    el("close-settings").onclick = closeSheets;
    el("export-data").onclick = exportData;
    el("recovery-export").onclick = exportRecovery;
    el("import-data").onchange = e => importData(e.target.files?.[0]);
    el("reset-data").onclick = resetData;

    window.addEventListener("storage", e => {
      if (e.key === C.STORE_KEY) {
        el("storage-warning").textContent = "Data ble endret i en annen fane. Last appen på nytt før du fortsetter å logge.";
        el("storage-warning").classList.remove("hidden");
      }
    });
  }

  window.P2026BeforeUpdate = () => {
    try { if (sessionContext) captureSession(); return !repository.error; }
    catch (_) { return false; }
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    const requested = new URL(location.href).searchParams.get("tab");
    setTab(["home","session","history","program"].includes(requested) ? requested : "home");
  });
})();

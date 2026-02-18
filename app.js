(() => {
  "use strict";

  const P = "p2026_";
  const ALT_KEYS = new Set(["FOOTBALL", "CARDIO", "OTHER", "MOBILITY", "CUSTOM"]);
  const DAY_NAMES = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const MAX_WEIGHT = 500;

  const el = (id) => document.getElementById(id);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));
  const safeParse = (raw, fb = null) => { try { return JSON.parse(raw); } catch { return fb; } };
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const nice = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const feelEmoji = (f) => f === "easy" ? "🙂" : f === "ok" ? "😐" : f === "hard" ? "🙁" : "";
  const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const keyDraft = (dayIso) => `${P}draft_${dayIso}`;
  const keyDay = (dayIso) => `${P}day_${dayIso}`;
  const keySel = (dayIso) => `${P}selectedWorkout_${dayIso}`;
  const keyPhase = () => `${P}phase`;
  const keyWeekGoal = () => `${P}weekGoal`;
  const keyLastMeta = (exId) => `${P}lastMeta_${exId}`;
  const keyLastWeight = (exId) => `${P}lastWeight_${exId}`;

  const loadDraft = (dayIso) => safeParse(localStorage.getItem(keyDraft(dayIso)), null);
  const ensureDraft = (dayIso) => loadDraft(dayIso) || { date: dayIso, workoutKey: null, entries: {}, altNote: "" };
  const saveDraft = (dayIso, draft) => localStorage.setItem(keyDraft(dayIso), JSON.stringify(draft));
  const setStatus = (text) => { const s = el("status-message"); if (s) s.textContent = text; };

  function trimStorage(days = 180) {
    const now = new Date(isoLocal(new Date()));
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${P}day_`) || k.startsWith(`${P}draft_`))
      .forEach((k) => {
        const dateStr = k.split("_").pop();
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) {
          const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
          if (diff > days) localStorage.removeItem(k);
        }
      });
  }

  const phase1Workouts = {
    W1: {
      name: "Økt 1 – Overkropp", typeTag: "Overkropp", note: "Oppbygging. Fokus: teknikk + skulderstabilitet.",
      warmup: ["Armcircles 20 sek", "Face pulls 20 reps", "Strikk pull-aparts 20 reps"],
      main: [
        { id: "row_seated", name: "Sittende roing", setsReps: "3×10", trackWeight: true },
        { id: "bench_press", name: "Benkpress / Pushups", setsReps: "3×8", trackWeight: true },
        { id: "arnold_press", name: "Arnold press", setsReps: "3×10", trackWeight: true },
        { id: "one_arm_row", name: "Enarms roing", setsReps: "3×12", trackWeight: true },
        { id: "incline_db_press", name: "Incline dumbbell press", setsReps: "3×10", trackWeight: true }
      ],
      extra: ["External rotations 3×12", "Face pulls 3×12"]
    },
    W2: {
      name: "Økt 2 – Underkropp + Akilles", typeTag: "Underkropp", note: "Oppbygging. Fokus: tåle fotball.",
      warmup: ["2 min rask gange / sykkel", "Lett ankelmobilisering", "10 tåhev"],
      main: [
        { id: "goblet_squat", name: "Goblet squat", setsReps: "3×10", trackWeight: true },
        { id: "rdl", name: "Rumensk markløft", setsReps: "3×10", trackWeight: true },
        { id: "hip_thrust", name: "Hip thrust", setsReps: "3×10", trackWeight: true },
        { id: "stepups", name: "Step-ups", setsReps: "3×10", trackWeight: true },
        { id: "leg_curl", name: "Leg curl", setsReps: "3×12", trackWeight: true }
      ],
      extra: ["Eksentrisk tåhev 3×10", "Balanse på én fot 2×45 sek"]
    },
    W3: {
      name: "Økt 3 – Fullkropp", typeTag: "Fullkropp", note: "All-round styrke + kjerne.",
      warmup: ["Cat/Cow", "Hoftecirkler"],
      main: [
        { id: "pulldown", name: "Pull-down / Pullups", setsReps: "3×8", trackWeight: true },
        { id: "leg_press", name: "Benpress", setsReps: "3×10", trackWeight: true },
        { id: "shoulder_press", name: "Skulderpress", setsReps: "3×10", trackWeight: true },
        { id: "kb_deadlift", name: "Kettlebell deadlift", setsReps: "3×12", trackWeight: true },
        { id: "pallof", name: "Pallof press", setsReps: "3×12", trackWeight: false },
        { id: "plank", name: "Planke", setsReps: "3×45 sek", trackWeight: false }
      ],
      extra: ["Ryggrotasjoner", "Hofteåpner"]
    },
    W4: {
      name: "Økt 4 – Stabilitet + Lett styrke", typeTag: "Stabilitet", note: "Buffer-økt. Robust kropp og sener.",
      warmup: ["Lett goblet squat", "Ankelmobilitet"],
      main: [
        { id: "bulgarian", name: "Bulgarsk split squat", setsReps: "3×8", trackWeight: true },
        { id: "landmine_press", name: "Landmine press", setsReps: "3×8", trackWeight: true },
        { id: "cable_row", name: "Sittende kabelroing", setsReps: "3×12", trackWeight: true },
        { id: "ham_curl", name: "Hamstring curl", setsReps: "3×10", trackWeight: true },
        { id: "farmers", name: "Farmers carry", setsReps: "2×40 m", trackWeight: false }
      ],
      extra: ["Akilles eksentrisk 3×10", "Core dead bug 3×10"]
    },
    REST: { name: "Hviledag / mobilitet", typeTag: "Hvile", note: "Rolig aktivitet, lett mobilitet.", warmup: [], main: [], extra: ["10–30 min rolig gåtur", "Lett mobilitet"] }
  };

  const phase2Workouts = {
    W1: { ...phase1Workouts.W1, name: "Økt 1 – Overkropp (Fase 2)", main: [{ id: "row_seated", name: "Sittende roing", setsReps: "4×8", trackWeight: true }, { id: "bench_press", name: "Benkpress / Pushups", setsReps: "4×6-8", trackWeight: true }, { id: "arnold_press", name: "Arnold press", setsReps: "3×8-10", trackWeight: true }, { id: "one_arm_row", name: "Enarms roing", setsReps: "3×10", trackWeight: true }, { id: "incline_db_press", name: "Incline dumbbell press", setsReps: "3×8", trackWeight: true }] },
    W2: { ...phase1Workouts.W2, name: "Økt 2 – Underkropp + Akilles (Fase 2)", main: [{ id: "goblet_squat", name: "Front squat / Goblet squat", setsReps: "4×6-8", trackWeight: true }, { id: "rdl", name: "Rumensk markløft", setsReps: "4×8", trackWeight: true }, { id: "hip_thrust", name: "Hip thrust", setsReps: "3×8", trackWeight: true }, { id: "stepups", name: "Step-ups", setsReps: "3×8", trackWeight: true }, { id: "leg_curl", name: "Leg curl", setsReps: "3×10", trackWeight: true }] },
    W3: { ...phase1Workouts.W3, name: "Økt 3 – Fullkropp (Fase 2)", main: [{ id: "pulldown", name: "Pull-down / Pullups", setsReps: "4×6-8", trackWeight: true }, { id: "leg_press", name: "Benpress", setsReps: "3×10", trackWeight: true }, { id: "shoulder_press", name: "Skulderpress", setsReps: "3×8", trackWeight: true }, { id: "trapbar_deadlift", name: "Trap bar / Markløft", setsReps: "4×5", trackWeight: true }, { id: "pallof", name: "Pallof press", setsReps: "3×12", trackWeight: false }, { id: "plank", name: "Planke", setsReps: "3×45-60 sek", trackWeight: false }] },
    W4: { ...phase1Workouts.W4, name: "Økt 4 – Stabilitet + Lett styrke (Fase 2)" },
    REST: phase1Workouts.REST
  };

  const phases = {
    phase1: { name: "Fase 1 – Oppbygging", workouts: phase1Workouts },
    phase2: { name: "Fase 2 – Fotballklar", workouts: phase2Workouts }
  };

  const altWorkouts = {
    FOOTBALL: { name: "⚽ Fotball", typeTag: "Fotball", note: "Valgfri notat. Teller som treningsdag." },
    CARDIO: { name: "🏃 Kondisjon", typeTag: "Kondisjon", note: "Valgfri notat. Teller som treningsdag." },
    OTHER: { name: "🏋️ Annen styrke", typeTag: "Annen styrke", note: "Valgfri notat. Teller som treningsdag." },
    MOBILITY: { name: "🧘 Mobilitet / restitusjon", typeTag: "Mobilitet", note: "Rolig dag som kan telle i planen." },
    CUSTOM: { name: "📝 Egendefinert", typeTag: "Egendefinert", note: "Valgfri notat. Teller som treningsdag." }
  };

  const getPhaseKey = () => (phases[localStorage.getItem(keyPhase())] ? localStorage.getItem(keyPhase()) : "phase1");
  const setPhaseKey = (key) => { if (phases[key]) localStorage.setItem(keyPhase(), key); };
  const validWeight = (v) => typeof v === "number" && !Number.isNaN(v) && v > 0 && v <= MAX_WEIGHT;

  function getWeekGoal() {
    const v = Number(localStorage.getItem(keyWeekGoal()));
    return Number.isFinite(v) && v >= 1 && v <= 7 ? Math.round(v) : 4;
  }

  function setWeekGoal(v) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1 && n <= 7) {
      localStorage.setItem(keyWeekGoal(), String(Math.round(n)));
      return true;
    }
    return false;
  }

  function setHeader() {
    const now = new Date();
    if (el("today-date")) el("today-date").textContent = nice(now);
    if (el("today-label")) el("today-label").textContent = `${DAY_NAMES[now.getDay()]} – dagens økt`;
    if (el("phase-label")) el("phase-label").textContent = phases[getPhaseKey()].name;
  }

  function bindPhaseSelect() {
    const s = el("phase-select");
    if (!s) return;
    s.value = getPhaseKey();
    s.addEventListener("change", (e) => {
      setPhaseKey(e.target.value);
      refreshAll();
      setStatus("Fase oppdatert uten reload.");
    });
  }

  function renderAlt(dayIso, key) {
    const w = altWorkouts[key];
    if (el("workout-name")) el("workout-name").textContent = w.name;
    if (el("workout-note")) el("workout-note").textContent = w.note;
    if (el("tag-daytype")) el("tag-daytype").textContent = w.typeTag;
    if (el("alt-workout-wrap")) el("alt-workout-wrap").style.display = "block";
    if (el("btn-save-draft")) el("btn-save-draft").style.display = "none";
    if (el("exercise-list")) el("exercise-list").innerHTML = "";

    const d = ensureDraft(dayIso);
    d.workoutKey = key;
    saveDraft(dayIso, d);

    const noteEl = el("alt-workout-note");
    if (noteEl) noteEl.value = d.altNote || "";
    if (noteEl) {
      noteEl.oninput = () => {
        const dd = ensureDraft(dayIso);
        dd.workoutKey = key;
        dd.altNote = noteEl.value || "";
        saveDraft(dayIso, dd);
      };
    }

    const btn = el("btn-save-draft-alt");
    if (btn) {
      btn.onclick = () => {
        const dd = ensureDraft(dayIso);
        dd.workoutKey = key;
        dd.altNote = noteEl ? noteEl.value || "" : "";
        saveDraft(dayIso, dd);
        setStatus("Alternativ økt lagret.");
      };
    }
  }

  function renderStrength(dayIso, workouts, key) {
    const w = workouts[key] || workouts.REST;

    if (el("workout-name")) el("workout-name").textContent = w.name || "Økt";
    if (el("workout-note")) el("workout-note").textContent = w.note || "";
    if (el("tag-daytype")) el("tag-daytype").textContent = w.typeTag || "";
    if (el("alt-workout-wrap")) el("alt-workout-wrap").style.display = "none";
    if (el("btn-save-draft")) el("btn-save-draft").style.display = "";

    const list = el("exercise-list");
    if (!list) return;

    let html = "";

    if (w.warmup?.length) {
      html += '<li class="exercise-section-title">Oppvarming</li>';
      w.warmup.forEach((x) => { html += `<li class="exercise-item">${esc(x)}</li>`; });
    }

    if (w.main?.length) {
      html += '<li class="exercise-section-title">Hovedøvelser</li>';
      w.main.forEach((ex) => {
        const last = safeParse(localStorage.getItem(keyLastMeta(ex.id)), null);
        const lastText = [
          typeof last?.weight === "number" ? `${last.weight} kg` : null,
          last?.feel ? feelEmoji(last.feel) : null,
          last?.note ? `"${esc(last.note)}"` : null
        ].filter(Boolean).join(" ") || "ingen registrert";

        const weightBlock = ex.trackWeight
          ? `<div class="ex-weight-block"><label>Vekt i dag (kg): <input type="number" step="0.5" min="0" max="${MAX_WEIGHT}" data-ex-id="${ex.id}"></label><div class="ex-last">Sist gang: <span>${lastText}</span></div><div class="ex-error" id="err-${ex.id}"></div></div>`
          : `<div class="ex-last">Sist gang: <span>${lastText}</span></div>`;

        html += `<li class="exercise-item"><div class="ex-main-line"><span>${esc(ex.name)}</span><span class="ex-sets">${esc(ex.setsReps)}</span></div>${weightBlock}<div class="feel-row"><button class="feel-btn" type="button" data-feel="easy" data-ex-feel="${ex.id}">🙂</button><button class="feel-btn" type="button" data-feel="ok" data-ex-feel="${ex.id}">😐</button><button class="feel-btn" type="button" data-feel="hard" data-ex-feel="${ex.id}">🙁</button><span class="muted" style="font-size:0.8rem;">Følelse</span></div><textarea class="ex-note" rows="2" placeholder="Notat (valgfritt)" data-ex-note="${ex.id}"></textarea></li>`;
      });
    }

    if (w.extra?.length) {
      html += '<li class="exercise-section-title">Til slutt / prehab</li>';
      w.extra.forEach((x) => { html += `<li class="exercise-item">${esc(x)}</li>`; });
    }

    list.innerHTML = html;

    hydrateDraft(dayIso, key);

    const btn = el("btn-save-draft");
    if (btn) btn.onclick = () => { pullUIToDraft(dayIso, key); setStatus("Økt lagret (mellomlagring)."); };
  }

  function hydrateDraft(dayIso, workoutKey) {
    const d = ensureDraft(dayIso);
    d.workoutKey = workoutKey;
    d.entries = d.entries || {};
    saveDraft(dayIso, d);

    qsa('input[data-ex-id]').forEach((inp) => {
      const exId = inp.dataset.exId;
      const entry = d.entries[exId] || {};

      if (validWeight(entry.weight)) {
        inp.value = String(entry.weight);
      } else {
        const lw = Number(localStorage.getItem(keyLastWeight(exId)));
        if (validWeight(lw)) inp.placeholder = String(lw);
      }

      inp.addEventListener("input", () => {
        const dd = ensureDraft(dayIso);
        const err = el(`err-${exId}`);
        dd.workoutKey = workoutKey;
        dd.entries = dd.entries || {};
        dd.entries[exId] = dd.entries[exId] || {};

        const v = parseFloat(inp.value);
        if (inp.value && !validWeight(v)) {
          dd.entries[exId].weight = null;
          if (err) err.textContent = `Bruk en verdi mellom 0.5 og ${MAX_WEIGHT} kg.`;
        } else {
          dd.entries[exId].weight = validWeight(v) ? v : null;
          if (err) err.textContent = "";
        }
        saveDraft(dayIso, dd);
      });
    });

    qsa('textarea[data-ex-note]').forEach((area) => {
      const exId = area.dataset.exNote;
      const entry = d.entries[exId] || {};
      if (typeof entry.note === "string") area.value = entry.note;
      area.addEventListener("input", () => {
        const dd = ensureDraft(dayIso);
        dd.workoutKey = workoutKey;
        dd.entries = dd.entries || {};
        dd.entries[exId] = dd.entries[exId] || {};
        dd.entries[exId].note = area.value || "";
        saveDraft(dayIso, dd);
      });
    });

    qsa('button[data-ex-feel]').forEach((btn) => {
      const exId = btn.dataset.exFeel;
      btn.addEventListener("click", () => {
        const feel = btn.dataset.feel;
        qsa(`button[data-ex-feel="${exId}"]`).forEach((b) => b.classList.toggle("active", b.dataset.feel === feel));
        const dd = ensureDraft(dayIso);
        dd.workoutKey = workoutKey;
        dd.entries = dd.entries || {};
        dd.entries[exId] = dd.entries[exId] || {};
        dd.entries[exId].feel = feel;
        saveDraft(dayIso, dd);
      });
    });

    Object.entries(d.entries).forEach(([exId, entry]) => {
      if (!entry?.feel) return;
      qsa(`button[data-ex-feel="${exId}"]`).forEach((b) => b.classList.toggle("active", b.dataset.feel === entry.feel));
    });
  }

  function pullUIToDraft(dayIso, workoutKey) {
    const d = ensureDraft(dayIso);
    d.workoutKey = workoutKey;
    d.entries = d.entries || {};

    qsa('input[data-ex-id]').forEach((inp) => {
      const exId = inp.dataset.exId;
      const v = parseFloat(inp.value);
      d.entries[exId] = d.entries[exId] || {};
      d.entries[exId].weight = validWeight(v) ? v : null;
    });

    qsa('textarea[data-ex-note]').forEach((area) => {
      const exId = area.dataset.exNote;
      d.entries[exId] = d.entries[exId] || {};
      d.entries[exId].note = area.value || "";
    });

    saveDraft(dayIso, d);
  }

  function renderWorkoutForToday(workouts) {
    const dayIso = isoLocal(new Date());
    const sel = el("workout-select");
    if (!sel) return;

    const pref = loadDraft(dayIso)?.workoutKey || localStorage.getItem(keySel(dayIso)) || "W1";
    sel.value = pref;
    if (sel.value !== pref) sel.value = "W1";

    localStorage.setItem(keySel(dayIso), sel.value);

    const renderKey = sel.value;
    if (ALT_KEYS.has(renderKey)) renderAlt(dayIso, renderKey);
    else renderStrength(dayIso, workouts, renderKey);

    sel.onchange = (e) => {
      const key = e.target.value;
      localStorage.setItem(keySel(dayIso), key);
      const d2 = ensureDraft(dayIso);
      d2.workoutKey = key;
      saveDraft(dayIso, d2);
      if (ALT_KEYS.has(key)) renderAlt(dayIso, key);
      else renderStrength(dayIso, workouts, key);
    };
  }

  function recomputeStreakFromHistory() {
    const successDays = Object.keys(localStorage)
      .filter((k) => k.startsWith(`${P}day_`))
      .map((k) => safeParse(localStorage.getItem(k), null))
      .filter((d) => d?.success && typeof d.date === "string")
      .map((d) => d.date)
      .sort();

    if (!successDays.length) {
      localStorage.setItem(P + "streak", "0");
      localStorage.setItem(P + "bestStreak", "0");
      localStorage.removeItem(P + "lastSuccessDate");
      return;
    }

    let best = 1;
    let curRun = 1;
    for (let i = 1; i < successDays.length; i++) {
      const prev = new Date(successDays[i - 1]);
      const cur = new Date(successDays[i]);
      const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
      curRun = diff === 1 ? curRun + 1 : 1;
      if (curRun > best) best = curRun;
    }

    const today = isoLocal(new Date());
    let streakNow = 0;
    if (successDays[successDays.length - 1] === today) {
      streakNow = 1;
      for (let i = successDays.length - 1; i > 0; i--) {
        const cur = new Date(successDays[i]);
        const prev = new Date(successDays[i - 1]);
        const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
        if (diff === 1) streakNow += 1;
        else break;
      }
    }

    localStorage.setItem(P + "streak", String(streakNow));
    localStorage.setItem(P + "bestStreak", String(best));
    localStorage.setItem(P + "lastSuccessDate", successDays[successDays.length - 1]);
  }

  function loadStreakUI() {
    const cur = Number(localStorage.getItem(P + "streak")) || 0;
    const best = Number(localStorage.getItem(P + "bestStreak")) || 0;
    if (el("streakCurrent")) el("streakCurrent").textContent = String(cur);
    if (el("streakBest")) el("streakBest").textContent = String(best);
  }

  function renderGoalProgress(successCount) {
    const goal = getWeekGoal();
    const msg = `${successCount}/${goal} fullførte dager i målperioden`;
    if (el("goal-progress")) el("goal-progress").textContent = msg;
    const goalInput = el("weekly-goal");
    if (goalInput && goalInput.value !== String(goal)) goalInput.value = String(goal);
  }

  function renderWeek(workouts) {
    const box = el("week-grid");
    if (!box) return;
    box.innerHTML = "";

    let successCount = 0;
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayIso = isoLocal(d);

      let status = "◻";
      let wname = "Ingen økt registrert";

      const day = safeParse(localStorage.getItem(keyDay(dayIso)), null);
      if (day) {
        const wk = day.workoutKey;
        wname = ALT_KEYS.has(wk) ? (altWorkouts[wk]?.name || "Alternativ trening") : (workouts[wk]?.name || wk || "Økt");
        status = day.success ? "✅" : "⚠";
        if (day.success) successCount += 1;
      }

      const row = document.createElement("div");
      row.className = "day-row";
      row.innerHTML = `<div><div class="day-name">${DAY_NAMES[d.getDay()]} – ${nice(d)}</div><div class="day-workout">${esc(wname)}</div></div><div>${status}</div>`;
      box.appendChild(row);
    }

    if (el("weekSuccess")) el("weekSuccess").textContent = `${successCount}/7`;
    renderGoalProgress(successCount);
  }

  const diffDays = (aIso, bIso) => Math.round((new Date(aIso).getTime() - new Date(bIso).getTime()) / 86400000);

  function completeDay() {
    const dayIso = isoLocal(new Date());
    const workoutKey = el("workout-select")?.value || "W1";
    const draft = ensureDraft(dayIso);

    if (ALT_KEYS.has(workoutKey)) {
      draft.altNote = el("alt-workout-note")?.value || draft.altNote || "";
      draft.workoutKey = workoutKey;
      saveDraft(dayIso, draft);
    } else {
      pullUIToDraft(dayIso, workoutKey);
    }

    const ids = ["doneWorkout", "chkProtein", "chkWater", "chkStretch", "chkSleep"];
    const allChecked = ids.every((id) => el(id)?.checked);
    let streak = Number(localStorage.getItem(P + "streak")) || 0;
    let best = Number(localStorage.getItem(P + "bestStreak")) || 0;
    const lastDate = localStorage.getItem(P + "lastSuccessDate");

    if (allChecked) {
      if (lastDate) streak = diffDays(dayIso, lastDate) === 1 ? streak + 1 : 1;
      else streak = 1;
      localStorage.setItem(P + "lastSuccessDate", dayIso);
    } else {
      streak = 0;
    }

    if (streak > best) best = streak;
    localStorage.setItem(P + "streak", String(streak));
    localStorage.setItem(P + "bestStreak", String(best));

    const energy = Number(el("energyLevel")?.value);
    const pain = Number(el("painLevel")?.value);

    localStorage.setItem(keyDay(dayIso), JSON.stringify({
      date: dayIso,
      success: allChecked,
      workoutKey,
      energy: Number.isFinite(energy) && energy >= 1 && energy <= 5 ? energy : null,
      pain: Number.isFinite(pain) && pain >= 0 && pain <= 10 ? pain : null,
      draft
    }));

    if (!ALT_KEYS.has(workoutKey)) {
      const entries = draft.entries || {};
      Object.entries(entries).forEach(([exId, entry]) => {
        const hasWeight = validWeight(entry?.weight);
        const hasNote = typeof entry?.note === "string" && entry.note.trim().length > 0;
        const hasFeel = typeof entry?.feel === "string" && entry.feel.length > 0;
        if (hasWeight || hasNote || hasFeel) {
          localStorage.setItem(keyLastMeta(exId), JSON.stringify({ weight: hasWeight ? entry.weight : undefined, note: hasNote ? entry.note : "", feel: hasFeel ? entry.feel : "" }));
          if (hasWeight) localStorage.setItem(keyLastWeight(exId), String(entry.weight));
        }
      });
    }

    ids.forEach((id) => { if (el(id)) el(id).checked = false; });
    if (el("energyLevel")) el("energyLevel").value = "";
    if (el("painLevel")) el("painLevel").value = "";

    refreshAll();
    setStatus(allChecked ? "Nice! Dagen er fullført og streak oppdatert." : "Dagen er lagret, men streak ble nullstilt.");
  }

  function undoTodayCompletion() {
    const dayIso = isoLocal(new Date());
    if (!localStorage.getItem(keyDay(dayIso))) {
      setStatus("Ingen fullføring registrert i dag.");
      return;
    }
    localStorage.removeItem(keyDay(dayIso));
    recomputeStreakFromHistory();
    refreshAll();
    setStatus("Dagens fullføring er angret.");
  }

  function resetAll() {
    if (!confirm("Er du sikker på at du vil slette all progresjon og starte på nytt?")) return;
    Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k));
    refreshAll();
    setStatus("Alle Prosjekt 2026-data er nullstilt.");
  }

  function exportData() {
    const payload = {};
    Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => { payload[k] = localStorage.getItem(k); });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prosjekt2026-backup-${isoLocal(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Data eksportert.");
  }

  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      const data = safeParse(r.result, null);
      if (!data || typeof data !== "object") {
        setStatus("Import feilet: ugyldig JSON.");
        return;
      }
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith(P) && typeof v === "string") localStorage.setItem(k, v);
      });
      recomputeStreakFromHistory();
      refreshAll();
      setStatus("Data importert.");
    };
    r.readAsText(file);
  }

  function refreshAll() {
    setHeader();
    const phaseKey = getPhaseKey();
    const workouts = phases[phaseKey].workouts;
    renderWorkoutForToday(workouts);
    loadStreakUI();
    renderWeek(workouts);
  }

  document.addEventListener("DOMContentLoaded", () => {
    trimStorage(180);
    recomputeStreakFromHistory();
    setHeader();
    bindPhaseSelect();
    refreshAll();

    if (el("btn-complete")) el("btn-complete").addEventListener("click", completeDay);
    if (el("btn-undo-day")) el("btn-undo-day").addEventListener("click", undoTodayCompletion);
    if (el("btn-reset")) el("btn-reset").addEventListener("click", resetAll);
    if (el("btn-export")) el("btn-export").addEventListener("click", exportData);

    if (el("weekly-goal")) {
      el("weekly-goal").value = String(getWeekGoal());
      el("weekly-goal").addEventListener("change", (e) => {
        const ok = setWeekGoal(e.target.value);
        if (!ok) setStatus("Mål må være mellom 1 og 7.");
        else {
          refreshAll();
          setStatus("Ukesmål oppdatert.");
        }
      });
    }

    if (el("import-file")) {
      el("import-file").addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) importData(file);
        e.target.value = "";
      });
    }

    setStatus("Autosave er aktiv. Appen er klar.");
  });
})();

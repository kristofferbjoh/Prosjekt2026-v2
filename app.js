/* Prosjekt 2026 – app.js (stable, compact)
   Features:
   - Phase toggle: phase1 / phase2
   - Per-exercise: weight + note + feel 🙂😐🙁
   - Autosave drafts per day (no data loss if you exit)
   - Alternative training (football etc) counts as training day
*/

(() => {
  "use strict";

  const P = "p2026_";
  const ALT_KEYS = new Set(["FOOTBALL", "CARDIO", "OTHER", "MOBILITY", "CUSTOM"]);
  const DAY_NAMES = ["Søndag","Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag"];

  const el = (id) => document.getElementById(id);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const iso = (d) => d.toISOString().split("T")[0];
  const nice = (d) => `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  const safeParse = (raw, fb=null) => { try { return JSON.parse(raw); } catch { return fb; } };
  const feelEmoji = (f) => f==="easy" ? "🙂" : f==="ok" ? "😐" : f==="hard" ? "🙁" : "";
  const esc = (s) => String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const keyDraft = (dayIso) => `${P}draft_${dayIso}`;
  const keyDay = (dayIso) => `${P}day_${dayIso}`;
  const keySel = (dayIso) => `${P}selectedWorkout_${dayIso}`;
  const keyPhase = () => `${P}phase`;

  const loadDraft = (dayIso) => {
    const raw = localStorage.getItem(keyDraft(dayIso));
    return raw ? safeParse(raw, null) : null;
  };
  const ensureDraft = (dayIso) => loadDraft(dayIso) || { date: dayIso, workoutKey: null, entries: {}, altNote: "" };
  const saveDraft = (dayIso, d) => localStorage.setItem(keyDraft(dayIso), JSON.stringify(d));

  const lastMetaKey = (exId) => `${P}lastMeta_${exId}`;
  const lastWeightKey = (exId) => `${P}lastWeight_${exId}`;

  const getLastMeta = (exId) => {
    const raw = localStorage.getItem(lastMetaKey(exId));
    return raw ? safeParse(raw, null) : null;
  };
  const setLastMeta = (exId, meta) => {
    localStorage.setItem(lastMetaKey(exId), JSON.stringify(meta));
    if (typeof meta?.weight === "number") localStorage.setItem(lastWeightKey(exId), String(meta.weight));
  };

  // ---------------------------
  // Workouts (Phase 1 & 2)
  // ---------------------------
  const phase1Workouts = {
    W1: {
      name: "Økt 1 – Overkropp",
      typeTag: "Overkropp",
      note: "Oppbygging. Fokus: teknikk + skulderstabilitet.",
      warmup: [
        "Armcircles 20 sek",
        "Face pulls (veldig lett) 20 reps",
        "Strikk pull-aparts 20 reps"
      ],
      main: [
        { id:"row_seated", name:"Sittende roing", setsReps:"3×10", trackWeight:true },
        { id:"bench_press", name:"Benkpress / Pushups", setsReps:"3×8", trackWeight:true },
        { id:"arnold_press", name:"Arnold press", setsReps:"3×10", trackWeight:true },
        { id:"one_arm_row", name:"Enarms roing", setsReps:"3×12", trackWeight:true },
        { id:"incline_db_press", name:"Incline dumbbell press", setsReps:"3×10", trackWeight:true },
      ],
      extra: [
        "External rotations 3×12",
        "Face pulls 3×12",
        "Full-can raises 2×12"
      ]
    },
    W2: {
      name: "Økt 2 – Underkropp + Akilles",
      typeTag: "Underkropp",
      note: "Oppbygging. Fokus: tåle fotball.",
      warmup: [
        "2 min rask gange / sykkel",
        "Lett ankelmobilisering",
        "10 tåhev"
      ],
      main: [
        { id:"goblet_squat", name:"Goblet squat", setsReps:"3×10", trackWeight:true },
        { id:"rdl", name:"Rumensk markløft", setsReps:"3×10", trackWeight:true },
        { id:"hip_thrust", name:"Hip thrust", setsReps:"3×10", trackWeight:true },
        { id:"stepups", name:"Step-ups", setsReps:"3×10", trackWeight:true },
        { id:"leg_curl", name:"Leg curl (maskin)", setsReps:"3×12", trackWeight:true },
      ],
      extra: [
        "Eksentrisk tåhev 3×10",
        "Balanse på én fot 2×45 sek",
        "Lette hopp (hælen i gulvet) 2×20"
      ]
    },
    W3: {
      name: "Økt 3 – Fullkropp",
      typeTag: "Fullkropp",
      note: "Oppbygging. All-round styrke + kjerne.",
      warmup: [
        "Cat/Cow",
        "Hoftecirkler",
        "Lett skuldermobilitet"
      ],
      main: [
        { id:"pulldown", name:"Pull-down / Pullups", setsReps:"3×8", trackWeight:true },
        { id:"leg_press", name:"Benpress", setsReps:"3×10", trackWeight:true },
        { id:"shoulder_press", name:"Skulderpress", setsReps:"3×10", trackWeight:true },
        { id:"kb_deadlift", name:"Kettlebell deadlift", setsReps:"3×12", trackWeight:true },
        { id:"pallof", name:"Pallof press", setsReps:"3×12", trackWeight:false },
        { id:"plank", name:"Planke", setsReps:"3×45 sek", trackWeight:false },
      ],
      extra: [
        "Ryggrotasjoner",
        "Hofteåpner"
      ]
    },
    W4: {
      name: "Økt 4 – Stabilitet + Lett styrke",
      typeTag: "Stabilitet",
      note: "Buffer-økt. Robust kropp og sener.",
      warmup: [
        "Lett goblet squat",
        "Ankelmobilitet",
        "Skulderstabilisering"
      ],
      main: [
        { id:"bulgarian", name:"Bulgarsk split squat", setsReps:"3×8", trackWeight:true },
        { id:"landmine_press", name:"Landmine press", setsReps:"3×8", trackWeight:true },
        { id:"cable_row", name:"Sittende kabelroing", setsReps:"3×12", trackWeight:true },
        { id:"ham_curl", name:"Hamstring curl", setsReps:"3×10", trackWeight:true },
        { id:"farmers", name:"Farmers carry", setsReps:"2×40 m", trackWeight:false },
      ],
      extra: [
        "Akilles: eksentrisk 3×10",
        "Skulder: Y-raises 2×12",
        "Core: dead bug 3×10",
        "Ankel: strikk-eversion 2×12"
      ]
    },
    REST: {
      name: "Hviledag / mobilitet",
      typeTag: "Hvile",
      note: "Rolig aktivitet, lett mobilitet.",
      warmup: [],
      main: [],
      extra: ["10–30 min rolig gåtur", "Lett mobilitet (ankel/hofte/rygg)", "Kontor-strekk"]
    }
  };

  const phase2Workouts = {
    W1: {
      ...phase1Workouts.W1,
      name: "Økt 1 – Overkropp (Fase 2)",
      note: "Litt mer styrkefokus. Hold teknikk ren.",
      main: [
        { id:"row_seated", name:"Sittende roing", setsReps:"4×8", trackWeight:true },
        { id:"bench_press", name:"Benkpress / Pushups", setsReps:"4×6–8", trackWeight:true },
        { id:"arnold_press", name:"Arnold press", setsReps:"3×8–10", trackWeight:true },
        { id:"one_arm_row", name:"Enarms roing", setsReps:"3×10", trackWeight:true },
        { id:"incline_db_press", name:"Incline dumbbell press", setsReps:"3×8", trackWeight:true },
      ],
      extra: ["External rotations 3×12","Face pulls 3×15","Full-can raises 2×12"]
    },
    W2: {
      ...phase1Workouts.W2,
      name: "Økt 2 – Underkropp + Akilles (Fase 2)",
      note: "Mer bakside-kjede. Akilles styrer progresjon.",
      main: [
        { id:"goblet_squat", name:"Front squat / Goblet squat", setsReps:"4×6–8", trackWeight:true },
        { id:"rdl", name:"Rumensk markløft", setsReps:"4×8", trackWeight:true },
        { id:"hip_thrust", name:"Hip thrust", setsReps:"3×8", trackWeight:true },
        { id:"stepups", name:"Step-ups", setsReps:"3×8", trackWeight:true },
        { id:"leg_curl", name:"Leg curl (maskin)", setsReps:"3×10", trackWeight:true },
      ],
      extra: ["Eksentrisk tåhev 3×10","Soleus-tåhev (kne bøyd) 3×12","Balanse på én fot 2×45 sek"]
    },
    W3: {
      ...phase1Workouts.W3,
      name: "Økt 3 – Fullkropp (Fase 2)",
      note: "Mer atletisk: litt tyngre hinge.",
      main: [
        { id:"pulldown", name:"Pull-down / Pullups", setsReps:"4×6–8", trackWeight:true },
        { id:"leg_press", name:"Benpress", setsReps:"3×10", trackWeight:true },
        { id:"shoulder_press", name:"Skulderpress", setsReps:"3×8", trackWeight:true },
        { id:"trapbar_deadlift", name:"Trap bar / Markløft", setsReps:"4×5", trackWeight:true },
        { id:"pallof", name:"Pallof press", setsReps:"3×12", trackWeight:false },
        { id:"plank", name:"Planke", setsReps:"3×45–60 sek", trackWeight:false },
      ],
      extra: ["Ryggrotasjoner","Hofteåpner"]
    },
    W4: {
      ...phase1Workouts.W4,
      name: "Økt 4 – Stabilitet + Lett styrke (Fase 2)",
      note: "Behold buffer-økta. Den gjør deg konsistent."
    },
    REST: phase1Workouts.REST
  };

  const phases = {
    phase1: { name: "Fase 1 – Oppbygging", workouts: phase1Workouts },
    phase2: { name: "Fase 2 – Fotballklar", workouts: phase2Workouts }
  };

  const altWorkouts = {
    FOOTBALL: { name:"⚽ Fotball", typeTag:"Fotball", note:"Valgfri notat. Teller som treningsdag." },
    CARDIO:   { name:"🏃 Kondisjon", typeTag:"Kondisjon", note:"Valgfri notat. Teller som treningsdag." },
    OTHER:    { name:"🏋️ Annen styrke", typeTag:"Annen styrke", note:"Valgfri notat. Teller som treningsdag." },
    MOBILITY: { name:"🧘 Mobilitet / restitusjon", typeTag:"Mobilitet", note:"Valgfri notat. Teller som treningsdag hvis du vil." },
    CUSTOM:   { name:"📝 Egendefinert", typeTag:"Egendefinert", note:"Valgfri notat. Teller som treningsdag." }
  };

  function getPhaseKey() {
    const s = localStorage.getItem(keyPhase());
    return phases[s] ? s : "phase1";
  }
  function setPhaseKey(k) {
    if (phases[k]) localStorage.setItem(keyPhase(), k);
  }

  // ---------------------------
  // Rendering
  // ---------------------------
  function setHeader() {
    const d = new Date();
    if (el("today-date")) el("today-date").textContent = nice(d);
    if (el("today-label")) el("today-label").textContent = `${DAY_NAMES[d.getDay()]} – dagens økt`;
    const phaseLabel = el("phase-label");
    if (phaseLabel) phaseLabel.textContent = phases[getPhaseKey()].name;
  }

  function bindPhaseSelect() {
    const s = el("phase-select");
    if (!s) return;
    s.value = getPhaseKey();
    s.addEventListener("change", (e) => {
      setPhaseKey(e.target.value);
      location.reload();
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
        dd.altNote = noteEl ? (noteEl.value || "") : (dd.altNote || "");
        saveDraft(dayIso, dd);
        alert("Lagret (mellomlagring).");
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

    const warmup = w.warmup || [];
    const main = w.main || [];
    const extra = w.extra || [];

    if (warmup.length) {
      html += `<li class="exercise-section-title">Oppvarming</li>`;
      warmup.forEach(x => html += `<li class="exercise-item"><div>${esc(x)}</div></li>`);
    }

    if (main.length) {
      html += `<li class="exercise-section-title">Hovedøvelser</li>`;
      main.forEach(ex => {
        const last = getLastMeta(ex.id);
        const parts = [];
        if (last && typeof last.weight === "number") parts.push(`${last.weight} kg`);
        if (last?.feel) parts.push(feelEmoji(last.feel));
        if (last?.note) parts.push(`"${esc(last.note)}"`);
        const lastText = parts.length ? parts.join(" ") : "ingen registrert";

        const weightBlock = ex.trackWeight
          ? `<div class="ex-weight-block">
               <label>Vekt i dag (kg):
                 <input type="number" step="0.5" min="0" data-ex-id="${ex.id}" />
               </label>
               <div class="ex-last">Sist gang: <span id="last-${ex.id}">${lastText}</span></div>
             </div>`
          : `<div class="ex-last">Sist gang: <span id="last-${ex.id}">${lastText}</span></div>`;

        html += `
          <li class="exercise-item" data-ex-wrap="${ex.id}">
            <div class="ex-main-line">
              <span class="ex-name">${esc(ex.name)}</span>
              <span class="ex-sets">${esc(ex.setsReps)}</span>
            </div>
            ${weightBlock}

            <div class="feel-row" data-feel-row="${ex.id}">
              <button class="feel-btn" type="button" data-feel="easy" data-ex-feel="${ex.id}">🙂</button>
              <button class="feel-btn" type="button" data-feel="ok" data-ex-feel="${ex.id}">😐</button>
              <button class="feel-btn" type="button" data-feel="hard" data-ex-feel="${ex.id}">🙁</button>
              <span class="muted" style="font-size:0.8rem;">Følelse</span>
            </div>

            <div style="margin-top:8px;">
              <textarea class="ex-note" rows="2"
                placeholder="Notat (valgfritt): kroppsvekt / byttet øvelse / tempo / smerte osv."
                data-ex-note="${ex.id}"></textarea>
            </div>
          </li>`;
      });
    }

    if (extra.length) {
      html += `<li class="exercise-section-title">Til slutt / prehab</li>`;
      extra.forEach(x => html += `<li class="exercise-item"><div>${esc(x)}</div></li>`);
    }

    list.innerHTML = html;

    hydrateDraft(dayIso, key);

    const btn = el("btn-save-draft");
    if (btn) {
      btn.onclick = () => {
        pullUIToDraft(dayIso, key);
        alert("Lagret (mellomlagring).");
      };
    }
  }

  function hydrateDraft(dayIso, workoutKey) {
    const d = ensureDraft(dayIso);
    d.workoutKey = workoutKey;
    d.entries = d.entries || {};
    saveDraft(dayIso, d);

    // weights
    qsa('input[data-ex-id]').forEach(inp => {
      const exId = inp.dataset.exId;
      const entry = d.entries[exId] || {};
      if (typeof entry.weight === "number") inp.value = String(entry.weight);
      else {
        const lw = localStorage.getItem(lastWeightKey(exId));
        if (lw && !isNaN(Number(lw))) inp.placeholder = lw;
      }
      inp.addEventListener("input", () => {
        const dd = ensureDraft(dayIso);
        dd.workoutKey = workoutKey;
        dd.entries = dd.entries || {};
        dd.entries[exId] = dd.entries[exId] || {};
        const v = parseFloat(inp.value);
        dd.entries[exId].weight = (!isNaN(v) && v > 0) ? v : null;
        saveDraft(dayIso, dd);
      });
    });

    // notes
    qsa('textarea[data-ex-note]').forEach(area => {
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

    // feel buttons
    qsa('button[data-ex-feel]').forEach(btn => {
      const exId = btn.dataset.exFeel;
      btn.addEventListener("click", () => {
        const feel = btn.dataset.feel;
        qsa(`button[data-ex-feel="${exId}"]`).forEach(b => b.classList.toggle("active", b.dataset.feel === feel));
        const dd = ensureDraft(dayIso);
        dd.workoutKey = workoutKey;
        dd.entries = dd.entries || {};
        dd.entries[exId] = dd.entries[exId] || {};
        dd.entries[exId].feel = feel;
        saveDraft(dayIso, dd);
      });
    });

    // apply active state
    Object.entries(d.entries).forEach(([exId, entry]) => {
      if (!entry?.feel) return;
      qsa(`button[data-ex-feel="${exId}"]`).forEach(b => b.classList.toggle("active", b.dataset.feel === entry.feel));
    });
  }

  function pullUIToDraft(dayIso, workoutKey) {
    const d = ensureDraft(dayIso);
    d.workoutKey = workoutKey;
    d.entries = d.entries || {};

    qsa('input[data-ex-id]').forEach(inp => {
      const exId = inp.dataset.exId;
      const v = parseFloat(inp.value);
      d.entries[exId] = d.entries[exId] || {};
      d.entries[exId].weight = (!isNaN(v) && v > 0) ? v : d.entries[exId].weight ?? null;
    });

    qsa('textarea[data-ex-note]').forEach(area => {
      const exId = area.dataset.exNote;
      d.entries[exId] = d.entries[exId] || {};
      d.entries[exId].note = area.value || d.entries[exId].note || "";
    });

    saveDraft(dayIso, d);
  }

  // ---------------------------
  // Day selection / workout select
  // ---------------------------
  function renderWorkoutForToday(workouts) {
    const dayIso = iso(new Date());
    const sel = el("workout-select");
    if (!sel) return;

    // prefer draft workoutKey -> saved select -> default W1
    const d = loadDraft(dayIso);
    const saved = localStorage.getItem(keySel(dayIso));
    const pref = d?.workoutKey || saved || "W1";

    sel.value = pref;
    if (sel.value !== pref) sel.value = "W1";

    // persist
    localStorage.setItem(keySel(dayIso), sel.value);
    const dd = ensureDraft(dayIso);
    dd.workoutKey = sel.value;
    saveDraft(dayIso, dd);

    // render
    if (ALT_KEYS.has(sel.value)) renderAlt(dayIso, sel.value);
    else renderStrength(dayIso, workouts, sel.value);

    sel.addEventListener("change", (e) => {
      const key = e.target.value;
      localStorage.setItem(keySel(dayIso), key);
      const d2 = ensureDraft(dayIso);
      d2.workoutKey = key;
      saveDraft(dayIso, d2);

      if (ALT_KEYS.has(key)) renderAlt(dayIso, key);
      else renderStrength(dayIso, workouts, key);
    });
  }

  // ---------------------------
  // Streak + week view
  // ---------------------------
  function loadStreakUI() {
    const cur = Number(localStorage.getItem(P+"streak")) || 0;
    const best = Number(localStorage.getItem(P+"bestStreak")) || 0;
    if (el("streakCurrent")) el("streakCurrent").textContent = String(cur);
    if (el("streakBest")) el("streakBest").textContent = String(best);
  }

  function renderWeek(workouts) {
    const box = el("week-grid");
    if (!box) return;
    box.innerHTML = "";

    const today = new Date();
    for (let i=6; i>=0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayIso = iso(d);

      let status = "◻";
      let wname = "Ingen økt registrert";

      const raw = localStorage.getItem(keyDay(dayIso));
      if (raw) {
        const day = safeParse(raw, null);
        if (day) {
          const wk = day.workoutKey;
          if (ALT_KEYS.has(wk)) wname = altWorkouts[wk]?.name || "Alternativ trening";
          else wname = workouts[wk]?.name || wk || "Økt";
          status = day.success ? "✅" : "⚠";
        }
      }

      const row = document.createElement("div");
      row.className = "day-row";

      const main = document.createElement("div");
      main.className = "day-main";

      const nameEl = document.createElement("div");
      nameEl.className = "day-name";
      nameEl.textContent = `${DAY_NAMES[d.getDay()]} – ${nice(d)}`;

      const wkEl = document.createElement("div");
      wkEl.className = "day-workout";
      wkEl.textContent = wname;

      main.appendChild(nameEl);
      main.appendChild(wkEl);

      const st = document.createElement("div");
      st.className = "day-status";
      st.textContent = status;

      row.appendChild(main);
      row.appendChild(st);

      box.appendChild(row);
    }
  }


  // ---------------------------
  // Complete day (streak + history)
  // ---------------------------
  function diffDays(aIso, bIso) {
    const a = new Date(aIso);
    const b = new Date(bIso);
    const ms = a.getTime() - b.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  function completeDay() {
    const dayIso = iso(new Date());
    const sel = el("workout-select");
    const workoutKey = sel ? sel.value : "W1";

    // Ensure latest draft is saved from UI
    const d = ensureDraft(dayIso);

    if (ALT_KEYS.has(workoutKey)) {
      const noteEl = el("alt-workout-note");
      d.altNote = noteEl ? (noteEl.value || "") : (d.altNote || "");
      d.workoutKey = workoutKey;
      saveDraft(dayIso, d);
    } else {
      pullUIToDraft(dayIso, workoutKey);
    }

    // Checklist
    const ids = ["doneWorkout", "chkProtein", "chkWater", "chkStretch", "chkSleep"];
    const allChecked = ids.every(id => {
      const c = el(id);
      return c ? c.checked : false;
    });

    // Streak logic
    let streak = Number(localStorage.getItem(P + "streak")) || 0;
    let best = Number(localStorage.getItem(P + "bestStreak")) || 0;
    const lastDate = localStorage.getItem(P + "lastSuccessDate");

    if (allChecked) {
      if (lastDate) {
        const diff = diffDays(dayIso, lastDate);
        streak = (diff === 1) ? (streak + 1) : 1;
      } else {
        streak = 1;
      }
      localStorage.setItem(P + "lastSuccessDate", dayIso);
    } else {
      streak = 0;
    }

    if (streak > best) best = streak;
    localStorage.setItem(P + "streak", String(streak));
    localStorage.setItem(P + "bestStreak", String(best));

    // Save day snapshot (history)
    const dayData = {
      date: dayIso,
      success: allChecked,
      workoutKey,
      draft: d
    };
    localStorage.setItem(keyDay(dayIso), JSON.stringify(dayData));

    // Update last-meta per exercise (strength workouts only)
    if (!ALT_KEYS.has(workoutKey)) {
      const entries = d.entries || {};
      Object.entries(entries).forEach(([exId, entry]) => {
        const hasWeight = typeof entry?.weight === "number";
        const hasNote = typeof entry?.note === "string" && entry.note.trim().length > 0;
        const hasFeel = typeof entry?.feel === "string" && entry.feel.length > 0;

        if (hasWeight || hasNote || hasFeel) {
          setLastMeta(exId, {
            weight: hasWeight ? entry.weight : undefined,
            note: hasNote ? entry.note : "",
            feel: hasFeel ? entry.feel : ""
          });
        }
      });
    }

    // Reset checklist for next day
    ids.forEach(id => {
      const c = el(id);
      if (c) c.checked = false;
    });

    // Refresh UI
    loadStreakUI();
    const phaseKey = getPhaseKey();
    const workouts = phases[phaseKey].workouts;
    renderWeek(workouts);

    alert(allChecked
      ? "Nice! Dagen er registrert som fullført. Streak oppdatert."
      : "Dagen er lagret, men ikke alle punkter ble krysset av. Streak ble nullstilt.");
  }

  // ---------------------------
  // Reset
  // ---------------------------
  function resetAll() {
    if (!confirm("Er du sikker på at du vil slette all progresjon og starte på nytt?")) return;

    Object.keys(localStorage)
      .filter(k => k.startsWith(P))
      .forEach(k => localStorage.removeItem(k));

    loadStreakUI();

    const phaseKey = getPhaseKey();
    const workouts = phases[phaseKey].workouts;
    renderWeek(workouts);

    alert("Alle Prosjekt 2026-data er nullstilt.");
  }

  // Expose for onclick
  window.completeDay = completeDay;
  window.resetAll = resetAll;

  // ---------------------------
  // Init
  // ---------------------------
  document.addEventListener("DOMContentLoaded", () => {
    // Phase
    setHeader();
    bindPhaseSelect();

    // Use current phase workouts
    const phaseKey = getPhaseKey();
    const workouts = phases[phaseKey].workouts;

    // Render today + week + streak
    renderWorkoutForToday(workouts);
    loadStreakUI();
    renderWeek(workouts);
  });

})();


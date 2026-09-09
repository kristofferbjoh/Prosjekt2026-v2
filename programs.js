/* Existing exercise IDs remain stable across releases. */
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.P2026Programs = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
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

  return { PHASES, ALT, ALL_KEYS };
});

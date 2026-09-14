const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom'),C=require('../coach-core.js');
const html=fs.readFileSync('index.html','utf8');

async function app(initial={}){
  const errors=[],alerts=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only',virtualConsole:vc});const w=dom.window;
  w.structuredClone=structuredClone;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.prompt=()=>null;w.alert=m=>alerts.push(String(m));
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
  for(const [k,v] of Object.entries(initial))w.localStorage.setItem(k,v);
  for(const f of ['coach-core.js','storage.js','programs.js','app.js','pwa.js'])w.eval(fs.readFileSync(f,'utf8'));
  await new Promise(r=>setTimeout(r,25));
  const el=id=>w.document.getElementById(id),state=()=>JSON.parse(w.localStorage.getItem(C.STORE_KEY));
  const input=(target,value,event='input')=>{const n=typeof target==='string'?el(target):target;n.value=value;n.dispatchEvent(new w.Event(event,{bubbles:true}));};
  const click=target=>{const n=typeof target==='string'?el(target):target;n.click();};
  return{dom,w,el,state,input,click,alerts,errors,close:()=>dom.window.close()};
}

test('v3 boots all four screens and preserves historical v2 data',async()=>{
  const old={...C.defaultState(),version:2,days:{'2026-08-10':{completed:true,score:85,habits:{plan:true}}},metrics:[{date:'2026-08-01',weight:94}],workouts:[]};
  const a=await app({[C.STORE_KEY]:JSON.stringify(old)});try{
    for(const button of a.w.document.querySelectorAll('.nav-btn'))button.click();
    const s=a.state();assert.deepEqual(a.errors,[]);assert.equal(s.days['2026-08-10'].score,85);assert.equal(s.metrics[0].weight,94);
    assert.deepEqual(s.trainingRotation,['W1','W2']);assert(s.customTemplates.phase2.W1.main.length>0);
  }finally{a.close();}
});

test('strength draft autosaves across tabs and reload without inventing completed reps',async()=>{
  const a=await app();let saved;
  try{
    a.click('start-next');
    const card=a.el('session-exercises').querySelector('.exercise-card');
    assert(card);assert.equal(card.querySelector('.set-reps').value,'');assert.equal(card.querySelector('.feel-btn.active'),null);
    a.input(card.querySelector('.set-weight'),'42,5');a.input(card.querySelector('.set-reps'),'8');card.querySelector('.set-done').click();
    a.w.document.querySelector('[data-tab="home"]').click();a.w.document.querySelector('[data-tab="session"]').click();
    assert.equal(a.el('session-exercises').querySelector('.set-weight').value,'42.5');
    saved=a.w.localStorage.getItem(C.STORE_KEY);assert.deepEqual(a.errors,[]);
  }finally{a.close();}
  const b=await app({[C.STORE_KEY]:saved});try{
    b.w.document.querySelector('[data-tab="session"]').click();
    const card=b.el('session-exercises').querySelector('.exercise-card');assert.equal(card.querySelector('.set-weight').value,'42.5');
    b.click('save-workout');await new Promise(r=>setTimeout(r,260));
    assert.equal(b.state().workouts.length,1);assert.equal(b.state().workouts[0].entries[0].sets[0].weight,42.5);assert.equal(b.state().workouts[0].entries[0].sets[0].reps,8);assert.deepEqual(b.errors,[]);
  }finally{b.close();}
});

test('empty session cannot be saved as a completed workout',async()=>{
  const a=await app();try{a.click('start-next');a.click('save-workout');assert.equal(a.state().workouts.length,0);assert.deepEqual(a.errors,[]);}finally{a.close();}
});

test('session exercise can be changed for today without mutating the template',async()=>{
  const a=await app();try{
    a.click('start-next');const first=a.el('session-exercises').querySelector('[data-edit-session="0"]');first.click();
    a.input('editor-name','Test press');a.click('editor-save-session');
    assert.equal(a.el('session-exercises').querySelector('.exercise-card h3').textContent,'Test press');
    assert.notEqual(a.state().customTemplates.phase2.W1.main[0].name,'Test press');assert.deepEqual(a.errors,[]);
  }finally{a.close();}
});

test('program template edit persists and rotation remains valid',async()=>{
  const a=await app();try{
    a.w.document.querySelector('[data-tab="program"]').click();
    const edit=a.w.document.querySelector('[data-edit-template="W1"][data-index="0"]');assert(edit);edit.click();
    a.input('editor-name','Permanent row');a.click('editor-save-template-only');
    assert.equal(a.state().customTemplates.phase2.W1.main[0].name,'Permanent row');assert(a.state().trainingRotation.length>=1);assert.deepEqual(a.errors,[]);
  }finally{a.close();}
});

test('corrupted stored state stays untouched and shows recovery warning',async()=>{
  const a=await app({[C.STORE_KEY]:'{broken'});try{assert.equal(a.w.localStorage.getItem(C.STORE_KEY),'{broken');assert(!a.el('storage-warning').classList.contains('hidden'));assert.deepEqual(a.errors,[]);}finally{a.close();}
});

test('invalid import is atomic; valid merge keeps existing data and restores program preferences',async()=>{
  const a=await app();try{
    const original=a.w.localStorage.getItem(C.STORE_KEY);
    const importFile=async value=>{const file={size:1000,text:async()=>JSON.stringify(value)};Object.defineProperty(a.el('import-data'),'files',{value:[file],configurable:true});a.el('import-data').dispatchEvent(new a.w.Event('change'));await new Promise(r=>setTimeout(r,35));};
    await importFile({state:{settings:{},days:{},workouts:'wrong'}});assert.equal(a.w.localStorage.getItem(C.STORE_KEY),original);assert(a.alerts.length>0);
    const incoming=C.defaultState();incoming.metrics=[{date:'2026-08-01',weight:90}];incoming.trainingRotation=['W1'];
    await importFile({state:incoming});assert.equal(a.state().metrics.length,1);assert.deepEqual(a.state().trainingRotation,['W1']);
    await importFile({state:incoming});assert.equal(a.state().metrics.length,1);assert.deepEqual(a.errors,[]);
  }finally{a.close();}
});

test('legacy phone backup still imports strength history safely',async()=>{
  const date='2026-08-13',oldDay={date,calories:1410,protein:124,water:2,sleep:8,meals:[],habits:{structured:true},done:true,score:70,training:{phase:'phase2',workoutKey:'W2',energy:3,achilles:0,ankle:1,back:1,note:'Øvelsesbytte bevart',completed:true,entries:{phase2_W2_0:{weight:'7.5',reps:'10',feel:'ok'}}}};
  const legacy={p2026v2_settings:JSON.stringify({weekdayMin:1800,weekdayMax:2100,weekendMin:2400,weekendMax:2800,footballCalories:2100,proteinMin:150,proteinMax:170,goalWeight:87.5,waterTarget:2,sleepTarget:7}),p2026v2_weights:JSON.stringify([{date,weight:95.3,note:'beholdes'}]),[`p2026v2_day_${date}`]:JSON.stringify(oldDay),p2026v2_streak:JSON.stringify({current:5,best:5,last:date}),p2026v2_last_phase2_W2_0:JSON.stringify({weight:'7.5',reps:'10',feel:'ok'})};
  const a=await app();try{
    const file={size:1000,text:async()=>JSON.stringify(legacy)};Object.defineProperty(a.el('import-data'),'files',{value:[file],configurable:true});a.el('import-data').dispatchEvent(new a.w.Event('change'));await new Promise(r=>setTimeout(r,40));
    const s=a.state();assert.equal(s.metrics.length,1);assert.equal(s.workouts.length,1);assert.equal(s.workouts[0].note,'Øvelsesbytte bevart');assert.equal(s.workouts[0].entries[0].sets[0].weight,7.5);assert.deepEqual(a.errors,[]);
  }finally{a.close();}
});

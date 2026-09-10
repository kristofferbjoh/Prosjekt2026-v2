const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom'),C=require('../coach-core.js');
const html=fs.readFileSync('index.html','utf8');
async function app(initial={}){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only',virtualConsole:vc});const w=dom.window;
  w.structuredClone=structuredClone;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.prompt=()=>null;
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
  for(const [k,v] of Object.entries(initial))w.localStorage.setItem(k,v);
  for(const f of ['coach-core.js','storage.js','programs.js','app.js','pwa.js'])w.eval(fs.readFileSync(f,'utf8'));
  await new Promise(r=>setTimeout(r,20));
  const el=id=>w.document.getElementById(id),state=()=>JSON.parse(w.localStorage.getItem(C.STORE_KEY));
  const input=(id,value,event='input')=>{const n=typeof id==='string'?el(id):id;n.value=value;n.dispatchEvent(new w.Event(event,{bubbles:true}));};
  return{dom,w,el,state,input,errors,close:()=>dom.window.close()};
}
test('app boots all four screens without runtime errors and preserves historical v2',async()=>{
  const old={...C.defaultState(),version:2,days:{'2026-08-10':{completed:true,score:85,habits:{plan:true}}},metrics:[{date:'2026-08-01',weight:94}],workouts:[]};
  const a=await app({[C.STORE_KEY]:JSON.stringify(old)});try{for(const button of a.w.document.querySelectorAll('.nav-btn'))button.click();assert.deepEqual(a.errors,[]);assert.equal(a.state().days['2026-08-10'].score,85);assert.equal(a.state().metrics[0].weight,94);}finally{a.close();}
});
test('workout draft survives tab changes and reload without inventing completed reps',async()=>{
  const a=await app();let saved;
  try{
    a.input('workout-select','W1','change');const card=a.el('exercise-list').querySelector('.exercise');
    assert.equal(card.querySelector('.set-reps').value,'');assert.equal(card.querySelector('.feel-btn.active'),null);
    a.input(card.querySelector('.set-weight'),'42,5');a.input(card.querySelector('.set-reps'),'8');
    const check=card.querySelector('.set-done');check.checked=true;check.dispatchEvent(new a.w.Event('change',{bubbles:true}));
    a.w.document.querySelector('[data-tab="food"]').click();a.w.document.querySelector('[data-tab="training"]').click();
    assert.equal(a.el('exercise-list').querySelector('.set-weight').value,'42.5');
    saved=a.w.localStorage.getItem(C.STORE_KEY);assert.deepEqual(a.errors,[]);
  }finally{a.close();}
  const b=await app({[C.STORE_KEY]:saved});try{b.input('workout-select','W1','change');assert.equal(b.el('exercise-list').querySelector('.set-weight').value,'42.5');b.el('save-workout').click();b.el('save-workout').click();assert.equal(b.state().workouts.length,1);assert.equal(b.state().workouts[0].entries[0].sets[0].weight,42.5);assert.deepEqual(b.errors,[]);}finally{b.close();}
});
test('empty workout cannot be saved as performed',async()=>{const a=await app();try{a.input('workout-select','W1','change');a.el('save-workout').click();assert.equal(a.state().workouts.length,0);assert.deepEqual(a.errors,[]);}finally{a.close();}});
test('food gram arithmetic, editing, additive yesterday copy and undo',async()=>{
  const s=C.defaultState(),today=C.localISO(),yesterday=C.localISO(C.addDays(today,-1));s.foods[yesterday]=[{id:'old',name:'Yesterday',kcal:100,protein:10,qty:1}];
  const a=await app({[C.STORE_KEY]:JSON.stringify(s)});
  try{
    a.input('food-name','Yoghurt');a.input('food-kcal','80');a.input('food-protein','10');a.input('food-basis','100g','change');a.input('food-qty','250');a.el('add-food').click();
    assert.equal(a.state().foods[today][0].qty,2.5);assert.equal(a.el('food-kcal-total').textContent,'200');
    a.el('copy-yesterday').click();assert.equal(a.state().foods[today].length,2);
    a.w.document.querySelector('[data-edit-food]').click();a.input('food-qty','150');a.el('add-food').click();assert.equal(a.state().foods[today][0].qty,1.5);
    a.w.document.querySelector('[data-del-food]').click();assert.equal(a.state().foods[today].length,1);a.el('undo-food').click();assert.equal(a.state().foods[today].length,2);assert.deepEqual(a.errors,[]);
  }finally{a.close();}
});
test('legacy alternative session, drafts and streak are migrated once',async()=>{
  const date=C.localISO(),initial={['p2026_day_'+date]:JSON.stringify({date,workoutKey:'FOOTBALL',success:true,draft:{entries:{},altNote:'Synthetic'}}),p2026_bestStreak:'12',['p2026_draft_'+date]:JSON.stringify({workoutKey:'W1',entries:{row_seated:{weight:30,note:'draft'}}})};
  const a=await app(initial);try{assert.equal(a.state().workouts.length,1);assert.equal(a.state().workouts[0].key,'FOOTBALL');assert.equal(a.state().legacyBestStreak,12);assert.equal(Object.keys(a.state().drafts).length,1);assert.deepEqual(a.errors,[]);}finally{a.close();}
});
test('corrupted stored state stays untouched and shows recovery warning',async()=>{const a=await app({[C.STORE_KEY]:'{broken'});try{assert.equal(a.w.localStorage.getItem(C.STORE_KEY),'{broken');assert(!a.el('storage-warning').classList.contains('hidden'));assert.deepEqual(a.errors,[]);}finally{a.close();}});
test('invalid import is atomic; merge and replace operate only after validation',async()=>{
  const a=await app();try{
    const original=a.w.localStorage.getItem(C.STORE_KEY);
    const importFile=async value=>{const file={size:100,text:async()=>JSON.stringify(value)};Object.defineProperty(a.el('import-data'),'files',{value:[file],configurable:true});a.el('import-data').dispatchEvent(new a.w.Event('change'));await new Promise(r=>setTimeout(r,30));};
    await importFile({state:{settings:{},days:{},workouts:'wrong'}});assert.equal(a.w.localStorage.getItem(C.STORE_KEY),original);
    const incoming=C.defaultState();incoming.metrics=[{date:'2026-08-01',weight:90}];await importFile({state:incoming});assert.equal(a.state().metrics.length,1);
    await importFile({state:incoming});assert.equal(a.state().metrics.length,1);assert.deepEqual(a.errors,[]);
  }finally{a.close();}
});
test('phone backup from the earlier p2026v2 app imports safely and idempotently',async()=>{
  const date='2026-08-13',oldDay={date,calories:1410,protein:124,water:2,sleep:8,meals:[{name:'Knekkebrød med egg',kcal:340,protein:30,at:'2026-08-13T10:00:00.000Z'}],habits:{movement:true,mobility:true,creatine:false,structured:true},done:true,score:70,training:{phase:'phase2',workoutKey:'W2',energy:3,achilles:0,ankle:1,back:1,note:'Øvelsesbytte bevart',completed:true,entries:{phase2_W2_0:{weight:'7.5',reps:'10',feel:'ok'}}}};
  const legacy={p2026v2_settings:JSON.stringify({weekdayMin:1800,weekdayMax:2100,weekendMin:2400,weekendMax:2800,footballCalories:2100,proteinMin:150,proteinMax:170,goalWeight:87.5,waterTarget:2,sleepTarget:7}),p2026v2_weights:JSON.stringify([{date,weight:95.3,note:'beholdes'}]),[`p2026v2_day_${date}`]:JSON.stringify(oldDay),p2026v2_streak:JSON.stringify({current:5,best:5,last:date}),p2026v2_last_phase2_W2_0:JSON.stringify({weight:'7.5',reps:'10',feel:'ok'})};
  const a=await app();try{
    const importFile=async()=>{const file={size:1000,text:async()=>JSON.stringify(legacy)};Object.defineProperty(a.el('import-data'),'files',{value:[file],configurable:true});a.el('import-data').dispatchEvent(new a.w.Event('change'));await new Promise(r=>setTimeout(r,30));};
    await importFile();await importFile();const s=a.state();
    assert.equal(s.metrics.length,1);assert.equal(s.workouts.length,1);assert.equal(s.workouts[0].legacy,true);assert.equal(s.workouts[0].note,'Øvelsesbytte bevart');assert.equal(s.workouts[0].entries[0].sets[0].weight,7.5);
    assert.equal(s.foods[date].length,2);assert.deepEqual(C.foodTotals(s,date),{kcal:1410,protein:124});assert.equal(s.days[date].score,70);assert.equal(s.legacyBestStreak,5);assert.deepEqual(s.importedLegacy,legacy);assert.deepEqual(a.errors,[]);
  }finally{a.close();}
});
test('edited completed day rescores without re-completing or changing yesterday',async()=>{
  const today=C.localISO(),s=C.defaultState();s.days[today]={completed:true,score:100,habits:{plan:true},nutritionComplete:true};s.foods[today]=[{id:'f',name:'Meal',kcal:2000,protein:170,qty:1}];
  const a=await app({[C.STORE_KEY]:JSON.stringify(s)});try{a.w.document.querySelector('[data-del-food]').click();assert.equal(a.state().days[today].score,25);assert.equal(a.state().days[today].completed,true);assert.deepEqual(a.errors,[]);}finally{a.close();}
});

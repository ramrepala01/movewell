import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RecoveryMomentRepository} from '../server/recovery/RecoveryMomentRepository.mjs';
import {RecoveryMomentService} from '../recovery/RecoveryMomentService.mjs';
import {createApp} from '../server/app.mjs';
const therapist={id:'maya',role:'THERAPIST'},patient={id:'ram',role:'PATIENT'};
function fixture(t){
  const repo=new RecoveryMomentRepository();t.after(()=>repo.close());let now=new Date('2026-10-02T05:00:00Z');
  const service=new RecoveryMomentService(repo,{clock:()=>now});
  const input={patientId:'ram',title:'Mobility break',description:'A short approved break.',triggerType:'INACTIVITY',triggerValue:45,allowedStartTime:'06:00',allowedEndTime:'22:00',maxPerDay:3,minimumIntervalMinutes:30,active:true,startDate:'2026-10-01',endDate:'2026-10-10',restrictions:'Do not add resistance.',exercises:[{exerciseId:'cat-cow',durationSeconds:90,repetitions:10,instructions:'Follow your prescribed comfortable range.'}]};
  const create=extra=>service.create(therapist,{...input,...extra});
  const trigger=()=>service.signal(patient,{type:'INACTIVITY',minutes:46});
  return {repo,service,input,create,trigger,advance:minutes=>now=new Date(now.getTime()+minutes*60000),setNow:value=>now=new Date(value)};
}
test('assigned therapist creates a durable ordered approved prescription',t=>{
  const f=fixture(t),m=f.create();assert.equal(m.therapistId,'maya');assert.equal(m.exercises[0].name,'Cat-cow mobility');assert.equal(f.service.get(patient,m.id).restrictions,'Do not add resistance.');
  assert.equal(f.repo.db.prepare('SELECT COUNT(*) AS n FROM recovery_moment_exercises').get().n,1);
});
test('patient retrieves today and strict inactivity threshold',t=>{
  const f=fixture(t);f.create();f.service.signal(patient,{type:'INACTIVITY',minutes:45});assert.equal(f.service.today(patient).events.length,0);
  f.advance(1);const today=f.service.today(patient);assert.equal(today.events.length,1);assert.equal(today.events[0].status,'AVAILABLE');assert.equal(today.notifications.length,1);
  f.service.today(patient);assert.equal(f.repo.read(s=>s.notifications.length),1);
});
test('minimum interval applies across prescriptions',t=>{
  const f=fixture(t),m=f.create();f.create({title:'Before walk',triggerType:'BEFORE_ACTIVITY'});f.trigger();const e=f.service.today(patient).events[0];f.service.action(patient,m.id,'skip',{eventId:e.id});
  f.service.signal(patient,{type:'BEFORE_ACTIVITY'});assert.equal(f.service.today(patient).events.length,1);f.advance(29);assert.equal(f.service.today(patient).events.length,1);f.advance(1);f.service.signal(patient,{type:'BEFORE_ACTIVITY'});assert.equal(f.service.today(patient).events.length,2);
});
test('daily maximum applies across all patient prescriptions, including skips',t=>{
  const f=fixture(t),m=f.create({maxPerDay:1});f.trigger();const e=f.service.today(patient).events[0];f.service.action(patient,m.id,'skip',{eventId:e.id});f.advance(60);f.trigger();assert.equal(f.service.today(patient).events.length,1);
  f.setNow('2026-10-03T05:00:00Z');f.trigger();assert.equal(f.service.today(patient).events.length,1);
});
test('quiet hours and overnight windows are respected',t=>{
  const f=fixture(t);f.create({allowedStartTime:'11:00',allowedEndTime:'12:00'});f.trigger();assert.equal(f.service.today(patient).events.length,0);f.advance(30);assert.equal(f.service.today(patient).events.length,1);
  f.setNow('2026-10-02T07:00:00Z');assert.throws(()=>f.service.action(patient,f.service.list(patient,'ram')[0].id,'start',{eventId:f.service.today(patient).events[0].id}),/approved availability/);
});
test('snooze waits for both due time and notification interval; counts remain historical',t=>{
  const f=fixture(t),m=f.create();f.trigger();const e=f.service.today(patient).events[0];f.service.action(patient,m.id,'snooze',{eventId:e.id,minutes:15});
  f.advance(15);assert.equal(f.service.today(patient).events[0].status,'SNOOZED');f.advance(15);assert.equal(f.service.today(patient).events[0].status,'AVAILABLE');assert.equal(f.repo.read(s=>s.notifications.length),2);
  f.service.action(patient,m.id,'start',{eventId:e.id});f.service.action(patient,m.id,'complete',{eventId:e.id,completedExerciseIds:['cat-cow']});
  assert.equal(f.service.history(therapist,'ram').analytics.snoozed,1);
});
test('skip is final and idempotent',t=>{
  const f=fixture(t),m=f.create();f.trigger();const e=f.service.today(patient).events[0];f.service.action(patient,m.id,'skip',{eventId:e.id});f.service.action(patient,m.id,'skip',{eventId:e.id});
  assert.equal(f.service.today(patient).events[0].status,'SKIPPED');assert.throws(()=>f.service.action(patient,m.id,'start',{eventId:e.id}),/no longer available/);
});
test('completion requires start and every prescribed exercise',t=>{
  const f=fixture(t),m=f.create();f.trigger();const e=f.service.today(patient).events[0];assert.throws(()=>f.service.action(patient,m.id,'complete',{eventId:e.id}),/Start/);
  f.service.action(patient,m.id,'start',{eventId:e.id});assert.throws(()=>f.service.action(patient,m.id,'complete',{eventId:e.id,completedExerciseIds:[]}),/each prescribed exercise/);
  assert.ok(f.service.action(patient,m.id,'complete',{eventId:e.id,completedExerciseIds:['cat-cow']}).completedAt);assert.equal(f.service.history(therapist,'ram').analytics.completionPercentage,100);
});
test('inactive and expired prescriptions never trigger',t=>{
  const f=fixture(t);f.create({active:false});f.create({endDate:'2026-10-01'});f.create({startDate:'2026-10-03'});f.trigger();assert.equal(f.service.today(patient).events.length,0);
});
test('another therapist, coach, and another patient cannot modify or read prescriptions',t=>{
  const f=fixture(t),m=f.create();f.repo.transaction(s=>s.people.push({id:'other',name:'Other therapist',role:'THERAPIST'}));
  const other={id:'other',role:'THERAPIST'};assert.throws(()=>f.service.update(other,m.id,f.input),/cannot access/);assert.throws(()=>f.service.create(other,f.input),/cannot access/);assert.throws(()=>f.service.remove(other,m.id),/cannot access/);
  assert.throws(()=>f.service.history(other,'ram'),/cannot access/);assert.throws(()=>f.service.get({id:'aarav',role:'PATIENT'},m.id),/cannot access/);assert.throws(()=>f.service.create({id:'arjun',role:'COACH'},f.input),/Only the assigned/);
});
test('unapproved exercises, excessive doses and malformed settings are rejected',t=>{
  const f=fixture(t);assert.throws(()=>f.create({exercises:[{...f.input.exercises[0],exerciseId:'trap-bar'}]}),/not approved/);
  assert.throws(()=>f.create({exercises:[{...f.input.exercises[0],durationSeconds:121}]}),/approved limits/);
  assert.throws(()=>f.create({exercises:[{...f.input.exercises[0],repetitions:21}]}),/approved limits/);
  assert.throws(()=>f.create({allowedStartTime:'25:00'}),/permitted/);assert.throws(()=>f.create({startDate:'2026-02-30'}),/valid date/);
});
test('prescription updates and revoked approvals invalidate outstanding events',t=>{
  const f=fixture(t),m=f.create();f.trigger();const e=f.service.today(patient).events[0];f.service.update(therapist,m.id,{...f.input,restrictions:'Updated restriction.'});assert.equal(f.service.today(patient).events[0].status,'EXPIRED');
  f.advance(30);f.trigger();f.repo.transaction(s=>s.approvals[0].active=false);assert.equal(f.service.today(patient).events.at(-1).status,'EXPIRED');assert.throws(()=>f.service.action(patient,m.id,'start',{eventId:e.id}),/no longer available/);
});
test('midnight expires outstanding suggestions without resending yesterday’s event',t=>{
  const f=fixture(t);f.create();f.trigger();f.setNow('2026-10-03T00:30:00Z');assert.equal(f.service.today(patient).events.length,0);assert.equal(f.service.history(therapist,'ram').events[0].status,'EXPIRED');assert.equal(f.service.history(therapist,'ram').analytics.mostFrequentlyMissed[0].count,1);
});
test('clinical prescription edits do not count as missed patient moments',t=>{
  const f=fixture(t),m=f.create();f.trigger();f.service.update(therapist,m.id,{...f.input,active:false});assert.equal(f.service.history(therapist,'ram').analytics.mostFrequentlyMissed.length,0);
});
test('morning, evening, scheduled, activity and manual triggers only use approved moments',t=>{
  for(const triggerType of ['MORNING','EVENING','SCHEDULED','BEFORE_ACTIVITY','AFTER_ACTIVITY','MANUAL']){
    const repo=new RecoveryMomentRepository();t.after(()=>repo.close());const f=fixture(t),service=new RecoveryMomentService(repo,{clock:()=>new Date('2026-10-02T05:00:00Z')});
    const m=service.create(therapist,{...f.input,triggerType,triggerValue:'10:00'});
    if(triggerType==='MANUAL')service.recommend(therapist,m.id);else if(triggerType.includes('ACTIVITY'))service.signal(patient,{type:triggerType});
    assert.equal(service.today(patient).events.length,1,triggerType);
  }
});
test('missed routine uses explicitly prescribed small doses, and completion suppresses conversion',t=>{
  const f=fixture(t),m=f.create({triggerType:'MISSED_SESSION',routineId:'ram-daily',exercises:[{...f.input.exercises[0],durationSeconds:60}]});
  assert.equal(f.service.today(patient).events.length,0);f.service.routineStatus(patient,'ram-daily','MISSED');assert.equal(f.service.today(patient).events[0].snapshot.exercises[0].durationSeconds,60);
  f.service.routineStatus(patient,'ram-daily','COMPLETED');assert.equal(f.service.today(patient).events[0].status,'EXPIRED');f.advance(60);assert.equal(f.service.today(patient).events.length,1);
});
test('snooze crossing quiet hours is not delivered until permitted hours',t=>{
  const f=fixture(t),m=f.create({allowedEndTime:'11:00'});f.trigger();const e=f.service.today(patient).events[0];f.service.action(patient,m.id,'snooze',{eventId:e.id,minutes:60});f.advance(60);assert.equal(f.service.today(patient).events[0].status,'SNOOZED');assert.equal(f.repo.read(s=>s.notifications.length),1);
});
test('overnight permitted hours and automatic missed-session trigger',t=>{
  const f=fixture(t);f.create({allowedStartTime:'21:00',allowedEndTime:'07:00'});f.trigger();assert.equal(f.service.today(patient).events.length,0);
  f.setNow('2026-10-02T17:30:00Z');f.trigger();assert.equal(f.service.today(patient).events.length,1);
  const g=fixture(t);g.create({triggerType:'MISSED_SESSION',routineId:'ram-daily'});g.setNow('2026-10-02T14:59:00Z');assert.equal(g.service.today(patient).events.length,0);g.setNow('2026-10-02T15:00:00Z');assert.equal(g.service.today(patient).events.length,1);
});
test('exercise progress persists and must follow the approved order',t=>{
  const f=fixture(t),m=f.create({exercises:[...f.input.exercises,{exerciseId:'hip-flexor',durationSeconds:60,repetitions:0,instructions:'Follow your approved instructions.'}]});f.trigger();const e=f.service.today(patient).events[0];f.service.action(patient,m.id,'start',{eventId:e.id});
  assert.throws(()=>f.service.action(patient,m.id,'progress',{eventId:e.id,exerciseId:'hip-flexor'}),/in order/);
  f.service.action(patient,m.id,'progress',{eventId:e.id,exerciseId:'cat-cow'});assert.deepEqual(f.service.today(patient).events[0].completedExerciseIds,['cat-cow']);
  f.service.action(patient,m.id,'progress',{eventId:e.id,exerciseId:'cat-cow'});assert.equal(f.service.today(patient).events[0].completedExerciseIds.length,1);
  f.service.action(patient,m.id,'progress',{eventId:e.id,exerciseId:'hip-flexor'});assert.equal(f.service.action(patient,m.id,'complete',{eventId:e.id,completedExerciseIds:['cat-cow','hip-flexor']}).status,'COMPLETED');
});
test('one outstanding snooze blocks other moments and minimum-dose totals are enforced',t=>{
  const f=fixture(t),m=f.create();f.create({triggerType:'MORNING',triggerValue:'07:00'});f.trigger();const e=f.service.today(patient).events[0];f.service.action(patient,m.id,'snooze',{eventId:e.id,minutes:60});f.advance(30);assert.equal(f.service.today(patient).events.length,1);
  assert.throws(()=>f.create({exercises:[{exerciseId:'cat-cow',durationSeconds:120,repetitions:0,instructions:'Approved.'},{exerciseId:'bird-dog',durationSeconds:180,repetitions:0,instructions:'Approved.'},{exerciseId:'hip-flexor',durationSeconds:1,repetitions:0,instructions:'Approved.'}]}),/at most five minutes/);
  assert.throws(()=>f.create({exercises:[null]}),/distinct approved/);
});
test('SQLite migrations are repeatable and prescriptions survive reopening',t=>{
  const dir=mkdtempSync(join(tmpdir(),'movewell-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'db.sqlite');
  let repo=new RecoveryMomentRepository(path),f=fixture(t),service=new RecoveryMomentService(repo,{clock:()=>new Date('2026-10-02T05:00:00Z')});const m=service.create(therapist,f.input);repo.close();repo=new RecoveryMomentRepository(path);t.after(()=>repo.close());assert.equal(new RecoveryMomentService(repo).list(patient,'ram')[0].id,m.id);assert.equal(repo.db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,1);
});
test('REST API authenticates session cookies, blocks spoofed roles and cross-origin writes',async t=>{
  const f=fixture(t),app=createApp(f.repo,{demoAuth:true,clock:()=>new Date('2026-10-02T05:00:00Z')});await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>app.close(resolve)));const base=`http://127.0.0.1:${app.address().port}`;
  const post=(path,body,cookie,origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/recovery-moments/today',{headers:{'X-User-Id':'ram','X-Role':'PATIENT'}})).status,401);
  const login=await post('/api/demo/session',{personId:'maya'});const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  assert.equal((await post('/api/recovery-moments',f.input,cookie,'https://evil.example')).status,403);
  const created=await post('/api/recovery-moments',{...f.input,triggerType:'MORNING',triggerValue:'07:00'},cookie);assert.equal(created.status,201);const m=await created.json();
  const patientLogin=await post('/api/demo/session',{personId:'ram'}),patientCookie=patientLogin.headers.get('set-cookie').split(';')[0];
  const today=await fetch(base+'/api/recovery-moments/today',{headers:{Cookie:patientCookie}});assert.equal(today.status,200);assert.equal((await today.json()).events[0].recoveryMomentId,m.id);
  assert.equal((await post('/api/recovery-moments',f.input,patientCookie)).status,403);
  const aarav=await post('/api/demo/session',{personId:'aarav'});assert.equal((await fetch(base+`/api/recovery-moments/${m.id}`,{headers:{Cookie:aarav.headers.get('set-cookie').split(';')[0]}})).status,403);
});

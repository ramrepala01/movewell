import {id,fail,localTime,TRIGGERS,SAFETY_MESSAGE} from './domain.mjs';
import {RecoveryMomentRulesEngine} from './RecoveryMomentRulesEngine.mjs';
import {RecoveryMomentNotificationService} from './RecoveryMomentNotificationService.mjs';
const OPEN=['AVAILABLE','STARTED','SNOOZED'];
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const time=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const text=(v,max=1000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;

export class RecoveryMomentService {
  constructor(repository,{clock=()=>new Date(),rulesEngine=new RecoveryMomentRulesEngine(),notifications=new RecoveryMomentNotificationService()}={}){this.repository=repository;this.clock=clock;this.rules=rulesEngine;this.notifications=notifications;}
  person(s,actor){const p=s.people.find(p=>p.id===actor?.id&&p.role===actor?.role);return p||fail(401,'Sign in to continue.');}
  patient(s,actor,patientId){
    this.person(s,actor);const p=s.patients.find(p=>p.id===patientId);
    if(!p)fail(404,'Patient not found.');
    if(!(actor.role==='PATIENT'&&actor.id===p.id)&&!(actor.role==='THERAPIST'&&p.therapistId===actor.id))fail(403,'You cannot access this patient.');
    return p;
  }
  therapist(s,actor,patientId){if(this.person(s,actor).role!=='THERAPIST')fail(403,'Only the assigned physiotherapist can prescribe Recovery Moments.');return this.patient(s,actor,patientId);}
  moment(s,actor,momentId){const m=s.moments.find(m=>m.id===momentId);if(!m)fail(404,'Recovery Moment not found.');this.patient(s,actor,m.patientId);return m;}
  catalog(actor){return this.repository.read(s=>{
    this.person(s,actor);
    const patients=s.patients.filter(p=>actor.role==='THERAPIST'?p.therapistId===actor.id:p.id===actor.id).map(p=>({...p,name:s.people.find(x=>x.id===p.id).name,exercises:s.approvals.filter(a=>a.patientId===p.id&&a.active).map(a=>({...s.exercises.find(e=>e.id===a.exerciseId),approval:a})),routines:s.routines.filter(r=>r.patientId===p.id&&r.active)}));
    return {actor,patients,safetyMessage:SAFETY_MESSAGE};
  });}
  validate(s,actor,input,existing){
    if(!input||typeof input!=='object')fail(400,'A prescription is required.');
    const patientId=existing?.patientId||input.patientId;this.therapist(s,actor,patientId);
    if(input.patientId&&input.patientId!==patientId)fail(400,'A prescription cannot be moved to another patient.');
    if(!text(input.title,120)||typeof input.description!=='string'||input.description.length>1000||!TRIGGERS[input.triggerType])fail(400,'Enter a title, description, and supported trigger.');
    if(!time(input.allowedStartTime)||!time(input.allowedEndTime)||input.allowedStartTime===input.allowedEndTime)fail(400,'Set different permitted start and end times.');
    if(!integer(input.maxPerDay,1,12)||!integer(input.minimumIntervalMinutes,1,1440)||typeof input.active!=='boolean')fail(400,'Daily limits and minimum intervals must be valid whole numbers.');
    if(!isoDate(input.startDate)||(input.endDate&&!isoDate(input.endDate))||(input.endDate&&input.endDate<input.startDate))fail(400,'Enter a valid date range.');
    if(!text(input.restrictions,2000))fail(400,'Enter clinical restrictions, or explicitly state that there are no additional restrictions.');
    if(input.triggerType==='INACTIVITY'&&!integer(input.triggerValue,1,480))fail(400,'Inactivity threshold must be between 1 and 480 minutes.');
    if(['MORNING','EVENING','SCHEDULED'].includes(input.triggerType)&&!time(input.triggerValue))fail(400,'Choose a trigger time.');
    const routine=input.triggerType==='MISSED_SESSION'?s.routines.find(r=>r.id===input.routineId&&r.patientId===patientId&&r.therapistId===actor.id&&r.active):null;
    if(input.triggerType==='MISSED_SESSION'&&!routine)fail(400,'Select the patient’s approved rehabilitation routine.');
    if(!Array.isArray(input.exercises)||input.exercises.length<1||input.exercises.length>6||!input.exercises.every(e=>e&&typeof e==='object')||new Set(input.exercises.map(e=>e.exerciseId)).size!==input.exercises.length)fail(400,'Select one to six distinct approved exercises.');
    const exercises=input.exercises.map((e,order)=>{
      const approval=s.approvals.find(a=>a.patientId===patientId&&a.therapistId===actor.id&&a.exerciseId===e.exerciseId&&a.active);
      if(!approval)fail(400,'An exercise is not approved for this patient by their physiotherapist.');
      if(routine&&!routine.exerciseIds.includes(e.exerciseId))fail(400,'Missed-session moments must use exercises from the selected routine.');
      if(!integer(e.durationSeconds,1,Math.min(180,approval.maxDurationSeconds))||!integer(e.repetitions,0,approval.maxRepetitions)||!text(e.instructions))fail(400,'Exercise instructions and doses must remain within the approved limits.');
      return {id:id(),exerciseId:e.exerciseId,order,durationSeconds:e.durationSeconds,repetitions:e.repetitions,instructions:e.instructions.trim()};
    });
    if(exercises.reduce((sum,e)=>sum+e.durationSeconds,0)>300)fail(400,'A Recovery Moment may last at most five minutes.');
    const now=this.clock().toISOString();
    return {id:existing?.id||id(),patientId,therapistId:actor.id,title:input.title.trim(),description:input.description.trim(),triggerType:input.triggerType,triggerValue:['INACTIVITY','MORNING','EVENING','SCHEDULED'].includes(input.triggerType)?input.triggerValue:null,allowedStartTime:input.allowedStartTime,allowedEndTime:input.allowedEndTime,maxPerDay:input.maxPerDay,minimumIntervalMinutes:input.minimumIntervalMinutes,active:input.active,startDate:input.startDate,endDate:input.endDate||null,restrictions:input.restrictions.trim(),routineId:routine?.id||null,createdAt:existing?.createdAt||now,updatedAt:now,exercises};
  }
  hydrate(s,m){return {...m,exercises:m.exercises.map(e=>({...s.exercises.find(x=>x.id===e.exerciseId),...e,name:s.exercises.find(x=>x.id===e.exerciseId)?.name,approvalRestrictions:s.approvals.find(a=>a.patientId===m.patientId&&a.exerciseId===e.exerciseId)?.restrictions})),safetyMessage:SAFETY_MESSAGE};}
  create(actor,input){return this.repository.transaction(s=>{const m=this.validate(s,actor,input);s.moments.push(m);return this.hydrate(s,m);});}
  update(actor,momentId,input){return this.repository.transaction(s=>{const old=this.moment(s,actor,momentId);this.therapist(s,actor,old.patientId);const m=this.validate(s,actor,input,old);s.moments[s.moments.indexOf(old)]=m;for(const e of s.events)if(e.recoveryMomentId===m.id&&OPEN.includes(e.status)){e.status='EXPIRED';e.expiredReason='Prescription updated';this.notifications.dismiss(s,e,this.clock());}return this.hydrate(s,m);});}
  remove(actor,momentId){return this.repository.transaction(s=>{const m=this.moment(s,actor,momentId);this.therapist(s,actor,m.patientId);m.active=false;m.updatedAt=this.clock().toISOString();for(const e of s.events)if(e.recoveryMomentId===m.id&&OPEN.includes(e.status)){e.status='EXPIRED';e.expiredReason='Prescription deactivated';this.notifications.dismiss(s,e,this.clock());}return {id:m.id,active:false};});}
  get(actor,momentId){return this.repository.read(s=>this.hydrate(s,this.moment(s,actor,momentId)));}
  list(actor,patientId){return this.repository.read(s=>{this.patient(s,actor,patientId);return s.moments.filter(m=>m.patientId===patientId).map(m=>this.hydrate(s,m));});}
  snapshot(s,m){return this.hydrate(s,m);}
  evaluate(s,patient,now){
    const {date}=localTime(now,patient.timeZone);
    for(const e of s.events.filter(e=>e.patientId===patient.id&&OPEN.includes(e.status))){
      const m=s.moments.find(m=>m.id===e.recoveryMomentId);
      if(e.date!==date||!m||!this.rules.current(m,now,patient)||!this.rules.approvalsValid(m,s)){
        e.status='EXPIRED';e.expiredReason=e.date!==date?'Daily availability expired':'Prescription or approval inactive';this.notifications.dismiss(s,e,now);continue;
      }
      if(e.status==='SNOOZED'&&new Date(e.snoozedUntil)<=now&&this.rules.permitted(m,now,patient)){
        if(this.notifications.deliver(s,e,now,this.rules.limits(patient,s,now).minimumIntervalMinutes))e.status='AVAILABLE';
      }
    }
    for(const m of s.moments.filter(m=>m.patientId===patient.id)){
      const eligible=this.rules.evaluate(m,patient,s,now);if(!eligible)continue;
      const event={id:id(),recoveryMomentId:m.id,patientId:patient.id,triggeredAt:now.toISOString(),startedAt:null,completedAt:null,status:'AVAILABLE',...eligible,snapshot:this.snapshot(s,m),snoozeCount:0,snoozeHistory:[],completedExerciseIds:[]};
      if(!this.notifications.deliver(s,event,now,this.rules.limits(patient,s,now).minimumIntervalMinutes))continue;
      s.events.push(event);
    }
  }
  today(actor){return this.repository.transaction(s=>{
    if(this.person(s,actor).role!=='PATIENT')fail(403,'Patient access is required.');
    const patient=this.patient(s,actor,actor.id),now=this.clock();this.evaluate(s,patient,now);
    const {date}=localTime(now,patient.timeZone);
    return {date,timeZone:patient.timeZone,safetyMessage:SAFETY_MESSAGE,events:s.events.filter(e=>e.patientId===patient.id&&e.date===date).map(e=>({...e,availableNow:this.rules.permitted(s.moments.find(m=>m.id===e.recoveryMomentId),now,patient)})),scheduled:s.moments.filter(m=>m.patientId===patient.id&&this.rules.current(m,now,patient)).map(m=>this.hydrate(s,m)),routines:s.routines.filter(r=>r.patientId===patient.id&&r.active).map(r=>({...r,status:s.routineLogs.find(l=>l.routineId===r.id&&l.date===date)?.status||'SCHEDULED'})),notifications:s.notifications.filter(n=>n.patientId===patient.id&&!n.readAt&&s.events.some(e=>e.id===n.eventId&&e.status==='AVAILABLE'&&this.rules.permitted(s.moments.find(m=>m.id===e.recoveryMomentId),now,patient))),limits:this.rules.limits(patient,s,now)};
  });}
  signal(actor,input){return this.repository.transaction(s=>{
    if(this.person(s,actor).role!=='PATIENT')fail(403,'Patient access is required.');this.patient(s,actor,actor.id);
    if(!['INACTIVITY','BEFORE_ACTIVITY','AFTER_ACTIVITY','STOP_INACTIVITY'].includes(input?.type))fail(400,'Unsupported patient activity signal.');
    const now=this.clock();
    for(const old of s.signals)if(old.patientId===actor.id&&old.type==='INACTIVITY'&&!old.stoppedAt)old.stoppedAt=now.toISOString();
    if(input.type==='STOP_INACTIVITY')return {stopped:true};
    if(input.type==='INACTIVITY'&&!integer(input.minutes,0,480))fail(400,'Enter sitting minutes between 0 and 480.');
    const signal={id:id(),patientId:actor.id,type:input.type,minutes:input.minutes||0,observedAt:now.toISOString(),expiresAt:new Date(now.getTime()+(input.type==='INACTIVITY'?8*60:30)*60000).toISOString(),source:'PATIENT_REPORT'};
    s.signals.push(signal);this.evaluate(s,this.patient(s,actor,actor.id),now);return signal;
  });}
  recommend(actor,momentId){return this.repository.transaction(s=>{
    const m=this.moment(s,actor,momentId);const p=this.therapist(s,actor,m.patientId);if(m.triggerType!=='MANUAL'||!this.rules.current(m,this.clock(),p))fail(400,'An active manual prescription is required.');
    const now=this.clock();s.signals.push({id:id(),patientId:p.id,momentId:m.id,type:'MANUAL',observedAt:now.toISOString(),expiresAt:new Date(now.getTime()+86400000).toISOString(),source:'THERAPIST'});this.evaluate(s,p,now);
    return {message:'Recommendation requested. Delivery respects permitted hours, daily limits, and existing suggestions.'};
  });}
  routineStatus(actor,routineId,status){return this.repository.transaction(s=>{
    if(this.person(s,actor).role!=='PATIENT')fail(403,'Patient access is required.');const p=this.patient(s,actor,actor.id),routine=s.routines.find(r=>r.id===routineId&&r.patientId===p.id);
    if(!routine)fail(404,'Routine not found.');if(!['COMPLETED','MISSED'].includes(status))fail(400,'Choose completed or missed.');
    const now=this.clock(),{date}=localTime(now,p.timeZone),existing=s.routineLogs.find(l=>l.routineId===routineId&&l.date===date);
    if(existing?.status==='COMPLETED'&&status==='MISSED')fail(409,'A completed routine cannot be marked missed.');
    const log={id:existing?.id||id(),patientId:p.id,routineId,date,status,recordedAt:now.toISOString()};if(existing)Object.assign(existing,log);else s.routineLogs.push(log);
    if(status==='COMPLETED')for(const e of s.events)if(e.patientId===p.id&&OPEN.includes(e.status)&&e.snapshot.routineId===routineId){e.status='EXPIRED';e.expiredReason='Normal routine completed';this.notifications.dismiss(s,e,now);}
    this.evaluate(s,p,now);return log;
  });}
  action(actor,momentId,action,input={}){return this.repository.transaction(s=>{
    const m=this.moment(s,actor,momentId);if(actor.role!=='PATIENT'||actor.id!==m.patientId)fail(403,'Only this patient can record an event.');
    const p=this.patient(s,actor,actor.id),now=this.clock();this.evaluate(s,p,now);
    const e=s.events.find(e=>e.id===input.eventId&&e.recoveryMomentId===m.id&&e.patientId===p.id);if(!e)fail(404,'Event not found.');
    if(action==='progress'){
      if(e.status!=='STARTED'||!this.rules.permitted(m,now,p)||!this.rules.approvalsValid(m,s))fail(409,'Start an available prescription before recording progress.');
      const next=e.snapshot.exercises.find(x=>!e.completedExerciseIds.includes(x.exerciseId));
      if(e.completedExerciseIds.includes(input.exerciseId))return e;
      if(!next||next.exerciseId!==input.exerciseId)fail(400,'Complete the prescribed exercises in order.');
      e.completedExerciseIds.push(input.exerciseId);return e;
    }
    const target={start:'STARTED',complete:'COMPLETED',skip:'SKIPPED',snooze:'SNOOZED'}[action];if(!target)fail(400,'Unsupported event action.');
    if(e.status===target&&action!=='snooze')return e;
    if(!OPEN.includes(e.status))fail(409,'This event is no longer available.');
    if(!this.rules.permitted(m,now,p)||!this.rules.approvalsValid(m,s))fail(409,'This prescription is outside its approved availability.');
    if(action==='start'){
      if(e.status!=='AVAILABLE')fail(409,'Wait until this suggestion is available.');e.startedAt=now.toISOString();
    }else if(action==='complete'){
      if(e.status!=='STARTED')fail(409,'Start the Recovery Moment before completing it.');
      const completed=input.completedExerciseIds;
      if(!Array.isArray(completed)||completed.length!==e.snapshot.exercises.length||!e.snapshot.exercises.every(x=>completed.includes(x.exerciseId)))fail(400,'Complete each prescribed exercise first.');
      e.completedExerciseIds=[...completed];e.completedAt=now.toISOString();
    }else if(action==='snooze'){
      if(e.status!=='AVAILABLE')fail(409,'Only an available suggestion can be postponed.');
      const minutes=input.minutes??15;if(!integer(minutes,5,240))fail(400,'Snooze for 5 to 240 minutes.');
      e.snoozedUntil=new Date(now.getTime()+minutes*60000).toISOString();e.snoozeCount++;e.snoozeHistory.push({at:now.toISOString(),until:e.snoozedUntil});
    }
    e.status=target;this.notifications.dismiss(s,e,now);return e;
  });}
  history(actor,patientId){return this.repository.read(s=>{
    this.patient(s,actor,patientId);const events=s.events.filter(e=>e.patientId===patientId);
    const completed=events.filter(e=>e.status==='COMPLETED').length,skipped=events.filter(e=>e.status==='SKIPPED').length,snoozed=events.filter(e=>e.snoozeCount>0).length;
    const missed=s.moments.filter(m=>m.patientId===patientId).map(m=>({id:m.id,title:m.title,count:events.filter(e=>e.recoveryMomentId===m.id&&(e.status==='SKIPPED'||(e.status==='EXPIRED'&&e.expiredReason==='Daily availability expired'))).length})).filter(m=>m.count).sort((a,b)=>b.count-a.count);
    return {events,analytics:{suggested:events.length,completed,skipped,snoozed,completionPercentage:events.length?Math.round(completed/events.length*100):0,mostFrequentlyMissed:missed},note:'Counts describe recorded activity only; they do not indicate clinical progress.'};
  });}
}

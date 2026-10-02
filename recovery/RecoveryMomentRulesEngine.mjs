import {localTime,minute,withinHours} from './domain.mjs';

// Pure eligibility boundary: a future recommender may rank eligible prescriptions,
// but must still pass these therapist-defined constraints before delivery.
export class RecoveryMomentRulesEngine {
  current(m,now,patient){const {date}=localTime(now,patient.timeZone);return m.active&&date>=m.startDate&&(!m.endDate||date<=m.endDate);}
  permitted(m,now,patient){return this.current(m,now,patient)&&withinHours(localTime(now,patient.timeZone).time,m.allowedStartTime,m.allowedEndTime);}
  approvalsValid(m,state){return m.exercises.every(e=>state.approvals.some(a=>a.patientId===m.patientId&&a.therapistId===m.therapistId&&a.exerciseId===e.exerciseId&&a.active&&e.durationSeconds<=a.maxDurationSeconds&&e.repetitions<=a.maxRepetitions));}
  limits(patient,state,now){
    const configured=state.moments.filter(m=>m.patientId===patient.id&&this.current(m,now,patient));
    return {maxPerDay:Math.min(...configured.map(m=>m.maxPerDay),12),minimumIntervalMinutes:Math.max(...configured.map(m=>m.minimumIntervalMinutes),1)};
  }
  trigger(m,patient,state,now){
    const {date,time}=localTime(now,patient.timeZone);
    if(['MORNING','EVENING','SCHEDULED'].includes(m.triggerType))return time>=m.triggerValue?`${m.id}:${date}`:null;
    if(m.triggerType==='MISSED_SESSION'){
      const routine=state.routines.find(r=>r.id===m.routineId&&r.patientId===patient.id&&r.active);
      if(!routine)return null;
      const log=state.routineLogs.find(l=>l.routineId===routine.id&&l.date===date);
      const missed=log?.status==='MISSED'||(!log&&minute(time)>=minute(routine.scheduledTime)+60);
      return missed?`${m.id}:${date}:${routine.id}`:null;
    }
    const signal=state.signals.filter(s=>s.patientId===patient.id&&s.type===m.triggerType&&new Date(s.expiresAt)>now&&(!s.momentId||s.momentId===m.id)).at(-1);
    if(!signal)return null;
    if(m.triggerType==='INACTIVITY'){
      if(signal.stoppedAt)return null;
      const minutes=signal.minutes+(now-new Date(signal.observedAt))/60000;
      if(minutes<=m.triggerValue)return null;
    }
    return `${m.id}:${date}:${signal.id}`;
  }
  evaluate(m,patient,state,now){
    if(!this.permitted(m,now,patient)||!this.approvalsValid(m,state))return null;
    const key=this.trigger(m,patient,state,now);
    if(!key||state.events.some(e=>e.triggerKey===key))return null;
    const {date}=localTime(now,patient.timeZone),limits=this.limits(patient,state,now);
    const events=state.events.filter(e=>e.patientId===patient.id);
    if(events.filter(e=>localTime(new Date(e.triggeredAt),patient.timeZone).date===date).length>=limits.maxPerDay)return null;
    // One outstanding suggestion per patient, including a snoozed suggestion.
    if(events.some(e=>['AVAILABLE','STARTED','SNOOZED'].includes(e.status)))return null;
    const previous=events.reduce((latest,e)=>!latest||e.triggeredAt>latest.triggeredAt?e:latest,null);
    if(previous&&now-new Date(previous.triggeredAt)<limits.minimumIntervalMinutes*60000)return null;
    return {triggerKey:key,date};
  }
}

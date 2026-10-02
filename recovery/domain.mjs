import { athletes, pros, rehabilitationExercises } from '../shared/catalog.mjs';
export const SAFETY_MESSAGE = 'Exercises shown here were selected or approved by your physiotherapist. Stop the exercise and contact your healthcare provider if you experience significant pain or concerning symptoms.';
export const TRIGGERS = {
  INACTIVITY:'Sitting / inactivity', MORNING:'Morning routine', BEFORE_ACTIVITY:'Before walking / exercise',
  AFTER_ACTIVITY:'After walking / exercise', EVENING:'Evening recovery', MISSED_SESSION:'Missed rehabilitation session',
  SCHEDULED:'Fixed scheduled time', MANUAL:'Manual therapist recommendation'
};
export class RecoveryError extends Error { constructor(status,message){super(message);this.status=status;} }
export const fail = (status,message) => {throw new RecoveryError(status,message);};
export const id = () => globalThis.crypto.randomUUID();
export function localTime(now,timeZone){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export const minute = time => Number(time.slice(0,2))*60+Number(time.slice(3,5));
export function withinHours(time,start,end){const t=minute(time),s=minute(start),e=minute(end);return s<e?t>=s&&t<e:t>=s||t<e;}
export function seedState(){
  const people=[...pros.map(p=>({id:p.id,name:p.n,role:p.id==='maya'?'THERAPIST':'COACH'})),...athletes.map(a=>({id:a.id,name:a.name,role:'PATIENT'}))];
  return {people,patients:athletes.map(a=>({id:a.id,therapistId:'maya',timeZone:'Asia/Kolkata'})),
    exercises:rehabilitationExercises.map(e=>({...e,mediaUrl:null,mediaType:null})),
    approvals:rehabilitationExercises.map(e=>({id:`ram-${e.id}`,patientId:'ram',therapistId:'maya',exerciseId:e.id,active:true,restrictions:'Stay within your prescribed comfortable range. Do not add resistance.',maxDurationSeconds:e.maxDurationSeconds,maxRepetitions:e.maxRepetitions})),
    routines:[{id:'ram-daily',patientId:'ram',therapistId:'maya',title:'Strength + mobility',scheduledTime:'19:30',exerciseIds:rehabilitationExercises.map(e=>e.id),active:true}],
    routineLogs:[],moments:[],events:[],notifications:[],signals:[]};
}

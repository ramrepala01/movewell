import React,{useEffect,useRef,useState} from 'react';
import {CheckCircle2,Clock} from 'lucide-react';
import {TRIGGERS} from '../domain.mjs';
import {recoveryClient as client} from '../client.mjs';
import {useRecoveryData} from './useRecoveryData.js';
import {RecoverySafety,RecoveryMode,ExerciseMedia} from './RecoveryShared.jsx';
const reasons={INACTIVITY:'You’ve reported sitting or inactivity for a while.',MORNING:'A short activity for your morning routine.',BEFORE_ACTIVITY:'You’re preparing to walk or exercise.',AFTER_ACTIVITY:'You’ve finished walking or exercise.',EVENING:'A short activity for your evening recovery.',MISSED_SESSION:'Your normal rehabilitation session was missed.',SCHEDULED:'It’s time for your scheduled recovery activity.',MANUAL:'Your physiotherapist recommended this activity.'};
const clockTime=(value,timeZone)=>new Date(value).toLocaleTimeString('en-IN',{timeZone,hour:'numeric',minute:'2-digit'});
function ExerciseStep({exercise,onNext,busy,last}){
  const [remaining,setRemaining]=useState(exercise.durationSeconds),[reps,setReps]=useState(0),[paused,setPaused]=useState(false);
  useEffect(()=>{
    if(paused)return;
    const deadline=Date.now()+remaining*1000;
    const timer=setInterval(()=>setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000))),250);
    return()=>clearInterval(timer);
  },[paused]);
  return <>
    <h2>{exercise.name}</h2><p>{exercise.bodyArea} · {exercise.difficulty}</p>
    <ExerciseMedia exercise={exercise}/><p className="recoveryInstructions">{exercise.instructions}</p>
    <p><strong>Exercise restrictions:</strong> {exercise.approvalRestrictions}</p>
    <div className="recoveryTimer" aria-label="Exercise timer">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</div>
    <p>{exercise.durationSeconds} seconds{exercise.repetitions?` · ${exercise.repetitions} repetitions`:''}</p>
    <div className="recoveryActions"><button onClick={()=>setPaused(p=>!p)}>{paused?'Resume timer':'Pause timer'}</button>{exercise.repetitions>0&&<button disabled={reps>=exercise.repetitions} onClick={()=>setReps(n=>Math.min(exercise.repetitions,n+1))}>Count repetition ({reps}/{exercise.repetitions})</button>}</div>
    <p className="recoveryHint">Follow the prescribed dose. You can record completion when the timer ends or the prescribed repetitions are counted.</p>
    <button className="primary" disabled={busy||(remaining>0&&(exercise.repetitions===0||reps<exercise.repetitions))} onClick={onNext}>{last?'Finish Recovery Moment':'Complete exercise & continue'}</button>
  </>;
}
function RecoveryRunner({event,busy,onProgress,onComplete,onClose,onSkip,error}){
  const exercises=event.snapshot.exercises,completed=event.completedExerciseIds||[],exercise=exercises.find(e=>!completed.includes(e.exerciseId));
  const container=useRef(null),busyRef=useRef(busy),closeRef=useRef(onClose);busyRef.current=busy;closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement,old=document.body.style.overflow;document.body.style.overflow='hidden';container.current?.focus();
    const onKey=e=>{
      if(e.key==='Escape'&&!busyRef.current)closeRef.current();
      if(e.key==='Tab'){
        const controls=[...container.current.querySelectorAll('button:not(:disabled),video[controls],[tabindex="0"]')];
        const first=controls[0],last=controls.at(-1);
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===container.current)){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=old;if(previous?.isConnected)previous.focus();};
  },[]);
  return <div className="modal recoveryModal"><section className="recoveryRunner" role="dialog" aria-modal="true" aria-labelledby="recovery-runner-title" tabIndex={-1} ref={container}>
    <div className="recoveryCardHeading"><h2 id="recovery-runner-title">{event.snapshot.title}</h2><button aria-label="Close exercise player" disabled={busy} onClick={onClose}>Close</button></div>
    <p>Exercise {Math.min(completed.length+1,exercises.length)} of {exercises.length}</p><p><strong>Prescription restrictions:</strong> {event.snapshot.restrictions}</p>
    {error&&<p role="alert" className="recoveryError">{error}</p>}
    {exercise?<ExerciseStep key={exercise.exerciseId} exercise={exercise} busy={busy} last={completed.length===exercises.length-1} onNext={()=>onProgress(exercise.exerciseId)}/>:<button className="primary" disabled={busy} onClick={onComplete}>Record completed Recovery Moment</button>}
    <RecoverySafety/><button disabled={busy} onClick={onSkip}>Stop & skip this moment</button>
  </section></div>;
}
export default function PatientRecovery(){
  const {data,error,busy,perform}=useRecoveryData('ram');
  const [runningId,setRunningId]=useState(null),[sittingMinutes,setSittingMinutes]=useState(0),[message,setMessage]=useState('');
  const today=data?.today,events=today?.events||[],running=events.find(e=>e.id===runningId&&e.status==='STARTED'&&e.availableNow);
  const action=(event,type,extra={})=>perform(()=>client.action(event.recoveryMomentId,type,{eventId:event.id,...extra}));
  async function start(event){const result=event.status==='STARTED'?event:await action(event,'start');if(result)setRunningId(event.id);}
  async function progress(exerciseId){
    const result=await perform(async()=>{
      const event=await client.action(running.recoveryMomentId,'progress',{eventId:running.id,exerciseId});
      if(event.completedExerciseIds.length===event.snapshot.exercises.length)return client.action(event.recoveryMomentId,'complete',{eventId:event.id,completedExerciseIds:event.completedExerciseIds});
      return event;
    });
    if(result?.status==='COMPLETED'){setRunningId(null);setMessage('Recovery Moment completed.');}
  }
  return <section className="patientRecovery" aria-labelledby="today-recovery-title">
    <div className="sectionHead"><h2 id="today-recovery-title">Today’s Recovery</h2>{today&&<span>{today.date}</span>}</div>
    <RecoveryMode/>{error&&!running&&<p role="alert" className="recoveryError">{error}</p>}{message&&<p role="status" className="recoverySuccess">{message}</p>}
    {!data&&!error&&<p role="status">Loading your approved recovery activities…</p>}
    {today&&<>
      {today.notifications.length>0&&<p role="status" className="recoveryNotification"><Clock size={18}/> A Recovery Moment from your physiotherapist is available.</p>}
      {events.filter(e=>['AVAILABLE','STARTED'].includes(e.status)&&e.availableNow).map(event=><article key={event.id} className="recoveryCard recoveryAvailable">
        <small>RECOVERY MOMENT</small><h3>{event.snapshot.title}</h3><p>{reasons[event.snapshot.triggerType]}</p><p>Your physiotherapist recommends this {event.snapshot.exercises.reduce((sum,e)=>sum+e.durationSeconds,0)}-second activity.</p>
        <p><strong>Restrictions:</strong> {event.snapshot.restrictions}</p><RecoverySafety/>
        <div className="recoveryActions"><button className="primary" disabled={busy} onClick={()=>start(event)}>{event.status==='STARTED'?'Continue':'Start'}</button>{event.status==='AVAILABLE'&&<button disabled={busy} onClick={()=>action(event,'snooze',{minutes:15})}>Remind Me Later</button>}<button disabled={busy} onClick={()=>action(event,'skip')}>Skip</button></div>
      </article>)}
      {!today.scheduled.length&&!events.length&&<div className="recoveryEmpty"><p>Your physiotherapist hasn’t prescribed any Recovery Moments yet. Your normal care plan is still available in My plan.</p></div>}
      <ul className="recoveryTimeline">
        {events.map(e=><li key={e.id}><span>{clockTime(e.triggeredAt,today.timeZone)}</span><strong>{e.snapshot.title}</strong><span>{e.status==='COMPLETED'?<><CheckCircle2 size={16}/> Completed</>:e.status==='SNOOZED'?`Remind after ${clockTime(e.snoozedUntil,today.timeZone)}`:e.status.toLowerCase()}</span></li>)}
        {today.scheduled.filter(m=>!events.some(e=>e.recoveryMomentId===m.id)).map(m=><li key={m.id}><span>{['MORNING','EVENING','SCHEDULED'].includes(m.triggerType)?m.triggerValue:TRIGGERS[m.triggerType]}</span><strong>{m.title}</strong><span>When eligible</span></li>)}
        {today.routines.map(r=><li key={r.id}><span>{r.scheduledTime}</span><strong>Normal rehabilitation · {r.title}</strong><span>{r.status.toLowerCase()}</span></li>)}
      </ul>
      {today.scheduled.length>0&&<details className="recoveryContext"><summary>Tell us about your day</summary><p>These are your own activity reports. MoveWell does not infer sitting or body movement from your phone or browser activity.</p>
        <div className="recoveryActions"><label>Sitting / inactive minutes<input type="number" min="0" max="480" value={sittingMinutes} onChange={e=>setSittingMinutes(Number(e.target.value))}/></label><button disabled={busy} onClick={()=>perform(()=>client.signal({type:'INACTIVITY',minutes:sittingMinutes}))}>Report sitting</button><button disabled={busy} onClick={()=>perform(()=>client.signal({type:'STOP_INACTIVITY'}))}>I’m moving now</button></div>
        <div className="recoveryActions"><button disabled={busy} onClick={()=>perform(()=>client.signal({type:'BEFORE_ACTIVITY'}))}>Before walking / exercise</button><button disabled={busy} onClick={()=>perform(()=>client.signal({type:'AFTER_ACTIVITY'}))}>After walking / exercise</button>{today.routines.map(r=><button key={r.id} disabled={busy||r.status==='COMPLETED'} onClick={()=>perform(()=>client.routineStatus(r.id,'MISSED'))}>I missed my normal session</button>)}</div>
      </details>}
      <RecoverySafety/>
    </>}
    {running&&<RecoveryRunner event={running} busy={busy} error={error} onProgress={progress} onComplete={async()=>{const result=await action(running,'complete',{completedExerciseIds:running.completedExerciseIds});if(result)setRunningId(null);}} onClose={()=>setRunningId(null)} onSkip={async()=>{const result=await action(running,'skip');if(result)setRunningId(null);}}/>}
  </section>;
}

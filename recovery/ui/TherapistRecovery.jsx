import React,{useState} from 'react';
import {Activity,Users,Plus} from 'lucide-react';
import {TRIGGERS,localTime} from '../domain.mjs';
import {recoveryClient as client} from '../client.mjs';
import {useRecoveryData} from './useRecoveryData.js';
import {RecoverySafety,RecoveryMode,ExerciseMedia} from './RecoveryShared.jsx';

function PrescriptionForm({patient,initial,onSave,onCancel,busy}){
  const [draft,setDraft]=useState(()=>initial?{...initial,exercises:initial.exercises.map(e=>({...e}))}:{patientId:patient.id,title:'',description:'',triggerType:'INACTIVITY',triggerValue:45,allowedStartTime:'08:00',allowedEndTime:'20:00',maxPerDay:3,minimumIntervalMinutes:60,active:true,startDate:localTime(new Date(),patient.timeZone).date,endDate:'',restrictions:'',routineId:'',exercises:[]});
  const set=(key,value)=>setDraft(d=>({...d,[key]:value}));
  const selectedRoutine=patient.routines.find(r=>r.id===draft.routineId);
  const library=patient.exercises.filter(e=>draft.triggerType!=='MISSED_SESSION'||selectedRoutine?.exerciseIds.includes(e.id));
  const toggle=exercise=>setDraft(d=>({...d,exercises:d.exercises.some(e=>e.exerciseId===exercise.id)?d.exercises.filter(e=>e.exerciseId!==exercise.id):[...d.exercises,{exerciseId:exercise.id,instructions:exercise.instructions,durationSeconds:Math.min(90,exercise.approval.maxDurationSeconds),repetitions:Math.min(10,exercise.approval.maxRepetitions)}]}));
  const changeExercise=(exerciseId,key,value)=>setDraft(d=>({...d,exercises:d.exercises.map(e=>e.exerciseId===exerciseId?{...e,[key]:value}:e)}));
  const changeTrigger=value=>setDraft(d=>({...d,triggerType:value,triggerValue:value==='INACTIVITY'?45:['MORNING','EVENING','SCHEDULED'].includes(value)?value==='EVENING'?'19:00':'08:00':null,routineId:'',exercises:value==='MISSED_SESSION'?[]:d.exercises}));
  return <form className="recoveryForm" onSubmit={e=>{e.preventDefault();onSave(draft);}}>
    <h2>{initial?'Edit Recovery Moment':'Create Recovery Moment'}</h2>
    <p>Prescribing for <strong>{patient.name}</strong>. Select existing approved exercises and stay within their limits.</p>
    <label>Title<input required maxLength={120} value={draft.title} onChange={e=>set('title',e.target.value)}/></label>
    <label>Description<textarea maxLength={1000} value={draft.description} onChange={e=>set('description',e.target.value)}/></label>
    <div className="recoveryFormGrid">
      <label>Trigger<select aria-label="Trigger" value={draft.triggerType} onChange={e=>changeTrigger(e.target.value)}>{Object.entries(TRIGGERS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      {draft.triggerType==='INACTIVITY'&&<label>Sitting longer than (minutes)<input type="number" required min="1" max="480" value={draft.triggerValue} onChange={e=>set('triggerValue',Number(e.target.value))}/></label>}
      {['MORNING','EVENING','SCHEDULED'].includes(draft.triggerType)&&<label>Suggestion time<input type="time" required value={draft.triggerValue} onChange={e=>set('triggerValue',e.target.value)}/></label>}
      {draft.triggerType==='MISSED_SESSION'&&<label>Approved normal routine<select required value={draft.routineId} onChange={e=>{set('routineId',e.target.value);set('exercises',[]);}}><option value="">Choose routine</option>{patient.routines.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>}
      <label>Allowed from<input type="time" required value={draft.allowedStartTime} onChange={e=>set('allowedStartTime',e.target.value)}/></label>
      <label>Allowed until<input type="time" required value={draft.allowedEndTime} onChange={e=>set('allowedEndTime',e.target.value)}/></label>
      <label>Maximum per day<input type="number" required min="1" max="12" value={draft.maxPerDay} onChange={e=>set('maxPerDay',Number(e.target.value))}/></label>
      <label>Minimum interval (minutes)<input type="number" required min="1" max="1440" value={draft.minimumIntervalMinutes} onChange={e=>set('minimumIntervalMinutes',Number(e.target.value))}/></label>
      <label>Start date<input type="date" required value={draft.startDate} onChange={e=>set('startDate',e.target.value)}/></label>
      <label>End date (optional)<input type="date" min={draft.startDate} value={draft.endDate||''} onChange={e=>set('endDate',e.target.value)}/></label>
    </div>
    <p className="recoveryHint">Times use {patient.timeZone}. The strictest active daily limit and interval apply across this patient’s Recovery Moments. Snoozing also respects these limits.</p>
    <label>Contraindications / restrictions<textarea required maxLength={2000} placeholder="Specify restrictions, or explicitly state no additional restrictions." value={draft.restrictions} onChange={e=>set('restrictions',e.target.value)}/></label>
    <label className="recoveryCheck"><input type="checkbox" checked={draft.active} onChange={e=>set('active',e.target.checked)}/> Active prescription</label>
    <fieldset><legend>Patient’s approved exercise library</legend>
      {!library.length&&<p>{draft.triggerType==='MISSED_SESSION'&&!selectedRoutine?'Choose a routine first.':'No approved exercises are available for this patient. An approved care plan is required before prescribing.'}</p>}
      {library.map(exercise=>{
        const selected=draft.exercises.find(e=>e.exerciseId===exercise.id);
        return <div className="recoveryApproved" key={exercise.id}>
          <label className="recoveryCheck"><input type="checkbox" checked={!!selected} onChange={()=>toggle(exercise)}/><strong>{exercise.name}</strong></label>
          <p>{exercise.bodyArea} · {exercise.difficulty} · Approved maximum {exercise.approval.maxDurationSeconds}s / {exercise.approval.maxRepetitions} repetitions</p>
          <p>Existing restriction: {exercise.approval.restrictions}</p><ExerciseMedia exercise={exercise}/>
          {selected&&<><label>Instructions<textarea required maxLength={1000} value={selected.instructions} onChange={e=>changeExercise(exercise.id,'instructions',e.target.value)}/></label><div className="recoveryFormGrid">
            <label>Duration (seconds)<input type="number" required min="1" max={Math.min(180,exercise.approval.maxDurationSeconds)} value={selected.durationSeconds} onChange={e=>changeExercise(exercise.id,'durationSeconds',Number(e.target.value))}/></label>
            <label>Repetitions (0 for timed only)<input type="number" required min="0" max={exercise.approval.maxRepetitions} value={selected.repetitions} onChange={e=>changeExercise(exercise.id,'repetitions',Number(e.target.value))}/></label>
          </div></>}
        </div>;
      })}
    </fieldset>
    <p className="recoveryHint">Exercises run in selection order. Total duration: {draft.exercises.reduce((n,e)=>n+e.durationSeconds,0)} seconds (maximum 300). Missed-session doses are explicitly prescribed here.</p>
    <RecoverySafety/>
    <div className="recoveryActions"><button type="submit" className="primary" disabled={busy||!draft.exercises.length}>{busy?'Saving…':'Save Recovery Moment'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
export default function TherapistRecovery({setMode}){
  const [patientId,setPatientId]=useState('ram'),[editing,setEditing]=useState(null),[creating,setCreating]=useState(false),[message,setMessage]=useState('');
  const {data,error,busy,perform}=useRecoveryData('maya',patientId);
  const patient=data?.catalog.patients.find(p=>p.id===patientId),stats=data?.history.analytics;
  const save=async draft=>{const result=await perform(()=>editing?client.update(editing.id,draft):client.create(draft));if(result){setCreating(false);setEditing(null);setMessage('Recovery Moment saved.');}};
  return <div className="coach recoveryTherapist">
    <header className="coachHeader"><div><div className="brand"><b>move</b>well <em>CARE</em></div><small>Dr. Maya Rao · Physiotherapist</small></div><div className="coachActions"><button onClick={()=>setMode('Athlete')}>Patient app</button><button onClick={()=>setMode('Coach')}>S&C Portal</button><div className="avatar">MR</div></div></header>
    <aside aria-label="Therapist navigation"><button className="selected" aria-current="page"><Activity/>Recovery Moments</button><button onClick={()=>setMode('Athlete')}><Users/>Patient app</button></aside>
    <section className="coachMain recoveryWorkspace">
      <div className="desktopTitle"><div><small>THERAPIST-APPROVED CARE</small><h1>Recovery Moments</h1><p>Short activities from your patient’s approved care plan.</p></div><button className="primary" disabled={busy||!patient?.exercises.length} onClick={()=>{setCreating(true);setEditing(null);setMessage('');}}><Plus/>Create Recovery Moment</button></div>
      <RecoveryMode/>
      <label className="recoveryPatientSelect">Select patient<select aria-label="Select patient" value={patientId} disabled={busy} onChange={e=>{setPatientId(e.target.value);setCreating(false);setEditing(null);setMessage('');}}>{(data?.catalog.patients||[{id:'ram',name:'Ram R.'}]).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
      {error&&<p role="alert" className="recoveryError">{error}</p>}{message&&<p role="status" className="recoverySuccess">{message}</p>}
      {!data&&!error&&<p role="status">Loading Recovery Moments…</p>}
      {data&&patient&&<>
        {stats&&<><div className="recoveryStats">{[['Suggested',stats.suggested],['Completed',stats.completed],['Skipped',stats.skipped],['Snoozed',stats.snoozed],['Completion',`${stats.completionPercentage}%`]].map(([label,value])=><div key={label}><b>{value}</b><span>{label}</span></div>)}</div><p className="recoveryHint">{data.history.note} Snoozed counts include moments later completed.</p></>}
        {(creating||editing)?<PrescriptionForm key={editing?.id||`new-${patient.id}`} patient={patient} initial={editing} onSave={save} onCancel={()=>{setCreating(false);setEditing(null);}} busy={busy}/>:<>
          {!data.moments.length&&<div className="recoveryEmpty"><h2>No Recovery Moments prescribed yet</h2><p>{patient.exercises.length?'Create a moment using this patient’s approved exercises.':'This patient has no approved rehabilitation exercises yet.'}</p></div>}
          <div className="recoveryPrescriptionList">{data.moments.map(m=><article className="recoveryCard" key={m.id}><div className="recoveryCardHeading"><h2>{m.title}</h2><span className="pill">{m.active?'Active':'Inactive'}</span></div><p>{m.description}</p><p>{TRIGGERS[m.triggerType]}{m.triggerValue!==null?` · ${m.triggerValue}${m.triggerType==='INACTIVITY'?' minutes':''}`:''}</p><p>{m.allowedStartTime}–{m.allowedEndTime} · {m.maxPerDay}/day · {m.minimumIntervalMinutes} min interval</p><p>{m.startDate}{m.endDate?` to ${m.endDate}`:' onwards'}</p><ul>{m.exercises.map(e=><li key={e.exerciseId}>{e.name} · {e.durationSeconds}s{e.repetitions?` · ${e.repetitions} reps`:''}</li>)}</ul><p><strong>Restrictions:</strong> {m.restrictions}</p>
            <div className="recoveryActions"><button disabled={busy} onClick={()=>{setEditing(m);setCreating(false);setMessage('');}}>Edit</button><button disabled={busy} onClick={()=>perform(()=>client.update(m.id,{...m,active:!m.active}))}>{m.active?'Deactivate':'Activate'}</button>{m.active&&m.triggerType==='MANUAL'&&<button disabled={busy} onClick={async()=>{const result=await perform(()=>client.recommend(m.id));if(result)setMessage(result.message);}}>Recommend now</button>}<button disabled={busy||!m.active} onClick={()=>perform(()=>client.remove(m.id))}>Archive</button></div>
          </article>)}</div>
          <h2>Most frequently missed</h2>{stats?.mostFrequentlyMissed.length?<ul>{stats.mostFrequentlyMissed.map(m=><li key={m.id}>{m.title}: {m.count} skipped or expired</li>)}</ul>:<p>No skipped or expired suggestions recorded.</p>}
          <h2>Recent activity</h2><ul className="recoveryTimeline">{data.history.events.slice(-10).reverse().map(e=><li key={e.id}><span>{new Date(e.triggeredAt).toLocaleString('en-IN',{timeZone:patient.timeZone})}</span><strong>{e.snapshot.title}</strong><span>{e.status.toLowerCase()}</span></li>)}</ul>
          <RecoverySafety/>
        </>}
      </>}
    </section>
  </div>;
}

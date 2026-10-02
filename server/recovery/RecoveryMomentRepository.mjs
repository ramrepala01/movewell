import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedState } from '../../recovery/domain.mjs';

export class RecoveryMomentRepository {
  constructor(filename=':memory:'){
    if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    if(!this.db.prepare('SELECT version FROM schema_migrations WHERE version=1').get()){
      this.db.exec('BEGIN IMMEDIATE');
      try{this.db.exec(readFileSync(new URL('../migrations/001_recovery_moments.sql',import.meta.url),'utf8'));this.db.prepare('INSERT INTO schema_migrations VALUES(1,?)').run(new Date().toISOString());this.save(seedState());this.db.exec('COMMIT');}
      catch(e){this.db.exec('ROLLBACK');throw e;}
    }
  }
  load(){
    const rows=table=>this.db.prepare(`SELECT * FROM ${table}`).all();
    const json=table=>rows(table).map(r=>JSON.parse(r.data));
    const exercises=rows('recovery_moment_exercises');
    return {people:rows('people'),patients:rows('patients'),exercises:json('exercises'),approvals:json('exercise_approvals'),routines:json('rehabilitation_routines'),routineLogs:json('routine_logs'),
      moments:rows('recovery_moments').map(m=>({...m,active:!!m.active,triggerValue:m.triggerValue===null?null:JSON.parse(m.triggerValue),exercises:exercises.filter(e=>e.recoveryMomentId===m.id).sort((a,b)=>a.sortOrder-b.sortOrder).map(e=>({id:e.id,exerciseId:e.exerciseId,order:e.sortOrder,durationSeconds:e.durationSeconds,repetitions:e.repetitions,instructions:e.instructions}))})),
      events:json('recovery_moment_events'),notifications:json('recovery_notifications'),signals:json('recovery_signals')};
  }
  save(s){
    const upsert=(table,columns,values)=>this.db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter(c=>c!=='id').map(c=>`${c}=excluded.${c}`).join(',')}`).run(...values);
    for(const p of s.people)upsert('people',['id','name','role'],[p.id,p.name,p.role]);
    for(const p of s.patients)upsert('patients',['id','therapistId','timeZone'],[p.id,p.therapistId,p.timeZone]);
    for(const e of s.exercises)upsert('exercises',['id','data'],[e.id,JSON.stringify(e)]);
    for(const a of s.approvals)upsert('exercise_approvals',['id','patientId','therapistId','exerciseId','data'],[a.id,a.patientId,a.therapistId,a.exerciseId,JSON.stringify(a)]);
    for(const [table,key] of [['rehabilitation_routines','routines'],['routine_logs','routineLogs'],['recovery_notifications','notifications'],['recovery_signals','signals']])for(const x of s[key])upsert(table,['id','patientId','data'],[x.id,x.patientId,JSON.stringify(x)]);
    const fields=['id','patientId','therapistId','title','description','triggerType','triggerValue','allowedStartTime','allowedEndTime','maxPerDay','minimumIntervalMinutes','active','startDate','endDate','restrictions','routineId','createdAt','updatedAt'];
    for(const m of s.moments){
      upsert('recovery_moments',fields,fields.map(k=>k==='triggerValue'?JSON.stringify(m[k]):k==='active'?Number(m[k]):m[k]??null));
      this.db.prepare('DELETE FROM recovery_moment_exercises WHERE recoveryMomentId=?').run(m.id);
      for(const e of m.exercises)upsert('recovery_moment_exercises',['id','recoveryMomentId','exerciseId','sortOrder','durationSeconds','repetitions','instructions'],[e.id,m.id,e.exerciseId,e.order,e.durationSeconds,e.repetitions,e.instructions]);
    }
    for(const e of s.events)upsert('recovery_moment_events',['id','recoveryMomentId','patientId','triggeredAt','startedAt','completedAt','status','data'],[e.id,e.recoveryMomentId,e.patientId,e.triggeredAt,e.startedAt,e.completedAt,e.status,JSON.stringify(e)]);
  }
  read(fn){return fn(this.load());}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const s=this.load(),result=fn(s);this.save(s);this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  close(){this.db.close();}
}

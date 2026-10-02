import {seedState} from './domain.mjs';
import {RecoveryMomentService} from './RecoveryMomentService.mjs';
const KEY='movewell-recovery-v1';
class LocalDemoRepository {
  load(){const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):seedState();}
  read(fn){return fn(this.load());}
  transaction(fn){const s=this.load(),result=fn(s);localStorage.setItem(KEY,JSON.stringify(s));return result;}
}
const localDemo=import.meta.env.VITE_RECOVERY_MODE==='local'||(!import.meta.env.DEV&&!import.meta.env.VITE_API_BASE_URL);
let actor=null;
const service=localDemo?new RecoveryMomentService(new LocalDemoRepository()):null;
async function request(path,method='GET',body){
  const response=await fetch(`${import.meta.env.VITE_API_BASE_URL||''}/api${path}`,{method,credentials:'include',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load Recovery Moments.');return data;
}
async function localCall(fn){return navigator.locks?navigator.locks.request(KEY,fn):fn();}
export const recoveryClient={
  localDemo,
  async session(personId){
    if(localDemo){actor=seedState().people.find(p=>p.id===personId);if(!actor)throw new Error('Unknown demo account.');return {actor,demo:true};}
    const current=await request('/session').catch(e=>{if(e.message==='Sign in to continue.')return null;throw e;});
    if(current?.actor.id===personId)return current;
    return request('/demo/session','POST',{personId});
  },
  catalog:()=>localDemo?localCall(()=>service.catalog(actor)):request('/recovery-moments/catalog'),
  today:()=>localDemo?localCall(()=>service.today(actor)):request('/recovery-moments/today'),
  list:patientId=>localDemo?localCall(()=>service.list(actor,patientId)):request(`/patients/${patientId}/recovery-moments`),
  history:patientId=>localDemo?localCall(()=>service.history(actor,patientId)):request(`/patients/${patientId}/recovery-moment-history`),
  create:body=>localDemo?localCall(()=>service.create(actor,body)):request('/recovery-moments','POST',body),
  update:(momentId,body)=>localDemo?localCall(()=>service.update(actor,momentId,body)):request(`/recovery-moments/${momentId}`,'PUT',body),
  remove:momentId=>localDemo?localCall(()=>service.remove(actor,momentId)):request(`/recovery-moments/${momentId}`,'DELETE'),
  recommend:momentId=>localDemo?localCall(()=>service.recommend(actor,momentId)):request(`/recovery-moments/${momentId}/recommend`,'POST',{}),
  signal:body=>localDemo?localCall(()=>service.signal(actor,body)):request('/recovery-context','POST',body),
  routineStatus:(routineId,status)=>localDemo?localCall(()=>service.routineStatus(actor,routineId,status)):request(`/rehabilitation-routines/${routineId}/status`,'POST',{status}),
  action:(momentId,action,body)=>localDemo?localCall(()=>service.action(actor,momentId,action,body)):request(`/recovery-moments/${momentId}/${action}`,'POST',body)
};

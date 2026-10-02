import {useCallback,useEffect,useRef,useState} from 'react';
import {recoveryClient as client} from '../client.mjs';
export function useRecoveryData(accountId,patientId='ram'){
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const alive=useRef(true),running=useRef(false),generation=useRef(0);
  const reload=useCallback(async()=>{
    const version=++generation.current;
    await client.session(accountId);
    const catalog=await client.catalog();
    const result=accountId==='ram'?{catalog,today:await client.today()}:{catalog,moments:await client.list(patientId),history:await client.history(patientId)};
    if(alive.current&&generation.current===version){setData(result);setError('');}
    return result;
  },[accountId,patientId]);
  useEffect(()=>{
    alive.current=true;setData(null);
    const refresh=()=>{if(!running.current)reload().catch(e=>{if(alive.current)setError(e.message);});};
    refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
    const onVisible=()=>{if(document.visibilityState==='visible')refresh();};document.addEventListener('visibilitychange',onVisible);
    return()=>{alive.current=false;++generation.current;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
  },[reload]);
  const perform=async(fn)=>{
    if(running.current)return null;running.current=true;setBusy(true);setError('');
    try{const result=await fn();await reload();return result;}catch(e){if(alive.current)setError(e.message);return null;}
    finally{running.current=false;if(alive.current)setBusy(false);}
  };
  return {data,error,busy,reload,perform};
}

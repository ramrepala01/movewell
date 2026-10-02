import React from 'react';
import {SAFETY_MESSAGE} from '../domain.mjs';
import {recoveryClient} from '../client.mjs';
export function RecoverySafety(){return <p className="recoverySafety">{SAFETY_MESSAGE}</p>;}
export function RecoveryMode(){return <p className="recoveryMode">{recoveryClient.localDemo?'Local demo · Sample records are stored in this browser only.':'Sample-account demo · Recovery Moments are saved by the MoveWell API.'}</p>;}
export function ExerciseMedia({exercise}){
  const url=exercise.mediaUrl;
  if(!url||!/^https:\/\//.test(url))return null;
  return exercise.mediaType==='video'?<video className="recoveryMedia" src={url} controls preload="metadata"/>:<img className="recoveryMedia" src={url} alt={exercise.name}/>;
}

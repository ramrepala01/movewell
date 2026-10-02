import {id} from './domain.mjs';

// Durable in-app outbox. Mobile push adapters can consume this outbox later.
// No browser permission prompt or repeated polling notification is emitted.
export class RecoveryMomentNotificationService {
  deliver(state,event,now,minimumIntervalMinutes){
    const previous=state.notifications.filter(n=>n.patientId===event.patientId).reduce((latest,n)=>!latest||n.createdAt>latest.createdAt?n:latest,null);
    if(previous&&now-new Date(previous.createdAt)<minimumIntervalMinutes*60000)return false;
    const sequence=event.snoozeCount||0;
    if(state.notifications.some(n=>n.eventId===event.id&&n.sequence===sequence))return true;
    state.notifications.push({id:id(),patientId:event.patientId,eventId:event.id,sequence,channel:'IN_APP',createdAt:now.toISOString(),readAt:null});
    return true;
  }
  dismiss(state,event,now){for(const n of state.notifications)if(n.eventId===event.id&&!n.readAt)n.readAt=now.toISOString();}
}

// Existing MoveWell demo records, shared by the original UI and Recovery Moments.
export const pros = [
  {id:'maya',n:'Dr. Maya Rao',r:'Physiotherapist',s:'Sports injury • Mobility',t:'4.9',next:'Today, 5:30 PM'},
  {id:'arjun',n:'Arjun Mehta',r:'S&C Coach',s:'Strength • Conditioning',t:'4.8',next:'Tomorrow, 7:00 AM'},
  {id:'nisha',n:'Nisha Kapoor',r:'Yoga Therapist',s:'Mobility • Recovery',t:'4.9',next:'Fri, 6:00 PM'}
];
export const initialExercises = [
  {name:'Trap Bar Deadlift',type:'Strength',sets:4,reps:'5',load:'RPE 7',cue:'Brace, push the floor away, finish tall.'},
  {name:'Rear-Foot Elevated Split Squat',type:'Strength',sets:3,reps:'8 / side',load:'RPE 7',cue:'Control the lowering phase and keep knee tracking over toes.'},
  {name:'Nordic Hamstring',type:'Injury prevention',sets:3,reps:'5',load:'Bodyweight',cue:'Keep hips extended and lower under control.'},
  {name:'10 m Acceleration',type:'Speed',sets:6,reps:'1',load:'Full recovery',cue:'Project forward for the first three steps.'}
];
export const athletes = [
  {id:'ram',name:'Ram R.',sport:'Cricket • WK/Batter',status:'Ready',load:'Moderate',protein:132,target:140,water:2.6,weight:70.4},
  {id:'aarav',name:'Aarav S.',sport:'Football • Midfielder',status:'Ready',load:'High',protein:118,target:130,water:3.1,weight:67.8},
  {id:'ishaan',name:'Ishaan K.',sport:'Tennis',status:'Modified',load:'Low',protein:104,target:125,water:2.2,weight:64.1}
];
export const rehabilitationExercises = [
  {id:'cat-cow',name:'Cat-cow mobility',prescription:'2 sets · 10 reps',instructions:'Keep movement controlled and follow your provider’s instructions.',bodyArea:'Back',difficulty:'Gentle',maxDurationSeconds:120,maxRepetitions:20},
  {id:'bird-dog',name:'Bird dog',prescription:'3 sets · 8 each side',instructions:'Keep movement controlled and follow your provider’s instructions.',bodyArea:'Core',difficulty:'Moderate',maxDurationSeconds:180,maxRepetitions:24},
  {id:'hip-flexor',name:'Hip flexor stretch',prescription:'3 × 30 sec each side',instructions:'Keep movement controlled and follow your provider’s instructions.',bodyArea:'Hip',difficulty:'Gentle',maxDurationSeconds:180,maxRepetitions:3},
  {id:'glute-bridge',name:'Glute bridge',prescription:'3 sets · 12 reps',instructions:'Keep movement controlled and follow your provider’s instructions.',bodyArea:'Hip',difficulty:'Moderate',maxDurationSeconds:180,maxRepetitions:36}
];
export const plan = rehabilitationExercises.map((e,i)=>`${e.name}|${e.prescription}|${i<2?'Done':'Start'}`);

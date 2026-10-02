import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {RecoveryMomentRepository} from '../server/recovery/RecoveryMomentRepository.mjs';
import {createApp} from '../server/app.mjs';
import {SAFETY_MESSAGE} from '../recovery/domain.mjs';

const repository=new RecoveryMomentRepository();
let now=new Date('2026-10-02T05:00:00Z');
const api=createApp(repository,{demoAuth:true,clock:()=>now,appOrigin:'http://127.0.0.1:5175'});
await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(0,'127.0.0.1',resolve);});
const mode=process.env.BROWSER_TEST_MODE||'api';
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(mode==='local'?['preview']:[]),'--host','127.0.0.1','--port','5175','--strictPort'],{env:{...process.env,MOVEWELL_API_PROXY:`http://127.0.0.1:${api.address().port}`},stdio:['ignore','pipe','pipe']});
let browser,page;
try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Vite startup timed out')),30000);vite.stdout.on('data',chunk=>{if(chunk.toString().includes('127.0.0.1:5175')){clearTimeout(timeout);resolve();}});vite.stderr.on('data',chunk=>process.stderr.write(chunk));vite.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Vite exited: ${code}`));});});
  console.log('Temporary API and frontend ready');
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  page=await browser.newPage({viewport:{width:375,height:667}});
  page.setDefaultTimeout(30000);
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5175/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByText('Your physiotherapist hasn’t prescribed any Recovery Moments yet.',{exact:false}).waitFor();
  console.log('Patient dashboard loaded');
  await page.getByRole('button',{name:'Therapist portal',exact:true}).click();
  await page.getByRole('button',{name:'Create Recovery Moment',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Approved mobility test');
  await page.getByLabel('Trigger',{exact:true}).selectOption('MANUAL');
  await page.getByLabel('Allowed from').fill('00:00');await page.getByLabel('Allowed until').fill('23:59');
  await page.getByLabel('Start date',{exact:true}).fill('2026-10-01');
  await page.getByLabel('Minimum interval (minutes)').fill('1');
  await page.getByLabel('Contraindications / restrictions').fill('Stay within the approved comfortable range.');
  await page.getByLabel('Cat-cow mobility',{exact:true}).check();
  await page.getByLabel('Hip flexor stretch',{exact:true}).check();
  for(const field of await page.getByLabel('Duration (seconds)',{exact:true}).all())await field.fill('1');
  for(const field of await page.getByLabel('Repetitions (0 for timed only)',{exact:true}).all())await field.fill('0');
  await page.getByRole('button',{name:'Save Recovery Moment',exact:true}).click();
  await page.getByText('Recovery Moment saved.',{exact:true}).waitFor();
  console.log('Therapist prescription saved');
  await page.getByRole('button',{name:'Recommend now',exact:true}).click();
  await page.getByText('Recommendation requested.',{exact:false}).waitFor();
  await page.locator('.coachActions').getByRole('button',{name:'Patient app',exact:true}).click();
  await page.locator('.recoveryAvailable').getByRole('button',{name:'Start',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('heading',{name:'Cat-cow mobility',exact:true}).waitFor();
  assert.ok(await dialog.getByText(SAFETY_MESSAGE,{exact:true}).isVisible());
  await dialog.getByRole('button',{name:'Complete exercise & continue',exact:true}).click();
  await dialog.getByRole('heading',{name:'Hip flexor stretch',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Close exercise player'}).click();
  await page.locator('.recoveryAvailable').getByRole('button',{name:'Continue',exact:true}).click();
  await dialog.getByRole('heading',{name:'Hip flexor stretch',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Finish Recovery Moment',exact:true}).click();
  await page.getByText('Recovery Moment completed.',{exact:true}).waitFor();
  console.log('Patient completed and resumed prescribed exercises');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.recoveryTimeline').getByText('Completed',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Therapist portal',exact:true}).click();
  assert.equal(await page.locator('.recoveryStats>div').nth(1).locator('b').textContent(),'1');
  for(const [width,height] of [[320,568],[375,667],[640,360],[768,1024],[1024,768],[1440,900]]){
    await page.setViewportSize({width,height});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Therapist overflow at ${width}`);
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Prescription form overflow at ${width}`);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
  }
  if(mode==='api')now=new Date(now.getTime()+61000);
  else await page.evaluate(()=>{const key='movewell-recovery-v1',s=JSON.parse(localStorage.getItem(key));for(const e of s.events)e.triggeredAt=new Date(Date.now()-120000).toISOString();for(const n of s.notifications)n.createdAt=new Date(Date.now()-120000).toISOString();localStorage.setItem(key,JSON.stringify(s));});
  await page.getByRole('button',{name:'Recommend now',exact:true}).click();await page.getByText('Recommendation requested.',{exact:false}).waitFor();
  await page.locator('.coachActions').getByRole('button',{name:'Patient app',exact:true}).click();
  await page.locator('.recoveryAvailable').getByRole('button',{name:'Remind Me Later',exact:true}).click();
  await page.locator('.recoveryTimeline').getByText('Remind after',{exact:false}).waitFor();
  for(const width of [320,375,640,768,1024,1440]){
    await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Patient overflow at ${width}`);
  }
  if(mode==='api')now=new Date(now.getTime()+16*60000);
  else await page.evaluate(()=>{const key='movewell-recovery-v1',s=JSON.parse(localStorage.getItem(key));for(const e of s.events)if(e.status==='SNOOZED')e.snoozedUntil=new Date(Date.now()-1000).toISOString();for(const n of s.notifications)n.createdAt=new Date(Date.now()-120000).toISOString();localStorage.setItem(key,JSON.stringify(s));});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.recoveryAvailable').getByRole('button',{name:'Skip',exact:true}).click();await page.locator('.recoveryTimeline').getByText('skipped',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Therapist portal',exact:true}).click();
  await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('Updated mobility test');await page.getByRole('button',{name:'Save Recovery Moment',exact:true}).click();await page.getByRole('heading',{name:'Updated mobility test',exact:true}).waitFor();
  await page.getByRole('button',{name:'Deactivate',exact:true}).click();await page.getByRole('button',{name:'Activate',exact:true}).waitFor();
  await page.getByLabel('Select patient',{exact:true}).selectOption('aarav');await page.getByText('This patient has no approved rehabilitation exercises yet.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Create Recovery Moment',exact:true}).isEnabled(),false);
  await page.getByRole('button',{name:'S&C Portal',exact:true}).click();
  for(const width of [320,640,1440]){
    await page.setViewportSize({width,height:900});
    for(const name of ['Dashboard','Athletes','Programs','Exercise Library','Nutrition']){
      await page.locator('aside').getByRole('button',{name,exact:true}).click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Existing coach ${name} overflow at ${width}`);
    }
  }
  await page.locator('.coachActions').getByRole('button',{name:'Athlete app',exact:true}).click();
  for(const width of [320,640,1440]){
    await page.setViewportSize({width,height:900});
    for(const name of ['Home','Book','Plan','Nutrition','Messages','Profile']){
      await page.locator('nav').getByRole('button',{name,exact:true}).click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Existing patient ${name} overflow at ${width}`);
    }
  }
  assert.deepEqual(errors,[]);
  console.log(`Recovery Moments browser checks passed (${mode}): prescription, manual delivery, player, resume, completion, persistence, snooze, skip, edit, deactivate, empty library, 6 screen sizes.`);
}catch(error){
  if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:'/tmp/movewell-recovery-browser-failure.png',fullPage:true,timeout:5000}).catch(()=>{});}
  throw error;
}finally{
  await browser?.close();vite.kill('SIGTERM');await once(vite,'exit').catch(()=>{});await new Promise(resolve=>api.close(resolve));repository.close();
}

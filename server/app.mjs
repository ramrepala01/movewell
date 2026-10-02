import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {RecoveryMomentService} from '../recovery/RecoveryMomentService.mjs';
import {RecoveryError,fail} from '../recovery/domain.mjs';
const hash=token=>createHash('sha256').update(token).digest('hex');
export function createApp(repository,{demoAuth=false,clock=()=>new Date(),appOrigin=null}={}){
  const service=new RecoveryMomentService(repository,{clock});
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try{
      const url=new URL(req.url,'http://localhost'),path=url.pathname.split('/').filter(Boolean).map(decodeURIComponent),method=req.method;
      if(!['GET','POST','PUT','DELETE'].includes(method))fail(405,'Method not allowed.');
      if(method!=='GET'){
        const origin=req.headers.origin;
        if(origin&&(origin!==(appOrigin||`http://${req.headers.host}`)))fail(403,'Request origin is not permitted.');
        if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Cross-site requests are not permitted.');
      }
      let body={};
      if(['POST','PUT'].includes(method)){
        if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Send JSON data.');
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>65536)fail(413,'Request is too large.');}
        try{body=raw?JSON.parse(raw):{};}catch{fail(400,'Invalid JSON.');}
        if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Send a JSON object.');
      }
      const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('movewell_session='))?.slice('movewell_session='.length);
      const session=token?repository.db.prepare('SELECT personId FROM sessions WHERE tokenHash=? AND expiresAt>?').get(hash(token),clock().toISOString()):null;
      const actor=session?repository.read(s=>s.people.find(p=>p.id===session.personId)):null;
      let result,status=200;
      if(url.pathname==='/api/health'&&method==='GET')result={status:'ok',demoAuth};
      else if(url.pathname==='/api/demo/session'&&method==='POST'){
        if(!demoAuth)fail(403,'Demo sign-in is disabled.');
        const person=repository.read(s=>s.people.find(p=>p.id===body.personId));if(!person)fail(400,'Unknown sample account.');
        const value=randomBytes(32).toString('hex');
        if(token)repository.db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(hash(token));
        repository.db.prepare('DELETE FROM sessions WHERE expiresAt<=?').run(clock().toISOString());
        repository.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(value),person.id,new Date(clock().getTime()+8*3600000).toISOString());
        res.setHeader('Set-Cookie',`movewell_session=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${appOrigin?.startsWith('https:')?'; Secure':''}`);
        result={actor:person,demo:true};
      }else if(url.pathname==='/api/session/logout'&&method==='POST'){
        if(token)repository.db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(hash(token));res.setHeader('Set-Cookie','movewell_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');result={signedOut:true};
      }else{
        if(!actor)fail(401,'Sign in to continue.');
        if(url.pathname==='/api/session'&&method==='GET')result={actor,demo:demoAuth};
        else if(url.pathname==='/api/recovery-moments/catalog'&&method==='GET')result=service.catalog(actor);
        else if(url.pathname==='/api/recovery-moments/today'&&method==='GET')result=service.today(actor);
        else if(url.pathname==='/api/recovery-context'&&method==='POST')result=service.signal(actor,body);
        else if(url.pathname==='/api/recovery-moments'&&method==='POST'){result=service.create(actor,body);status=201;}
        else if(path[0]==='api'&&path[1]==='patients'&&path.length===4&&method==='GET'){
          if(path[3]==='recovery-moments')result=service.list(actor,path[2]);
          else if(path[3]==='recovery-moment-history')result=service.history(actor,path[2]);else fail(404,'Route not found.');
        }else if(path[0]==='api'&&path[1]==='rehabilitation-routines'&&path.length===4&&path[3]==='status'&&method==='POST')result=service.routineStatus(actor,path[2],body.status);
        else if(path[0]==='api'&&path[1]==='recovery-moments'&&path.length===3){
          if(method==='GET')result=service.get(actor,path[2]);else if(method==='PUT')result=service.update(actor,path[2],body);else if(method==='DELETE')result=service.remove(actor,path[2]);else fail(405,'Method not allowed.');
        }else if(path[0]==='api'&&path[1]==='recovery-moments'&&path.length===4&&method==='POST'){
          if(path[3]==='recommend')result=service.recommend(actor,path[2]);
          else if(['start','complete','skip','snooze','progress'].includes(path[3]))result=service.action(actor,path[2],path[3],body);else fail(404,'Route not found.');
        }else fail(404,'Route not found.');
      }
      res.writeHead(status);res.end(JSON.stringify(result));
    }catch(error){const status=error instanceof RecoveryError?error.status:500;if(status===500)console.error(error);res.writeHead(status);res.end(JSON.stringify({error:status===500?'Recovery Moments could not be processed.':error.message}));}
  });
}

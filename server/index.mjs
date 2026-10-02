import {resolve} from 'node:path';
import {RecoveryMomentRepository} from './recovery/RecoveryMomentRepository.mjs';
import {createApp} from './app.mjs';
const repository=new RecoveryMomentRepository(resolve(process.env.MOVEWELL_DB||'data/movewell.sqlite'));
const demoAuth=process.env.DEMO_AUTH_ENABLED==='true';
const server=createApp(repository,{demoAuth,appOrigin:process.env.APP_ORIGIN||null});
server.listen(Number(process.env.API_PORT||8787),process.env.API_HOST||'127.0.0.1',()=>console.log(`MoveWell API: http://${process.env.API_HOST||'127.0.0.1'}:${process.env.API_PORT||8787} (sample account access ${demoAuth?'enabled':'disabled'})`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{repository.close();process.exit(0);}));

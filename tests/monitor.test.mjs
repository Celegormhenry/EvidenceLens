import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMonitor,monitorStatus,monitorDescription,monitorProgress} from '../lib/monitor.ts';
import {handleTelem} from '../lib/telem-api.ts';
const m={id:'test-monitor',query:'NASA Artemis launch announcements',status:'active',expires_at:'2099-01-01T00:00:00Z',agent_state:{status:'compiling',next_run_at:null}};
const request=(action,body={id:m.id})=>new Request('http://localhost/api/telem/monitor-'+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost','oai-authenticated-user-id':crypto.randomUUID()},body:JSON.stringify(body)});
test('monitor state distinguishes preparing, paused, expired and failed states',()=>{
 assert.match(monitorDescription(m),/preparing/);
 assert.match(monitorDescription({...m,status:'paused'}),/Resume/);
 assert.equal(monitorStatus({...m,expires_at:'2000-01-01T00:00:00Z'}),'ended');
 assert.match(monitorDescription({...m,agent_state:{status:'failed'}}),/attention/);
 assert.equal(parseMonitor({status:'active'}),null);
 assert.equal(monitorProgress.create,'Starting monitor…');assert.equal(monitorProgress.pause,'Pausing monitor…');
});
test('create, status, pause, resume and end use the provider contract without leaking extra fields',async()=>{
 const original=globalThis.fetch;let status='active';const calls=[];
 globalThis.fetch=async(url,options)=>{
  assert.ok(url.startsWith('https://hack.telem.ai/api/v1/monitors'));
  calls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});
  if(options.method==='DELETE')return new Response(null,{status:204});
  if(options.method==='PATCH')status=JSON.parse(options.body).status;
  return Response.json({...m,status,webhook_secret:'secret',agent_state:{...m.agent_state,compile:{error:'sensitive internals'}}});
 };
 try{
  const created=await (await handleTelem(request('create',{query:m.query}),{TELEM_API_KEY:'test'})).json();assert.equal(created.id,m.id);assert.ok(!JSON.stringify(created).includes('secret'));assert.ok(!JSON.stringify(created).includes('sensitive'));
  assert.deepEqual(calls[0].body,{query:m.query,options:{frequency:'1h'},ttl:'4h',agent:true});
  assert.equal((await (await handleTelem(request('status'),{TELEM_API_KEY:'test'})).json()).agent_state.status,'compiling');
  assert.equal((await (await handleTelem(request('pause'),{TELEM_API_KEY:'test'})).json()).status,'paused');
  assert.equal((await (await handleTelem(request('resume'),{TELEM_API_KEY:'test'})).json()).status,'active');
  assert.equal((await (await handleTelem(request('end'),{TELEM_API_KEY:'test'})).json()).status,'ended');
  assert.deepEqual(calls.map(c=>c.method),['POST','GET','PATCH','PATCH','DELETE']);
 }finally{globalThis.fetch=original;}
});
test('malformed monitor creation is rejected instead of reporting a phantom success',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({status:'active'});
 try{const r=await handleTelem(request('create',{query:m.query}),{TELEM_API_KEY:'test'});assert.equal(r.status,502);assert.match((await r.json()).error,/invalid monitor/);}finally{globalThis.fetch=original;}
});

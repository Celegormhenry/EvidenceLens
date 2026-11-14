import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleTelem} from '../lib/telem-api.ts';
const make=(action,body={},origin='https://lens.example')=>new Request('https://lens.example/api/telem/'+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'oai-authenticated-user-id':crypto.randomUUID()},body:JSON.stringify(action==='research'?{researchMode:'quick',...body}:body)});
test('credentials are server-only and required for live work',async()=>{
 const r=await handleTelem(make('research',{topic:'test topic'}),{});assert.equal(r.status,503);
 const status=await handleTelem(new Request('https://lens.example/api/telem/status'),{TELEM_API_KEY:'test-only'});const d=await status.json();assert.equal(d.configured,true);assert.ok(!JSON.stringify(d).includes('test-only'));
});
test('hackathon base applies to search and fetch, with automatic routing and no redirects',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer hack-test-key');
  assert.ok(url.startsWith('https://hack.telem.ai/api/v1/'));
  if(url.endsWith('/search')){const body=JSON.parse(options.body);assert.equal(body.search.auto_routing,'accuracy');assert.equal(body.search.providers,undefined);return Response.json({results:[{url:'https://example.com/report',title:'Test report'}]});}
  return Response.json({fetched_results:[]});
 };
 try{
  const response=await handleTelem(make('research',{topic:'Hackathon endpoint smoke'}),{TELEM_API_KEY:'hack-test-key',TELEM_BASE_URL:'https://hack.telem.ai/api/'});
  assert.equal(response.status,200);assert.equal(calls.length,3);assert.ok(calls.includes('https://hack.telem.ai/api/v1/fetch'));
 }finally{globalThis.fetch=original;}
});
test('unsupported endpoint cannot receive the server credential',async()=>{
 const original=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;throw Error('Unexpected network request');};
 try{
  const response=await handleTelem(make('fetch',{url:'https://example.com'}),{TELEM_API_KEY:'test-key',TELEM_BASE_URL:'https://other.example/api'});
  assert.equal(response.status,502);assert.equal(called,false);
 }finally{globalThis.fetch=original;}
});
test('cross-site requests and private fetch targets are rejected',async()=>{
 assert.equal((await handleTelem(make('research',{topic:'a topic'},'https://attacker.example'),{TELEM_API_KEY:'test'})).status,403);
 for(const url of ['http://example.com','https://127.0.0.1','https://localhost','https://user:pass@example.com','https://example.com:8443'])assert.equal((await handleTelem(make('fetch',{url}),{TELEM_API_KEY:'test'})).status,400);
});
test('deduplication, budget cap and observed fetched_results envelope',async()=>{
 const original=globalThis.fetch;const calls=[];globalThis.fetch=async(url,opts)=>{
   const b=JSON.parse(opts.body);calls.push({url,body:b});
   if(url.endsWith('/search'))return Response.json({preprocessor_runs:[{preprocessor_name:'brave',output_payload:{results:[{url:'https://a.example/story?utm_source=test',title:'A'},{url:'https://a.example/story',title:'A duplicate'},{url:'https://b.example/story',title:'B'},{url:'https://c.example/story',title:'C'},{url:'javascript:alert(1)',title:'unsafe'}]}}]});
   return Response.json({preprocessor_runs:[{preprocessor_name:'web_fetch',output_payload:{fetched_results:b.urls.map((url,i)=>({url,provider:'jina',status:'succeeded',http_status:i===1?404:200,content:'Fetched page content '+url,content_sha256:'test-hash'}))}}]});
 };
 try{const r=await handleTelem(make('research',{topic:'a public research topic'}),{TELEM_API_KEY:'fake-unit-key'});const d=await r.json();assert.equal(r.status,200);assert.equal(d.results.length,3);assert.equal(d.budget.queryCount,2);assert.equal(d.budget.fetchUrls,3);assert.equal(calls.filter(c=>c.url.endsWith('/search')).length,2);assert.equal(d.results.filter(r=>r.content).length,2);assert.deepEqual(d.results[0].queryLanes,[0,1]);assert.ok(!JSON.stringify(d).includes('fake-unit-key'));assert.ok(d.results.every(r=>r.url.startsWith('https://')))}finally{globalThis.fetch=original}
});
test('partial search failure remains visible',async()=>{
 const original=globalThis.fetch;let n=0;globalThis.fetch=async(url,opts)=>{
   if(url.endsWith('/search')){if(n++===0)return Response.json({error:'bad'}, {status:503});return Response.json({results:[{url:'https://source.example/article',title:'A'}]})}
   return Response.json({results:[{url:'https://source.example/article',status:'failed'}]});
 };
 try{const r=await handleTelem(make('research',{topic:'partial failure example'}),{TELEM_API_KEY:'unit-key'});const d=await r.json();assert.equal(r.status,200);assert.equal(d.results.length,1);assert.ok(d.warnings.some(w=>w.includes('503')));assert.equal(d.results[0].content,'');assert.equal(d.results[0].provider,'unknown')}finally{globalThis.fetch=original}
});
test('Telem chooses providers while analysis stays bounded and covers both query lanes',async()=>{
 const original=globalThis.fetch;let lane=0;
 globalThis.fetch=async(url,opts)=>{
  const body=JSON.parse(opts.body);
  if(url.endsWith('/search')){
   assert.equal(body.search.auto_routing,'accuracy');assert.equal(body.search.providers,undefined);
   const current=lane++;
   return Response.json({preprocessor_runs:['tavily','exa'].map(provider=>({preprocessor_name:provider,output_payload:{results:Array.from({length:5},(_,i)=>({url:`https://${provider}.example/lane-${current}/${i}`,title:'Test result'}))}}))});
  }
  assert.ok(body.urls.length<=3);return Response.json({results:[]});
 };
 try{
  const response=await handleTelem(make('research',{topic:'auto routing example'}),{TELEM_API_KEY:'test'});const data=await response.json();
  assert.equal(response.status,200);assert.equal(lane,2);assert.equal(data.results.length,10);
  assert.equal(data.results.filter(row=>row.queryLanes.includes(0)).length,5);
  assert.equal(data.results.filter(row=>row.queryLanes.includes(1)).length,5);
  assert.ok(data.results.every(row=>['tavily','exa'].includes(row.provider)));
  assert.equal(data.budget.queryCount,2);assert.equal(data.budget.queryProviderPairs,undefined);
 }finally{globalThis.fetch=original;}
});

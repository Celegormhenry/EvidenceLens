import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchScope,diverseSources,initialReading} from '../lib/research-scope.ts';
import {handleTelem} from '../lib/telem-api.ts';
import {modelSources,groundAnalysis} from '../lib/analysis.ts';
import {readRuns} from '../lib/history.ts';
import {article,statement,proposedAnalysis} from '../evals/source-overlap-fixture.mjs';

test('overview searches five distinct angles without manufacturing a contradictions lane',()=>{
 const s=researchScope('A public event');assert.equal(s.lanes.length,5);assert.equal(s.sourceLimit,40);
 assert.equal(s.initialReads+s.additionalReads,16);assert.equal(s.resultsPerProvider,8);
 assert.ok(s.lanes.every(l=>!l.query.includes('contradictions')));
 assert.equal(researchScope('A public event','quick').sourceLimit,10);
});
test('selection spreads coverage across lanes and domains and reads known timeline extremes',()=>{
 const rows=Array.from({length:30},(_,i)=>({id:`L${i}`,url:`https://p${i}.example/a`,title:'Report',summary:'',domain:i<10?'same.example':`p${i}.example`,queryLanes:[i%5],publish_date:i===29?'2020-01-01':i===28?'2026-11-14':null}));
 const selected=diverseSources(rows,5,20);
 assert.equal(new Set(selected.slice(0,5).map(r=>r.queryLanes[0])).size,5);
 assert.equal(new Set(selected.slice(0,5).map(r=>r.domain)).size,5);
 const read=initialReading(selected.concat(rows.filter(r=>!selected.includes(r))),5,10);
 assert.equal(read.length,10);assert.ok(read.some(r=>r.id==='L29'));assert.ok(read.some(r=>r.id==='L28'));
});
test('relevance outranks domain novelty: unrelated profiles and generic feeds cannot displace topical reports',()=>{
 const row=(id,url,title,summary='')=>({id,url,title,summary,domain:new URL(url).hostname,queryLanes:[0]});
 const rows=[row('profile','https://linkedin.com/in/person','People operations professional','Houston Texas'),row('feed','https://podcasts.example/episodes/feed','Politics podcast','Texas data centers mentioned among many topics.'),row('a','https://news.example/texas-data-centers','Texas data center permits paused'),row('b','https://news.example/water','Texas data center water investigation')];
 assert.deepEqual(diverseSources(rows,1,2,'Data Center in Texas').map(r=>r.id),['a','b']);
 assert.deepEqual(initialReading(rows,1,2,'Data Center in Texas').map(r=>r.id),['a','b']);
});

test('overview preserves 40 sources through both model calls and history; fetch batches obey the five-URL cap',async()=>{
 const nativeFetch=globalThis.fetch;let searches=0,models=0;const batches=[],inputs=[];
 globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(url.endsWith('/search')){
   const lane=searches++;assert.equal(body.search.auto_routing,'accuracy');assert.equal(body.search.providers,undefined);assert.equal(body.search.num_results,8);
   const rows=Array.from({length:16},(_,i)=>({url:`https://p${lane}-${i}.example/article`,title:'Harbor pilot authorization',summary:statement}));
   return Response.json({results:[...rows,{...rows[0],url:rows[0].url+'?utm_source=copy'},{url:'javascript:bad',title:'Invalid'}]});
  }
  if(url.endsWith('/fetch')){
   assert.ok(body.urls.length<=5);batches.push(body.urls);
   return Response.json({fetched_results:body.urls.map(url=>({url,status:'succeeded',http_status:200,content:article}))});
  }
  assert.equal(url,'https://api.openai.com/v1/responses');models++;
  const input=JSON.parse(body.input);inputs.push(input);assert.equal(input.sources.length,40);
  const targets=input.sources.slice(-4); // citations beyond the former ten-page cutoff
  return Response.json({status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify(proposedAnalysis(targets))}]}]});
 };
 try{
  const response=await handleTelem(new Request('https://test.example/api/telem/research',{method:'POST',headers:{Origin:'https://test.example','Content-Type':'application/json','oai-authenticated-user-id':crypto.randomUUID()},body:JSON.stringify({topic:'Harbor pilot authorization'})}),{TELEM_API_KEY:'fake',OPENAI_API_KEY:'fake'});
  const run=await response.json();assert.equal(response.status,200);
  assert.equal(searches,5);assert.equal(models,2);assert.deepEqual(batches.map(b=>b.length),[5,5,5,1]);
  assert.equal(new Set(batches.flat()).size,16);assert.equal(run.budget.fetchUrls,16);
  assert.deepEqual([run.coverage.returned,run.coverage.invalidSkipped,run.coverage.duplicatesRemoved,run.coverage.uniqueUrls,run.coverage.retained,run.coverage.omitted,run.coverage.read],[90,5,5,80,40,40,16]);
  assert.ok(run.coverage.lanes.every(l=>l.retained===8&&l.status==='ok'));
  assert.equal(inputs[1].sources.slice(-4).filter(r=>r.type==='fetched_page').length,4);
  assert.equal(modelSources(run.results).length,40);assert.equal(readRuns([run])[0].results.length,40);
  assert.equal(readRuns([run])[0].additionalReading.selected.length,6);
  assert.ok(run.analysis.claims[0].evidence.some(e=>e.sourceId===inputs[1].sources.at(-1).id));
 }finally{globalThis.fetch=nativeFetch;}
});
test('a failed search angle and partial fetch batch remain visible without dropping successful sources',async()=>{
 const nativeFetch=globalThis.fetch;let searches=0,batches=0;
 globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(url.endsWith('/search')){const lane=searches++;if(lane===3)return Response.json({error:'Temporary failure'},{status:503});return Response.json({results:Array.from({length:8},(_,i)=>({url:`https://p${lane}-${i}.example/a`,title:'Public announcement',summary:statement}))});}
  if(batches++===0)return Response.json({error:'Temporary failure'},{status:503});
  return Response.json({fetched_results:body.urls.map(url=>({url,status:'succeeded',content:article}))});
 };
 try{
  const response=await handleTelem(new Request('https://test.example/api/telem/research',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':crypto.randomUUID()},body:JSON.stringify({topic:'Public announcement'})}),{TELEM_API_KEY:'fake'});
  const run=await response.json();assert.equal(response.status,200);assert.equal(run.results.length,32);assert.equal(run.coverage.lanes[3].status,'failed');
  assert.equal(run.coverage.read,5);assert.equal(run.coverage.omitted,0);assert.ok(run.warnings.some(w=>w.includes('503')));
 }finally{globalThis.fetch=nativeFetch;}
});
test('grounding accepts twelve distinct cited claims instead of silently truncating at six',()=>{
 const rows=[{id:'L1',url:'https://example.com',title:'Synthetic',summary:statement}],raw=proposedAnalysis(rows);
 raw.claims=Array.from({length:12},(_,i)=>({...raw.claims[0],id:`C${i+1}`}));
 assert.equal(groundAnalysis(raw,rows,null,false).core.claims.length,12);
});

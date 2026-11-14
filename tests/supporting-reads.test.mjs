import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supportingReads} from '../lib/supporting-reads.ts';
import {handleTelem} from '../lib/telem-api.ts';
import {fingerprint} from '../lib/analysis.ts';
import {groupEvidenceSources} from '../lib/evidence-groups.ts';
import {readRuns} from '../lib/history.ts';
import {article,statement,copies,proposedAnalysis} from '../evals/source-overlap-fixture.mjs';

test('supporting read selection is bounded and excludes read, attempted and context-only pages',()=>{
 const rows=copies(8).map((r,i)=>({...r,content:i===0?article:''}));
 const raw=proposedAnalysis(rows);
 raw.claims=[{id:'C1',text:statement,status:'reported',evidence:[1,2,3,4,5,6].map(i=>({sourceId:rows[i].id,quote:statement,relation:i===1?'context':'supports'}))}];
 assert.deepEqual(supportingReads(raw,rows,[rows[2].url],3).map(r=>r.sourceId),['L4','L5','L6']);
 assert.deepEqual(supportingReads({...raw,claims:[]},rows,[]),[]);
});
test('related snippets are fallback reading candidates, never treated as verified support',()=>{
 const rows=copies(5).map((r,i)=>({...r,content:i===0?article:'',summary:i===1||i===3?statement:'Unrelated gardening announcement.'}));
 const raw=proposedAnalysis([rows[0],rows[4]]);
 const plan=supportingReads(raw,rows,[]);
 assert.equal(plan[0].sourceId,'L5');assert.equal(plan[0].basis,'citation');
 assert.deepEqual(plan.slice(1).map(p=>[p.sourceId,p.basis]),[['L2','related_snippet'],['L4','related_snippet']]);
 assert.ok(!plan.some(p=>p.sourceId==='L3'));
});

async function runScenario({extraFails=false,secondModelFails=false,alreadyRead=false}={}){
 const nativeFetch=globalThis.fetch;let modelCalls=0;const batches=[],modelInputs=[];
 const sources=copies(10),raw=proposedAnalysis(alreadyRead?sources.slice(0,2):sources.slice(3,7));
 globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(url.endsWith('/search'))return Response.json({results:sources.map((r,i)=>({...r,content:undefined,summary:alreadyRead&&i>2?'Unrelated gardening announcement.':statement}))});
  if(url.endsWith('/fetch')){
   batches.push(body.urls);
   return Response.json({fetched_results:body.urls.map((url,i)=>({url,status:extraFails&&batches.length===2?'failed':'succeeded',http_status:extraFails&&batches.length===2?403:200,content:batches.length===1&&i>0?`Distinct source ${i}. ${statement}`:article}))});
  }
  assert.equal(url,'https://api.openai.com/v1/responses');modelCalls++;modelInputs.push(JSON.parse(body.input));
  if(secondModelFails&&modelCalls===2)return Response.json({error:{message:'Unavailable'}},{status:503});
  return Response.json({status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify(raw)}]}]});
 };
 try{
  const response=await handleTelem(new Request('https://test.example/api/telem/research',{method:'POST',headers:{Origin:'https://test.example','Content-Type':'application/json','oai-authenticated-user-id':crypto.randomUUID()},body:JSON.stringify({topic:'Synthetic harbor authorization',researchMode:'quick'})}),{TELEM_API_KEY:'fake',OPENAI_API_KEY:'fake'});
  assert.equal(response.status,200);
  return {run:await response.json(),batches,modelCalls,modelInputs};
 }finally{globalThis.fetch=nativeFetch;}
}

test('supplemental reading reveals duplication, updates the model input and persists coverage and usage',async()=>{
 const {run,batches,modelCalls,modelInputs}=await runScenario();
 assert.deepEqual(batches.map(b=>b.length),[3,3]);assert.equal(new Set(batches.flat()).size,6);
 assert.equal(modelCalls,2);assert.equal(run.budget.fetchUrls,6);assert.equal(run.budget.inputTokens,200);
 assert.equal(run.additionalReading.groupsBefore,0);assert.equal(run.additionalReading.groupsAfter,1);
 assert.deepEqual(run.additionalReading.fetchedSourceIds,['L4','L5','L6']);
 assert.equal(run.additionalReading.analysisRefreshed,true);
 assert.equal(modelInputs[0].sources.find(s=>s.id==='L4').type,'search_snippet');
 assert.equal(modelInputs[1].sources.find(s=>s.id==='L4').type,'fetched_page');
 assert.equal(modelInputs[1].sources.find(s=>s.id==='L4').sourceGroupId,'G1');
 assert.equal(groupEvidenceSources(run.results)[0].sourceIds.length,4);
 assert.equal(run.fingerprint,await fingerprint(run.results));
 assert.deepEqual(readRuns([run])[0].additionalReading,run.additionalReading);
 const legacy=structuredClone(run);legacy.additionalReading.selected.forEach(p=>delete p.basis);
 assert.ok(readRuns([legacy])[0].additionalReading.selected.every(p=>p.basis==='legacy_unknown'));
 assert.ok(run.analysis.claims.every(c=>c.status!=='corroborated'));
});
test('failed supplemental pages remain snippets, are not retried and do not trigger another model call',async()=>{
 const {run,batches,modelCalls}=await runScenario({extraFails:true});
 assert.equal(batches.length,2);assert.equal(modelCalls,1);assert.equal(run.additionalReading.fetchedSourceIds.length,0);
 assert.equal(run.results.filter(r=>r.content).length,3);assert.equal(run.additionalReading.groupsAfter,0);
 assert.ok(run.warnings.some(w=>w.includes('L4, L5, L6')));assert.ok(run.analysis);
});
test('an update failure retains new sources but does not publish stale snippet-based analysis',async()=>{
 const {run}=await runScenario({secondModelFails:true});
 assert.equal(run.analysis,null);assert.equal(run.results.filter(r=>r.content).length,6);
 assert.equal(run.additionalReading.analysisRefreshed,false);
 assert.ok(run.warnings.some(w=>w.includes('updated analysis is unavailable')));
});
test('already-read supporting pages stop the second pass without extra calls',async()=>{
 const {run,batches,modelCalls}=await runScenario({alreadyRead:true});
 assert.equal(batches.length,1);assert.equal(modelCalls,1);assert.deepEqual(run.additionalReading.selected,[]);
});

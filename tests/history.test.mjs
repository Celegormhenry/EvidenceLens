import {test} from 'node:test';
import assert from 'node:assert/strict';
import {graphParameters,neo4jEndpoint,queryNeo4j,loadRuns} from '../lib/neo4j.ts';
import {handleHistory,persistResearch} from '../lib/history-api.ts';
import {handleTelem} from '../lib/telem-api.ts';
import {mergeRuns,readRuns} from '../lib/history.ts';
import {sampleRun} from './fixtures/history-run.mjs';

const env={NEO4J_URI:'neo4j+s://unit-test.databases.neo4j.io',NEO4J_USERNAME:'neo4j',NEO4J_PASSWORD:'unit-secret'};
test('Aura URL conversion rejects credential leaks and non-Aura destinations',()=>{
  assert.equal(neo4jEndpoint(env),'https://unit-test.databases.neo4j.io/db/neo4j/query/v2');
  for(const uri of ['http://unit-test.databases.neo4j.io','https://attacker.example','https://unit-test.databases.neo4j.io/path','https://user:secret@unit-test.databases.neo4j.io','https://unit-test.databases.neo4j.io?secret=key'])assert.throws(()=>neo4jEndpoint({...env,NEO4J_URI:uri}));
});
test('graph records preserve quotation provenance, basis and run isolation',()=>{
  const a=graphParameters(env,sampleRun()),b=graphParameters(env,sampleRun('other-run'));
  assert.notEqual(a.events[0].key,b.events[0].key);
  assert.equal(a.relations[0].basis,'inferred');
  assert.equal(a.relations[0].type,'responds_to');
  assert.equal(a.citations[0].quote,a.sources[0].content);
  assert.equal(a.citations[0].source,a.sources[0].key);
  assert.equal(a.grounding[0].claim,a.claims[0].key);
  assert.equal(a.forecastLinks[0].forecast,a.forecasts[0].key);
  assert.deepEqual(JSON.parse(a.snapshot),sampleRun());
});
test('HTTP-success Neo4j errors and credentials never reach callers',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({errors:[{message:'unit-secret sensitive query'}]});
  try{
    await assert.rejects(queryNeo4j(env,'RETURN 1'),e=>!e.message.includes('unit-secret'));
    const result=await persistResearch(new Request('http://localhost:5173/api/telem/research'),env,sampleRun());
    assert.equal(result.status,'unavailable');assert.ok(!JSON.stringify(result).includes('unit-secret'));
  }finally{globalThis.fetch=original;}
});
test('history is local and same-origin; absent config needs no provider call',async()=>{
  for(const request of [new Request('https://lens.example/api/history/runs'),new Request('http://localhost/api/history/runs',{headers:{Origin:'https://attacker.example'}}),new Request('http://localhost/api/history/runs',{headers:{'Sec-Fetch-Site':'cross-site'}})])assert.equal((await handleHistory(request,env)).status,403);
  const result=await handleHistory(new Request('http://localhost/api/history/runs'),{});
  assert.equal((await result.json()).status,'unconfigured');
  assert.equal((await handleHistory(new Request('http://localhost/api/history/runs',{method:'POST'}),env)).status,405);
});
test('history read uses namespace and read access; corrupt records are skipped',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);
    assert.equal(body.accessMode,'Read');assert.equal(body.parameters.scope,'private-test');
    assert.equal(options.redirect,'manual');assert.ok(options.headers.Authorization.startsWith('Basic '));
    return Response.json({data:{fields:['r.snapshot'],values:[[JSON.stringify(sampleRun())],['broken'],['{}']]}});
  };
  try{const result=await loadRuns({...env,NEO4J_NAMESPACE:'private-test'});assert.equal(result.runs.length,1);assert.equal(result.skipped,2);}finally{globalThis.fetch=original;}
});
test('restored history deduplicates without replacing local data or recent runs',()=>{
  const old=sampleRun(),recent={...sampleRun('recent'),timestamp:'2026-11-15T00:00:00.000Z'};
  const merged=mergeRuns([recent,old],[{...old,topic:'conflicting duplicate'}]);
  assert.deepEqual(merged.map(r=>r.id),['recent',old.id]);assert.equal(merged[1].topic,old.topic);
  assert.equal(readRuns([null,{},old]).length,1);
});

test('redirects are rejected without following credentials to another host',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://attacker.example'}});};
  try{await assert.rejects(queryNeo4j(env,'RETURN 1'),/HTTP 302/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});

test('research saves server snapshots and retains retrieval after database failure',async()=>{
  const original=globalThis.fetch;let fail=false,snapshot;
  globalThis.fetch=async(url,options)=>{
    if(url.includes('.databases.neo4j.io')){
      if(fail)return Response.json({errors:[{message:'unit-secret'}]});
      const body=JSON.parse(options.body);
      if(body.parameters.snapshot)snapshot=JSON.parse(body.parameters.snapshot);
      return Response.json({data:{fields:[],values:[]}});
    }
    if(url.endsWith('/search'))return Response.json({results:[{url:'https://example.com/fixture',title:'Test source',summary:'Synthetic evidence'}]});
    return Response.json({results:[{url:'https://example.com/fixture',status:'succeeded',content:'Synthetic page text'}]});
  };
  const request=()=>new Request('http://localhost:5173/api/telem/research',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5173','oai-authenticated-user-id':crypto.randomUUID()},body:JSON.stringify({topic:'Synthetic persistence check'})});
  try{
    const success=await handleTelem(request(),{...env,TELEM_API_KEY:'test-telem'});const saved=await success.json();
    assert.equal(success.status,200);assert.equal(saved.persistence.status,'saved');assert.equal(snapshot.id,saved.id);assert.equal(snapshot.results[0].content,'Synthetic page text');assert.ok(!JSON.stringify(snapshot).includes('unit-secret'));
    fail=true;const failure=await handleTelem(request(),{...env,TELEM_API_KEY:'test-telem'});const retained=await failure.json();
    assert.equal(failure.status,200);assert.equal(retained.persistence.status,'unavailable');assert.equal(retained.results.length,1);
  }finally{globalThis.fetch=original;}
});

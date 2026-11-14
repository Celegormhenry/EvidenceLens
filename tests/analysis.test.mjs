import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groundAnalysis,fingerprint,validPrior,analyze} from '../lib/analysis.ts';
const content='The board has announced an independent review of the reported allegations.';
const rows=[{id:'L1',url:'https://example.com/a',title:'Announcement',content,summary:''}];
const fixture=()=>({summary:'A review was announced.',claims:[{id:'C1',text:'A review was announced.',status:'reported',evidence:[{sourceId:'L1',quote:content,relation:'supports'}]}],assessments:[{sourceId:'L1',claimId:'C1',directness:3,reason:'Direct announcement.'}],relationships:[],conflicts:[],forecasts:[{id:'F1',question:'Will the board publish an update?',deadline:'2026-12-31T23:59:00Z',resolution:'Official board update published by deadline.',probability:40,rationale:'An ongoing review may prompt an update.',sourceIds:['L1'],changeTrigger:'A scheduled board announcement.'}],impacts:[],nextSearches:[],limits:['Uncalibrated estimate.']});
const now=new Date('2026-11-14T23:00:00Z');
test('fabricated quotation removes claim and withholds all forecasts',()=>{
 const data=fixture();data.claims[0].evidence[0].quote='There was a proven criminal act and confirmed guilt.';
 const out=groundAnalysis(data,rows,null,false,now);assert.equal(out.core.claims.length,0);assert.equal(out.core.forecasts.length,0);assert.ok(out.warnings.length);
});
test('unchanged retrieved evidence preserves same-question estimate and computes delta',()=>{
 const old=fixture(),next=fixture();next.forecasts[0].probability=80;next.forecasts[0].question='A different question';
 const out=groundAnalysis(next,rows,{id:'prior',analysis:old},true,now);
 assert.equal(out.core.forecasts[0].probability,40);assert.equal(out.core.forecasts[0].question,old.forecasts[0].question);assert.equal(out.changes[0].delta,0);
});
test('snippet-only evidence and expired deadline cannot issue numeric forecasts',()=>{
 const snippets=[{...rows[0],content:'',summary:content}];assert.equal(groundAnalysis(fixture(),snippets,null,false,now).core.forecasts[0].probability,null);
 const data=fixture();data.forecasts[0].deadline='2026-11-01T00:00:00Z';assert.equal(groundAnalysis(data,rows,null,false,now).core.forecasts[0].probability,null);
});
test('a prior run without forecast questions does not prevent first estimates',()=>{
 const previous=fixture();previous.forecasts=[];
 const out=groundAnalysis(fixture(),rows,{id:'prior',analysis:previous},false,now);
 assert.equal(out.core.forecasts.length,1);assert.equal(out.changes[0].previous,null);
});
test('event graph keeps grounded events and typed links, rejects dangling edges and fake quotes',()=>{
 const data=fixture();const event=(id)=>({id,title:'Board review',description:'A reported event',date:null,actors:['Board'],status:'reported',claimIds:['C1'],forecastId:null});
 data.events=[event('E1'),event('E2'),{...event('E3'),claimIds:['fake']}];
 const edge=(id,from,to)=>({id,from,to,type:'responds_to',basis:'reported',explanation:'The second statement responds to the first.',evidence:[{sourceId:'L1',quote:content,relation:'supports'}]});
 data.eventRelations=[edge('R1','E2','E1'),edge('R2','E1','E3'),{...edge('R3','E1','E2'),evidence:[{sourceId:'L1',quote:'This quotation does not exist in the source.',relation:'supports'}]}];
 const out=groundAnalysis(data,rows,null,false,now);assert.equal(out.core.events.length,2);assert.deepEqual(out.core.eventRelations.map(r=>r.id),['R1']);assert.equal(out.core.eventRelations[0].type,'responds_to');
});
test('inferred triggering and future-event links are explicitly hypothetical',()=>{
 const data=fixture();const event=(id,status)=>({id,title:'Event',description:'Context',date:null,actors:[],status,claimIds:['C1'],forecastId:null});
 data.events=[event('E1','reported'),event('E2','possible')];data.eventRelations=[{id:'R1',from:'E1',to:'E2',type:'triggers',basis:'reported',explanation:'A possible future pathway.',evidence:[{sourceId:'L1',quote:content,relation:'supports'}]}];
 const out=groundAnalysis(data,rows,null,false,now);assert.equal(out.core.eventRelations[0].type,'may_lead_to');assert.equal(out.core.eventRelations[0].basis,'hypothetical');
});
test('references are constrained and fingerprints track text changes',async()=>{
 const data=fixture();data.relationships.push({fromSourceId:'L1',toSourceId:'fake',kind:'quotes',reason:'invented'});data.forecasts[0].sourceIds=['fake'];
 const out=groundAnalysis(data,rows,null,false,now);assert.equal(out.core.relationships.length,0);assert.equal(out.core.forecasts[0].probability,null);
 assert.notEqual(await fingerprint(rows),await fingerprint([{...rows[0],content:content+' New finding.'}]));
 assert.equal(validPrior({id:'x',topic:'another'},'topic'),null);
});
test('quota failures never echo provider body or secret',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:{message:'sk-secret-provider-body'}},{status:429});
 try{await assert.rejects(analyze({OPENAI_API_KEY:'sk-secret'},'topic',rows,null,'x'),e=>/quota/.test(e.message)&&!e.message.includes('sk-secret'));}finally{globalThis.fetch=original;}
});

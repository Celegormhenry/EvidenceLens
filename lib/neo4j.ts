import {eventRelationTypes} from './analysis.ts';
import {readRuns} from './history.ts';
import type {Run} from './history.ts';

export type Neo4jEnv={NEO4J_URI?:string;NEO4J_USERNAME?:string;NEO4J_PASSWORD?:string;NEO4J_DATABASE?:string;NEO4J_NAMESPACE?:string};
export function neo4jConfigured(env:Neo4jEnv){return !!(env.NEO4J_URI&&env.NEO4J_USERNAME&&env.NEO4J_PASSWORD);}
export function neo4jEndpoint(env:Neo4jEnv){
  const uri=new URL(env.NEO4J_URI||'');
  if(!['neo4j+s:','https:'].includes(uri.protocol)||! /^[a-z0-9-]+\.databases\.neo4j\.io$/i.test(uri.hostname)||uri.username||uri.password||uri.port||!['','/'].includes(uri.pathname)||uri.search||uri.hash)throw Error('Invalid Neo4j Aura configuration.');
  const database=env.NEO4J_DATABASE||'neo4j';
  if(!/^[a-zA-Z0-9._-]{1,63}$/.test(database))throw Error('Invalid Neo4j database name.');
  return `https://${uri.hostname}/db/${encodeURIComponent(database)}/query/v2`;
}
export async function queryNeo4j(env:Neo4jEnv,statement:string,parameters:Record<string,unknown>={},read=false):Promise<unknown[][]>{
  if(!neo4jConfigured(env))throw Error('Neo4j is not configured.');
  const endpoint=neo4jEndpoint(env);
  let response:Response;
  try{
    const bytes=new TextEncoder().encode(`${env.NEO4J_USERNAME}:${env.NEO4J_PASSWORD}`);
    const credential=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
    response=await fetch(endpoint,{method:'POST',redirect:'manual',headers:{Authorization:`Basic ${credential}`,'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({statement,parameters,accessMode:read?'Read':'Write'}),signal:AbortSignal.timeout(12000)});
  }catch{throw Error('Neo4j could not be reached.');}
  // Provider bodies can contain credentials, query text, or source data. Never
  // forward them to the browser or logs, including errors in successful HTTP replies.
  if(!response.ok){await response.body?.cancel();throw Error(`Neo4j request failed (HTTP ${response.status}).`);}
  let body:{errors?:unknown[];data?:{fields?:string[];values?:unknown[][]}};
  try{body=await response.json();}catch{throw Error('Neo4j returned an invalid response.');}
  if(body.errors?.length||!Array.isArray(body.data?.values))throw Error('Neo4j could not complete the query.');
  return body.data.values;
}

const namespace=(env:Neo4jEnv)=>env.NEO4J_NAMESPACE||'evidence-lens-local';
const key=(scope:string,runId:string,kind:string,id='')=>JSON.stringify([scope,runId,kind,id]);
export function graphParameters(env:Neo4jEnv,run:Run){
  const scope=namespace(env),k=(kind:string,id='')=>key(scope,run.id,kind,id);
  const core=run.analysis;
  const sources=run.results.map(s=>({key:k('source',s.id),id:s.id,url:s.url,title:s.title,summary:s.summary,content:s.content||'',domain:s.domain,contentTruncated:s.contentTruncated||false}));
  const claims=(core?.claims||[]).map(c=>({key:k('claim',c.id),id:c.id,text:c.text,status:c.status}));
  const events=(core?.events||[]).map(e=>({key:k('event',e.id),id:e.id,title:e.title,description:e.description,date:e.date,actors:e.actors,status:e.status}));
  const forecasts=(core?.forecasts||[]).map(f=>({...f,key:k('forecast',f.id)}));
  const relations=(core?.eventRelations||[]).map(r=>({key:k('relation',r.id),id:r.id,type:r.type,basis:r.basis,explanation:r.explanation,from:k('event',r.from),to:k('event',r.to),evidenceJson:JSON.stringify(r.evidence)}));
  const citations=[...(core?.claims||[]).flatMap(c=>c.evidence.map((e,i)=>({owner:k('claim',c.id),source:k('source',e.sourceId),index:i,quote:e.quote,relation:e.relation}))),
    ...(core?.eventRelations||[]).flatMap(r=>r.evidence.map((e,i)=>({owner:k('relation',r.id),source:k('source',e.sourceId),index:i,quote:e.quote,relation:e.relation})))];
  const grounding=(core?.events||[]).flatMap(e=>e.claimIds.map(id=>({event:k('event',e.id),claim:k('claim',id)})));
  const forecastLinks=(core?.events||[]).filter(e=>e.forecastId).map(e=>({event:k('event',e.id),forecast:k('forecast',e.forecastId!)}));
  return {scope,runKey:k('run'),id:run.id,timestamp:run.timestamp,topic:run.topic,fingerprint:run.fingerprint||'',snapshot:JSON.stringify(run),
    previousKey:core?.revision.previousRunId?key(scope,core.revision.previousRunId,'run'):null,sources,claims,events,forecasts,relations,citations,grounding,forecastLinks};
}

export const SAVE_RUN_QUERY=`
CREATE (r:EvidenceLensEntity:EvidenceLensRun {key:$runKey})
SET r.namespace=$scope,r.id=$id,r.timestamp=$timestamp,r.topic=$topic,r.fingerprint=$fingerprint,r.snapshot=$snapshot
FOREACH (s IN $sources | CREATE (n:EvidenceLensEntity:EvidenceLensSource) SET n=s CREATE (r)-[:HAS_SOURCE]->(n))
FOREACH (c IN $claims | CREATE (n:EvidenceLensEntity:EvidenceLensClaim) SET n=c CREATE (r)-[:HAS_CLAIM]->(n))
FOREACH (e IN $events | CREATE (n:EvidenceLensEntity:EvidenceLensEvent) SET n=e CREATE (r)-[:HAS_EVENT]->(n))
FOREACH (f IN $forecasts | CREATE (n:EvidenceLensEntity:EvidenceLensForecast) SET n=f CREATE (r)-[:HAS_FORECAST]->(n))
CALL { WITH r UNWIND $relations AS edge
  MATCH (a:EvidenceLensEvent {key:edge.from}),(b:EvidenceLensEvent {key:edge.to})
  CREATE (n:EvidenceLensEntity:EvidenceLensRelation) SET n=edge
  CREATE (r)-[:HAS_RELATION]->(n),(n)-[:FROM_EVENT]->(a),(n)-[:TO_EVENT]->(b)
  ${eventRelationTypes.map(type=>`FOREACH (_ IN CASE WHEN edge.type='${type}' THEN [1] ELSE [] END |
    CREATE (a)-[link:${type.toUpperCase()}]->(b) SET link.id=edge.id,link.basis=edge.basis,link.explanation=edge.explanation,link.evidenceJson=edge.evidenceJson)`).join('\n')}
  RETURN count(*) AS relationCount
}
CALL { WITH r UNWIND $citations AS cite
  MATCH (a:EvidenceLensEntity {key:cite.owner}),(s:EvidenceLensSource {key:cite.source})
  CREATE (a)-[:CITES {position:cite.index,quote:cite.quote,relation:cite.relation}]->(s)
  RETURN count(*) AS citationCount
}
CALL { WITH r UNWIND $grounding AS ground
  MATCH (e:EvidenceLensEvent {key:ground.event}),(c:EvidenceLensClaim {key:ground.claim})
  CREATE (e)-[:GROUNDED_IN]->(c) RETURN count(*) AS groundingCount
}
CALL { WITH r UNWIND $forecastLinks AS link
  MATCH (e:EvidenceLensEvent {key:link.event}),(f:EvidenceLensForecast {key:link.forecast})
  CREATE (e)-[:FORECASTS]->(f) RETURN count(*) AS forecastCount
}
CALL { WITH r MATCH (previous:EvidenceLensRun {key:$previousKey})
  CREATE (r)-[:PREVIOUS_RUN]->(previous) RETURN count(*) AS previousCount
}
RETURN r.id`;

export async function saveRun(env:Neo4jEnv,run:Run){
  // One application-specific constraint; no changes to unrelated graph labels.
  await queryNeo4j(env,'CREATE CONSTRAINT evidence_lens_entity_key IF NOT EXISTS FOR (n:EvidenceLensEntity) REQUIRE n.key IS UNIQUE');
  await queryNeo4j(env,SAVE_RUN_QUERY,graphParameters(env,run));
}
export async function loadRuns(env:Neo4jEnv){
  const rows=await queryNeo4j(env,'MATCH (r:EvidenceLensRun {namespace:$scope}) RETURN r.snapshot ORDER BY r.timestamp DESC LIMIT 50',{scope:namespace(env)},true);
  const decoded=rows.flatMap(row=>{try{return [JSON.parse(String(row[0]))];}catch{return [];}});
  const runs=readRuns(decoded);
  return {runs,skipped:rows.length-runs.length};
}

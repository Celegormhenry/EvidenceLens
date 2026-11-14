import {loadRuns,neo4jConfigured,saveRun} from './neo4j.ts';
import type {Neo4jEnv} from './neo4j.ts';
import type {Persistence,Run} from './history.ts';

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// Local development only. Hosting this history API requires real per-user
// authorization and partitioning; a client-supplied user header is not sufficient.
export function localHistoryRequest(request:Request){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  return ['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&(!origin||origin===url.origin)&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
export async function persistResearch(request:Request,env:Neo4jEnv,run:Run):Promise<Persistence>{
  if(!localHistoryRequest(request)||!neo4jConfigured(env))return {status:'unconfigured',message:'Browser history only. Neo4j is optional and available in local development.'};
  try{await saveRun(env,run);return {status:'saved',message:'Saved to Neo4j and browser history.'};}
  catch{return {status:'unavailable',message:'Neo4j save failed. This run remains available in browser history; export a copy to keep it.'};}
}
export async function handleHistory(request:Request,env:Neo4jEnv){
  if(!localHistoryRequest(request))return json({error:'History is available only on the local development server.'},403);
  if(new URL(request.url).pathname!=='/api/history/runs')return json({error:'Unknown history action'},404);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if(!neo4jConfigured(env))return json({status:'unconfigured',runs:[],message:'Browser history only. Configure Neo4j to keep server snapshots.'});
  try{const {runs,skipped}=await loadRuns(env);return json({status:'connected',runs,skipped,message:skipped?`Neo4j connected. Skipped ${skipped} invalid snapshots.`:'Neo4j connected. New runs are saved automatically.'});}
  catch{return json({status:'unavailable',runs:[],message:'Neo4j history is unavailable. Browser history is still available.'},503);}
}

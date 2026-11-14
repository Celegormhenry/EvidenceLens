// Hackathon Telem protocol: https://hack.telem.ai/doc/
// No credentials, provider responses or request bodies are written to logs.
import {analyze,fingerprint,validPrior,MODEL} from './analysis.ts';
import {persistResearch} from './history-api.ts';
import type {Neo4jEnv} from './neo4j.ts';
import type {Run} from './history.ts';
import {parseMonitor} from './monitor.ts';
import {supportingReads} from './supporting-reads.ts';
import {groupEvidenceSources} from './evidence-groups.ts';
import {researchScope,diverseSources,initialReading} from './research-scope.ts';
type Env = Neo4jEnv & {TELEM_API_KEY?:string;TELEM_BASE_URL?:string;OPENAI_API_KEY?:string};
const DEFAULT_BASE='https://hack.telem.ai/api';
function apiBase(env:Env){
  const base=(env.TELEM_BASE_URL||DEFAULT_BASE).trim().replace(/\/+$/,'');
  if(![DEFAULT_BASE,'https://router.telem.ai'].includes(base))throw Error('Unsupported Telem API base URL. Configure the official Telem endpoint.');
  return base;
}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const rate=new Map<string,{start:number,count:number}>();
function safeURL(raw:string){
  try {const u=new URL(raw); const h=u.hostname.toLowerCase();
    if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||h==='localhost'||h.endsWith('.local')||h.endsWith('.internal')||/^[\d.]+$/.test(h)||h.includes(':'))return null;
    return u.href;
  }catch{return null;}
}
function canonical(raw:string){const u=new URL(raw);u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_')||['fbclid','gclid'].includes(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'');}
async function call(env:Env,path:string,body?:unknown,method?:string){
  const r=await fetch(apiBase(env)+path,{method:method||(body?'POST':'GET'),headers:{Authorization:`Bearer ${env.TELEM_API_KEY}`,'Content-Type':'application/json','User-Agent':'EvidenceLens/1.0 (SearchHack demo)'},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(55000)});
  if(r.status>=300&&r.status<400){await r.body?.cancel();throw Error('Telem redirected the request. Check the API base URL; the credential was not forwarded.');}
  if(!r.ok){
    const raw=await r.text();let reason='';
    try{const d=JSON.parse(raw);const msg=d.error?.message||d.detail||d.message||d.error;reason=typeof msg==='string'?msg.slice(0,180):'';}catch{reason=raw.includes('Cloudflare')?'The provider edge rejected the hosted request.':'';}
    reason=reason.split(env.TELEM_API_KEY||'__missing__').join('[redacted]').replace(/tlm_[A-Za-z0-9_-]+/g,'[redacted]');
    throw new Error(`Telem returned HTTP ${r.status}. ${reason||(r.status===401?'The key was not accepted.':r.status===403?'Check the key permissions or network restrictions.':r.status===402?'Check your Telem balance.':r.status===429?'Please wait before retrying.':'The request was not completed.')}`);
  }
  if(r.status===204)return {status:'ended'};
  return r.json() as Promise<any>;
}
function resultRows(data:any){
  if(Array.isArray(data.results))return data.results;
  if(Array.isArray(data.fetched_results))return data.fetched_results;
  return (data.preprocessor_runs||[]).flatMap((run:any)=>(run.output_payload?.results||run.output_payload?.fetched_results||[]).map((r:any)=>({...r,provider:r.provider||run.preprocessor_name})));
}
function rows(data:any){return resultRows(data).filter((r:any)=>typeof r.url==='string'&&safeURL(r.url)).map((r:any)=>({url:r.url,title:String(r.title||new URL(r.url).hostname),summary:String(r.summary||r.description||'').slice(0,1800),provider:r.provider||'unknown',publish_date:r.publish_date||null}));}
export async function handleTelem(request:Request,env:Env){
  const url=new URL(request.url),action=url.pathname.split('/').pop();
  if(action==='status'&&request.method==='GET')return json({configured:!!env.TELEM_API_KEY,provider:'Telem AI',modelConnected:!!env.OPENAI_API_KEY,model:env.OPENAI_API_KEY?MODEL:null});
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const origin=request.headers.get('Origin');
  if((origin&&origin!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Same-origin requests only'},403);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required'},415);
  if(!env.TELEM_API_KEY)return json({error:'Telem is not configured on the server yet. Case replay remains available.'},503);
  const caller=request.headers.get('oai-authenticated-user-id')||request.headers.get('CF-Connecting-IP')||'private-site';
  const now=Date.now(),lim=rate.get(caller);
  if(lim&&now-lim.start<60000&&lim.count>=8)return json({error:'Demo limit reached. Please wait a minute.'},429);
  rate.set(caller,{start:lim&&now-lim.start<60000?lim.start:now,count:lim&&now-lim.start<60000?lim.count+1:1});
  try{
    const raw=await request.text();if(raw.length>65000)return json({error:'Request too large'},413);
    let b:any;try{b=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
    if(action==='research'){
      const topic=String(b.topic||'').trim();if(topic.length<5||topic.length>240)return json({error:'Use a topic between 5 and 240 characters.'},400);
      if(b.researchMode!==undefined&&!['quick','overview'].includes(b.researchMode))return json({error:'Unknown research mode'},400);
      const scope=researchScope(topic,b.researchMode||'overview'),queries=scope.lanes.map(l=>l.query);
      const outcomes=await Promise.allSettled(queries.map(query=>call(env,'/v1/search',{user_input:{query},search:{tier:'default',auto_routing:'accuracy',num_results:scope.resultsPerProvider}})));
      const map=new Map<string,any>(),warnings:string[]=[];let returned=0,usable=0;
      outcomes.forEach((out,i)=>{if(out.status==='rejected'){warnings.push(String(out.reason?.message||'Search failed'));return;}
        returned+=resultRows(out.value).length;const rr=rows(out.value);usable+=rr.length;if(!rr.length)warnings.push(`Query ${i+1} returned no usable results.`);
        rr.forEach((r:any)=>{const c=canonical(r.url);const old=map.get(c);if(old){if(!old.queryLanes.includes(i))old.queryLanes.push(i);return;}map.set(c,{...r,id:`L${map.size+1}`,queryLanes:[i],domain:new URL(r.url).hostname.replace(/^www\./,''),reviewStatus:'Unreviewed',retrievedAt:new Date().toISOString()});});
      });
      const allResults=[...map.values()],results=diverseSources(allResults,queries.length,scope.sourceLimit,topic);
      const selected=initialReading(results,queries.length,scope.initialReads,topic).map(r=>r.url);
      let fetchBatches=0;
      const readPages=async(urls:string[])=>{
        if(!urls.length)return;
        // Hackathon Fetch accepts at most five URLs per request.
        const batches=Array.from({length:Math.ceil(urls.length/5)},(_,i)=>urls.slice(i*5,i*5+5));
        await Promise.all(batches.map(async urls=>{
        try{
          fetchBatches++;
          const fetched=await call(env,'/v1/fetch',{urls,options:{tier:'default',content_format:'text',inline_max_chars:12000}});
          for(const p of resultRows(fetched)){
            if(typeof p.url!=='string'||!safeURL(p.url))continue;
            const r=results.find(r=>urls.includes(r.url)&&canonical(r.url)===canonical(p.url));
            if(r){r.fetchStatus=p.status||'unknown';r.httpStatus=p.http_status;r.content=typeof p.content==='string'?p.content.slice(0,12000).trim():'';r.contentHash=p.content_sha256||null;r.contentTruncated=p.content_truncated||false;r.fetchWarnings=p.warnings||[];if(p.http_status>=400||p.status==='failed')r.content='';}
          }
          const failed=results.filter(r=>urls.includes(r.url)&&!r.content).map(r=>r.id);
          if(failed.length)warnings.push(`No readable page text returned for ${failed.join(', ')}. These remain snippet-only sources.`);
        }catch(e:any){warnings.push(e.message||'Page fetch failed.');}
        }));
      };
      await readPages(selected);
      if(!results.length)return json({error:warnings.join(' ')||'No results returned. Try a more specific topic.'},502);
      let fp=await fingerprint(results);
      const prior=validPrior(b.previous,topic);
      let analysis=null,modelCalls=0,inputTokens=0,outputTokens=0;
      let additionalReading:Run['additionalReading'];
      if(env.OPENAI_API_KEY){modelCalls=1;try{analysis=await analyze(env,topic,results,prior,fp);}catch(e:any){warnings.push(e.message);}}
      else warnings.push('Model analysis is not configured. Retrieval remains available.');
      if(analysis){
        inputTokens+=analysis.inputTokens;outputTokens+=analysis.outputTokens;
        const plan=supportingReads(analysis,results,selected,scope.additionalReads),groupsBefore=groupEvidenceSources(results).length;
        additionalReading={selected:plan,fetchedSourceIds:[],groupsBefore,groupsAfter:groupsBefore,analysisRefreshed:false};
        const extraUrls=plan.map(p=>results.find(r=>r.id===p.sourceId)!.url);
        await readPages(extraUrls);selected.push(...extraUrls);
        additionalReading.fetchedSourceIds=plan.filter(p=>results.find(r=>r.id===p.sourceId)?.content).map(p=>p.sourceId);
        additionalReading.groupsAfter=groupEvidenceSources(results).length;
        if(additionalReading.fetchedSourceIds.length){
          fp=await fingerprint(results);modelCalls++;
          // Refreshed analysis must use the newly fetched text and group metadata.
          // On failure, retain the sources, not stale snippet-grounded claims.
          analysis=null;
          try{analysis=await analyze(env,topic,results,prior,fp);additionalReading.analysisRefreshed=true;inputTokens+=analysis.inputTokens;outputTokens+=analysis.outputTokens;}
          catch(e:any){warnings.push(`Additional pages were retained, but the updated analysis is unavailable. ${e.message}`);}
        }
      }
      const coverage:Run['coverage']={mode:scope.mode,returned,invalidSkipped:returned-usable,duplicatesRemoved:usable-allResults.length,uniqueUrls:allResults.length,retained:results.length,omitted:allResults.length-results.length,read:results.filter(r=>r.content).length,
        lanes:scope.lanes.map((lane,i)=>({...lane,status:outcomes[i].status==='rejected'?'failed':allResults.some(r=>r.queryLanes.includes(i))?'ok':'empty',uniqueUrls:allResults.filter(r=>r.queryLanes.includes(i)).length,retained:results.filter(r=>r.queryLanes.includes(i)).length,read:results.filter(r=>r.queryLanes.includes(i)&&r.content).length}))};
      const run:Run={id:crypto.randomUUID(),timestamp:new Date().toISOString(),topic,queries,results,warnings,fingerprint:fp,budget:{queryCount:queries.length,resultsPerProvider:scope.resultsPerProvider,fetchUrls:selected.length,fetchBatches,modelCalls,inputTokens,outputTokens},mode:analysis?'live-analysis':'live-retrieval',analysis,additionalReading,coverage};
      const persistence=await persistResearch(request,env,run);
      return json({...run,persistence});
    }
    if(action==='fetch'){
      const target=safeURL(String(b.url||''));if(!target)return json({error:'A public HTTPS URL is required.'},400);
      const fetched=await call(env,'/v1/fetch',{urls:[target],options:{tier:'default',content_format:'text',inline_max_chars:18000}});return json({results:resultRows(fetched)});
    }
    if(action==='monitor-create'){
      const query=String(b.query||'').trim();if(query.length<10||query.length>400)return json({error:'Describe the topic in 10–400 characters.'},400);
      const m=await call(env,'/v1/monitors',{query,options:{frequency:'1h'},ttl:'4h',agent:true});
      // Deliberately do not return any webhook secret or credential-like metadata.
      const monitor=parseMonitor(m);if(!monitor)throw Error('Telem returned an invalid monitor. Check the Telem console before starting another.');
      return json(monitor);
    }
    if(['monitor-changes','monitor-pause','monitor-resume','monitor-status','monitor-end'].includes(action||'')){
      if(typeof b.id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(b.id))return json({error:'Invalid monitor ID'},400);
      const path='/v1/monitors/'+encodeURIComponent(b.id);
      if(action==='monitor-end')return json(await call(env,path,undefined,'DELETE'));
      if(action==='monitor-pause'||action==='monitor-resume'||action==='monitor-status'){
        const m=action==='monitor-status'?await call(env,path):await call(env,path,{status:action==='monitor-resume'?'active':'paused'},'PATCH');
        const monitor=parseMonitor(m);if(!monitor)throw Error('Telem returned an invalid monitor status.');return json(monitor);
      }
      const cursor=Number(b.cursor||0);if(!Number.isSafeInteger(cursor)||cursor<0)return json({error:'Invalid cursor'},400);
      return json(await call(env,path+'/agent/changes?cursor='+cursor+'&limit=20'));
    }
    return json({error:'Unknown action'},404);
  }catch(e:any){return json({error:e.name==='TimeoutError'?'Telem timed out. No automatic retry was made.':String(e.message||'Request failed').slice(0,300)},502);}
}

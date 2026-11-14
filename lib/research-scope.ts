import type {SourceRow} from './analysis.ts';

export const MIN_SOURCES=5;
export const MAX_SOURCES=100;
export const DEFAULT_SOURCES=40;
export const MAX_ADDITIONAL_READS=6;
export type ResearchMode='overview'|'quick';
export function researchScope(topic:string,mode:ResearchMode='overview',pageLimit?:number){
 const sourceLimit=pageLimit??(mode==='quick'?10:DEFAULT_SOURCES);
 if(!Number.isInteger(sourceLimit)||sourceLimit<MIN_SOURCES||sourceLimit>MAX_SOURCES)throw Error(`Page limit must be a whole number from ${MIN_SOURCES} to ${MAX_SOURCES}.`);
 const lanes=mode==='quick'?
  [{label:'Primary records',query:`${topic} primary sources official statements evidence`},{label:'Findings and corrections',query:`${topic} investigation findings corrections unresolved questions`}]:
  [{label:'News and developments',query:`${topic} news latest developments`},
   {label:'Official records',query:`${topic} official statement primary documents announcements`},
   {label:'Timeline and background',query:`${topic} timeline background earlier events dates`},
   {label:'Participants and impacts',query:`${topic} participants affected people response impact`},
   {label:'Findings and corrections',query:`${topic} investigation findings corrections unresolved questions`}];
 return {mode,lanes,sourceLimit,initialReads:Math.min(sourceLimit,mode==='quick'?3:10),additionalReads:mode==='quick'?3:MAX_ADDITIONAL_READS,resultsPerProvider:Math.min(20,Math.max(mode==='quick'?5:8,Math.ceil(sourceLimit/lanes.length)))};
}
type Candidate=SourceRow&{queryLanes:number[];domain:string};
const stop=new Set('a an the in on at of for to and or is are was were will has have by event news latest about'.split(' '));
const terms=(text:string)=>[...new Set(text.toLowerCase().replace(/data[\s-]*cent(?:er|re)s?/g,'data center').match(/[\p{L}\p{N}]+/gu)||[])].filter(w=>w.length>1&&!stop.has(w)).map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w);
// A ranking heuristic, not a factual-support judgment. Prefer topic matches
// and specific documents over homepages, personal profiles and generic feeds.
export function sourceRelevance(row:SourceRow,topic:string){
 const target=terms(topic);if(!target.length)return 0;
 const title=new Set(terms(row.title)),text=new Set(terms(row.title+' '+row.summary+' '+row.url));
 const u=new URL(row.url),generic=u.pathname==='/'||/\/in\/|\/episodes\/feed\/?$|\/feed\/?$/.test(u.pathname);
 const match=target.filter(t=>text.has(t)).length/target.length,titleMatch=target.filter(t=>title.has(t)).length/target.length;
 return match+titleMatch*.25-(generic?.65:0);
}
// Topic relevance precedes domain diversity. Search rank breaks equal scores.
export function diverseSources<T extends Candidate>(rows:T[],laneCount:number,limit:number,topic=''):T[]{
 const chosen:T[]=[],hosts=new Map<string,number>();
 const relevance=new Map(rows.map(r=>[r,sourceRelevance(r,topic)]));
 while(chosen.length<Math.min(limit,rows.length)){
  const remaining=rows.filter(r=>!chosen.includes(r)),lane=chosen.length%laneCount;
  const inLane=remaining.filter(r=>r.queryLanes.includes(lane));
  const pool=inLane.length?inLane:remaining;
  const score=(r:T)=>relevance.get(r)!-Math.min(hosts.get(r.domain)||0,3)*.08;
  const next=pool.reduce((best,r)=>score(r)>score(best)?r:best);
  chosen.push(next);hosts.set(next.domain,(hosts.get(next.domain)||0)+1);
 }
 return chosen;
}
export function initialReading<T extends Candidate>(rows:T[],laneCount:number,limit:number,topic=''):T[]{
 const chosen=diverseSources(rows,laneCount,Math.min(laneCount,limit),topic);
 // Include publication-date extremes when available, without inventing dates.
 const dated=rows.filter(r=>(!topic||sourceRelevance(r,topic)>=.5)&&r.publish_date&&Number.isFinite(Date.parse(r.publish_date))).sort((a,b)=>Date.parse(a.publish_date!)-Date.parse(b.publish_date!));
 for(const row of [dated[0],dated.at(-1),...diverseSources(rows,laneCount,limit,topic)]){
  if(row&&!chosen.includes(row)&&chosen.length<limit)chosen.push(row);
 }
 return chosen;
}

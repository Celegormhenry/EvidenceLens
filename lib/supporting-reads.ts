import type {AnalysisCore,SourceRow} from './analysis.ts';
import {MAX_ADDITIONAL_READS} from './research-scope.ts';

export type SupportingRead={sourceId:string;claimIds:string[];basis:'citation'|'related_snippet'};
const stopwords=new Set('about after again also been before being between could does during from have into more most only other over said some than that their them then there these they this those through under until very were what when where which while will with would'.split(' '));
const words=(text:string)=>new Set((text.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>=4&&!stopwords.has(w)));
// Leading claims have priority, then pages supporting several claims. This is
// a bounded reading heuristic, not an independent judgment of claim importance.
export function supportingReads(analysis:AnalysisCore,rows:SourceRow[],attempted:string[],limit=3):SupportingRead[]{
 const candidates=rows.filter(r=>!r.content?.trim()&&!attempted.includes(r.url)).map(row=>{
  const claims=analysis.claims.filter(c=>c.evidence.some(e=>e.sourceId===row.id&&e.relation==='supports'));
  if(claims.length)return {sourceId:row.id,claimIds:claims.map(c=>c.id),basis:'citation' as const,score:100+claims.reduce((n,c)=>n+(analysis.claims.indexOf(c)<3?3:1),0)};
  // Once cited pages are covered, inspect related unread results for possible
  // republications. Lexical relevance is NOT a support or entailment judgment.
  if(analysis.claims.some(c=>c.evidence.some(e=>e.sourceId===row.id)))return {sourceId:row.id,claimIds:[],basis:'related_snippet' as const,score:0};
  const snippet=words(row.title+' '+row.summary);
  const related=analysis.claims.slice(0,3).flatMap(c=>{const terms=words(c.text),shared=[...terms].filter(w=>snippet.has(w)).length;return shared>=3&&shared/terms.size>=.25?[{id:c.id,score:shared/terms.size}]:[];});
  return {sourceId:row.id,claimIds:related.map(c=>c.id),basis:'related_snippet' as const,score:related.reduce((n,c)=>n+c.score,0)};
 }).filter(c=>c.score>0);
 return candidates.sort((a,b)=>b.score-a.score).slice(0,Math.max(0,Math.min(MAX_ADDITIONAL_READS,limit))).map(({sourceId,claimIds,basis})=>({sourceId,claimIds,basis}));
}

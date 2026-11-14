import {modelSources} from '../lib/analysis.ts';
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
export function evidenceMetrics(answer,rows){
 const sources=new Map(modelSources(rows).map(s=>[s.id,s.text]));
 const claims=answer?.claims||[],citations=claims.flatMap(c=>c.evidence||[]);
 const valid=e=>typeof e.quote==='string'&&e.quote.trim().length>=20&&sources.has(e.sourceId)&&normalize(sources.get(e.sourceId)).includes(normalize(e.quote));
 const matched=citations.filter(valid).length;
 return {claims:claims.length,citations:citations.length,matchedQuotes:matched,quoteMatchRate:citations.length?matched/citations.length:null,
  claimsWithMatchedQuote:claims.filter(c=>c.evidence?.some(valid)).length,
  sources:rows.length,fetchedPages:rows.filter(r=>r.content).length,
  nasaSources:rows.filter(r=>new URL(r.url).hostname==='nasa.gov'||new URL(r.url).hostname.endsWith('.nasa.gov')).length};
}
export function reviewedFacts(review,criteria){
 if(!review)return null;
 const decisions=criteria.map(c=>review.criteria?.[c.id]);
 if(decisions.some(d=>!d||!['pass','fail','unassessable'].includes(d.verdict)||typeof d.evidence!=='string'||!d.evidence.trim()))return null;
 return {passed:decisions.filter(d=>d.verdict==='pass').length,total:criteria.length,unassessable:decisions.filter(d=>d.verdict==='unassessable').length};
}

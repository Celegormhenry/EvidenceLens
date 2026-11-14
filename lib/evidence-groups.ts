import type {SourceRow} from './analysis.ts';

export type EvidenceGroup={id:string;sourceIds:string[];basis:('matching_text'|'overlapping_text'|'shared_attribution')[];originalUrls:string[]};
const normalize=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
function canonical(raw:string){try{const u=new URL(raw);if(!['http:','https:'].includes(u.protocol))return null;u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_')||['fbclid','gclid'].includes(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'');}catch{return null;}}
function originalURL(content:string){
 // Only explicit republication labels. A link, shared domain, generic mention,
 // or an inferred model relationship is not proof of a common original.
 const matches=[...content.matchAll(/(?:originally published (?:at|on)|republished from|original reporting(?: by)?|original source)\s*:?\s*(https?:\/\/[^\s<>"\)]+)/gi)]
  .map(m=>canonical(m[1].replace(/[.,;]+$/,''))).filter((v):v is string=>!!v);
 const unique=[...new Set(matches)];return unique.length===1?unique[0]:null;
}
function shingles(text:string){const words=text.match(/[\p{L}\p{N}]+/gu)||[];const out=new Set<string>();if(words.length<40)return out;for(let i=0;i<=words.length-5;i++)out.add(words.slice(i,i+5).join(' '));return out;}
export function groupEvidenceSources(rows:SourceRow[]):EvidenceGroup[]{
 const data=rows.map(r=>({id:r.id,url:canonical(r.url),text:normalize((r.content||'').slice(0,8000)),original:originalURL((r.content||'').slice(0,8000))}));
 const parent=data.map((_,i)=>i),links:{a:number;b:number;basis:EvidenceGroup['basis'][number];original?:string}[]=[];
 const root=(i:number):number=>parent[i]===i?i:root(parent[i]);
 const grams=data.map(r=>shingles(r.text));
 for(let i=0;i<data.length;i++)for(let j=i+1;j<data.length;j++){
  const a=data[i],b=data[j];let basis:EvidenceGroup['basis'][number]|undefined,original:string|undefined;
  if(a.original&&(a.original===b.original||a.original===b.url)){basis='shared_attribution';original=a.original;}
  else if(b.original&&b.original===a.url){basis='shared_attribution';original=b.original;}
  else if(a.text.length>=160&&a.text===b.text)basis='matching_text';
  else if(grams[i].size&&grams[j].size){const shared=[...grams[i]].filter(g=>grams[j].has(g)).length;const union=grams[i].size+grams[j].size-shared;if(shared/union>=.9)basis='overlapping_text';}
  if(basis){parent[root(j)]=root(i);links.push({a:i,b:j,basis,original});}
 }
 const groups=new Map<number,number[]>();data.forEach((_,i)=>{const k=root(i);groups.set(k,[...(groups.get(k)||[]),i]);});
 return [...groups.values()].filter(g=>g.length>1).map((g,i)=>{const edges=links.filter(l=>g.includes(l.a)&&g.includes(l.b));return {id:`G${i+1}`,sourceIds:g.map(k=>data[k].id),basis:[...new Set(edges.map(l=>l.basis))],originalUrls:[...new Set(edges.flatMap(l=>l.original?[l.original]:[]))]};});
}

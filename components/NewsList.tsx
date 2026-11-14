'use client';
import {useState} from 'react';
import type {SourceRow} from '../lib/analysis';
import {groupEvidenceSources} from '../lib/evidence-groups';

const publication=(r:SourceRow)=>r.publish_date&&Number.isFinite(Date.parse(r.publish_date))?Date.parse(r.publish_date):null;
export default function NewsList({rows,onSource,citedIds=[]}:{rows:SourceRow[];onSource:(id:string)=>void;citedIds?:string[]}){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[domain,setDomain]=useState('all'),[sort,setSort]=useState('coverage'),[visible,setVisible]=useState(12);
 const host=(r:SourceRow)=>r.domain||new URL(r.url).hostname;
 const groups=groupEvidenceSources(rows);
 const filtered=rows.filter(r=>(r.title+' '+r.summary+' '+host(r)).toLowerCase().includes(query.toLowerCase())&&(domain==='all'||host(r)===domain)&&(status==='all'||(status==='read'?!!r.content?.trim():!r.content?.trim())));
 if(sort!=='coverage')filtered.sort((a,b)=>{const x=publication(a),y=publication(b);return x===null?y===null?0:1:y===null?-1:sort==='newest'?y-x:x-y;});
 return <section className="news-library panel">
  <div className="section-line"><h3>News & source library</h3><span className="caption">{rows.length} retained webpages · articles remain visible even when not cited in the summary</span></div>
  <p className="caption">Search excerpts are not verified findings. Open a page to inspect the evidence. Publication dates are supplied by the search provider; unknown dates stay unknown.</p>
  <div className="news-filters">
   <label>Find an article<input value={query} placeholder="Title, excerpt or publisher" onChange={e=>{setQuery(e.target.value);setVisible(12)}}/></label>
   <label>Publisher<select value={domain} onChange={e=>{setDomain(e.target.value);setVisible(12)}}><option value="all">All publishers</option>{[...new Set(rows.map(host))].sort().map(d=><option key={d}>{d}</option>)}</select></label>
   <label>Reading status<select value={status} onChange={e=>{setStatus(e.target.value);setVisible(12)}}><option value="all">All pages</option><option value="read">Page text retrieved</option><option value="snippet">Snippet only</option></select></label>
   <label>Sort<select value={sort} onChange={e=>{setSort(e.target.value);setVisible(12)}}><option value="coverage">Search coverage order</option><option value="newest">Newest publication first</option><option value="oldest">Oldest publication first</option></select></label>
  </div>
  <p className="caption" role="status">Showing {Math.min(visible,filtered.length)} of {filtered.length} matching pages</p>
  <div className="news-grid">{filtered.slice(0,visible).map(r=>{const group=groups.find(g=>g.sourceIds.includes(r.id)),date=publication(r);return <article key={r.id} className="news-card">
   <p className="caption">{r.id} · {host(r)} · {date===null?'Date unavailable':new Date(date).toISOString().slice(0,10)}</p>
   <h4><button className="news-title" onClick={()=>onSource(r.id)}>{r.title}</button></h4>
   <p>{r.summary?r.summary.slice(0,520)+(r.summary.length>520?'…':''):'No search excerpt supplied. Open the source to read it.'}</p>
   <div className="row"><span className="pill neutral">{r.content?.trim()?'Page text retrieved':'Snippet only'}</span>{citedIds.includes(r.id)&&<span className="caption">Cited in analysis</span>}{group&&<span className="caption">{group.id} · possible shared origin</span>}</div>
   <div className="row"><button className="source-chip" onClick={()=>onSource(r.id)}>Inspect source</button><a href={r.url} target="_blank" rel="noreferrer">Original ↗</a></div>
  </article>})}</div>
  {!filtered.length&&<p>No articles match these filters.</p>}
  {visible<filtered.length&&<button className="button secondary" onClick={()=>setVisible(n=>n+12)}>Show more articles ({filtered.length-visible} remaining)</button>}
 </section>;
}

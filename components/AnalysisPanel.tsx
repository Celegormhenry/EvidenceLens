'use client';
import {useState} from 'react';
import EventGraph from './EventGraph';
import NewsList from './NewsList';
import type {Analysis,SourceRow} from '../lib/analysis';
import {groupEvidenceSources} from '../lib/evidence-groups';
import type {Run} from '../lib/history';

export default function AnalysisPanel({analysis:a,rows,onSource,onSearch,previousTime,additionalReading}:{analysis:Analysis;rows:SourceRow[];onSource:(id:string)=>void;onSearch:(q:string)=>void;previousTime?:string;additionalReading?:Run['additionalReading']}){
 const [tab,setTab]=useState('News');
 const groups=groupEvidenceSources(rows),readCount=rows.filter(r=>r.content?.trim()).length;
 const chips=(ids:string[])=>ids.map(id=><button key={id} className="source-chip" onClick={()=>onSource(id)}>{id} ↗</button>);
 return <div className="analysis-stack">
  <section className="panel analysis-intro"><div className="row"><span className="pill supports">Live model analysis</span></div><h3>Current assessment</h3><p>{a.summary}</p><p className="caption">Model interpretation, not a verified verdict. Quotations are checked against retrieved text; that check does not establish truth or entailment.</p></section>
  {a.groundingWarnings.map((w,i)=><div className="warning-note" key={i}>{w}</div>)}
  <nav className="result-tabs" aria-label="Analysis views">{['News','Evidence','Graph','Forecasts'].map(t=><button key={t} aria-pressed={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}{t==='Evidence'?` (${a.claims.length})`:t==='News'?` (${rows.length})`:''}</button>)}</nav>
  {tab==='News'&&<NewsList rows={rows} onSource={onSource} citedIds={[...new Set(a.claims.flatMap(c=>c.evidence.map(e=>e.sourceId)))]}/>}
  {tab==='Forecasts'&&<>
  <div className="section-line"><h3>Possible next events</h3><span className="caption">Subjective estimates · not calibrated · separate binary questions</span></div>
  {a.revision.previousRunId&&<div className="warning-note">Compared with the previous browser snapshot{previousTime?' from '+new Date(previousTime).toLocaleString('en-US'):''}. {a.revision.unchangedEvidence?'Retrieved text is unchanged; prior estimates were retained.':'Review the evidence behind each proposed revision.'}</div>}
  <div className="live-forecasts">{a.forecasts.map(f=>{const change=a.revision.changes.find(x=>x.id===f.id);return <article className="panel live-forecast" key={f.id}><span className="overline">{f.id} · MODEL ESTIMATE</span><h3>{f.question}</h3><div className={f.probability===null?"estimate-value estimate-unavailable":"estimate-value"}>{f.probability===null?'No probability estimate':f.probability+'%'}<small>{f.probability===null?'No percentage issued — this does not mean 0%.':change?.delta!=null?`${change.previous}% → ${change.current}% (${change.delta>0?'+':''}${change.delta} pp)`:'First estimate / no comparable prior'}</small></div><p>{f.probability===null&&<strong>Why no estimate? </strong>}{f.rationale}</p><div className="row">{chips(f.sourceIds)}</div><details><summary>Resolution & what could change this</summary><p><strong>Deadline:</strong> {f.deadline}</p><p>{f.resolution}</p><p><strong>Watch for:</strong> {f.changeTrigger}</p></details></article>})}</div>
  {!a.forecasts.length&&<p className="warning-note">No evidence-grounded forecast available. Inspect the sources or investigate a narrower question.</p>}
  {a.impacts.length>0&&<section className="panel analysis-list"><h3>Possible wider effects</h3><p className="caption">Conditional scenarios, not observed consequences or causal estimates.</p>{a.impacts.map((i,j)=><article key={j}><h4>If {i.condition}</h4><p>{i.effect}</p><div className="row">{chips(i.sourceIds)}</div></article>)}</section>}
  <button className="conflict-link" onClick={()=>setTab('Evidence')}>{a.conflicts.length?`${a.conflicts.length} potential conflicts or scope differences — inspect evidence →`:'No grounded conflict identified in this retrieval — inspect evidence →'}</button>
  </>}
  {tab==='Evidence'&&<>
  <section className="panel analysis-list"><h3>Source independence: not yet verified</h3>
   <p>Found {rows.length} webpages. Page text retrieved for {readCount}; {rows.length-readCount} remain snippet-only.</p>
   {additionalReading&&additionalReading.selected.length>0&&<p>Additional reading: {additionalReading.fetchedSourceIds.length} of {additionalReading.selected.length} relevant pages retrieved. Overlap groups before / after: {additionalReading.groupsBefore} / {additionalReading.groupsAfter}.</p>}
   {additionalReading&&additionalReading.selected.length>0&&<p className="caption">Prioritized cited pages, then related search results. Similar snippets guide reading; they do not establish support or independence. Failed reads were not retried. {additionalReading.analysisRefreshed?'The analysis was updated using the additional page text.':'No updated analysis was needed because no additional page text was retrieved.'}</p>}
   {!groups.length?<p>{readCount<2?'Not enough page text to compare sources yet.':'No clear copying or shared original source identified in the retrieved text.'} This does not mean the webpages are independent.</p>:<p>{groups.length} group{groups.length===1?'':'s'} with matching text or a stated shared original source. These are not independent confirmations.</p>}
   <p className="caption">Unread pages remain unassessed. Checks use the retrieved text, which may be incomplete; an ungrouped page is not a verified independent source.</p>
   {groups.map(g=><article key={g.id}><h4>{g.id} · {g.sourceIds.length} pages</h4><div className="row">{chips(g.sourceIds)}</div><p>{g.basis.map(b=>b==='matching_text'?'Matching retrieved text':b==='overlapping_text'?'Substantially overlapping text; likely reproduction':'Explicit shared attribution; origin not independently verified').join(' · ')}</p>{g.originalUrls.map(url=><p key={url}><a href={url} target="_blank" rel="noreferrer">Named original source ↗</a></p>)}</article>)}
  </section>
  <div className="analysis-columns"><section className="panel analysis-list"><h3>Claims & quoted evidence</h3>{a.claims.map(c=><article key={c.id}><div className="row"><span className="overline">{c.id}</span><span className="pill neutral">{c.status==='corroborated'?'reported · independence unverified':c.status}</span></div><h4>{c.text}</h4>{c.evidence.map((e,i)=><div className="quoted-evidence" key={i}><blockquote>{e.quote}</blockquote><div className="row">{chips([e.sourceId])}<span className="caption">{e.relation} · exact text match</span></div></div>)}</article>)}</section>
  <section className="panel analysis-list"><h3>Conflicts & source relationships</h3>{!a.conflicts.length&&<p className="caption">No well-grounded conflict identified in this limited retrieval. This does not establish agreement.</p>}{a.conflicts.map((c,i)=><article key={i}><span className="pill clarifies">{c.kind.replaceAll('_',' ')}</span><p>{c.explanation}</p><div className="row">{chips(c.sourceIds)}</div></article>)}{a.relationships.map((r,i)=><article key={'r'+i}><span className="overline">{r.kind.replaceAll('_',' ')} · inferred</span><p>{r.reason}</p><div className="row">{chips([r.fromSourceId,r.toSourceId])}</div></article>)}<h3>Claim-specific source ratings</h3><p className="caption">Directness: 0–3. Not a truth score. Open the source and check the claim.</p>{a.assessments.map((s,i)=><article key={i}><div className="row">{chips([s.sourceId])}<span className="pill neutral">{s.claimId} · {s.directness===null?'Unknown':s.directness+'/3'}</span></div><p>{s.reason}</p></article>)}</section></div>
  </>}
  {tab==='Graph'&&<EventGraph analysis={a} onSource={onSource}/>}
  <details className="next-searches"><summary>Suggested searches & limitations</summary>
  <section className="panel analysis-list"><h3>What could change the answer?</h3>{a.nextSearches.map((q,i)=><button className="next-query" key={i} onClick={()=>onSearch(q.query)}><strong>{q.query} ↗</strong><span>{q.why}</span></button>)}<details><summary>Limits of this analysis</summary><ul>{a.limits.map((l,i)=><li key={i}>{l}</li>)}</ul><p className="caption">History is stored in this browser and can be edited or cleared. Export snapshots to retain a copy. This is not an immutable audit log.</p></details></section>
  </details>
 </div>;
}

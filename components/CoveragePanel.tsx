import type {Run} from '../lib/history';

export default function CoveragePanel({run}:{run:Run}){
 const c=run.coverage;
 if(!c)return <p className="warning-note">This saved run used the earlier search scope. Search again in Broad overview mode for wider coverage and reading counts.</p>;
 const domains=new Set(run.results.map(r=>r.domain)).size;
 return <section className="panel coverage-panel">
  <h3>{c.mode==='overview'?'Broad overview':'Quick check'} · search coverage</h3>
  <div className="coverage-counts"><div><strong>{c.returned}</strong><span>search results returned</span></div><div><strong>{c.uniqueUrls}</strong><span>distinct URLs</span></div><div><strong>{c.retained}</strong><span>pages in your library</span></div><div><strong>{c.read}</strong><span>page texts retrieved</span></div></div>
  <p>{domains} publisher domains · {c.retained-c.read} pages still have only snippets. Different domains do not establish independent reporting.</p>
  <p className="caption">{c.duplicatesRemoved} repeated URL results removed. {c.invalidSkipped>0?`${c.invalidSkipped} unusable links skipped. `:''}{c.omitted>0?`${c.omitted} distinct URLs fell outside this run's page limit; they were not judged irrelevant.`:'All distinct usable URLs from this search were retained.'}</p>
  <details><summary>Search angles & remaining gaps</summary><div className="coverage-lanes">{c.lanes.map((lane,i)=><div key={i}><strong>{lane.label}</strong><span>{lane.status==='failed'?'Search failed — coverage gap':lane.status==='empty'?'No results — coverage gap':`${lane.retained} retained · ${lane.read} page texts retrieved`}</span></div>)}</div><p className="caption">A search angle records where we looked, not whether the angle is adequately covered. Article counts do not establish a complete account. Snippets and unread material remain gaps.</p></details>
 </section>;
}

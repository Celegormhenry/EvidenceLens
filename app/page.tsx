'use client';
import {useEffect,useRef,useState} from 'react';
import AnalysisPanel from '../components/AnalysisPanel';
import NewsList from '../components/NewsList';
import CoveragePanel from '../components/CoveragePanel';
import {DEFAULT_SOURCES,MIN_SOURCES,MAX_SOURCES} from '../lib/research-scope';
import type {ResearchMode} from '../lib/research-scope';
import {mergeRuns,readRuns} from '../lib/history';
import type {Run} from '../lib/history';
import {parseMonitor,monitorStatus,monitorDescription,monitorProgress} from '../lib/monitor';
import type {Monitor,MonitorAction} from '../lib/monitor';
type Note={stance:string;note:string;score:string};
const date=(s:string)=>new Date(s).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export default function Home(){
 const [researchMode,setResearchMode]=useState<ResearchMode>('overview');
 const [pageLimit,setPageLimit]=useState(String(DEFAULT_SOURCES));
 const [topic,setTopic]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [connected,setConnected]=useState<boolean|null>(null),[model,setModel]=useState<string|null>(null);
 const [runs,setRuns]=useState<Run[]>([]),[activeRunId,setActiveRunId]=useState<string|null>(null),[notes,setNotes]=useState<Record<string,Note>>({});
 const [storage,setStorage]=useState('Checking saved history…'),[historyBusy,setHistoryBusy]=useState(true);
 const [monitor,setMonitor]=useState<Monitor|null>(null),[monitorPending,setMonitorPending]=useState<MonitorAction|null>(null),[monitorMessage,setMonitorMessage]=useState(''),[monitorError,setMonitorError]=useState(''),[lastChecked,setLastChecked]=useState<string|null>(null),[changes,setChanges]=useState<any[]>([]),[cursor,setCursor]=useState(0);
 const [selected,setSelected]=useState<string|null>(null),[fetched,setFetched]=useState<Record<string,string>>({}),[fetchBusy,setFetchBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),priorFocus=useRef<HTMLElement|null>(null);
 const monitorBusy=monitorPending!==null,monitorState=monitorStatus(monitor);
 const run=runs.find(r=>r.id===activeRunId)||runs[0],detail=run?.results.find(r=>r.id===selected);
 async function restoreHistory(){setHistoryBusy(true);try{const response=await fetch('/api/history/runs',{signal:AbortSignal.timeout(15000)});const data=await response.json() as {runs?:unknown;message?:string};if(!response.ok)throw Error();const restored=readRuns(data.runs);setRuns(current=>mergeRuns(current,restored));setActiveRunId(id=>id||restored[0]?.id||null);setTopic(current=>current||restored[0]?.topic||'');setStorage(data.message||'Browser history only.')}catch{setStorage('Neo4j history is unavailable. Browser history is still available.')}finally{setHistoryBusy(false)}}
 useEffect(()=>{fetch('/api/telem/status').then(r=>r.json()).then((d:any)=>{setConnected(d.configured===true);setModel(d.modelConnected?d.model:null)}).catch(()=>setConnected(false));try{const d=JSON.parse(localStorage.getItem('lens-v1')||'{}');const saved=readRuns(d.runs);setRuns(saved);if(saved[0]){setActiveRunId(saved[0].id);setTopic(saved[0].topic)}if(d.notes)setNotes(d.notes);if(d.monitor)setMonitor(parseMonitor(d.monitor));if(Number.isSafeInteger(d.cursor))setCursor(d.cursor);if(Array.isArray(d.changes))setChanges(d.changes)}catch{}setLoaded(true);void restoreHistory()},[]);
 useEffect(()=>{if(loaded)try{localStorage.setItem('lens-v1',JSON.stringify({runs:runs.slice(0,5),notes,monitor,cursor,changes:changes.slice(-40)}))}catch{setNotice('Browser storage is full. Export your results to retain them.')}},[runs,notes,monitor,cursor,changes,loaded]);
 useEffect(()=>{if(selected){priorFocus.current=document.activeElement as HTMLElement;dialog.current?.showModal()}else if(dialog.current?.open){dialog.current.close();priorFocus.current?.focus()}},[selected]);
 async function api(action:string,body:any){const r=await fetch('/api/telem/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(action==='research'?450000:65000)});const d:any=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d}
 async function research(t=topic,settings?:{researchMode:ResearchMode;pageLimit:number}){t=t.trim();if(busy||t.length<5)return;const limit=settings?.pageLimit??Number(pageLimit);if(!Number.isInteger(limit)||limit<MIN_SOURCES||limit>MAX_SOURCES){setError(`Choose a page limit from ${MIN_SOURCES} to ${MAX_SOURCES}.`);return;}setBusy(true);setError('');setNotice('');setTopic(t);try{const prior=runs.find(r=>r.topic===t&&r.analysis&&r.fingerprint);const previous=prior?{id:prior.id,topic:prior.topic,timestamp:prior.timestamp,analysis:prior.analysis,fingerprint:prior.fingerprint}:null;const d=await api('research',{topic:t,previous,researchMode:settings?.researchMode??researchMode,pageLimit:limit});const [saved]=readRuns([d]);if(!saved)throw Error('Research response could not be read.');setRuns(r=>mergeRuns([saved,...r],[]));setActiveRunId(saved.id);setSelected(null);setStorage(d.persistence?.message||'Saved in browser history.');if(d.persistence?.status==='unavailable')setNotice(d.persistence.message)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function fetchPage(url:string){setFetchBusy(true);try{const d=await api('fetch',{url});const p=d.results?.[0];if(!p||p.status==='failed'||p.http_status>=400||!p.content)throw Error('Unable to read this page. Open the original source instead.');setFetched(f=>({...f,[url]:p.content}));setNotice('Page fetched. This extra read does not automatically reanalyze the report.')}catch(e:any){setNotice(e.message)}finally{setFetchBusy(false)}}
 async function monitorAction(action:MonitorAction){
  if(monitorBusy)return;setMonitorPending(action);setMonitorMessage('');setMonitorError('');
  try{
   if(action==='create'){
    const m=parseMonitor(await api('monitor-create',{query:topic.trim()}));if(!m)throw Error('The monitor response could not be read. Check the Telem console before starting another.');
    setMonitor(m);setCursor(0);setChanges([]);setLastChecked(null);setMonitorMessage('Monitor created. Telem will check this topic hourly for four hours.');
   }else if(monitor){
    if(action==='end'){await api('monitor-end',{id:monitor.id});setMonitor({...monitor,status:'ended'});setMonitorMessage('Monitor ended.');}
    else{
     const current=parseMonitor(await api(action==='changes'?'monitor-status':'monitor-'+action,{id:monitor.id}));
     if(!current)throw Error('The monitor status could not be read.');setMonitor(current);
     if(action==='changes'){
      if(monitorStatus(current)!=='active'){setMonitorMessage(monitorDescription(current));return;}
      if(current.agent_state?.status==='compiling'||current.agent_state?.status==='failed'){setMonitorMessage(monitorDescription(current));return;}
      const d=await api('monitor-changes',{id:monitor.id,cursor});const fresh=Array.isArray(d.changes)?d.changes:[];
      setChanges(c=>[...c,...fresh].slice(-40));if(Number.isSafeInteger(d.next_cursor))setCursor(d.next_cursor);setLastChecked(new Date().toISOString());
      setMonitorMessage(fresh.length?`${fresh.length} new changes found. Updating the analysis…`:'No new changes yet. The next scheduled check may find more; no new analysis was run.');
      if(fresh.length){await research(current.query);setMonitorMessage(`${fresh.length} changes received. See the analysis result or error below.`);}
     }else setMonitorMessage(action==='pause'?'Monitor paused.':action==='resume'?'Monitor resumed.':'Monitor status refreshed.');
    }
   }
  }catch(e:any){setMonitorError(e.name==='TimeoutError'?'The request timed out. Refresh status or check the Telem console before creating another monitor.':e.message||'Monitor request failed.');}
  finally{setMonitorPending(null)}
 }
 function annotate(url:string,key:string,value:string){setNotes(n=>({...n,[url]:{...(n[url]||{stance:'unreviewed',note:'',score:'Unknown'}),[key]:value}}))}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify({app:'Evidence Lens',exportedAt:new Date().toISOString(),liveRuns:runs,notes,monitor,changes},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='evidence-lens-results.json';a.click();URL.revokeObjectURL(url)}
 return <main className="simple-app">
  <header className="app-header"><a href="/">Evidence Lens</a><span className="caption">Telem AI + {model||'model pending'}</span></header>
  <h1>Track a topic. Understand what changes.</h1><p className="intro">Find evidence, spot conflicts, and inspect the reasons behind each forecast.</p>
  <form id="research-form" className="topic-form" onSubmit={e=>{e.preventDefault();research()}}><label htmlFor="topic">Topic or question</label><div className="search-input"><input id="topic" placeholder="e.g. NVIDIA board inquiry" value={topic} onChange={e=>setTopic(e.target.value)} minLength={5} maxLength={240} required/><button className="button primary" disabled={busy||!connected}>{busy?'Analyzing…':'Analyze'}</button></div></form>
  <div className="scope-choice"><div className="scope-fields"><label>Research scope <select value={researchMode} disabled={busy} onChange={e=>{const mode=e.target.value as ResearchMode;setResearchMode(mode);setPageLimit(String(mode==='quick'?10:DEFAULT_SOURCES))}}><option value="overview">Broad overview · 5 search angles</option><option value="quick">Quick check · 2 search angles</option></select></label><label htmlFor="page-limit">Maximum pages <input id="page-limit" form="research-form" type="number" min={MIN_SOURCES} max={MAX_SOURCES} step="1" required value={pageLimit} disabled={busy} onChange={e=>setPageLimit(e.target.value)}/></label></div><p className="caption">Choose {MIN_SOURCES}–{MAX_SOURCES} pages to keep after URL deduplication. Actual results may be fewer. Up to {researchMode==='overview'?16:6} page texts read; the rest remain snippets. Higher limits can increase API usage.</p></div>
  {!run&&<div className="examples"><span>Try:</span>{['NVIDIA board inquiry','US AI chip export policy','California data center power demand'].map(t=><button key={t} onClick={()=>setTopic(t)}>{t}</button>)}</div>}
  {connected===false&&<p className="warning-note">Telem connection unavailable. Please reload and try again.</p>}
  <details className="monitor-controls" open><summary>Topic monitor · {monitorState}</summary>
   <p className="caption">{monitorDescription(monitor)} Uses your Telem balance.</p>
   {monitor&&<p>{monitor.query}{monitor.expires_at&&<span className="caption"> · Ends {date(monitor.expires_at)}</span>}{monitor.agent_state?.next_run_at&&monitorState==='active'&&<span className="caption"> · Next check {date(monitor.agent_state.next_run_at)}</span>}</p>}
   <div className="row">
    {(!monitor||monitorState==='ended')?<button className="button secondary" disabled={!connected||monitorBusy||busy||topic.trim().length<10} onClick={()=>monitorAction('create')}>{monitorPending==='create'?'Starting monitor…':'Start monitor'}</button>:<>
     <button className="button secondary" disabled={monitorBusy||busy||monitorState!=='active'} onClick={()=>monitorAction('changes')}>{monitorPending==='changes'?'Checking for updates…':'Check updates'}</button>
     <button className="button secondary" disabled={monitorBusy||busy} onClick={()=>monitorAction(monitorState==='paused'?'resume':'pause')}>{monitorPending==='pause'?'Pausing…':monitorPending==='resume'?'Resuming…':monitorState==='paused'?'Resume monitor':'Pause'}</button>
     <button className="text-button" disabled={monitorBusy||busy} onClick={()=>monitorAction('end')}>{monitorPending==='end'?'Ending…':'End monitor'}</button>
    </>}
    {monitor&&monitorState!=='ended'&&<button className="text-button" disabled={monitorBusy||busy} onClick={()=>monitorAction('status')}>Refresh status</button>}
   </div>
   {(!monitor||monitorState==='ended')&&topic.trim().length<10&&<p className="caption">Enter a topic of at least 10 characters to enable Start monitor.</p>}
   {monitorPending&&<p role="status">{monitorProgress[monitorPending]}</p>}
   {!monitorPending&&monitorMessage&&<p role="status">{monitorMessage}</p>}
   {monitorError&&<p className="error-box" role="alert">{monitorError}</p>}
   {lastChecked&&<p className="caption">Last checked {date(lastChecked)} · {changes.length} received changes retained.</p>}
  </details>
  {notice&&<p className="notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}>×</button></p>}
  {error&&<p className="error-box" role="alert">{error}</p>}
  {busy&&<div className="loading-box" role="status"><span className="spinner"/><div><strong>Searching and analyzing…</strong><p>Searching multiple angles, reading original pages, and filling gaps behind the leading claims. An extra reading pass may take several minutes.</p></div></div>}
  {run&&!busy&&<section className="results"><div className="result-toolbar"><div><h2>{run.topic}</h2><p className="caption">{date(run.timestamp)} · {run.results.length} sources · {run.results.filter(r=>r.content?.trim()).length} pages retrieved · {run.budget.fetchUrls} reads attempted</p></div><div className="row"><button className="button primary" disabled={!connected} onClick={()=>research(run.topic)}>Search again & compare</button><button className="button secondary" onClick={download}>Export</button></div></div>
   {runs.length>1&&<label className="history-select">Saved runs <select value={run.id} onChange={e=>{setActiveRunId(e.target.value);setTopic(runs.find(r=>r.id===e.target.value)!.topic);setSelected(null)}}>{runs.map(r=><option key={r.id} value={r.id}>{date(r.timestamp)} · {r.topic}</option>)}</select></label>}
   <CoveragePanel run={run} onSource={setSelected}/>
   {run.warnings.map((w,i)=><p className="warning-note" key={i}>{w}</p>)}
   {run.analysis&&typeof run.analysis==='object'?<AnalysisPanel key={run.id} analysis={run.analysis} rows={run.results} additionalReading={run.additionalReading} onSource={setSelected} onSearch={q=>research(q)} previousTime={runs.find(r=>r.id===run.analysis?.revision.previousRunId)?.timestamp}/>:<><p className="warning-note">Analysis unavailable. You can still browse the retrieved news and sources.</p><NewsList rows={run.results} onSource={setSelected}/></>}
   <details className="all-sources" open={!run.analysis}><summary>All retrieved sources ({run.results.length})</summary>{run.results.map(r=><button key={r.id} className="source-row" onClick={()=>setSelected(r.id)}><span>{r.id}</span><div><strong>{r.title}</strong><small>{r.domain} · {r.content?'Page retrieved':'Snippet only'}</small></div><span>↗</span></button>)}</details>
   <details className="run-details"><summary>Search details & usage</summary>{run.queries.map((q,i)=><p key={q}><strong>{run.coverage?.lanes[i]?.label||`Search ${i+1}`}:</strong> {q}</p>)}<p>{run.budget.queryCount??run.queries.length} queries · Telem auto-routing · up to {Number(run.budget.resultsPerProvider||5)} results per provider · {run.budget.fetchUrls} fetches · {run.budget.modelCalls||0} model calls</p>{run.analysis&&typeof run.analysis==='object'&&<p>{run.analysis.model} · {Number(run.budget.inputTokens??run.analysis.inputTokens)} input / {Number(run.budget.outputTokens??run.analysis.outputTokens)} output tokens (reported across analysis calls)</p>}</details>
  </section>}
  <footer><p role="status">{storage}</p><button className="text-button" disabled={historyBusy||busy} onClick={()=>void restoreHistory()}>{historyBusy?'Loading history…':'Refresh saved history'}</button><p>The last five runs and your notes stay in this browser. Neo4j restores up to 50 recent snapshots when configured. Export to keep a copy.</p></footer>
  <dialog ref={dialog} className="modal" aria-label="Source detail" onCancel={e=>{e.preventDefault();setSelected(null)}} onClick={e=>e.target===dialog.current&&setSelected(null)}><div className="modal-inner"><button className="close-modal" aria-label="Close source detail" onClick={()=>setSelected(null)}>×</button>{detail&&<><span className="caption">{detail.id} · {detail.domain}</span><h2>{detail.title}</h2><div className="row"><a className="button primary" href={detail.url} target="_blank" rel="noreferrer">Open original ↗</a>{!detail.content&&!fetched[detail.url]&&<button className="button secondary" disabled={fetchBusy} onClick={()=>fetchPage(detail.url)}>{fetchBusy?'Reading…':'Fetch page'}</button>}</div><p className="caption">Retrieved text is evidence to inspect, not a verified fact.</p><pre className="source-text">{fetched[detail.url]||detail.content||detail.summary||'No source text available.'}</pre>{detail.contentTruncated&&<p className="caption">This page was truncated at the retrieval limit.</p>}<details><summary>Add your assessment</summary><div className="review-controls"><label>Relation<select value={notes[detail.url]?.stance||'unreviewed'} onChange={e=>annotate(detail.url,'stance',e.target.value)}>{['unreviewed','supports','challenges','context','duplicate'].map(v=><option key={v}>{v}</option>)}</select></label><label>Directness<select value={notes[detail.url]?.score||'Unknown'} onChange={e=>annotate(detail.url,'score',e.target.value)}>{['Unknown','Low','Medium','High'].map(v=><option key={v}>{v}</option>)}</select></label></div><label className="note-label">Your notes<textarea value={notes[detail.url]?.note||''} onChange={e=>annotate(detail.url,'note',e.target.value)} maxLength={2000}/></label></details></>}</div></dialog>
 </main>;
}

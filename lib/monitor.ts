export type Monitor={id:string;query:string;status:'active'|'paused'|'ended';expires_at?:string|null;agent_state?:{status?:string;next_run_at?:string|null;needs_attention?:boolean}|null};
export type MonitorAction='create'|'changes'|'pause'|'resume'|'end'|'status';
export const monitorProgress:Record<MonitorAction,string>={create:'Starting monitor…',changes:'Checking for updates…',pause:'Pausing monitor…',resume:'Resuming monitor…',end:'Ending monitor…',status:'Refreshing monitor status…'};
export function parseMonitor(value:unknown):Monitor|null{
 if(!value||typeof value!=='object')return null;
 const m=value as Record<string,unknown>;
 if(typeof m.id!=='string'||! /^[a-zA-Z0-9_-]{1,120}$/.test(m.id)||typeof m.query!=='string'||!['active','paused','ended'].includes(String(m.status)))return null;
 const a=m.agent_state&&typeof m.agent_state==='object'?m.agent_state as Record<string,unknown>:null;
 return {id:m.id,query:m.query,status:m.status as Monitor['status'],expires_at:typeof m.expires_at==='string'?m.expires_at:null,
  agent_state:a?{status:typeof a.status==='string'?a.status:undefined,next_run_at:typeof a.next_run_at==='string'?a.next_run_at:null,needs_attention:a.needs_attention===true}:null};
}
export function monitorStatus(m:Monitor|null,now=Date.now()){
 if(!m)return 'not started';
 return m.expires_at&&Date.parse(m.expires_at)<=now?'ended':m.status;
}
export function monitorDescription(m:Monitor|null,now=Date.now()){
 if(!m)return 'Start a monitor to watch this topic every hour for four hours.';
 const state=monitorStatus(m,now);
 if(state==='ended')return 'This monitor has ended. Start a new monitor to keep watching.';
 if(state==='paused')return 'Monitoring is paused. Resume it to continue hourly checks.';
 if(m.agent_state?.status==='compiling')return 'Telem is preparing the monitoring plan. Refresh status to check when it is ready.';
 if(m.agent_state?.status==='failed'||m.agent_state?.needs_attention)return 'The monitoring agent needs attention. Check it in the Telem console or end this monitor and start again.';
 return 'Monitoring is active. Check updates reads changes already found; it does not force an immediate web search.';
}

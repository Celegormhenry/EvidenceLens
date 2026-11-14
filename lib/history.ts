import {z} from 'zod';
import {analysisValidator} from './analysis.ts';
import {MAX_SOURCES,MAX_ADDITIONAL_READS} from './research-scope.ts';

const analysis = analysisValidator.extend({
  model:z.string(), timestamp:z.string(), inputTokens:z.number(), outputTokens:z.number(),
  groundingWarnings:z.array(z.string()),
  revision:z.object({previousRunId:z.string().nullable(),unchangedEvidence:z.boolean(),changes:z.array(z.object({
    id:z.string(),previous:z.number().nullable(),current:z.number().nullable(),delta:z.number().nullable(),reason:z.string()
  }))})
});
export const runValidator=z.object({
  id:z.string().min(1).max(120),timestamp:z.string().datetime(),topic:z.string().min(1).max(240),
  queries:z.array(z.string()),warnings:z.array(z.string()),fingerprint:z.string().optional(),
  results:z.array(z.object({id:z.string(),url:z.string().url(),title:z.string(),summary:z.string(),
    domain:z.string(),queryLanes:z.array(z.number()),content:z.string().optional(),contentTruncated:z.boolean().optional()
  }).passthrough()).max(MAX_SOURCES),
  budget:z.object({queryCount:z.number().optional(),queryProviderPairs:z.number().optional(),fetchUrls:z.number(),modelCalls:z.number().optional()}).passthrough(),
  analysis:analysis.nullable().optional(),mode:z.string().optional(),
  additionalReading:z.object({
    selected:z.array(z.object({sourceId:z.string(),claimIds:z.array(z.string()),basis:z.enum(['citation','related_snippet','legacy_unknown']).default('legacy_unknown')})).max(MAX_ADDITIONAL_READS),
    fetchedSourceIds:z.array(z.string()).max(MAX_ADDITIONAL_READS),groupsBefore:z.number(),groupsAfter:z.number(),
    analysisRefreshed:z.boolean()
  }).optional(),
  coverage:z.object({mode:z.enum(['overview','quick']),returned:z.number(),invalidSkipped:z.number(),duplicatesRemoved:z.number(),uniqueUrls:z.number(),retained:z.number(),omitted:z.number(),read:z.number(),
    lanes:z.array(z.object({label:z.string(),query:z.string(),status:z.enum(['ok','empty','failed']),uniqueUrls:z.number(),retained:z.number(),read:z.number()}))
  }).optional()
});
export type Run=z.infer<typeof runValidator>;
export type Persistence={status:'saved'|'unconfigured'|'unavailable';message:string};

export function readRuns(value:unknown):Run[]{
  if(!Array.isArray(value))return [];
  return value.flatMap(item=>{const result=runValidator.safeParse(item);return result.success?[result.data]:[];});
}

// Prefer this browser's current objects on duplicate IDs; keep the active selection
// by ID in the UI so late database responses cannot change what the user is reading.
export function mergeRuns(current:Run[],restored:Run[],limit=50):Run[]{
  const byId=new Map<string,Run>();
  for(const run of [...current,...restored])if(!byId.has(run.id))byId.set(run.id,run);
  return [...byId.values()].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,limit);
}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {groupEvidenceSources} from '../lib/evidence-groups.ts';
import {groundAnalysis} from '../lib/analysis.ts';
import {copies,proposedAnalysis} from './source-overlap-fixture.mjs';
const cases=[1,2,5,10].map(pages=>{
 const sources=copies(pages),groups=groupEvidenceSources(sources);
 const result=groundAnalysis(proposedAnalysis(sources),sources,null,false);
 const status=result.core.claims[0].status;
 assert.equal(groups.length,pages===1?0:1);assert.equal(status,'reported');
 return {pages,identifiedOverlapGroups:groups.length,groupedPages:groups.flatMap(g=>g.sourceIds).length,independence:'unverified',proposedLabel:'corroborated',publishedLabel:status};
});
await mkdir('outputs',{recursive:true});
await writeFile('outputs/source-overlap-results.json',JSON.stringify({createdAt:new Date().toISOString(),design:'Synthetic counterfactual: hold all article text constant and add distinct republication URLs. Inject the same proposed corroborated label into the production validator. No model or retrieval requests.',limitation:'Tests a deterministic label guardrail, not model accuracy, complete provenance discovery or semantic entailment. All unverified corroborated labels are withheld, even for ungrouped sources. An overlap group is not a verified original reporting chain.',cases},null,2)+'\n');
console.table(cases);

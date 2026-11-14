import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupEvidenceSources} from '../lib/evidence-groups.ts';
import {groundAnalysis,modelSources} from '../lib/analysis.ts';
import {article,copies,proposedAnalysis} from '../evals/source-overlap-fixture.mjs';

test('adding two, five or ten identical republications produces one group',()=>{
 assert.deepEqual(groupEvidenceSources(copies(1)),[]);
 for(const count of [2,5,10]){
  const groups=groupEvidenceSources(copies(count));
  assert.equal(groups.length,1);assert.equal(groups[0].sourceIds.length,count);
  assert.deepEqual(groups[0].basis,['matching_text']);
  assert.ok(modelSources(copies(count)).every(r=>r.sourceGroupId==='G1'&&r.independence==='unverified'));
 }
});
test('a short added introduction does not disguise a near-copy',()=>{
 const rows=copies(2);rows[1].content='Local update. '+article;
 assert.deepEqual(groupEvidenceSources(rows)[0].basis,['overlapping_text']);
});
test('same domain, identical snippets, common links and short boilerplate do not establish an origin group',()=>{
 const rows=copies(2);
 rows[1].url='https://publisher-1.example/unrelated';rows[1].content='A separate account of a different incident.';
 assert.deepEqual(groupEvidenceSources(rows),[]);
 assert.deepEqual(groupEvidenceSources(copies(2).map(r=>({...r,content:'',summary:article}))),[]);
 rows[0].content='A report referring to https://original.example/news';
 rows[1].content='An unrelated analysis also linking https://original.example/news';
 assert.deepEqual(groupEvidenceSources(rows),[]);
 assert.deepEqual(groupEvidenceSources(copies(2).map(r=>({...r,content:'All rights reserved.'}))),[]);
});
test('explicit common attribution connects copies to the named original without requiring matching text',()=>{
 const rows=copies(3);
 rows[0].url='https://original.example/news';
 rows[1].content='Republished from: https://original.example/news?utm_source=syndication';
 rows[2].content='Original source: https://original.example/news#section';
 const groups=groupEvidenceSources(rows);
 assert.equal(groups.length,1);assert.deepEqual(groups[0].sourceIds,['L1','L2','L3']);
 assert.deepEqual(groups[0].originalUrls,['https://original.example/news']);
 assert.deepEqual(groups[0].basis,['shared_attribution']);
});
test('ambiguous attribution stays unknown and near-copy grouping retains conflicting text',()=>{
 const rows=copies(2);
 rows[0].content='Original source: https://a.example/news\nOriginal source: https://b.example/news';
 rows[1].content='Republished from https://a.example/news';
 assert.deepEqual(groupEvidenceSources(rows),[]);
 const altered=copies(2);altered[1].content=article.replace('2025','2024');
 const before=structuredClone(altered);groupEvidenceSources(altered);
 assert.deepEqual(altered,before);assert.ok(modelSources(altered)[1].text.includes('2024'));
});
test('one to ten copies cannot promote a claim into independent corroboration',()=>{
 for(const count of [1,2,5,10]){
  const rows=copies(count),out=groundAnalysis(proposedAnalysis(rows),rows,null,false);
  assert.equal(out.core.claims[0].status,'reported');
  assert.ok(out.warnings.some(w=>w.includes('independence is unverified')));
 }
});
test('ungrouped pages remain unverified; a real quotation can still fail semantic support',()=>{
 const rows=copies(2);rows[1].content='Another report confirms that a pilot was approved, but does not identify its primary source.';
 assert.deepEqual(groupEvidenceSources(rows),[]);
 assert.ok(modelSources(rows).every(r=>r.independence==='unverified'));
 // Document the current boundary: presence checks do NOT catch wrong-year claims.
 const raw=proposedAnalysis(copies(1));raw.claims[0].text=raw.claims[0].text.replace('2025','2024');
 const out=groundAnalysis(raw,copies(1),null,false);
 assert.equal(out.core.claims[0].text,raw.claims[0].text);
 assert.equal(out.core.claims[0].evidence.length,1);
});

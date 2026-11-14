import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidenceMetrics,reviewedFacts} from '../evals/metrics.mjs';
test('evaluation does not count invented sources, empty quotes or unseen truncated text as grounded',()=>{
 const rows=[{id:'L1',url:'https://www.nasa.gov/test',title:'Test',summary:'',content:'A documented fact appears here. '+'x'.repeat(8000)+'An unseen claim outside the window.'}];
 const answer={claims:[{text:'test',evidence:[{sourceId:'L1',quote:'A documented fact appears here.'},{sourceId:'L2',quote:'A documented fact appears here.'},{sourceId:'L1',quote:''},{sourceId:'L1',quote:'An unseen claim outside the window.'}]}]};
 const m=evidenceMetrics(answer,rows);assert.equal(m.matchedQuotes,1);assert.equal(m.citations,4);assert.equal(m.quoteMatchRate,.25);
 assert.equal(evidenceMetrics({claims:[]},rows).quoteMatchRate,null);
});
test('fact scores require explicit review decisions and explanatory evidence',()=>{
 const criteria=[{id:'a'},{id:'b'}];
 assert.equal(reviewedFacts(undefined,criteria),null);
 assert.equal(reviewedFacts({criteria:{a:{verdict:'pass',evidence:'claim 1'}}},criteria),null);
 assert.equal(reviewedFacts({criteria:{a:{verdict:'pass',evidence:'claim 1'},b:{verdict:'pass',evidence:''}}},criteria),null);
 assert.deepEqual(reviewedFacts({criteria:{a:{verdict:'pass',evidence:'claim 1'},b:{verdict:'unassessable',evidence:'source absent'}}},criteria),{passed:1,total:2,unassessable:1});
});

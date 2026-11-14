// Run explicitly with: node --env-file=.dev.vars scripts/check-neo4j.mjs
// Uses synthetic data in a unique namespace and cleans up only its own records.
import assert from 'node:assert/strict';
import {queryNeo4j,saveRun,loadRuns} from '../lib/neo4j.ts';
import {sampleRun} from '../tests/fixtures/history-run.mjs';
const env={...process.env,NEO4J_NAMESPACE:`evidence-lens-smoke-${crypto.randomUUID()}`};
try{
  const run=sampleRun(crypto.randomUUID());
  await saveRun(env,run);
  const next={...sampleRun(crypto.randomUUID()),timestamp:'2026-11-14T21:00:00.000Z'};
  next.analysis.revision.previousRunId=run.id;
  await saveRun(env,next);
  const restored=await loadRuns(env);
  assert.equal(restored.runs.length,2);assert.deepEqual(restored.runs[1],run);
  const edges=await queryNeo4j(env,`MATCH (r:EvidenceLensRun {namespace:$scope})-[:HAS_EVENT]->(e)-[link:RESPONDS_TO]->()
    RETURN count(link),collect(link.basis)`,{scope:env.NEO4J_NAMESPACE},true);
  assert.equal(edges[0][0],2);assert.deepEqual(edges[0][1],['inferred','inferred']);
  const citations=await queryNeo4j(env,`MATCH (r:EvidenceLensRun {namespace:$scope})-[:HAS_CLAIM]->()-[c:CITES]->(s)
    RETURN count(c),collect(c.quote=s.content)`,{scope:env.NEO4J_NAMESPACE},true);
  assert.equal(citations[0][0],2);assert.deepEqual(citations[0][1],[true,true]);
  const revisions=await queryNeo4j(env,'MATCH (r:EvidenceLensRun {namespace:$scope})-[:PREVIOUS_RUN]->() RETURN count(r)',{scope:env.NEO4J_NAMESPACE},true);
  assert.equal(revisions[0][0],1);
  // A duplicate run ID must fail atomically, leaving the existing graph intact.
  await assert.rejects(saveRun(env,run));
  assert.equal((await loadRuns(env)).runs.length,2);
  console.log('PASS: Aura save, restore, typed edges, exact quotations, revisions and duplicate protection.');
}catch{
  console.error('Neo4j integration check failed. No credentials or provider payloads were logged.');
  process.exitCode=1;
}finally{
  try{
    await queryNeo4j(env,'MATCH (n:EvidenceLensEntity) WHERE n.key STARTS WITH $prefix DETACH DELETE n',{prefix:JSON.stringify([env.NEO4J_NAMESPACE]).slice(0,-1)+','});
    console.log('Synthetic test records cleaned up.');
  }catch{console.error('Synthetic cleanup could not complete; namespace: '+env.NEO4J_NAMESPACE);process.exitCode=1;}
}

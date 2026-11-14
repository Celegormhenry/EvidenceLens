export function sampleRun(id='fixture-run'){
  const quote='The public meeting will take place on Monday.';
  return {id,timestamp:'2026-11-14T20:00:00.000Z',topic:'Synthetic persistence check',queries:['fixture'],warnings:[],fingerprint:'a'.repeat(64),
    budget:{queryProviderPairs:2,fetchUrls:1,modelCalls:0},
    results:[{id:'L1',url:'https://example.com/fixture',title:'Synthetic fixture',summary:quote,content:quote,domain:'example.com',queryLanes:[0]}],
    analysis:{model:'test-fixture',timestamp:'2026-11-14T20:00:00.000Z',inputTokens:0,outputTokens:0,groundingWarnings:[],summary:'Synthetic data, not a real event.',
      claims:[{id:'C1',text:'A meeting was announced.',status:'reported',evidence:[{sourceId:'L1',quote,relation:'supports'}]}],
      events:[{id:'E1',title:'Announcement',description:'Synthetic event',date:null,actors:[],status:'reported',claimIds:['C1'],forecastId:null},
        {id:'E2',title:'Response',description:'Synthetic response',date:null,actors:[],status:'disputed',claimIds:['C1'],forecastId:'F1'}],
      eventRelations:[{id:'R1',from:'E2',to:'E1',type:'responds_to',basis:'inferred',explanation:'Synthetic relation',evidence:[{sourceId:'L1',quote,relation:'context'}]}],
      forecasts:[{id:'F1',question:'Will a meeting occur?',deadline:'2030-01-01T00:00:00Z',resolution:'Synthetic fixture only',probability:null,rationale:'Test only',sourceIds:['L1'],changeTrigger:'Test'}],
      assessments:[],relationships:[],conflicts:[],impacts:[],nextSearches:[],limits:['Test data'],revision:{previousRunId:null,unchangedEvidence:false,changes:[]}}
  };
}

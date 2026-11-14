export type Evidence = {
  id: string; title: string; publisher: string; date: string; group: string;
  kind: 'supports' | 'clarifies' | 'duplicate'; summary: string; scope: string;
  limitation: string; url?: string; stage: number; ratings: string[];
};
export const evidence: Evidence[] = [
  { id:'E01',title:'Singapore challenges the reported attribution',publisher:'Singapore · MHA',date:'Oct 31, 2026',group:'Singapore MHA',kind:'clarifies',stage:0,
    summary:'MHA disputed an attribution to Singapore officials concerning an intelligence-related investigation into Alice Huang.',
    scope:'What Singapore says about its own investigation.',
    limitation:'A jurisdiction-specific statement cannot settle every allegation elsewhere.',
    url:'https://www.mha.gov.sg/media-room/newsroom/clarification-statement-on-wall-street-journals-article/',ratings:['High','High','Unknown','Medium','High','Unknown']},
  { id:'E02',title:'NVIDIA’s board announces an independent inquiry',publisher:'NVIDIA · Investor Relations',date:'Nov 8, 2026',group:'NVIDIA',kind:'supports',stage:0,
    summary:'Independent directors and outside counsel will oversee a review following reports of a foreign intelligence effort targeting Jensen Huang.',
    scope:'The board announced a review. It said it had no reason to believe secrets had been compromised.',
    limitation:'An inquiry does not prove the allegation; the board’s stated position is not independent exoneration.',
    url:'https://investor.nvidia.com/news/press-release-details/2026/Statement-from-NVIDIA-Board-of-Directors/default.aspx',ratings:['High','High','Unknown','High','High','Unknown']},
  { id:'E03',title:'A repeat of the same board statement arrives',publisher:'Synthetic duplicate · stress test',date:'Replay injection',group:'NVIDIA',kind:'duplicate',stage:1,
    summary:'This deliberately simulated item repeats E02. It introduces no additional reporting or new source.',
    scope:'Tests whether repeated coverage is mistakenly counted as independent evidence.',
    limitation:'Not a real news article. Forecast values must remain unchanged in this test.',ratings:['N/A','N/A','Low','Low','N/A','Low']},
  { id:'E04',title:'Commercial investigation ≠ espionage investigation',publisher:'Singapore · MHA',date:'Nov 12, 2026',group:'Singapore MHA',kind:'clarifies',stage:2,
    summary:'MHA described suspected false declarations involving server purchases and explicitly said Alice Huang was not investigated for espionage.',
    scope:'Clarifies the nature of Singapore’s investigation into Alice Huang and Megaspeed.',
    limitation:'This addresses Singapore’s investigation, not the outcome of NVIDIA’s separate review. E01 and E04 share an institutional origin.',
    url:'https://www.mha.gov.sg/media-room/newsroom/singapore-investigations-into-alice-huang-huang-le-and-megaspeed-international-pte-ltd/',ratings:['High','High','Unknown','High','High','Unknown']}
];
export const dimensions=['Provenance','Directness','Independence','New information','Time match','Corroboration'];
export const snapshots = [
 {label:'Initial sources',short:'Establish the claims',values:[62,35,28],heading:'Two official sources. Different questions.',body:'An inquiry and a jurisdiction-specific clarification can coexist. Keep their claims separate before making an inference.',change:'Baseline constructed for this demonstration. These are not historical forecasts.',sourceIds:['E01','E02']},
 {label:'Duplicate coverage',short:'Resist the echo',values:[62,35,28],heading:'More coverage. No new independent evidence.',body:'The injected item points back to the same NVIDIA statement. The source group stays the same, so the illustrative estimates do not move.',change:'Duplicate stress test: three items, two source groups. All probabilities unchanged.',sourceIds:['E03','E02']},
 {label:'Scope clarification',short:'Revise with a reason',values:[62,48,28],heading:'One new document changes the question.',body:'The later MHA statement adds detail about a commercial investigation. It challenges a conflation of investigation types; it does not resolve NVIDIA’s inquiry.',change:'Illustrative revision: another Singapore clarification, 35% → 48%. The numerical change is scripted to demonstrate traceability, not inferred from the source.',sourceIds:['E04','E01']}
];
export const forecasts=[
 {id:'F01',label:'A further board update',question:'Will NVIDIA publish another board update about its review?',category:'Next event',resolution:'YES if a new NVIDIA board statement explicitly updating this review is published by the deadline; otherwise NO. Resolve from NVIDIA Investor Relations.',driver:'A review has been announced; its reporting timetable remains unspecified.',evidenceId:'E02'},
 {id:'F02',label:'Another scope clarification',question:'Will Singapore issue another clarification about the investigation?',category:'Next event',resolution:'YES if MHA or SPF publishes a new substantive clarification about the investigation by the deadline; otherwise NO.',driver:'Separating commercial and espionage claims creates a concrete follow-up question.',evidenceId:'E04'},
 {id:'F03',label:'A public partner response',question:'Will a named major NVIDIA partner publicly address business continuity in relation to this inquiry?',category:'Wider impact',resolution:'YES only for a dated statement from Microsoft, Amazon, Google or Meta explicitly discussing continuity in relation to this inquiry by the deadline. Otherwise NO.',driver:'A potential downstream response, conditional on partner concern. No such response is established by this evidence set.',evidenceId:'E02'}
];
export const cutoff='November 12, 2026';
export const queryDefault='Jensen Huang NVIDIA board inquiry Singapore MHA Megaspeed';

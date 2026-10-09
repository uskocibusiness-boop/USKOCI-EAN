import json,pathlib,re,subprocess,datetime,hashlib
root=pathlib.Path('C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006');out=pathlib.Path(__file__).parent
read=lambda p:json.loads((root/p).read_text(encoding='utf-8-sig'))
reg=read('docs/control/redovi.json');state=read('docs/control/stanje.json');snap=read('docs/control/dev_snapshot.json');inv=json.loads((out/'source-inventory.json').read_text(encoding='utf-8'));graph=json.loads((out/'import-graph.json').read_text(encoding='utf-8'))
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();assert head=='6311804dbac2323069e927f9a8dc49f8f0bb1f14'
byid={r['id']:r for r in state['redovi']};files={f['file']:f for f in inv['files']};sources={f:(root/f).read_text(encoding='utf-8') for f in files};known=set(snap.get('rpc_all',[]));edges={e['slug'] for e in snap.get('edge',[])}
changes=subprocess.check_output(['git','diff','--name-only','ce23eb06befd0260b71e0c334e5557da5df7639d',head],cwd=root,text=True).splitlines();assert all(p.startswith('docs/') for p in changes)
base='docs/implementation/ui-ux-pass-20261002/'
keymap={'A02':['intake_completion_20261009','review_map_finish_20261009'],'A04':['location_native_findings_20261009','map_location_recovery_20261009'],'A06':['intake_completion_20261009'],'A07':['intake_completion_20261009'],'B00':['worker_ai_native_f64b6bb4_20261009'],'B01':['worker_ai_native_f64b6bb4_20261009'],'B04':['discovery_place_total_20261009','discovery_window_local_20261009'],'B05':['discovery_plan_cache_local_mitigation_20261009','discovery_area_key_local_20261009'],'B09':['application_people_20261009'],'B11':['application_people_20261009'],'D03':['voice_b0','voice_b1_b2','conversation_channels_ai_finish_20261009','chat_pending_identity_20261009','push_phone_real_message_20261009'],'D05':['conversation_channels_ai_finish_20261009','connected_lifecycle_20261009','group_reading_20261009'],'P01':['push_event_inventory_20261009'],'P03':['push_phone_real_message_20261009'],'P04':['push_phone_real_message_20261009','push_opportunity_local_20261009','push_opportunity_certificate_local_20261009'],'A12':['connected_lifecycle_20261009'],'A15':['connected_lifecycle_20261009'],'D07':['connected_lifecycle_20261009']}
notes={
'A02':'Task AI stvaranje postoji; v59 prirodno pojasnjenje ->review->objava dokazano na starijem native source. Snapshot Edge60; finish-only i kompletan edit nisu dokazani ovim stvaranjem.',
'A03':'AI diktiranje nije glasovna poruka niti govoreni AI odgovor; poseban native snimanje/transkript dokaz potreban.',
'A04':'Search/proposal/pin/confirm postoje; tek zasebna potvrda prihvata tacku. Ispravke brzog unosa/ambiguous izbora postoje, kompletna ruta sa svim tackama nije zatvorena.',
'A05':'RC02 DEV APPLIED02.10; datum/receipt ostaju. Ne pretvarati staru reprodukciju u novi concurrency PASS; upload/open/retry/remove native pending.',
'A06':'Review je odvojena potvrda autoritativnih fact/location podataka; nije automatska objava.',
'A07':'rpc_accept_ai_task_review pravi DRAFT; evaluator/publish zasebni. Istorijski stvarni PUBLISHED dokaz nije svaki novi AI razgovor/edit.',
'A13':'AI edit published task postoji kroz rpc_ai_open_need_edit_conversation_v2 + rpc_confirm_need_edit_from_review_v2; create proof nije edit proof. Current native edit pending.',
'A14':'Otkaz published task i brisanje DRAFT su odvojeni revision-bound RPC-ovi sa receipt/recovery; ne znaci fizicko brisanje svih povezanih podataka.',
'A15':'Zatvaranje potrage ne otkazuje sve bilateralne saradnje; izolovani connected RPC proof obuhvata close/reopen/zamenu, ne aktuelni native tok.',
'A16':'HITNO odlozen iz V1 najnovijom odlukom; source/config gate postoji. Ordinary zadatak odmah nije HITNO transport.',
'B00':'Worker AI create/review/save ACTIVE/COMPLETED dokazan emulatorf64 i DEVreadback. Aktivni profil edit, sve general-helper preference i realno novo-task matching/push nisu time zatvoreni.',
'B01':'Licni profil/kapacitet save i activation implementirani; AI promena vec ACTIVE profila odvojena je od create/save testa.',
'B04':'Discovery server reader primenjen sa granicama; lokalni plan/cache/area/window kandidati i synthetic row corpus nisu primena ni hiljade simultanih korisnika.',
'B05':'Legacy NOVO udaljenost i sortiranje izaziva crveno u generatoru; postojeci filters/PLACES/PAGE source i raniji native dokaz postoje. Specifikovati nepokriven dodatak umesto tvrdnje nema filters backend.',
'B09':'Proporcionalni TOTAL/people rounding DEV applied ledger237; JS/SQL provere postoje; ce23 inertni native plus/minus/directinput/review PASS. Nema aktuelnog live send->selection->Agreement dokaza.',
'B11':'ce23 inertni stale edit/people max/roundedprice PASS, ne stvarno slanje izmenjene prijave niti povlacenje na DEV.',
'D01':'Task-centered grouping je prikaz vise bilateralnih ugovora; ne spaja njihove cene/status/komande.',
'D02':'Autoritativni per-person uslovi i individualne naredne radnje; grupni roster ne cini sve individualne iznose javnim.',
'D03':'Private text/history/outbox postoje. Voice B1 DEVapplied, B2 recorder/player/UI enabled inDEV; actual current record/send/play pending. Jedan privatni text push/tap ownerconfirmed oldbuild.',
'D04':'Priprema/prenos medija nisu poruka dok send nije potvrden; current native upload/open/retry/delete nije potvrden.',
'D05':'Grupa je text-only; requester->svaki participant privatno, participant->requester samo. Izolovani4Auth cutoff/zamena proof stvaran; native gr-thread samo inertan latestbody. Nedostaje grupni emit_event/push.',
'D06':'Bilateralni predlog/prihvati/odbij/povuci postoji; pendingamount nije vazeciiznos; svi lifecycle native scenariji nisu potvrdeni.',
'D07':'Otkaz pojedinacne saradnje postoji; isolated realRPC groupcutoff nakon cancel dokaz, ne currentPHONE cancel.',
'D13':'NextStepCard/state-derived koraci postoje bez zasebnog RPC; prazno server polje nije nedostajuca funkcija. Ne dodavati izmisljeni dolazak/kretanje.',
'P01':'In-app notification red/ack odvojeni od provider ticket i systemtap; registry test zelena ne dokazuje sve vrste emitera.',
'P03':'Postojeci boundowner device dokazan starijim push preflightom; ne sveplatforme/noviAPK/refresh token matrix.',
'P04':'MESSAGE bounded SQL/Edge APPLIED; jedna prirodna text poruka provideraccepted+ownertap. OPPORTUNITY extension LOCALPROOF+LOCALCERT only, NIJE DEVapplied/provider/phone. Global/targetflagsOFF u poslednjem boundedproof stanju; 19emittertypes/5bezemitera; grupnimessageemitter absent.',
'P05':'Podsetnici namerno odlozeni; nema dokazano ukljucenog V1 reminder toka.',
'N09':'Stvarni export ugovori/worker postoje; downloadstarted nije dokaz korisnickog sacuvanogfajla; end-to-end currentdevice potrebno.',
'N10':'Closureprepare/review/start/read/worker postoje; isolated erasure proof nije brisanje ownernaloga na telefonu. Cross-deviceexecutiondiscovery ogranicenje zapisano; ne ponavljati destruktivnu probu bez posebnogscope.',
'N11':'Privatnost/retention servercert i UI postoje; legaloperator/processor texts i currentrelease acceptance odvojeno.',
'S03':'Deljeni bounded receipt/uncertain status/timer lifecycle SOURCE; svezi80tests samo3izabrana seam-a, ne univerzalno offline/doubletap prihvatanje.',
'S04':'RETIRE/legacy inventory je cleanup paket sa compatibility/cert/rollback granicama; broj nepozvanih RPC nije lista bezbednogbrisanja.'}

def refs(v):
 vals=[]
 if isinstance(v,dict):
  for x in v.values():vals+=refs(x)
 elif isinstance(v,list):
  for x in v:vals+=refs(x)
 elif isinstance(v,str):vals+=re.findall(r'(?:docs|supabase|src)/[^\s;,)\]"<>]+',v)
 return sorted(set(vals))
rows=[]
for i,r in enumerate(reg['redovi']):
 s=byid[r['id']];id=r['id'];serviceFiles=[]
 for service in r.get('servisi',[]):
  serviceFiles += [f for f in files if pathlib.PurePosixPath(f).stem==service]
 serviceFiles=sorted(set(serviceFiles));surface=[]
 for f in serviceFiles:
  matches=[]
  for n,line in enumerate(sources[f].splitlines(),1):
   if re.search(r"(?:rpc|call|recoveryCall)\s*\(\s*['\"](?:rpc_|fn_)|rpc:\s*['\"](?:rpc_|fn_)",line):matches.append({'line':n,'symbols':re.findall(r"['\"]((?:rpc_|fn_)[A-Za-z0-9_]+)['\"]",line)})
  surface.append({'file':f,'sha256':files[f]['sha256'],'rpcCallLocations':matches})
 related={k:reg['finalization'][k] for k in keymap.get(id,[]) if k in reg['finalization']};fin=(r.get('finalization') or {});dep=r.get('server',[]);catalog=[{'symbol':x,'presence':'DECLARED_GAP_PLACEHOLDER' if x.startswith('NOVO:') else 'PRESENT_IN_SNAPSHOT' if x in known or x in edges else 'NOT_FOUND_IN_SNAPSHOT_NAME_LIST'} for x in dep]
 implemented='SOURCE_SURFACE_PRESENT' if serviceFiles else 'REQUIRES_ROW_SPECIFIC_INTERPRETATION'
 connected='STATIC_SERVICE_REACHABLE' if serviceFiles and all(f not in {x['file'] for x in inv['nonRouteReachable']} for f in serviceFiles) else 'NOT_INFERRED_FROM_ROUTE_OR_LIGHT'
 if id=='D13':implemented='STATE_DERIVED_UI_PRESENT';connected='SHARED_AGREEMENT_PROJECTION'
 if id=='P04':implemented='APPLIED_SERVER_TRANSPORT_PLUS_SOURCE_EXTENSION';connected='BOUNDED_MESSAGE_PATH_ONLY'
 if id in ['A16','P05']:implemented='OUT_OF_V1_GATED_OR_DEFERRED';connected='NOT_ENABLED_FOR_V1'
 if id=='S04':implemented='CLEANUP_PACKAGE_NOT_PRODUCT_SCREEN';connected='NOT_APPLICABLE'
 native={'status':'NOT_PROVEN_ON_CURRENT_SOURCE','evidence':[],'limit':'Older native receipts retained below; no current behavior inferred from source.'}
 if id in ['B09','B11']:native={'status':'SOURCE_EQUIVALENT_CE23_INERT_NATIVE_PARTIAL_PASS','evidence':[base+'evidence/application-people-20261009/native-ce23-receipt.json'],'limit':'Only fixture controls/rounded amounts/review/Back/largefont. HEAD631 differs fromce23 onlydocs; no live command.'}
 tested={'status':'RECORDED_HISTORICAL_OR_BOUNDED_TEST_EVIDENCE_NOT_FRESH_FULL_PASS','registrySource':f'$.redovi[{i}].finalization.test','declaredScope':fin.get('test'), 'generatorPresenceNote':s.get('note',{}).get('test'), 'relatedEvidence':refs(related)}
 if id in ['A16','P05','S04']:tested['status']='DEFERRED_OR_PACKAGE_SPECIFIC_NOT_FULL_FEATURE_PASS'
 if id=='S03':tested['freshBoundedRun']={'artifact':'bounded-tests.json','head':head,'tests':80,'scope':'focused-resource20/activity-message-target41/group-reading19; not entire S03'}
 row={'id':id,'title':r['naslov'],'group':r['grupa'],'registryPointer':f'$.redovi[{i}]','implemented':{'status':implemented,'source':surface,'registryDeclaration':fin.get('status')},'connected':{'status':connected,'routes':r.get('ekrani',[]),'dependencyCatalogSnapshot':catalog,'limit':'Source graph + saved catalog membership only; not live execution/authorization.'},'tested':tested,'currentNative':native,'phone':{'status':'HISTORICAL_OR_OWNER_REPORT_ONLY_CURRENT_ACCEPTANCE_NOT_PROVEN','declaredHistoricalState':(r.get('telefon') or {}).get('stanje'),'historicalScope':(r.get('telefon') or {}).get('dokaz'),'extraScope':fin.get('device_proof'),'limit':'No current phone upgrade from source, installedAPK or old light.'},'productionReady':{'status':'NOT_PROVEN','reason':'Current finalAPK fullflow/store/production deployment gate not closed; sharedDEV presence is not separatePROD readiness.'},'interpretation':notes.get(id,'Source/service exists; exact historical test/device scope retained. No wholefeature/currentPHONE/PROD PASS inferred.'),'currentProblem':r.get('problem'),'nextCriterion':r.get('sledece'),'evidencePaths':sorted(set(refs(fin)+refs(related)+refs((r.get('telefon') or {})))),'currentRelatedRegistryEntries':related,'rawProjectionLights':s['lights']}
 rows.append(row)
assert len(rows)==62 and len({r['id'] for r in rows})==62
report={'head':head,'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'62 canonical existing row IDs; per-service current tracked source locations+saved catalog+registry evidence. No new live calls. Generator green test means references/presence, not executedPASS; current native limited to evidence scope. ce23â†’631 diff docs-only verified. No blanket source-completeness assertion.','projectionMetadata':state['meta'],'sourceEquivalentNative':{'source':'ce23eb06befd0260b71e0c334e5557da5df7639d','target':head,'diffFiles':changes,'scope':'B09/B11 inert controls only; not full62rows'},'rows':rows}
(out/'backend-capabilities.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
md=['# Backend capabilities â€”62 canonical rows','',f'HEAD `{head}`. Read-only source/registry inspection; no live call.','', '## How to read','', '- SOURCE means relevant module/handler exists; CONNECTED means static route/service reach and saved contract wiring. Neither implies successful runtime command.','- TEST means recorded proof with its exact scope, not merely green generated light. Fresh review run is80cases/3seams only.','- CURRENT NATIVE: ce23 and thisHEAD differ onlydocs; B09/B11 inert controls proof can be associated explicitly. OtheroldAPK receipts stay OLD.','- PHONE: historical or owner-reported scope only. Delivered APK or green oldrow is not current phone acceptance.','- PRODUCTION READY: not demonstrated for any complete row on thiscurrent release candidate; this does not mean implementation is absent.','- Projection captured09Oct16:00:51 atce23, catalog15:35:15 ledger237; no newserverread here.','', '## Row matrix','', '|ID|Capability|Implemented|Connected|Tests|Current native|Phone|Production|','|---|---|---|---|---|---|---|---|']
for r in rows:
 native='PARTIAL: ce23 inert' if r['id'] in ['B09','B11'] else 'Not proved'
 md.append('|'+ '|'.join([r['id'],r['title'],r['implemented']['status'],r['connected']['status'],'Recorded scope / JSON',native,('OLD / scoped' if r['phone']['declaredHistoricalState'] in ['DOKAZANO','DELIMIČNO'] else 'Not recorded / not proved'),'Not proved'])+'|')
md+=['','## Important interpretation corrections','']
for id in ['A02','A04','A06','A07','A13','A14','A15','B00','B01','B05','B09','B11','D01','D03','D05','D06','D07','D13','P04','P05','N09','N10','S04']:md+=['- **'+id+'**: '+notes[id]]
md+=['','## Evidence and closure criteria','', 'The JSON carries every row\'s exact current service paths/hashes/RPC lines, raw projection lights, catalog presence, historical test/device text and linked receipts. Long prior next-step narratives are retained as source data, not endorsed as current orders. Newer owner/evidence overrides govern.','', '1. AI task creation: actual natural text/location/review/publish exists on earlierbuild; prove current finish-only, draftresume and editpublished separately. Workercreate ACTIVE proof does notclose active-profile AIedit.','2. Pricing: ledger237 applied;341focused+SQLvector proofs and ce23 inertnative exist. Actual1+2applicantsâ†’selectionâ†’separateAgreements amounts remains livejourney criterion.','3. Cancel/delete: preserve draftdelete vs publishedcancel vs singleAgreementcancel vs accountclosure. Each needs its own receipt/idempotency/recovery; a disappearedUIrow is notphysicalpurge.','4. Push: MESSAGE applied/provider+ownerphoneproof exists. OPPORTUNITY candidate/localcert proof is notDEVapplied. Natural eligible activeprofile/event/device/session required for onebounded realdelivery; globalflags remainoffuntilreviewedactivation. Groupmessageemitter absent.','5. Auth/export/accountclosure: catalogsource and isolatedproofs kept separate fromcurrent two-device recovery, storeprivacy/operator readiness andphysicalerasure.','', 'No tests/server/device actions were run for this62row addition. No canonical master/registry changed.']
md+=['','## Tačan postojeći obim dokaza po redu','']
for r in rows:
 md += ['### '+r['id']+' — '+r['title'],'',r['interpretation'],'','- Izvor: '+', '.join('`'+x['file']+'`' for x in r['implemented']['source']) if r['implemented']['source'] else '- Izvor: poseban sistemski slučaj naveden u JSON-u.','- Testovi — zapisani obim, nisu ponovo izvršeni: '+str(r['tested']['declaredScope'] or 'Nema posebnog teksta testa u redu.'),'- Telefon — OLD, nije dokaz trenutnog APK-a: '+str(r['phone']['historicalScope'] or 'Nema zasebnog dokaza telefona u ovom redu.'),'']
(out/'backend-capabilities.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print('Wrote62rows',len(rows));print('SnapshotRPC',len(known),'edges',len(edges),'ce23diffdocs',len(changes))

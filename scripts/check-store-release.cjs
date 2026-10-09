'use strict';
// Offline, read-only USKOCI store preflight. Never modifies code, credentials, users or databases.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const checks=[];
const add=(id,status,reason)=>checks.push({id,status,reason});
let app,eas,config,guard;
try{app=read('app.json').expo;eas=read('eas.json');config=fs.readFileSync(path.join(root,'app.config.js'),'utf8');guard=fs.readFileSync(path.join(root,'scripts/check-eas-preview.cjs'),'utf8');}
catch{console.error(JSON.stringify({verdict:'NO_GO_PUBLIC_RELEASE',error:'RELEASE_SOURCE_UNREADABLE'}));process.exit(2);}
const prod=eas.build?.production??{}, prev=eas.build?.preview??{};
const penv=prod.env??{},venv=prev.env??{};
add('store-android-id',config.includes("const STORE_PACKAGE = 'rs.uskoci'")?'CONFIG_PASS':'BLOCKED','Verify rs.uskoci package in signed AAB.');
add('store-aab-profile',prod.distribution==='store'&&prod.android?.buildType==='app-bundle'?'CONFIG_PASS':'BLOCKED','Verify signed EAS app-bundle with SHA256.');
add('store-ota',prod.channel==='production'&&penv.USKOCI_OTA_TARGET==='production'?'CONFIG_PASS':'BLOCKED','Production runtime/channel must match binary.');
add('backend-prod-isolation',penv.EXPO_PUBLIC_SUPABASE_URL&&penv.EXPO_PUBLIC_SUPABASE_URL!==venv.EXPO_PUBLIC_SUPABASE_URL?'NOT_VERIFIED':'BLOCKED','Production currently uses same DEV Supabase URL as preview.');
add('icon-source',app.icon&&fs.existsSync(path.join(root,app.icon))?'CONFIG_PASS':'BLOCKED','Review real icon and 512 PNG.');
add('ios-identity',app.ios?.bundleIdentifier?'CONFIG_PASS':'BLOCKED','Permanent iOS Bundle ID is not configured.');
add('ios-preflight',guard.includes("env.EAS_BUILD_PLATFORM === 'android'")?'BLOCKED':'NOT_VERIFIED','EAS build guard currently admits Android only.');
add('production-firebase',config.includes('delete android.googleServicesFile')?'BLOCKED':'NOT_VERIFIED','Production Firebase Android rs.uskoci client is not confirmed.');
for(const [id,reason] of [
['android-artifact','No source-bound signed AAB SHA, signing certificate, targetSdk36 and versionCode in this audit.'],
['native-16kb','Native library page alignment and 16 KB device test required.'],
['legal-urls','Real operator and public Privacy/Terms/Support/Deletion URLs not approved/proved.'],
['closure-e2e','Canonical Auth+Storage+ordinary erasure with disposable account not proven.'],
['ugc-ai-consent','First-use UGC acceptance/age, AI consent and AI offensive content report not proven.'],
['data-forms','Apple App Privacy / Google Play Data Safety not signed off.'],
['review-access','Two reviewer accounts and required closed test/Production Access not confirmed.'],
['device-qa','Final signed store binary physical tests, push/monitoring/OTA rollback not done.'],
['ios-archive','No iOS signed IPA/TestFlight/privacy manifest proof.']
]) add(id,'NOT_VERIFIED',reason);
const blocked=checks.filter(c=>c.status==='BLOCKED').map(c=>c.id);
const unresolved=checks.filter(c=>c.status==='NOT_VERIFIED').map(c=>c.id);
// No green light without artifact and legal evidence. A configuration-only probe cannot grant production release.
const passing=blocked.length===0&&unresolved.length===0&&checks.every(c=>c.status==='VERIFIED');
console.log(JSON.stringify({verdict:passing?'READY_FOR_RELEASE_REVIEW':'NO_GO_PUBLIC_RELEASE',source:'2026-10-09 static store gate',checks,blocked,unresolved},null,2));
process.exitCode=passing?0:2;

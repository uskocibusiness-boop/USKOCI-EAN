'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/ui/notifications/PushRuntime.tsx'),'utf8');
const start=source.indexOf('  function reconcile() {'),end=source.indexOf('  const responseListener',start);
assert.ok(start>=0&&end>start);
const body=source.slice(start,end);
// Executes the exact runtime reconciliation body with mocked native/owned RPCs; not native E2E.
async function exercise(source, opts={}) {
 let alive=true,pending=false,generation=0,activeTimer,accountId='qa-user',accountRevision=1,sessionEpoch=1;
 let calls=[],reads=0,settled,finish;
 const scope={accountId,accountRevision},owned=()=>alive,visible=()=>alive&&opts.foreground!==false;
 const blocked={current:new Set()},remember=(set,key)=>set.add(key);
 const setTimeout=()=>1,clearTimeout=()=>{};
 const response=x=>({ok:true,podatak:x});
 const nativePushDevice=async()=>({kind:opts.permission??'READY',token:'ExpoPushToken[test]',platform:'ANDROID'});
 const notificationPreferencesClientService={read:async()=>({settings:{push_enabled:opts.enabled!==false}})};
 const revokePushBeforeLogout=async()=>calls.push('revoke');
 const pushDeviceClientService={
  sessionDevice:async()=>{reads++;return response(reads===1?(opts.session??{kind:'NONE'}):(opts.secondSession??{kind:'NONE'}))},
  read:async()=>{if(opts.switchDuringRead)alive=false;return response({sessionBound:false,revision:opts.revision??0})},
  set:async(_scope,_token,_platform,_active,rev)=>{calls.push('set:'+rev);return opts.failWrite?{ok:false}:response({active:true})},
  rotate:async()=>{calls.push('rotate');return response({active:true})}
 };
 const reconcile=new Function('scope','owned','visible','nativePushDevice','notificationPreferencesClientService','pushDeviceClientService','revokePushBeforeLogout','blocked','remember','accountId','accountRevision','sessionEpoch','setTimeout','clearTimeout', 'let pending=false,generation=0,activeTimer;'+source+';return reconcile;')(scope,owned,visible,nativePushDevice,notificationPreferencesClientService,pushDeviceClientService,revokePushBeforeLogout,blocked,remember,accountId,accountRevision,sessionEpoch,setTimeout,clearTimeout);
 reconcile();for(let i=0;i<25;i++)await Promise.resolve();
 if(opts.twice){reconcile();for(let i=0;i<25;i++)await Promise.resolve();}
 return calls;
}
const cases=[
  [
    "new device",
    {
      "revision": 0
    },
    [
      "set:0"
    ]
  ],
  [
    "inactive old device",
    {
      "revision": 2
    },
    [
      "set:2"
    ]
  ],
  [
    "opted out",
    {
      "enabled": false
    },
    []
  ],
  [
    "permission required",
    {
      "permission": "PERMISSION_REQUIRED"
    },
    []
  ],
  [
    "denied",
    {
      "permission": "DENIED"
    },
    []
  ],
  [
    "background",
    {
      "foreground": false
    },
    []
  ],
  [
    "session ambiguous",
    {
      "session": {
        "kind": "AMBIGUOUS"
      }
    },
    []
  ],
  [
    "account switch during read",
    {
      "switchDuringRead": true
    },
    []
  ],
  [
    "concurrent settings registration",
    {
      "secondSession": {
        "kind": "DEVICE"
      }
    },
    []
  ],
  [
    "existing device same token",
    {
      "session": {
        "kind": "DEVICE",
        "token": "ExpoPushToken[test]",
        "platform": "ANDROID",
        "id": "a",
        "revision": 1
      }
    },
    []
  ],
  [
    "existing device rotation",
    {
      "session": {
        "kind": "DEVICE",
        "token": "ExpoPushToken[old]",
        "platform": "ANDROID",
        "id": "a",
        "revision": 1
      }
    },
    [
      "rotate"
    ]
  ],
  [
    "existing device permission denied",
    {
      "session": {
        "kind": "DEVICE",
        "token": "ExpoPushToken[test]",
        "platform": "ANDROID",
        "id": "a",
        "revision": 1
      },
      "permission": "DENIED"
    },
    [
      "revoke"
    ]
  ]
];
for(const [name,opts,wanted] of cases)test(name,async()=>assert.deepEqual(await exercise(body,opts),wanted));

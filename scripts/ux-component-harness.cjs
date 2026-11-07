'use strict';
// Actual React/production TS at inert native UI boundaries. Not Android or pixel E2E.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const RTR = require('react-test-renderer');
const ROOT = path.resolve(__dirname, '..');
global.IS_REACT_ACT_ENVIRONMENT = true;
function deferred() { let resolve; let reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
function createHarness(extra = {}, timerModules = {}) {
  const hosts = new Map();
  const host = name => {
    if (!hosts.has(name)) {
      const C = p => React.createElement(name, p, p.header, p.right, p.leading, p.icon, p.children, p.footer);
      C.displayName = name; hosts.set(name, C);
    }
    return hosts.get(name);
  };
  const ui = names => Object.fromEntries(names.map(name => [name, host(name)]));
  const native = { View:'View', Text:'Text', ScrollView:'ScrollView', TextInput:'TextInput', RefreshControl:'RefreshControl', ActivityIndicator:'ActivityIndicator',
    StyleSheet:{create:x=>x,hairlineWidth:1}, Platform:{OS:'android',select:x=>x.android??x.default} };
  const stubs = {
    'react-native': native,
    'src/ui/system/Appear.tsx': { Appear:host('Appear'), useAppear:()=>({settle:()=>{},isNew:()=>false}) },
    'src/ui/system/textScale.ts': { useLayoutClass:()=>({stacked:false,wide:true}) },
    'src/ui/system/usePullRefresh.ts': { usePullRefresh:(fn,refreshing)=>({onRefresh:fn,refreshing}) },
    'src/ui/system/tokens.ts': { sys:{color:{},space:{},radius:{},motion:{scale:{row:1,button:1}},type:{heading:{lineHeight:24}},touch:{min:48}},brandAction:{},profileLift:{} },
    'src/ui/system/layout.ts': { layout:{group:16,rowMin:48,gutter:20,touch:48},ruleWidth:1 },
    ...Object.fromEntries(['Avatar','FactArt','ScreenHeader','ListRow','Screen','Section','Surface','Glyph','ChromeIconButton'].map(n=>['src/ui/system/'+n+'.tsx',ui([n])])),
    'src/ui/Press.tsx':ui(['Press']), 'src/ui/Text.tsx':ui(['T']), 'src/ui/v2/V2Action.tsx':ui(['V2Action']),
    'src/ui/settings/SettingsPresentation.tsx':ui(['SettingsGroup','SettingsRow']),
    'src/ui/profile/AccountHeader.tsx':ui(['AccountHeader']),
    'src/ui/home/HomeLaunchArt.tsx':ui(['HomeLaunchArt']),
    'src/ui/home/HowItWorks.tsx':ui(['HowItWorks']),
    ...extra,
  };
  const cache = new Map();
  function load(rel) {
    if (Object.hasOwn(stubs,rel)) return stubs[rel];
    if (cache.has(rel)) return cache.get(rel).exports;
    const filename = path.join(ROOT,rel);
    const out = ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename.replace(/\.mjs$/,'.ts'),reportDiagnostics:true,
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
    assert.deepEqual((out.diagnostics??[]).filter(d=>d.category===1),[], 'TypeScript syntax: '+rel);
    const m={exports:{}};cache.set(rel,m);
    const req=spec=>{
      if (Object.hasOwn(stubs,spec)) return stubs[spec];
      if (!spec.startsWith('.')) return require(spec);
      const base=path.resolve(path.dirname(filename),spec);
      const target=['','.ts','.tsx','.js','.mjs','/index.ts','/index.tsx'].map(s=>base+s).find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
      assert.ok(target,'Resolve '+rel+' -> '+spec);return load(path.relative(ROOT,target));
    };
    new Function('require','module','exports','setTimeout','clearTimeout',out.outputText)(req,m,m.exports,
      timerModules[rel]?.setTimeout??setTimeout,timerModules[rel]?.clearTimeout??clearTimeout);
    return m.exports;
  }
  return { load,stubs,host,native };
}
async function mount(C,props){let r;await RTR.act(async()=>{r=RTR.create(React.createElement(C,props));});return r;}
const nodes=(r,test)=>r.root.findAll(n=>typeof n.type==='string'&&test(n));
function target(r,label){const found=nodes(r,n=>n.props.label===label||n.props.accessibilityLabel===label||n.props.title===label);assert.equal(found.length,1,label);return found[0];}
async function press(n){assert.ok(!n.props.disabled,'Enabled target');await RTR.act(async()=>{n.props.onPress();});}
async function unmount(r){await RTR.act(async()=>r.unmount());}
module.exports={ROOT,React,RTR,createHarness,deferred,mount,nodes,target,press,unmount};

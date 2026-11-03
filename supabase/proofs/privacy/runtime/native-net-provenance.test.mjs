import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {compareNativeNetProvenance, validateNativeNetBaseline} from './native-net-provenance.mjs';
const source = readFileSync(new URL('./native-net-provenance.sql',import.meta.url));
const expected = JSON.parse(readFileSync(new URL('./native-net-provenance-expected.json',import.meta.url)));
const digest = createHash('sha256').update(source).digest('hex');
const native = () => ({...structuredClone(expected.observation), helper: {
  ...structuredClone(expected.observation.helper),
  source_sha256: expected.observation.helper.normalized_sha256,
  native_literal_count: 1, hosted_literal_count: 0, config_kind: 'INHERITED'
}});
test('baseline is bound to exact SQL, read-only current DEV and pinned observed helper', () => {
  assert.equal(validateNativeNetBaseline(expected, digest).extension_version,'0.20.4');
  assert.throws(()=>validateNativeNetBaseline(expected,'0'.repeat(64)),/FORMAT_REFUSED/);
  assert.throws(()=>validateNativeNetBaseline({...expected,observation:{...expected.observation,read_only:'off'}},digest));
  assert.throws(()=>validateNativeNetBaseline({...expected,observation:{...expected.observation,helper:{...expected.observation.helper,source_sha256:'0'.repeat(64)}}},digest));
});
test('only the source-normalized native helper passes the narrow provenance check', () => {
  const result = compareNativeNetProvenance(expected,native(),digest);
  assert.equal(result.provenance_verified,true);
  assert.equal(result.difference_count,0);
  assert.match(result.limitations,/unproven/);
});
test('all source, event, mode, legacy-version and dependency drift is rejected', () => {
  const mutations = [
    x=>{x.helper.source_sha256='0'.repeat(64);},
    x=>{x.helper.normalized_sha256='0'.repeat(64);},
    x=>{x.helper.native_literal_count=0;},
    x=>{x.helper.hosted_literal_count=1;},
    x=>{x.helper.config_kind='EMPTY_SEARCH_PATH';},
    x=>{x.helper.invoker=false;},
    x=>{x.event.create_extension_only=false;},
    x=>{x.event.invokes_helper=false;},
    x=>{x.dependencies.only_event=false;},
    x=>{x.dependencies.total=2;},
    x=>{x.legacy_branches.native_active=true;},
    x=>{x.legacy_branches.hosted_active=true;},
  ];
  for (const mutate of mutations) {
    const x=native();mutate(x);
    assert.equal(compareNativeNetProvenance(expected,x,digest).provenance_verified,false);
  }
});
test('unexpected runtime/metadata format, raw names or null fields fail closed', () => {
  const mutations = [
    x=>{x.extension_version='0.8';},x=>{x.read_only='off';},
    x=>{x.server_version_num=180000;}, x=>{x.helper.config_kind='other';},
    x=>{x.helper.private_body='unsafe';}, x=>{x.event=null;},
    x=>{x.legacy_branches.native_active='false';},
  ];
  for (const mutate of mutations) {
    const x=native();mutate(x);
    assert.throws(()=>compareNativeNetProvenance(expected,x,digest),/FORMAT_REFUSED/);
  }
});

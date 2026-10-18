import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const state=readFileSync(new URL('../../../src/ui/v2/discovery/DiscoveryListState.tsx',import.meta.url),'utf8');
const presentation=readFileSync(new URL('../../../src/ui/v2/DiscoveryPresentation.tsx',import.meta.url),'utf8');
const route=readFileSync(new URL('../../../src/ui/v2/discovery/DiscoveryV1Route.tsx',import.meta.url),'utf8');

test('Za mene is not mistaken for a claim that no public tasks exist',()=>{
 assert.match(state,/Za sada nema zadataka za tebe/);
 assert.match(state,/Gledamo potvrđene usluge koje nudiš, područje i dostupnost/);
 assert.match(state,/proveri da li su tvoje usluge sačuvane i potvrđene/);
 assert.doesNotMatch(state,/forMeTitle: 'Nema zadataka'/);
});
test('worker action remains optional and never replaces Show All',()=>{
 assert.match(state,/kind: 'forMe'; onShowAll: \(\) => void; onWorkProfile\?: \(\) => void/);
 assert.match(state,/primary=\{\{ label: w\.showAll, onPress: state\.onShowAll \}\}/);
 assert.match(state,/quiet=\{state\.onWorkProfile \? \{ label: w\.forMeEdit, onPress: state\.onWorkProfile \} : undefined\}/);
});
test('fresh and retained empty states both use route-owned profile navigation',()=>{
 const matches=presentation.match(/kind: 'forMe', onShowAll: \(\) => chooseScope\('all'\), onWorkProfile: props\.onWorkProfile/g)??[];
 assert.equal(matches.length,2,'both paths required, including after map pan/refresh');
 assert.match(route,/onWorkProfile=\{\(\) => navigate\(\(\) => router\.navigate\('\/profil\/radnik'\)\)\}/);
});
test('navigating to profile is never a capability grant, Save or push',()=>{
 assert.doesNotMatch(state,/rpc_taxonomy|rpc_.*save|push_token|confirm.*uuid/i);
 assert.doesNotMatch(presentation,/rpc_taxonomy_bind_reviewed_worker_service/);
});

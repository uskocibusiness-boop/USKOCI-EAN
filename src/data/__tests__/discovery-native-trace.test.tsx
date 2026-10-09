import React from 'react';
import { act, create } from 'react-test-renderer';
import type { DiscoveryTrace } from '../../ui/v2/DiscoveryPresentation';

let mockPackage: string | undefined = 'rs.uskoci.dev';
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { android: { package: mockPackage } }; } } }));

import { NATIVE_TRACE_LIMIT, NATIVE_TRACE_SAMPLE_LIMIT, useDiscoveryNativeTrace } from '../../ui/v2/discovery/discoveryNativeTrace';

let info: jest.SpyInstance;
const originalTrace = process.env.EXPO_PUBLIC_DISCOVERY_TRACE;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); mockPackage = 'rs.uskoci.dev'; delete process.env.EXPO_PUBLIC_DISCOVERY_TRACE; });
afterEach(() => { info.mockRestore(); if (originalTrace === undefined) delete process.env.EXPO_PUBLIC_DISCOVERY_TRACE; else process.env.EXPO_PUBLIC_DISCOVERY_TRACE = originalTrace; });

async function mount() {
  const box: { trace: DiscoveryTrace | undefined } = { trace: undefined };
  function Probe() { box.trace = useDiscoveryNativeTrace(); return null; }
  await act(async () => { create(<Probe />); });
  return box;
}
const lines = () => info.mock.calls.map(call => String(call[0])).filter(line => line.startsWith('[USKOCI_DISCOVERY_TRACE]'));

it('exists by default only in the exact DEV package', async () => {
  for (const other of ['rs.uskoci', 'rs.uskoci.preview', 'com.example', undefined]) {
    mockPackage = other;
    expect((await mount()).trace).toBeUndefined();
  }
  mockPackage = 'rs.uskoci.dev';
  expect(typeof (await mount()).trace).toBe('function');
});

it('allows an explicitly enabled preview build but never the store or another package', async () => {
  process.env.EXPO_PUBLIC_DISCOVERY_TRACE = '1';
  mockPackage = 'rs.uskoci.preview';
  expect(typeof (await mount()).trace).toBe('function');
  for (const other of ['rs.uskoci', 'com.example', undefined]) {
    mockPackage = other;
    expect((await mount()).trace).toBeUndefined();
  }
});

it('logs a numbered fixed line with finite numbers only and drops anything else', async () => {
  const { trace } = await mount();
  trace!('index', 0, 2, true);
  trace!('geometry', 12.345, -20_000_000, 20_000_000);
  trace!('index', Number.NaN);
  trace!('index', Infinity);
  trace!('nothing-like-it' as never, 1);
  trace!('index', ...Array.from({ length: 21 }, () => 1));
  expect(lines()).toEqual(['[USKOCI_DISCOVERY_TRACE] [1,"index",0,2,true]', '[USKOCI_DISCOVERY_TRACE] [2,"geometry",12.3,-10000000,10000000]']);
});

it('is bounded: samples per high-rate event, and a total limit', async () => {
  const { trace } = await mount();
  for (let i = 0; i < NATIVE_TRACE_SAMPLE_LIMIT + 30; i++) trace!('scroll', i);
  expect(lines()).toHaveLength(NATIVE_TRACE_SAMPLE_LIMIT);
  for (let i = 0; i < NATIVE_TRACE_LIMIT + 50; i++) trace!('index', i);
  expect(lines()).toHaveLength(NATIVE_TRACE_LIMIT);
});

it('gives every visit its own allowance: route-focus starts a visit, so a return is diagnosed like the first visit', async () => {
  const { trace } = await mount();
  for (let i = 0; i < NATIVE_TRACE_LIMIT + 10; i++) trace!('index', i);
  for (let i = 0; i < NATIVE_TRACE_SAMPLE_LIMIT + 10; i++) trace!('scroll', i);
  expect(lines()).toHaveLength(NATIVE_TRACE_LIMIT);
  trace!('route-focus'); trace!('index', 1); trace!('scroll', 2); trace!('kick', 1, 400);
  expect(lines().slice(-4)).toEqual(['[USKOCI_DISCOVERY_TRACE] [1,"route-focus"]', '[USKOCI_DISCOVERY_TRACE] [2,"index",1]',
    '[USKOCI_DISCOVERY_TRACE] [3,"scroll",2]', '[USKOCI_DISCOVERY_TRACE] [4,"kick",1,400]']);
});

it('samples the persisted view, so that scrolling a long list cannot spend the allowance of the visit', async () => {
  const { trace } = await mount();
  for (let i = 0; i < NATIVE_TRACE_SAMPLE_LIMIT + 60; i++) trace!('route-view', i, 2);
  expect(lines()).toHaveLength(NATIVE_TRACE_SAMPLE_LIMIT);
  trace!('index', 0);
  expect(lines()).toHaveLength(NATIVE_TRACE_SAMPLE_LIMIT + 1);
});

it('gives every sampled event its own allowance in a visit, so scrolling cannot use up the restore evidence', async () => {
  const { trace } = await mount();
  for (let i = 0; i < NATIVE_TRACE_SAMPLE_LIMIT + 20; i++) trace!('scroll', i);
  for (let i = 0; i < NATIVE_TRACE_SAMPLE_LIMIT + 20; i++) trace!('content', i);
  trace!('stall', 1, 22917, 20855.8, 21451.8, 20855.6, -1, -1);
  const all = lines();
  expect(all.filter(line => line.includes('"scroll"'))).toHaveLength(NATIVE_TRACE_SAMPLE_LIMIT);
  expect(all.filter(line => line.includes('"content"'))).toHaveLength(NATIVE_TRACE_SAMPLE_LIMIT);
  expect(all.at(-1)).toContain('"stall",1,22917,20855.8,21451.8,20855.6,-1,-1');
});

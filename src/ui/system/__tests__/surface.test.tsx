import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
import { Press } from '../../Press';
import { Surface, speaks, surfaceWarnings, type SurfaceKind } from '../Surface';
import { sys } from '../tokens';
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const host = (id: string) => tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === id)[0];
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const kinds: SurfaceKind[] = ['record', 'panel', 'float', 'note', 'hero', 'media', 'inset'];

it.each(kinds)('%s keeps content accessible without inventing an action', async kind => {
  await render(<Surface kind={kind} testID="s"><Text>Stvaran sadržaj</Text></Surface>);
  expect(tree.root.findAllByType(Press)).toHaveLength(0);
  expect(host('s').props.accessible).toBeUndefined();
  expect(tree.root.findAllByType(Text).map(n => n.props.children)).toContain('Stvaran sadržaj');
  expect(flat(host('s')).backgroundColor).toMatch(/^#[0-9A-F]{6}$/);
});
it.each(kinds)('%s supports an explicit labeled action independently of its material', async kind => {
  const press=jest.fn();
  await render(<Surface kind={kind} testID="s" onPress={press} accessibilityLabel="Otvori zadatak" accessibilityHint="Prikazuje detalje"><Text>Zadatak</Text></Surface>);
  const button=tree.root.findByType(Press);
  expect(button.props).toMatchObject({accessibilityRole:'button',accessibilityLabel:'Otvori zadatak',accessibilityHint:'Prikazuje detalje'});
  expect(flat(host('s')).minHeight).toBeGreaterThanOrEqual(sys.touch.min);
  expect(flat(host('s')).minWidth).toBeGreaterThanOrEqual(sys.touch.min);
  await act(async()=>button.props.onPress()); expect(press).toHaveBeenCalledTimes(1);
  await act(async()=>tree.update(<Surface kind={kind} testID="s" disabled onPress={press}><Text>Zadatak</Text></Surface>));
  expect(tree.root.findByType(Press).props.accessibilityState.disabled).toBe(true);
  await act(async()=>tree.root.findByType(Press).props.onPress()); expect(press).toHaveBeenCalledTimes(1);
});
it('supports meaningful tints beyond notes without changing business content', async()=>{
  await render(<Surface kind="record" tone="info" variant="tinted" testID="s"><Text>Čeka tvoj odgovor</Text></Surface>);
  expect(flat(host('s')).backgroundColor).toBe(sys.status.info.background);
  expect(flat(host('s')).elevation).toBe(0);
  expect(tree.root.findByType(Text).props.children).toBe('Čeka tvoj odgovor');
});
it('allows different densities and corners for comparison, media and hero compositions', async()=>{
  await render(<Surface kind="hero" density="spacious" testID="s"><Text>Objavi zadatak</Text></Surface>);
  const hero=flat(host('s')); expect(hero.padding).toBe(sys.surface.padding.spacious);
  await act(async()=>tree.update(<Surface kind="panel" density="compact" testID="s"><Text>Sažetak</Text></Surface>));
  expect(flat(host('s')).padding).toBeLessThan(hero.padding!);
  expect(flat(host('s')).borderRadius).toBe(sys.radius.cardCompact);
});
it('a flat variant clears previous elevation, and caller geometry remains available',async()=>{
  await render(<Surface kind="record" variant="flat" testID="s" style={{maxWidth:400}}><Text>Pregled</Text></Surface>);
  expect(flat(host('s'))).toMatchObject({elevation:0,shadowOpacity:0,boxShadow:[],maxWidth:400});
});
it('passive nesting is permitted while nested whole-card actions are identified',()=>{
  for(const outer of kinds) for(const inner of kinds){
    expect(surfaceWarnings({kind:inner,enclosing:outer,pressed:false,enclosingPressed:true})).toEqual([]);
    expect(surfaceWarnings({kind:inner,enclosing:outer,pressed:true,enclosingPressed:false})).toEqual([]);
    expect(surfaceWarnings({kind:inner,enclosing:outer,pressed:true,enclosingPressed:true})).toHaveLength(1);
  }
});
it('development diagnostics remain silent in tests and production',async()=>{
  expect(speaks({dev:true,test:false})).toBe(true);
  expect(speaks({dev:true,test:true})).toBe(false); expect(speaks({dev:false,test:false})).toBe(false);
  const warn=jest.spyOn(console,'warn').mockImplementation(()=>undefined);
  await render(<Surface kind="hero"><Surface kind="panel"><Text>Detalj</Text></Surface></Surface>);
  expect(warn).not.toHaveBeenCalled();
});

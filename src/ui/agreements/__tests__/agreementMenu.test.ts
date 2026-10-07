import { orderActions } from '../../system/ActionSheet';
import { agreementMenuActions, MENU_WAIT_REASON, type AgreementMenuCommands, type AgreementMenuInput } from '../agreementMenu';

/**
 * The "···" menu of a Dogovor (plan 2.6): the rare actions, in the plan's order, with the two that end something in the danger
 * colour and last. Each entry is offered under the condition of its row on the page, so the menu never promises what the page
 * could not do. Built from the facts; the route gives each entry its command.
 */
const commands = (): AgreementMenuCommands & Record<keyof AgreementMenuCommands, jest.Mock> => ({
  onChange: jest.fn(), onCancel: jest.fn(), onPhone: jest.fn(), onLocation: jest.fn(), onProblem: jest.fn(), onSafety: jest.fn(),
});
const input = (patch: Partial<AgreementMenuInput> = {}): AgreementMenuInput => ({
  party: true, hasOther: true, active: true, requester: true, canChange: true, phoneShared: false, hasLocation: true, problemFree: true, enabled: true, ...patch });
const labels = (patch: Partial<AgreementMenuInput> = {}) => agreementMenuActions(input(patch), commands()).map(action => action.label);

describe('the menu\'s entries and their order', () => {
  it('is, for the requester of an agreed physical Dogovor: change, number, location, problem - then, in red, cancel and report/block', () => {
    expect(labels()).toEqual(['Izmeni uslove', 'Podeli svoj broj', 'Podeli lokaciju', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
  });

  it('keeps the plan\'s order after the sheet\'s own ordering, with the danger entries last and only those two in danger', () => {
    const actions = agreementMenuActions(input(), commands());
    expect(orderActions(actions).map(action => action.key)).toEqual(['change', 'phone', 'location', 'problem', 'cancel', 'safety']);
    expect(actions.filter(action => action.destructive).map(action => action.label)).toEqual(['Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
    expect(actions.slice(0, 4).every(action => !action.destructive)).toBe(true);
    expect(actions.map(action => action.key)).toEqual([...new Set(actions.map(action => action.key))]);
  });

  it('writes the number entry for what it will do', () => {
    expect(labels({ phoneShared: false })).toContain('Podeli svoj broj');
    expect(labels({ phoneShared: true })).toContain('Opozovi deljenje broja');
    expect(labels({ phoneShared: true })).not.toContain('Podeli svoj broj');
  });

  it('offers sharing the location to the requester only, and only where a physical place exists', () => {
    expect(labels({ requester: false })).not.toContain('Podeli lokaciju');
    expect(labels({ hasLocation: false })).not.toContain('Podeli lokaciju');
    expect(labels({ requester: true, hasLocation: true })).toContain('Podeli lokaciju');
  });

  it('offers reporting a problem only while no problem is open', () => {
    expect(labels({ problemFree: false })).not.toContain('Prijavi problem');
    expect(labels({ problemFree: true })).toContain('Prijavi problem');
  });

  it('offers neither change nor cancel where the page offers no "Izmene i otkazivanje" (the requester once the work is reported done)', () => {
    const waiting = labels({ canChange: false });
    expect(waiting).not.toContain('Izmeni uslove');
    expect(waiting).not.toContain('Otkaži Dogovor');
    expect(waiting).toEqual(['Podeli svoj broj', 'Podeli lokaciju', 'Prijavi problem', 'Prijavi ili blokiraj osobu']);
  });

  it('is only the safety entry on a Dogovor that is over, and nothing for someone who is not a side of it', () => {
    expect(labels({ active: false, canChange: false })).toEqual(['Prijavi ili blokiraj osobu']);
    expect(labels({ active: false, canChange: false, hasOther: false })).toEqual([]);
    expect(labels({ party: false })).toEqual([]);
  });

  it('has no safety entry when the Dogovor does not name the other side', () => {
    expect(labels({ hasOther: false })).not.toContain('Prijavi ili blokiraj osobu');
  });
});

describe('the menu\'s commands', () => {
  it('runs the command of the entry that was chosen, and no other', () => {
    const given = commands();
    const actions = agreementMenuActions(input(), given);
    const byKey = Object.fromEntries(actions.map(action => [action.key, action]));
    const wiring: [string, keyof AgreementMenuCommands][] = [['change', 'onChange'], ['phone', 'onPhone'], ['location', 'onLocation'],
      ['problem', 'onProblem'], ['cancel', 'onCancel'], ['safety', 'onSafety']];
    for (const [key, command] of wiring) {
      byKey[key].onPress();
      expect(wiring.map(([, name]) => given[name].mock.calls.length)).toEqual(wiring.map(([, name]) => name === command ? 1 : 0));
      jest.clearAllMocks();
    }
  });

  it('tells the person where "Podeli lokaciju" goes, since the share state is read in the section it opens', () => {
    const location = agreementMenuActions(input(), commands()).find(action => action.key === 'location');
    expect(location?.hint).toBe('Otvara odeljak Kontakt i mesto.');
  });

  it('draws every entry grey with the reason while the page is reading or saving, never hidden and never faded', () => {
    const actions = agreementMenuActions(input({ enabled: false }), commands());
    expect(actions).toHaveLength(6);
    for (const action of actions) expect([action.key, action.disabled, action.reason]).toEqual([action.key, true, MENU_WAIT_REASON]);
    const live = agreementMenuActions(input({ enabled: true }), commands());
    for (const action of live) expect([action.key, action.disabled, action.reason]).toEqual([action.key, false, undefined]);
  });
});

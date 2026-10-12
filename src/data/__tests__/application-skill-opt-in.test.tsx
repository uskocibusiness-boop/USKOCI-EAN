import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, {
    get(target, key) {
      if (key === 'useWindowDimensions') return () => ({ width: 361, height: 780, scale: 3, fontScale: 1.15 });
      return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Modal', 'Switch'].includes(String(key))
        ? key
        : Reflect.get(target, key);
    },
  });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/system/haptics', () => ({ tick: jest.fn() }));

import { ApplicationComposerPresentation, type ApplicationDraft } from '../../ui/v2/ApplicationComposerPresentation';

const need = {
  id: 'need-1',
  revizija: 3,
  naslov: 'Selidba i transport',
  podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Danas',
  stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 2, preostalo: 2, popunjeno: 0, udeo: 0 },
  rezimCene: 'OFFERS',
  osnovaCene: null,
  taskTimezone: 'Europe/Belgrade',
  schedule: null,
  uslovi: [],
} as unknown as PotrebaProjekcija;
const opportunity = { ...need, primaNovePrijave: true, rokZaPrijaveIso: null } as unknown as PrilikaProjekcija;
const draft: ApplicationDraft = { price: '3000', people: '1', note: '', start: null, end: null };

describe('ApplicationComposerPresentation skill opt-in', () => {
  it('renders skill opt-in toggle when category is not yet in worker profile', async () => {
    const onToggle = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ApplicationComposerPresentation
          need={need}
          opportunity={opportunity}
          draft={draft}
          change={jest.fn()}
          submit={jest.fn()}
          back={jest.fn()}
          busy={false}
          pending={false}
          uncertain={false}
          refresh={jest.fn()}
          error={null}
          confirmed={false}
          openApplications={jest.fn()}
          canSubmit={true}
          skillOptIn={{
            category: 'Selidbe',
            enabled: true,
            onToggle,
          }}
        />
      );
    });

    const switchNodes = tree.root.findAll(node => String(node.type) === 'Switch');
    expect(switchNodes.length).toBe(1);
    expect(switchNodes[0].props.value).toBe(true);
    expect(switchNodes[0].props.accessibilityLabel).toBe('Dodaj Selidbe u radni profil');

    // Toggle the switch
    act(() => {
      switchNodes[0].props.onValueChange(false);
    });
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('does not render skill opt-in when worker already has the category or skillOptIn is null', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ApplicationComposerPresentation
          need={need}
          opportunity={opportunity}
          draft={draft}
          change={jest.fn()}
          submit={jest.fn()}
          back={jest.fn()}
          busy={false}
          pending={false}
          uncertain={false}
          refresh={jest.fn()}
          error={null}
          confirmed={false}
          openApplications={jest.fn()}
          canSubmit={true}
          skillOptIn={null}
        />
      );
    });

    const switchNodes = tree.root.findAll(node => String(node.type) === 'Switch');
    expect(switchNodes.length).toBe(0);
  });
});

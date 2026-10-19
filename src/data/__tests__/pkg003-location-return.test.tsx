import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const CONVERSATION = '30000000-0000-4000-8000-000000000003';
let mockConversationId: string | string[] | undefined = CONVERSATION;
const mockRead = jest.fn(), mockSave = jest.fn(), mockOwnedEditor = jest.fn(), mockResolver = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: 'Redirect',
  useLocalSearchParams: () => ({ conversationId: mockConversationId }),
}));
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: (...args: unknown[]) => mockOwnedEditor(...args) }));
jest.mock('../locationClientService', () => ({ needLocationClientService: {
  read: (...args: unknown[]) => mockRead(...args), save: (...args: unknown[]) => mockSave(...args),
} }));
jest.mock('../productionLocationResolver', () => ({ createProductionLocationResolver: (...args: unknown[]) => mockResolver(...args) }));

import MestoZadatka from '../../app/(app)/mesto-zadatka';

let tree: ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); mockConversationId = CONVERSATION; });
afterEach(() => { act(() => tree?.unmount()); });

async function render() {
  await act(async () => { tree = create(<MestoZadatka />); });
  return tree.root.findByType('Redirect' as never);
}
function expectNoSecondLocationWriter() {
  expect(mockRead).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
  expect(mockOwnedEditor).not.toHaveBeenCalled(); expect(mockResolver).not.toHaveBeenCalled();
}

describe('PKG-003 legacy location links converge on the canonical signed review', () => {
  it('redirects a valid old deep link with the exact conversation identity and performs no location I/O', async () => {
    const redirect = await render();
    expect(redirect.props.href).toEqual({ pathname: '/pregled-zadatka', params: { conversationId: CONVERSATION } });
    expectNoSecondLocationWriter();
  });

  it.each([undefined, '', 'invalid', [CONVERSATION], [CONVERSATION, 'other']])(
    'sends an invalid or ambiguous conversation parameter %j to the ordinary intake without reading or saving', async value => {
      mockConversationId = value;
      const redirect = await render();
      expect(redirect.props.href).toBe('/nova');
      expectNoSecondLocationWriter();
    });
});

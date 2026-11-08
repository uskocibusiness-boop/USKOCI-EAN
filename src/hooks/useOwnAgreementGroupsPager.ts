import { useCallback, useEffect, useState } from 'react';
import { createPagedListPager } from '../data/pagedListPager';
import { OWN_AGREEMENT_PAGE_LIMIT, ownAgreementScope, ownAgreementViewFromScope,
  type OwnAgreementCounts, type OwnAgreementCursor, type OwnAgreementGroup, type OwnAgreementPage,
  type OwnAgreementPageRequest, type OwnAgreementView } from '../data/ownAgreementGroupsPage';
import { usePagedList } from './usePagedList';

/** Reuse the existing account/focus/epoch pager. Search is server-scoped and
 * debounced; neither a filter nor an empty screen drains the user's history. */
export function useOwnAgreementGroupsPager(readPage: (request: OwnAgreementPageRequest) => Promise<OwnAgreementPage>, view: OwnAgreementView) {
  const scope = ownAgreementScope(view);
  const [requestedScope, setRequestedScope] = useState(scope);
  useEffect(() => {
    if (scope === requestedScope) return;
    const before = ownAgreementViewFromScope(requestedScope);
    const onlyQuery = before.section === view.section && before.role === view.role && before.outcome === view.outcome
      && before.confirmationOnly === view.confirmationOnly && !!view.query;
    if (!onlyQuery) { setRequestedScope(scope); return; }
    const timer = setTimeout(() => setRequestedScope(scope), 250);
    return () => clearTimeout(timer);
  }, [scope, requestedScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = useCallback((isCurrent: () => boolean) => createPagedListPager<OwnAgreementGroup, string, OwnAgreementCursor, OwnAgreementCounts>({
    readPage: request => readPage({ view: ownAgreementViewFromScope(request.scope), limit: request.limit, cursor: request.cursor }),
    isCurrent, keyOf: item => item.key, limit: OWN_AGREEMENT_PAGE_LIMIT, countsByScope: true,
  }), [readPage]);
  const { state, pager } = usePagedList(create, requestedScope, false, 'start');
  return { state, pager, inView: scope === requestedScope && state.scope === scope };
}

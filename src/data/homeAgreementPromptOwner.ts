import { decodeHomeAgreementPromptPage, HOME_AGREEMENT_PROMPT_PAGE_LIMIT,
  type HomeAgreementPromptCursor, type HomeAgreementPromptPage, type HomeAgreementPromptPageRequest } from './homeAgreementsContract';

/** One focused account owns the on-demand traversal. The screen keeps only the
 * current bounded page, never all rows or a growing cursor history. */
export type HomeAgreementPromptSource = {
  read: (request: HomeAgreementPromptPageRequest) => Promise<HomeAgreementPromptPage>;
  current: () => boolean;
};
export type HomeAgreementPromptState = {
  page: HomeAgreementPromptPage | null;
  index: number;
  loading: boolean;
  error: 'unavailable' | 'expired' | null;
};
type PagePosition = { cursor: HomeAgreementPromptCursor | null; index: number };

export class HomeAgreementPromptOwner {
  private state: HomeAgreementPromptState = { page: null, index: 0, loading: false, error: null };
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private failed: PagePosition | null = null;
  private retired = false;
  constructor(private readonly accountId: string, private readonly source: HomeAgreementPromptSource) {}

  getSnapshot = (): HomeAgreementPromptState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(value: HomeAgreementPromptState) {
    this.state = value;
    for (const listener of this.listeners) listener();
  }
  start = (): Promise<void> => this.state.page || this.state.loading ? Promise.resolve() : this.refresh();
  refresh = (): Promise<void> => this.load({ cursor: null, index: 0 });
  next = (): Promise<void> => {
    const cursor = this.state.page?.nextCursor;
    if (!cursor || !this.state.page?.hasMore || this.state.error) return Promise.resolve();
    return this.load({ cursor: { ...cursor }, index: this.state.index + 1 });
  };
  retry = (): Promise<void> => this.failed && this.state.error !== 'expired' ? this.load(this.failed) : Promise.resolve();
  dispose() {
    this.retired = true;
    this.controller?.abort();
    this.controller = null;
    this.listeners.clear();
  }

  private async load(position: PagePosition): Promise<void> {
    if (this.retired || this.controller || !this.source.current()) return;
    const controller = new AbortController();
    this.controller = controller;
    const before = this.state;
    this.publish({ ...before, loading: true, error: null });
    const request: HomeAgreementPromptPageRequest = {
      limit: HOME_AGREEMENT_PROMPT_PAGE_LIMIT, cursor: position.cursor ? { ...position.cursor } : null, signal: controller.signal,
    };
    let stopped: (() => void) | undefined;
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const cancelled = new Promise<never>((_, reject) => {
        stopped = () => reject(new Error('HOME_PROMPTS_RETIRED'));
        controller.signal.addEventListener('abort', stopped, { once: true });
      });
      const raw = await Promise.race([this.source.read(request), cancelled]);
      if (this.retired || controller.signal.aborted || !this.source.current()) return;
      const page = decodeHomeAgreementPromptPage(raw, request, this.accountId);
      if (!page) throw new Error('HOME_PROMPTS_INVALID');
      this.failed = null;
      this.publish({ page, index: position.index, loading: false, error: null });
    } catch (error) {
      if (this.retired || !this.source.current()) return;
      this.failed = position;
      this.publish({ ...before, loading: false,
        error: error instanceof Error && error.message === 'HOME_PROMPTS_EXPIRED' ? 'expired' : 'unavailable' });
    } finally {
      clearTimeout(timer);
      if (stopped) controller.signal.removeEventListener('abort', stopped);
      controller.abort();
      if (this.controller === controller) this.controller = null;
    }
  }
}

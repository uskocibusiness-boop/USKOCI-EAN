/** HITNO activation is retired. Keep a no-op adapter for existing route composition. */
type Props = {
  needId: string;
  need: import('../../contracts/projections').PotrebaProjekcija | null;
  disabled: boolean;
  onActiveChange: (active: boolean) => void;
  onRefresh: () => void;
};

type RetiredControl = {
  entry: null;
  sheet: null;
  view: { phase: 'idle'; message: ''; journal: false };
  check: () => void;
  finish: () => void;
};

export function useUrgentActivationActions(_props: Props): RetiredControl {
  return {
    entry: null,
    sheet: null,
    view: { phase: 'idle', message: '', journal: false },
    check: () => undefined,
    finish: () => undefined,
  };
}

export function UrgentActivationActions(_props: { control: RetiredControl }) {
  return null;
}

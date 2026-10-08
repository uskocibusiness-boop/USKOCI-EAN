import { DetailTopBar } from '../../system/DetailTopBar';
import { Screen } from '../../system/Screen';
import { StateView } from '../../system/StateView';
import type { Kadar } from './kadar';
import { noop } from './PocetnaZajednicko';
import type { Porodica } from './podaci';
import { StateViewVarA } from './StateViewVarA';
import { StateViewVarB } from './StateViewVarB';
import { StateViewVarC } from './StateViewVarC';

/**
 * The state family as full screens (V1, creative direction 2026-10-08, C.17–C.23): one member of the family at a time, FULL SCREEN
 * under a bar with the screen's name, because where the block lies is only what a screen shows when the block has the whole room
 * (as `StateGallery` does it). `StanjaSada` is today's `StateView` with today's words; A, B and C are the three variants.
 * The bar is a detail bar for every member, roots included: the stage is what is judged here, not the chrome.
 */
const actions = (clan: Porodica) => ({
  primary: clan.glavna ? { label: clan.glavna, onPress: noop } : undefined,
  quiet: clan.tiha ? { label: clan.tiha, onPress: noop } : undefined,
});

export function StanjaSada({ clan }: { clan: Porodica }) {
  return <Screen kind="detail" scroll={false} header={<DetailTopBar title={clan.traka} onBack={noop} />}>
    <StateView kind={clan.kind} art={clan.art} title={clan.naslov} body={clan.uci} {...actions(clan)} />
  </Screen>;
}

export function StanjaA({ clan }: { clan: Porodica }) {
  return <Screen kind="detail" scroll={false} header={<DetailTopBar title={clan.traka} onBack={noop} />}>
    <StateViewVarA kind={clan.kind} art={clan.art} cause={clan.cause} title={clan.naslov} body={clan.uci} {...actions(clan)} />
  </Screen>;
}

export function StanjaB({ clan }: { clan: Porodica }) {
  return <Screen kind="detail" scroll={false} header={<DetailTopBar title={clan.traka} onBack={noop} />}>
    <StateViewVarB kind={clan.kind} art={clan.art} cause={clan.cause} title={clan.naslov} body={clan.uci} {...actions(clan)} />
  </Screen>;
}

export function StanjaC({ clan, kadar }: { clan: Porodica; kadar: Kadar }) {
  return <Screen kind="detail" scroll={false} header={<DetailTopBar title={clan.traka} onBack={noop} />}>
    <StateViewVarC kind={clan.kind} art={clan.art} cause={clan.cause} title={clan.naslov} body={clan.uci} kadar={kadar} {...actions(clan)} />
  </Screen>;
}

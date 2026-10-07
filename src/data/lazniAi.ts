/**
 * R02 — AI intake, lažni izvor.
 *
 * Model je preslikan iz donorovog `ai_structured_facts` (KEEP odluka):
 * činjenica ima status, poreklo, citat i `potisnutaU` — pa ispravka ne
 * prepisuje staru vrednost nego je potiskuje.
 *
 * Zbog toga chat i live kartica mogu da budu DVE PROJEKCIJE istog stanja.
 * Da je kartica imala svoj state, „ipak u 18h" bi ostavilo 17h u kartici
 * i 18h u chatu — što je tačno ono što vlasnik ne želi.
 */

import type {
  Cinjenica,
  IzvorCinjenice,
  KljucCinjenice,
  NacrtPotrebeProjekcija,
  OdlukaBezbednosti,
  PorukaRazgovora,
  StatusCinjenice,
} from '../contracts/projections';
import type { Ishod } from './ports';
import { osoba } from '../ui/system/plural';

type Zapis = {
  id: string;
  kljuc: KljucCinjenice;
  prikaz: string;
  status: StatusCinjenice;
  izvor: IzvorCinjenice;
  citat: string | null;
  /** Kad je potisnuta novijom činjenicom za isti ključ. */
  potisnutaU: string | null;
};

type Razgovor = {
  id: string;
  poruke: PorukaRazgovora[];
  zapisi: Zapis[];
  brojac: number;
  objavljenaPotrebaId: string | null;
};

const razgovori = new Map<string, Razgovor>();
let brojRazgovora = 0;

/** Obavezno pre objave. Bez ovoga Potreba ne bi imala smisla. */
const OBAVEZNO: KljucCinjenice[] = ['naslov', 'datum', 'vreme', 'polaziste', 'odrediste', 'osoba'];

export function resetujAi() {
  razgovori.clear();
  brojRazgovora = 0;
}

function aktuelni(r: Razgovor): Zapis[] {
  return r.zapisi.filter((z) => z.potisnutaU === null);
}

/* ------------------------------------------------------ izvlačenje činjenica */

type Nalaz = { kljuc: KljucCinjenice; prikaz: string; izvor: IzvorCinjenice };

const BROJEVI: Record<string, number> = {
  jedan: 1, jedna: 1, jedno: 1,
  dva: 2, dvoje: 2, dvojica: 2, dvojicu: 2,
  tri: 3, troje: 3, trojica: 3, trojicu: 3,
  cetiri: 4, četiri: 4, cetvoro: 4, četvoro: 4,
};

/**
 * Namerno konzervativno: ono što je korisnik doslovno rekao ide kao KORISNIK,
 * ono što je izvedeno ide kao AI_ZAKLJUCAK. Razlika mora da se vidi u kartici.
 */
function izvuci(tekst: string): Nalaz[] {
  const t = tekst.toLowerCase();
  const nadjeno: Nalaz[] = [];

  const sat = t.match(/(?:u|oko)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:h|sati|časova|casova)?/);
  if (sat) {
    const h = sat[1].padStart(2, '0');
    const m = sat[2] ?? '00';
    nadjeno.push({ kljuc: 'vreme', prikaz: `${h}:${m}`, izvor: 'KORISNIK' });
  }

  if (/\bsutra\b/.test(t)) nadjeno.push({ kljuc: 'datum', prikaz: 'Sutra', izvor: 'KORISNIK' });
  else if (/\bdanas\b/.test(t)) nadjeno.push({ kljuc: 'datum', prikaz: 'Danas', izvor: 'KORISNIK' });
  else if (/\bprekosutra\b/.test(t)) nadjeno.push({ kljuc: 'datum', prikaz: 'Prekosutra', izvor: 'KORISNIK' });

  for (const [rec, n] of Object.entries(BROJEVI)) {
    if (new RegExp(`\\b${rec}\\b`).test(t)) {
      nadjeno.push({ kljuc: 'osoba', prikaz: osoba(n), izvor: 'KORISNIK' });
      break;
    }
  }

  if (/\bkombi/.test(t)) nadjeno.push({ kljuc: 'vozilo', prikaz: 'Kombi', izvor: 'KORISNIK' });
  else if (/\bautomobil|\bkola\b/.test(t)) nadjeno.push({ kljuc: 'vozilo', prikaz: 'Automobil', izvor: 'KORISNIK' });

  const ruta = t.match(/sa\s+([a-zšđčćž]+)\s+na\s+([a-zšđčćž]+)/);
  if (ruta) {
    nadjeno.push({ kljuc: 'polaziste', prikaz: veliko(ruta[1]), izvor: 'KORISNIK' });
    nadjeno.push({ kljuc: 'odrediste', prikaz: veliko(ruta[2]), izvor: 'KORISNIK' });
  }

  // Naslov je izveden, ne rečen — zato AI_ZAKLJUCAK i traži potvrdu.
  const predmet = t.match(/\b(ormar|frižider|frizider|veš mašina|kauč|kauc|sto|krevet|paket|nameštaj|namestaj)\w*/);
  if (predmet) {
    const p = veliko(predmet[1]);
    const gde = ruta ? ` sa ${veliko(ruta[1])} na ${veliko(ruta[2])}` : '';
    nadjeno.push({ kljuc: 'naslov', prikaz: `Prenos ${p.toLowerCase()}a${gde}`, izvor: 'AI_ZAKLJUCAK' });
    nadjeno.push({ kljuc: 'kategorija', prikaz: 'Selidba i prenos', izvor: 'AI_ZAKLJUCAK' });
  }

  return nadjeno;
}

function veliko(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------------------------------------------------------- safety gate */

/**
 * Server je autoritet. Fail closed tamo gde kanon traži.
 * UI vidi ishod, nikad interno obrazloženje.
 */
function proveriBezbednost(tekst: string): { odluka: OdlukaBezbednosti; poruka: string | null } {
  const t = tekst.toLowerCase();
  if (/\b(oruž|oruz|droga|narkot|krijumčar|krijumcar)\w*/.test(t)) {
    return { odluka: 'BLOCK', poruka: 'Ovakvu Potrebu ne možemo da objavimo.' };
  }
  if (/\b(gotovina|keš|kes)\b/.test(t) && /\bprenos|prevoz\b/.test(t)) {
    return { odluka: 'REVIEW', poruka: 'Potrebu će pre objave pregledati naš tim.' };
  }
  if (t.trim().length < 12) {
    return { odluka: 'CLARIFY', poruka: 'Reci mi malo više da bih razumeo šta ti treba.' };
  }
  return { odluka: 'ALLOW', poruka: null };
}

/* ----------------------------------------------------------- projekcija */

function projektuj(r: Razgovor): NacrtPotrebeProjekcija {
  const zivi = aktuelni(r);
  const cinjenice: Cinjenica[] = zivi.map((z) => ({
    id: z.id,
    kljuc: z.kljuc,
    prikaz: z.prikaz,
    status: z.status,
    izvor: z.izvor,
    citat: z.citat,
  }));

  const imaKljuc = new Set(zivi.map((z) => z.kljuc));
  const nedostaje = OBAVEZNO.filter((k) => !imaKljuc.has(k));

  const poslednja = r.poruke.filter((p) => !p.odAI).slice(-1)[0];
  let bez = poslednja ? proveriBezbednost(poslednja.telo) : { odluka: 'CLARIFY' as const, poruka: null };
  // Kratka ispravka nije nejasnoća ako je iz nje izvučena činjenica i nacrt već
  // nešto sadrži. CLARIFY sme da važi samo dok stvarno ne znamo ništa.
  if (bez.odluka === 'CLARIFY' && zivi.length > 0) {
    bez = { odluka: 'ALLOW', poruka: null };
  }

  // Objava traži da je SVE obavezno i postojeće i POTVRĐENO od čoveka.
  const sveObaveznoPotvrdjeno =
    nedostaje.length === 0 &&
    OBAVEZNO.every((k) => zivi.some((z) => z.kljuc === k && z.status === 'POTVRDJENO'));

  return {
    razgovorId: r.id,
    cinjenice,
    nedostaje,
    bezbednost: bez.odluka,
    bezbednostPoruka: bez.poruka,
    spremnoZaObjavu: sveObaveznoPotvrdjeno && bez.odluka === 'ALLOW',
  };
}

/** Ciljano pitanje umesto izmišljanja. */
function pitanjeZa(k: KljucCinjenice): string {
  return {
    naslov: 'Kako biste ukratko nazvali ovaj zadatak?',
    opis: 'Ima li još nešto što radnik treba da zna?',
    kategorija: 'O kakvoj vrsti pomoći je reč?',
    datum: 'Kog dana ti treba?',
    vreme: 'U koliko sati?',
    polaziste: 'Odakle se kreće?',
    odrediste: 'Gde treba doneti?',
    osoba: 'Koliko ljudi ti treba?',
    vozilo: 'Da li je potrebno vozilo?',
    uslovi: 'Ima li posebnih uslova — sprat, lift, alat?',
  }[k];
}

/* --------------------------------------------------------------- motor */

const kasnjenje = () => new Promise((r) => setTimeout(r, 70));

export const lazniAi = {
  async otvoriRazgovor(): Promise<Ishod<{ razgovorId: string }>> {
    await kasnjenje();
    brojRazgovora += 1;
    const id = `raz-${brojRazgovora}`;
    razgovori.set(id, {
      id,
      brojac: 0,
      objavljenaPotrebaId: null,
      zapisi: [],
      poruke: [
        {
          id: 'p0',
          odAI: true,
          telo: 'Reci mi svojim rečima šta ti treba. Ja ću popuniti detalje sa strane, a ti ćeš ih potvrditi.',
          predlozene: [],
        },
      ],
    });
    return { ok: true, podatak: { razgovorId: id } };
  },

  async razgovor(razgovorId: string) {
    await kasnjenje();
    const r = razgovori.get(razgovorId);
    if (!r) return null;
    return { poruke: r.poruke, nacrt: projektuj(r) };
  },

  async posaljiKorisnikovuPoruku(razgovorId: string, telo: string): Promise<Ishod<{ predlozeno: number }>> {
    await kasnjenje();
    const r = razgovori.get(razgovorId);
    if (!r) return { ok: false, kod: 'NOT_FOUND', poruka: 'Razgovor ne postoji.' };
    if (!telo.trim()) return { ok: false, kod: 'EMPTY', poruka: 'Napiši nešto.' };

    r.brojac += 1;
    r.poruke = [...r.poruke, { id: `u${r.brojac}`, odAI: false, telo, predlozene: [] }];

    const bez = proveriBezbednost(telo);
    if (bez.odluka === 'BLOCK') {
      r.brojac += 1;
      r.poruke = [...r.poruke, { id: `a${r.brojac}`, odAI: true, telo: bez.poruka!, predlozene: [] }];
      return { ok: true, podatak: { predlozeno: 0 } };
    }

    const nalazi = izvuci(telo);
    const noviIds: string[] = [];

    for (const n of nalazi) {
      // Ispravka: novija činjenica za isti ključ POTISKUJE stariju.
      const stara = r.zapisi.find((z) => z.kljuc === n.kljuc && z.potisnutaU === null);
      r.brojac += 1;
      const id = `c${r.brojac}`;
      if (stara) stara.potisnutaU = id;

      r.zapisi.push({
        id,
        kljuc: n.kljuc,
        prikaz: n.prikaz,
        // AI nikad ne upisuje POTVRDJENO. To može samo čovek.
        status: 'TRAZI_POTVRDU',
        izvor: n.izvor,
        citat: telo.slice(0, 90),
        potisnutaU: null,
      });
      noviIds.push(id);
    }

    r.poruke[r.poruke.length - 1].predlozene = noviIds;

    const nacrt = projektuj(r);
    const sledece = nacrt.nedostaje[0];
    const odgovor =
      bez.odluka === 'CLARIFY' && nalazi.length === 0
        ? bez.poruka!
        : sledece
          ? pitanjeZa(sledece)
          : nacrt.cinjenice.some((c) => c.status !== 'POTVRDJENO')
            ? 'Proveri podatke sa strane i potvrdi ono što je tačno.'
            : 'Sve je potvrđeno. Možeš objaviti Potrebu.';

    r.brojac += 1;
    r.poruke = [...r.poruke, { id: `a${r.brojac}`, odAI: true, telo: odgovor, predlozene: [] }];

    return { ok: true, podatak: { predlozeno: noviIds.length } };
  },

  async potvrdiCinjenicu(cinjenicaId: string): Promise<Ishod<null>> {
    await kasnjenje();
    for (const r of razgovori.values()) {
      const z = r.zapisi.find((x) => x.id === cinjenicaId);
      if (!z) continue;
      if (z.potisnutaU !== null) {
        return { ok: false, kod: 'SUPERSEDED', naslov: 'Zastarelo', poruka: 'Taj podatak je u međuvremenu izmenjen.' };
      }
      z.status = 'POTVRDJENO';
      z.izvor = 'KORISNIK'; // potvrdio čovek — više nije AI zaključak
      return { ok: true, podatak: null };
    }
    return { ok: false, kod: 'NOT_FOUND', poruka: 'Podatak ne postoji.' };
  },

  async ispraviCinjenicu(cinjenicaId: string, novaVrednost: string): Promise<Ishod<{ novaCinjenicaId: string }>> {
    await kasnjenje();
    if (!novaVrednost.trim()) return { ok: false, kod: 'EMPTY', poruka: 'Unesi vrednost.' };
    for (const r of razgovori.values()) {
      const stara = r.zapisi.find((x) => x.id === cinjenicaId);
      if (!stara) continue;
      r.brojac += 1;
      const id = `c${r.brojac}`;
      stara.potisnutaU = id;
      r.zapisi.push({
        id,
        kljuc: stara.kljuc,
        prikaz: novaVrednost.trim(),
        status: 'POTVRDJENO', // čovek je upisao ručno
        izvor: 'KORISNIK',
        citat: null,
        potisnutaU: null,
      });
      return { ok: true, podatak: { novaCinjenicaId: id } };
    }
    return { ok: false, kod: 'NOT_FOUND', poruka: 'Podatak ne postoji.' };
  },

  async objaviPotrebu(razgovorId: string): Promise<Ishod<{ potrebaId: string }>> {
    await kasnjenje();
    const r = razgovori.get(razgovorId);
    if (!r) return { ok: false, kod: 'NOT_FOUND', poruka: 'Razgovor ne postoji.' };

    const nacrt = projektuj(r);
    if (nacrt.bezbednost === 'BLOCK') {
      return { ok: false, kod: 'BLOCKED', naslov: 'Nije moguće objaviti', poruka: nacrt.bezbednostPoruka ?? '' };
    }
    if (nacrt.nedostaje.length > 0) {
      return {
        ok: false,
        kod: 'INCOMPLETE',
        naslov: 'Fali podatak',
        poruka: `Još nedostaje: ${nacrt.nedostaje.join(', ')}.`,
      };
    }
    if (!nacrt.spremnoZaObjavu) {
      return {
        ok: false,
        kod: 'UNCONFIRMED',
        naslov: 'Potvrdi podatke',
        poruka: 'Sve obavezne podatke moraš potvrditi pre objave.',
      };
    }

    // CANONICAL_SAVED — iz istog nacrta, ne iz istorije poruka.
    r.objavljenaPotrebaId = `potreba-${r.id}`;
    return { ok: true, podatak: { potrebaId: r.objavljenaPotrebaId } };
  },
};

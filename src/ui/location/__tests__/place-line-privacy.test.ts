import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { needGeographyRows } from '../../../data/needDetailPresentation';
import { readPublicNeedDetail } from '../../../data/needClientService';
import { taskPlace } from '../../v2/TaskFace';

/**
 * The owner's place line reads a PRIVATE address (the confirmed point's), so it is for the owner's own screens only (owner, 2026-10-07: he moved
 * the pin and the published task still named the street of the first text; the fix reads the point for HIM and never puts it in front of a
 * stranger). Everything a stranger sees of a place is the approximate area (`approximate_city`, `approximate_area`) and the public topology (label,
 * city, area), which the read hands over as `detalji.geografija`. These cases hold that line from both sides.
 */
const repo = join(__dirname, '../../../..');
const source = (path: string) => readFileSync(join(repo, path), 'utf8');

/** What a stranger's screens and the reads that feed them are made of. None of them may reach the owner's place line, or a private address. */
const PUBLIC_SURFACES = [
  'src/ui/v2/TaskCard.tsx', 'src/ui/v2/TaskFace.tsx', 'src/ui/v2/OwnTaskCard.tsx', 'src/ui/v2/PublicNeedPresentation.tsx', 'src/ui/v2/detail/TaskDecision.tsx',
  'src/ui/v2/discovery/DiscoveryPeek.tsx', 'src/ui/v2/discovery/DiscoveryListSheet.tsx', 'src/ui/v2/DiscoveryPresentation.tsx', 'src/ui/product/ProductDetails.tsx',
  'src/ui/v2/ApplicationComposerPresentation.tsx', 'src/ui/v2/MyApplicationsPresentation.tsx', 'src/data/needDetailPresentation.ts', 'src/data/needClientService.ts',
  'src/data/marketplaceView.ts', 'src/data/discoveryV1MarketplaceAdapter.ts', 'src/data/applicationClientService.ts',
];
const PRIVATE_PLACE = /ownerPlace|confirmedPointText|confirmedPlaceEntries|slotSeed|exactAddressForSlot|resolvedLocation|exactAddress|exact_address/;

describe('the owner’s place line is never reached from a stranger’s screen', () => {
  it.each(PUBLIC_SURFACES)('%s names no private-address function and no private field', path => {
    expect(source(path).match(PRIVATE_PLACE) ?? []).toEqual([]);
  });

  it('the reads that feed a stranger’s screen forward the public topology and the approximate area, and drop a private address that rides beside them', () => {
    const raw = { category: 'Prevoz', schedule_kind: 'FLEXIBLE', execution_location_mode: 'STATIONARY', task_country_code: 'RS', task_timezone: 'Europe/Belgrade',
      verified_identity_required: false, minimum_experience_years: null, starts_at: null, ends_at: null,
      required_skills: [], required_tools: [], required_vehicles: [], required_licenses: [], need_requirement_details: { critical_conditions: [] },
      need_geography: { public_topology: { mode: 'STATIONARY', start: { city: 'Novi Sad', label: 'Lenke Dunđerski' } } },
      // Not part of a public read, and never forwarded if one rides along.
      need_sensitive: { exact_address: '6, Pavla Ivića, Jugovićevo, Novi Sad, Srbija', exact_lat: 45.261418, exact_lng: 19.800509 },
      exact_address: '6, Pavla Ivića, Jugovićevo, Novi Sad, Srbija' };
    const { detail } = readPublicNeedDetail(raw);
    expect(JSON.stringify(detail)).not.toMatch(/Pavla|Ivića|45\.26|19\.80/);
    expect(detail.geografija).toEqual({ mode: 'STATIONARY', start: { city: 'Novi Sad', label: 'Lenke Dunđerski' } });
  });

  it('what a stranger reads of a place is the stored words, so a pin moved by its owner changes none of it', () => {
    const stationary = { podrucjeTekst: 'Novi Sad', detalji: { geografija: { mode: 'STATIONARY', start: { city: 'Novi Sad', label: 'Lenke Dunđerski' } } } } as never;
    expect(needGeographyRows(stationary)).toEqual([{ label: 'Način izvršenja', value: 'Na jednom mestu' }, { label: 'Mesto', value: 'Lenke Dunđerski · Novi Sad' }]);
    expect(taskPlace(stationary)).toEqual({ remote: false, text: 'Novi Sad' });
    const route = { podrucjeTekst: 'Novi Sad', detalji: { geografija: { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad', label: 'Lenke Dunđerski' },
      end: { city: 'Novi Sad', label: 'Dositejeva' } } } } as never;
    expect(needGeographyRows(route).map(row => row.value)).toEqual(['Od mesta do mesta', 'Lenke Dunđerski · Novi Sad', 'Dositejeva · Novi Sad']);
    expect(taskPlace(route)).toEqual({ remote: false, text: 'Lenke Dunđerski' });
  });
});

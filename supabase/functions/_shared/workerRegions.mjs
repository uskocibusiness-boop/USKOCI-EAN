// Region work areas (owner decision 22.11.2026). Codes and labels mirror the DEV
// functions private.worker_region_districts_v1 / worker_region_label_v1
// (migration 20261122084958); a REGION matches a task inside its districts.
// Mirrored for the app in src/contracts/workerRegions.ts; a test keeps all three equal.
export const WORKER_REGIONS = Object.freeze({
  'RS-VO': 'Cela Vojvodina', 'RS-BG': 'Ceo Beograd',
  'RS-SZ': 'Šumadija i Zapadna Srbija', 'RS-JI': 'Južna i Istočna Srbija',
  'RS-BACKA': 'Bačka', 'RS-BANAT': 'Banat', 'RS-SREM': 'Srem',
  'RS-01': 'Severnobački okrug', 'RS-02': 'Srednjobanatski okrug', 'RS-03': 'Severnobanatski okrug',
  'RS-04': 'Južnobanatski okrug', 'RS-05': 'Zapadnobački okrug', 'RS-06': 'Južnobački okrug',
  'RS-07': 'Sremski okrug', 'RS-08': 'Mačvanski okrug', 'RS-09': 'Kolubarski okrug',
  'RS-10': 'Podunavski okrug', 'RS-11': 'Braničevski okrug', 'RS-12': 'Šumadijski okrug',
  'RS-13': 'Pomoravski okrug', 'RS-14': 'Borski okrug', 'RS-15': 'Zaječarski okrug',
  'RS-16': 'Zlatiborski okrug', 'RS-17': 'Moravički okrug', 'RS-18': 'Raški okrug',
  'RS-19': 'Rasinski okrug', 'RS-20': 'Nišavski okrug', 'RS-21': 'Toplički okrug',
  'RS-22': 'Pirotski okrug', 'RS-23': 'Jablanički okrug', 'RS-24': 'Pčinjski okrug',
});
/** Practical "no limit" for a worker's areas; protects geocoding and matching. */
export const WORKER_AREA_LIMIT = 200;

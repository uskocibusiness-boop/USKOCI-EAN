import { cityLabel } from '../cityLabel';

/**
 * A CITY as the profile screens show it (owner's phone, 8 Oct 2026: "Novi Sad" in the header and "Novi sad" in the rows under it, because the
 * work area's city had been typed with a small "s"). Display only: `tidyPlaceLabel` keeps a well-formed place as typed, and a city field is
 * where every word of a settlement's name takes its capital.
 */
describe('a city as it is shown', () => {
  it.each([
    ['Novi sad', 'Novi Sad'],
    ['novi sad', 'Novi Sad'],
    ['NovI SAD', 'Novi Sad'],
    ['NOVI SAD', 'Novi Sad'],
    ['sremska mitrovica', 'Sremska Mitrovica'],
    ['Bela crkva', 'Bela Crkva'],
    ['đakovo', 'Đakovo'],
    ['нови сад', 'Нови Сад'],
  ])('writes %p as %p', (typed, shown) => {
    expect(cityLabel(typed)).toBe(shown);
  });

  it.each(['Novi Sad', 'Sremska Kamenica', 'Beograd - Zemun', 'Sremska Kamenica, Novi Sad', 'Kula', 'Petrovac na Mlavi', 'Kovilj kod Novog Sada'])
    ('leaves %p exactly as it is, byte for byte', label => {
      expect(cityLabel(label)).toBe(label);
    });

  it('keeps the small words after the first one small, and the separators as they were typed', () => {
    expect(cityLabel('Kovilj kod novog sada')).toBe('Kovilj kod Novog Sada');
    expect(cityLabel('petrovac na mlavi')).toBe('Petrovac na Mlavi');
    expect(cityLabel('priboj na limu')).toBe('Priboj na Limu');
    expect(cityLabel('novi sad - petrovaradin')).toBe('Novi Sad - Petrovaradin');
    expect(cityLabel('Sremska kamenica, novi sad')).toBe('Sremska Kamenica, Novi Sad');
  });

  it('does not touch an abbreviation or a number, and raises only the first letter of a word', () => {
    expect(cityLabel('Novi Beograd, MZ Altina')).toBe('Novi Beograd, MZ Altina');
    expect(cityLabel('blok 45')).toBe('Blok 45');
    expect(cityLabel('45 blok')).toBe('45 Blok');
  });

  it('says nothing for nothing', () => {
    expect(cityLabel('')).toBe('');
    expect(cityLabel('   ')).toBe('');
  });
});

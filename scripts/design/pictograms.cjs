// USKOČI pictograms — the picker level of the one icon language (owner's master directive, 2026-09-23).
// Same 32-unit canvas, tones, ground shadow, edge-under-face depth and shine as FactArt; pictograms add a soft vertical
// face gradient ({grad}) for the premium volume the picker screens call for. Objects face right, light from the top left.
// Tokens: {front} {edge} {light} {soft} {grad} are the tone; constants below are the shared neutrals.
const INK = '#35463D', METAL = '#8A938E', STEEL = '#C5CDC7', PALE = '#E4E9E5', WHITE = '#FFFFFF', DARK = '#26332C';
const SHADOW = '<ellipse cx="16" cy="29.2" rx="12" ry="1.7" fill="#163D2B" opacity="0.08"/>';
const line = (d, color, width = 1.9) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shine = (d, w = 1.6) => line(d, '{light}', w);
const wheel = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${DARK}"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(2)}" fill="${STEEL}"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.18).toFixed(2)}" fill="${METAL}"/>`;
const ring = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${DARK}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="1" fill="${METAL}"/>`;
const shift = (d, dy = 1.4) => d; // edges are drawn explicitly below; kept for readability
const body = (d, dEdge) => `<path d="${dEdge}" fill="{edge}"/><path d="${d}" fill="{grad}"/>`;
const badgeCheck = (cx = 24.5, cy = 8.5) => `<circle cx="${cx}" cy="${cy + 0.8}" r="5" fill="#077958"/><circle cx="${cx}" cy="${cy}" r="5" fill="#079C77"/>` + line(`m${cx - 2.3} ${cy} 1.6 1.7 3.1-3.3`, WHITE, 1.8);

const K = {};
const add = (id, label, group, tone, parts) => { K[id] = { label, group, tone, svg: [SHADOW, ...parts] }; };

// ── Vozila ─────────────────────────────────────────────────────────────────────────────────────────────────────
const bikeFrame = (c = '{front}') => line('M8.5 22 15 22 12.8 13.2 8.5 22M12.8 13.2H21.2L15 22M21.2 13.2 23.5 22', c, 2.2)
  + line('M11 12h3.6', DARK, 2.2) + line('M20.2 11.4 23 10.2', DARK, 1.9);
add('bicikl', 'Bicikl', 'vozila', 'green', [ring(8.5, 22, 5.2), ring(23.5, 22, 5.2), bikeFrame(), shine('M14.2 12.2h5.4', 1.2)]);
add('ebike', 'E-bike', 'vozila', 'green', [ring(8.5, 22, 5.2), ring(23.5, 22, 5.2), bikeFrame(),
  '<rect x="15.6" y="14.4" width="4.6" height="6.6" rx="1.6" transform="rotate(-50 17.9 17.7)" fill="#CF5B12"/>',
  '<rect x="15.6" y="13.8" width="4.6" height="6.6" rx="1.6" transform="rotate(-50 17.9 17.1)" fill="#F78028"/>',
  '<path d="m18.3 15.2-1.6 2.3h1.6l-1.2 2" fill="none" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>']);
add('skuter', 'Skuter', 'vozila', 'green', [
  body('M4.5 22.3C4.5 17.6 7 15.4 11 15.4h4.6c1 0 1.6.8 1.6 1.8v3.2h2.9l2.2-9.4c.2-.9 1.1-1.5 2-1.3l.8.2c.9.2 1.4 1.1 1.2 2l-2.4 9.3c-.4 1.4-1.6 2.3-3 2.3H6c-.8 0-1.5-.5-1.5-1.2Z',
    'M4.5 23.7C4.5 19 7 16.8 11 16.8h4.6c1 0 1.6.8 1.6 1.8v3.2h2.9l2.2-9.4c.2-.9 1.1-1.5 2-1.3l.8.2c.9.2 1.4 1.1 1.2 2l-2.4 9.3c-.4 1.4-1.6 2.3-3 2.3H6c-.8 0-1.5-.5-1.5-1.2Z'),
  '<rect x="6.6" y="13" width="8.2" height="2.6" rx="1.3" fill="' + DARK + '"/>', line('M22.9 9.7 27 8.6', DARK, 1.9),
  '<circle cx="25.2" cy="12.6" r="1.1" fill="#FFBE85"/>', shine('M7.4 18.2a4.4 4.4 0 0 1 3.6-1.6'), wheel(8.6, 24.2, 3.8), wheel(22.4, 24.2, 3.8)]);
add('motor', 'Motor', 'vozila', 'green', [
  line('M10.6 18 7.5 22.6M21.4 14.2l3.1 8.4', DARK, 1.8),
  '<rect x="12.2" y="17.6" width="7" height="4.8" rx="1.4" fill="' + METAL + '"/>', line('M13.7 19.1v2M15.7 19.1v2M17.7 19.1v2', STEEL, 1),
  body('M9.8 15.3c1-1.9 3.5-2.7 6.2-2.3l4.4.6c1.1.2 1.7 1.2 1.3 2.2l-.8 2H12c-1.4 0-2.6-1.3-2.2-2.5Z',
    'M9.8 16.5c1-1.9 3.5-2.7 6.2-2.3l4.4.6c1.1.2 1.7 1.2 1.3 2.2l-.8 2H12c-1.4 0-2.6-1.3-2.2-2.5Z'),
  '<path d="M4.8 15.6c1.8-1 4-1 6 .1l-.4 1.4H5.4Z" fill="' + DARK + '"/>', line('M20.4 12 23.8 11', DARK, 1.8),
  '<circle cx="24.4" cy="15.2" r="1.3" fill="#F78028"/>', shine('M12.4 14.2a4 4 0 0 1 3.2-.6', 1.3), wheel(7.5, 22.8, 5), wheel(24.5, 22.8, 5)]);
const CAR = 'M3.5 21.4v-3c0-1.2.8-2.2 2-2.4l3.7-.6 3.2-4c.8-1 2-1.6 3.3-1.6H21c1.3 0 2.5.6 3.3 1.6l2.9 3.8c1.4.3 2.3 1.5 2.3 2.9v3.3c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5Z';
const CAR_E = 'M3.5 22.8v-3c0-1.2.8-2.2 2-2.4l3.7-.6 3.2-4c.8-1 2-1.6 3.3-1.6H21c1.3 0 2.5.6 3.3 1.6l2.9 3.8c1.4.3 2.3 1.5 2.3 2.9v3.3c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5Z';
add('automobil', 'Automobil', 'vozila', 'green', [body(CAR, CAR_E),
  '<path d="M16.6 11.4h4.2c.7 0 1.3.3 1.8.9l2.2 2.8h-8.2Z" fill="{soft}"/>', '<path d="M15.2 11.4v3.7h-4.4l2.5-3c.4-.4 1-.7 1.6-.7Z" fill="{soft}"/>',
  line('M16 15.9v5', '{edge}', 1), '<rect x="26.8" y="16.9" width="2" height="1.3" rx=".6" fill="#FFBE85"/>', shine('M6 17.6h3.4'),
  wheel(9.5, 23, 3.6), wheel(23.5, 23, 3.6)]);
add('karavan', 'Karavan', 'vozila', 'green', [
  body('M3.5 21.4v-7.2c0-1.3.9-2.4 2.2-2.6l2.5-1c.8-.4 1.7-.6 2.6-.6h9.8c1.3 0 2.5.6 3.3 1.6l3 3.7c1.5.3 2.6 1.6 2.6 3.1v3c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5Z',
    'M3.5 22.8v-7.2c0-1.3.9-2.4 2.2-2.6l2.5-1c.8-.4 1.7-.6 2.6-.6h9.8c1.3 0 2.5.6 3.3 1.6l3 3.7c1.5.3 2.6 1.6 2.6 3.1v3c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5Z'),
  '<rect x="5.6" y="11.6" width="4.6" height="3.8" rx="1" fill="{soft}"/>', '<rect x="11.4" y="11.6" width="5" height="3.8" rx="1" fill="{soft}"/>',
  '<path d="M17.6 11.6h2.8c.6 0 1.2.3 1.6.8l2.4 3H17.6Z" fill="{soft}"/>', '<rect x="27.1" y="17" width="2" height="1.3" rx=".6" fill="#FFBE85"/>',
  wheel(9.5, 23, 3.6), wheel(23.5, 23, 3.6)]);
add('pickup', 'Pickup', 'vozila', 'green', [
  body('M3 21.6v-4.8c0-.5.4-.8.9-.8h11.7v-4.2c0-.9.7-1.6 1.6-1.6h5c.8 0 1.5.4 1.9 1.1l2.5 4.1c1.7.2 2.9 1.6 2.9 3.3v2.9c0 .8-.7 1.4-1.5 1.4H4.4c-.8 0-1.4-.6-1.4-1.4Z',
    'M3 23v-4.8c0-.5.4-.8.9-.8h11.7v-4.2c0-.9.7-1.6 1.6-1.6h5c.8 0 1.5.4 1.9 1.1l2.5 4.1c1.7.2 2.9 1.6 2.9 3.3V23c0 .8-.7 1.4-1.5 1.4H4.4c-.8 0-1.4-.6-1.4-1.4Z'),
  '<path d="M17.4 11.8h4.4c.4 0 .8.2 1 .6l1.8 3h-7.2Z" fill="{soft}"/>', shine('M3.6 16.9h11.4', 1.2),
  '<rect x="27.4" y="17.2" width="1.8" height="1.3" rx=".6" fill="#FFBE85"/>', wheel(8.5, 23, 3.6), wheel(23.5, 23, 3.6)]);
add('kombi', 'Kombi', 'vozila', 'green', [
  body('M3 21.4v-9.9C3 10.1 4.1 9 5.5 9h16c1.1 0 2.1.6 2.7 1.5l4.2 6.1c.4.5.6 1.1.6 1.8v3c0 .9-.7 1.6-1.6 1.6H4.6c-.9 0-1.6-.7-1.6-1.6Z',
    'M3 22.8v-9.9c0-1.4 1.1-2.5 2.5-2.5h16c1.1 0 2.1.6 2.7 1.5l4.2 6.1c.4.5.6 1.1.6 1.8v3c0 .9-.7 1.6-1.6 1.6H4.6c-.9 0-1.6-.7-1.6-1.6Z'),
  '<rect x="5.2" y="10.8" width="5" height="4.4" rx="1" fill="{soft}"/>', '<rect x="11.4" y="10.8" width="5" height="4.4" rx="1" fill="{soft}"/>',
  '<path d="M18 10.8h3.4c.5 0 1 .3 1.3.7l3.2 4.7H18Z" fill="{soft}"/>', line('M17.2 16.8v4', '{edge}', 1), shine('M5.6 17.6h9'),
  '<rect x="26.9" y="18.4" width="1.8" height="1.3" rx=".6" fill="#FFBE85"/>', wheel(8.5, 23, 3.6), wheel(23.5, 23, 3.6)]);
add('prikolica', 'Prikolica', 'vozila', 'orange', [
  line('M23 19.6 28.8 20', DARK, 1.9), '<circle cx="29.2" cy="20" r="1.2" fill="' + DARK + '"/>',
  body('M3 12.4C3 11.1 4.1 10 5.4 10h15.2c1.3 0 2.4 1.1 2.4 2.4v7.4c0 1.3-1.1 2.4-2.4 2.4H5.4C4.1 22.2 3 21.1 3 19.8Z',
    'M3 13.8c0-1.3 1.1-2.4 2.4-2.4h15.2c1.3 0 2.4 1.1 2.4 2.4v7.4c0 1.3-1.1 2.4-2.4 2.4H5.4c-1.3 0-2.4-1.1-2.4-2.4Z'),
  line('M9.6 12.6v7.6M16.4 12.6v7.6', '{light}', 1.2), shine('M5.2 12.4h3'), wheel(13, 23.4, 3.6)]);
add('kamion', 'Kamion', 'vozila', 'green', [
  line('M2.8 21.8h26.4', DARK, 1.8),
  '<path d="M2.5 9.6c0-1.2 1-2.1 2.1-2.1h14.2c1.2 0 2.1 1 2.1 2.1v11.2H2.5Z" fill="#E1E6E2"/>',
  '<path d="M2.5 8.9c0-1.2 1-2.1 2.1-2.1h14.2c1.2 0 2.1 1 2.1 2.1v10.5H2.5Z" fill="#FFFFFF" stroke="#CCD4CE" stroke-width="1"/>',
  '<rect x="2.5" y="15.6" width="18.4" height="2.6" fill="{front}"/>',
  body('M20.8 21V12.6c0-.9.7-1.6 1.6-1.6h3c.8 0 1.5.5 1.8 1.2l2.1 4.7.2 1V21Z', 'M20.8 22.4V14c0-.9.7-1.6 1.6-1.6h3c.8 0 1.5.5 1.8 1.2l2.1 4.7.2 1v3.1Z'),
  '<path d="M22.4 12.6h2.6c.4 0 .7.2.9.5l1.6 3.5h-5.1Z" fill="{soft}"/>', wheel(7, 23.4, 3.3), wheel(12.4, 23.4, 3.3), wheel(25, 23.4, 3.3)]);

// ── Oprema i alat ──────────────────────────────────────────────────────────────────────────────────────────────
add('rucni-alat', 'Ručni alat', 'alat', 'orange', [
  '<g transform="rotate(-45 16 16)"><rect x="14.6" y="15" width="2.8" height="13" rx="1.4" fill="{edge}"/><rect x="14.6" y="14" width="2.8" height="13" rx="1.4" fill="{grad}"/>'
  + '<rect x="9.2" y="7" width="13.6" height="6.4" rx="1.6" fill="' + INK + '"/><rect x="9.2" y="6.2" width="13.6" height="6" rx="1.6" fill="' + METAL + '"/>'
  + '<path d="M10.6 7.4h10.8" stroke="#C5CDC7" stroke-width="1.2" stroke-linecap="round"/></g>',
  '<g transform="rotate(45 16 16)"><rect x="14.8" y="4" width="2.4" height="12" rx="1.2" fill="' + STEEL + '"/><path d="M15.2 4h1.6l-.8-1.6Z" fill="' + METAL + '"/>'
  + '<rect x="13.8" y="16" width="4.4" height="10.4" rx="2.2" fill="#077958"/><rect x="13.8" y="15.4" width="4.4" height="10.2" rx="2.2" fill="#079C77"/>'
  + '<path d="M15 17.4v6.4" stroke="#6FD0AB" stroke-width="1" stroke-linecap="round"/></g>']);
const DRILL = 'M5 11h15c1.7 0 3 1.3 3 3v1.5c0 1.7-1.3 3-3 3h-6l-1.4 7.2c-.2 1-1 1.6-2 1.6H8.8c-1.1 0-1.9-1-1.7-2.1l1.5-6.7H6.5c-1.4 0-2.5-1.1-2.5-2.5v-4c0-.6.4-1 1-1Z';
const DRILL_E = 'M5 12.2h15c1.7 0 3 1.3 3 3v1.5c0 1.7-1.3 3-3 3h-6l-1.4 7.2c-.2 1-1 1.6-2 1.6H8.8c-1.1 0-1.9-1-1.7-2.1l1.5-6.7H6.5c-1.4 0-2.5-1.1-2.5-2.5v-4c0-.6.4-1 1-1Z';
const drillHead = '<rect x="23" y="12.6" width="3.2" height="3.4" rx=".7" fill="' + METAL + '"/>' + line('M26.2 14.3h3.8', DARK, 1.4)
  + '<rect x="11.6" y="18.4" width="2.4" height="2.8" rx=".8" fill="' + DARK + '"/>';
add('busilica', 'Bušilica', 'alat', 'green', [body(DRILL, DRILL_E), drillHead, shine('M6.6 12.6h10'),
  line('M10 27.4c-.4 1.3-2.2 1.8-4 1.2', DARK, 1.4)]);
add('aku-alat', 'Aku alat', 'alat', 'green', [body(DRILL, DRILL_E), drillHead, shine('M6.6 12.6h10'),
  '<rect x="5" y="26.2" width="10" height="3.6" rx="1.2" fill="#CF5B12"/><rect x="5" y="25.4" width="10" height="3.6" rx="1.2" fill="#F78028"/>',
  '<path d="m10.4 26-1.3 1.6h1.4l-1 1.4" fill="none" stroke="#FFFFFF" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>']);
add('merdevine', 'Merdevine', 'alat', 'green', [
  line('M9 27.6 14.4 5.6', '{edge}', 2.6), line('M23 27.6 17.6 5.6', '{edge}', 2.6),
  line('M8.6 27 14 5', '{front}', 2.4), line('M23.4 27 18 5', '{front}', 2.4),
  line('M10 22h12M11.4 16.5h9.2M12.8 11h6.4', STEEL, 1.8), '<rect x="13.2" y="3.6" width="5.6" height="2.8" rx="1.3" fill="#F78028"/>']);
add('kolica', 'Transportna kolica', 'alat', 'orange', [
  '<rect x="12.4" y="12" width="9.6" height="11" rx="1.4" fill="{edge}"/><rect x="12.4" y="11.2" width="9.6" height="11" rx="1.4" fill="{grad}"/>',
  line('M17.2 11.4v3.4', '{light}', 1.2), line('M9.6 3.6 10.4 24h9.8', INK, 2.2), line('M7.6 4.2h3.4', INK, 2.4), wheel(11.4, 26, 2.6)]);
add('usisivac', 'Usisivač', 'alat', 'green', [
  '<path d="M13.6 18.4c1.4-4.4 3.2-9.4 6.8-10.4" fill="none" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round"/>',
  line('M20.4 8 26.4 24.2', METAL, 1.9), '<rect x="21.8" y="23.6" width="8.4" height="3.6" rx="1.8" fill="' + DARK + '"/>',
  '<path d="M3.2 21.4c0-3.4 2.8-6.2 6.2-6.2h1.8c3.4 0 6.2 2.8 6.2 6.2v2.4c0 1.3-1.1 2.4-2.4 2.4H5.6c-1.3 0-2.4-1.1-2.4-2.4Z" fill="{edge}"/>',
  '<path d="M3.2 20.2c0-3.4 2.8-6.2 6.2-6.2h1.8c3.4 0 6.2 2.8 6.2 6.2v2.4c0 1.3-1.1 2.4-2.4 2.4H5.6c-1.3 0-2.4-1.1-2.4-2.4Z" fill="{grad}"/>',
  shine('M5.8 18.4a4.4 4.4 0 0 1 3-2.2'), '<circle cx="10.4" cy="20.4" r="2.2" fill="{soft}"/>',
  '<circle cx="6.4" cy="26.6" r="1.4" fill="' + DARK + '"/><circle cx="14.2" cy="26.6" r="1.4" fill="' + DARK + '"/>']);
add('kosilica', 'Kosilica', 'alat', 'orange', [
  line('M21.6 18.2 27.8 5.8', INK, 1.9), line('M25.6 5 29.6 6.8', INK, 2.4),
  '<rect x="11" y="13.6" width="7.2" height="4.2" rx="1.4" fill="' + METAL + '"/>',
  body('M6 22.4c0-2.9 2.4-5.3 5.3-5.3h8.2c2.9 0 5.3 2.4 5.3 5.3v.6H6Z', 'M6 23.6c0-2.9 2.4-5.3 5.3-5.3h8.2c2.9 0 5.3 2.4 5.3 5.3v.6H6Z'),
  shine('M8.6 19.8a3.6 3.6 0 0 1 2.6-1.3'), wheel(9.2, 24.6, 2.6), wheel(21.6, 24.6, 2.6),
  '<path d="M3 27.6l1-2.6 1 2.6 1-3 1 3" fill="none" stroke="#079C77" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>']);
add('basta-alat', 'Alat za baštu', 'alat', 'green', [
  line('M11.6 4.6v13', '{front}', 2.6), '<path d="M9.6 3.2h4v2.6h-4Z" fill="' + DARK + '"/>',
  '<path d="M7.8 17.4h7.6v5c0 2.8-1.7 5-3.8 5s-3.8-2.2-3.8-5Z" fill="' + METAL + '"/>', line('M9.4 19.2v4', STEEL, 1.2),
  line('M21.4 3.6v17', '#F78028', 2.4), line('M16.8 20.8h9.2', INK, 2), line('M17.4 21v4.4M19.6 21v4.4M21.8 21v4.4M24 21v4.4M26 21v4.4', INK, 1.2)]);
add('zastita', 'Zaštitna oprema', 'alat', 'orange', [
  body('M5.8 20.6C5.8 13.6 10.4 8.4 16 8.4s10.2 5.2 10.2 12.2Z', 'M5.8 21.8C5.8 14.8 10.4 9.6 16 9.6s10.2 5.2 10.2 12.2Z'),
  '<rect x="3.4" y="20.4" width="25.2" height="3.6" rx="1.8" fill="{edge}"/>', '<rect x="14.6" y="8.4" width="2.8" height="12.2" rx="1.2" fill="{light}"/>',
  shine('M8.6 15.4a8 8 0 0 1 3.6-4.6')]);
add('laptop', 'Laptop', 'alat', 'green', [
  '<rect x="6" y="6.4" width="20" height="13.8" rx="2" fill="' + DARK + '"/>', '<rect x="7.6" y="8" width="16.8" height="10.6" rx="1" fill="{soft}"/>',
  '<rect x="9.6" y="10" width="7.6" height="5.6" rx="1" fill="{grad}"/>', line('M19 11h3.4M19 13.6h3.4', '{light}', 1.3),
  '<path d="M3 21.6h26l-1.4 2.9c-.2.5-.7.8-1.2.8H5.6c-.5 0-1-.3-1.2-.8Z" fill="' + STEEL + '"/>', line('M13.6 21.9h4.8', METAL, 1)]);
add('racunar', 'Računar', 'alat', 'green', [
  '<rect x="4.4" y="4.8" width="23.2" height="15.8" rx="2.2" fill="' + DARK + '"/>', '<rect x="6.2" y="6.6" width="19.6" height="12.2" rx="1.1" fill="{soft}"/>',
  '<rect x="8.4" y="8.8" width="9" height="7.4" rx="1.1" fill="{grad}"/>', line('M19.6 10h4M19.6 12.8h4M19.6 15.4h2.4', '{light}', 1.3),
  '<rect x="14.6" y="20.4" width="2.8" height="3.8" fill="' + METAL + '"/>', '<rect x="10.4" y="24" width="11.2" height="2.6" rx="1.3" fill="' + STEEL + '"/>']);

// ── Usluge ─────────────────────────────────────────────────────────────────────────────────────────────────────
const box = (x, y, w, h, tape = true) => `<rect x="${x}" y="${y + 1.2}" width="${w}" height="${h}" rx="1.6" fill="{edge}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="{grad}"/>`
  + (tape ? `<rect x="${x + w / 2 - 1.2}" y="${y}" width="2.4" height="${h}" fill="{light}" opacity="0.8"/>` : '');
add('selidba', 'Selidba', 'usluge', 'orange', [box(4.6, 14.6, 16.4, 11.6), box(8.8, 6, 11.8, 9), shine('M6.2 16.4h4'),
  '<circle cx="25.4" cy="9.4" r="4.4" fill="#077958"/><circle cx="25.4" cy="8.8" r="4.4" fill="#079C77"/>', line('M25.4 11.2V6.6M23.4 8.4l2-2 2 2', WHITE, 1.6)]);
add('nosenje', 'Nošenje', 'usluge', 'orange', [box(8, 12, 16, 13), line('M13.2 12.2c0-4 5.6-4 5.6 0', INK, 1.9),
  line('M3 15.6h3.2M2.4 19.4h3.8M3 23.2h3.2', '#6FD0AB', 1.5)]);
add('ciscenje', 'Čišćenje', 'usluge', 'green', [
  body('M10.6 13.4h8.8l1 4v8.2c0 1.4-1.1 2.4-2.4 2.4h-6c-1.3 0-2.4-1-2.4-2.4v-8.2Z', 'M10.6 14.6h8.8l1 4v8.2c0 1.4-1.1 2.4-2.4 2.4h-6c-1.3 0-2.4-1-2.4-2.4v-8.2Z'),
  '<path d="M11.4 8.6h7.4v4.8h-7.4Z" fill="' + METAL + '"/>', '<path d="M18.8 9.2h3.2l.8 2.4h-4Z" fill="' + DARK + '"/>', line('M13 13.4l-1.6 3.4', DARK, 1.4),
  '<rect x="12.2" y="18.6" width="5.6" height="4.6" rx="1" fill="#FFFFFF" opacity="0.85"/>', shine('M11.8 17.4v6'),
  '<path d="M25.6 3.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" fill="#F78028"/>', '<path d="M27.4 11.4l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" fill="#FFBE85"/>']);
add('basta', 'Bašta', 'usluge', 'green', [
  '<path d="M9.4 19.2h13.2l-1.6 8c-.2 1-1 1.6-2 1.6h-6c-1 0-1.8-.6-2-1.6Z" fill="#CF5B12"/><path d="M9.4 18.4h13.2l-1.6 8c-.2 1-1 1.6-2 1.6h-6c-1 0-1.8-.6-2-1.6Z" fill="#F78028"/>',
  '<rect x="8.4" y="16.8" width="15.2" height="3.2" rx="1.2" fill="#CF5B12"/>', line('M16 16.8V9.6', '#077958', 1.8),
  '<path d="M16 11.6C16 7 12.4 4.6 8.6 5.4c-.2 4.2 2.8 6.8 7.4 6.2Z" fill="{grad}"/>', '<path d="M16 13.4c0-4.6 3.6-7 7.4-6.2.2 4.2-2.8 6.8-7.4 6.2Z" fill="{grad}"/>',
  line('M10.4 6.6c1.8.6 3.4 2 4.4 3.6', '{light}', 1.1)]);
add('popravke', 'Popravke', 'usluge', 'green', [
  '<g transform="rotate(-45 16 16)"><path d="M13.8 12.6h4.4v14c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2Z" fill="' + INK + '"/><path d="M13.8 11.8h4.4v14c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2Z" fill="' + METAL + '"/>'
  + '<path d="M11 4.8c0-.6.5-1 1.1-.8l1.7.6v3.6h4.4V4.6l1.7-.6c.6-.2 1.1.2 1.1.8v4.4c0 2.8-2.2 5-5 5s-5-2.2-5-5Z" fill="' + METAL + '"/>'
  + '<path d="M15 14.4v10.8" stroke="#C5CDC7" stroke-width="1" stroke-linecap="round"/></g>',
  '<circle cx="24.6" cy="23.6" r="4.6" fill="{edge}"/><circle cx="24.6" cy="22.8" r="4.6" fill="{grad}"/>', line('m22.4 22.8 1.6 1.6 3-3', WHITE, 1.6)]);
add('montaza', 'Montaža', 'usluge', 'green', [
  '<rect x="4.6" y="5.4" width="15.4" height="22.4" rx="1.8" fill="{edge}"/><rect x="4.6" y="4.6" width="15.4" height="22.4" rx="1.8" fill="{grad}"/>',
  '<rect x="6.6" y="6.6" width="11.4" height="8.6" rx="1" fill="{soft}"/><rect x="6.6" y="16.6" width="11.4" height="8.6" rx="1" fill="{soft}"/>',
  line('M9.4 10.8h5.8M9.4 20.8h5.8', '{light}', 1.4),
  '<g transform="rotate(35 24 18)"><rect x="22.8" y="9" width="2.4" height="11" rx="1.2" fill="' + STEEL + '"/><rect x="21.8" y="19.6" width="4.4" height="8.4" rx="2.2" fill="#CF5B12"/><rect x="21.8" y="19" width="4.4" height="8.2" rx="2.2" fill="#F78028"/></g>']);
add('prevoz', 'Prevoz', 'usluge', 'green', [
  body('M7 21.4v-9.9C7 10.1 8.1 9 9.5 9h13c1.1 0 2.1.6 2.7 1.5l3.6 5.4c.4.5.6 1.1.6 1.8v3.7c0 .9-.7 1.6-1.6 1.6H8.6c-.9 0-1.6-.7-1.6-1.6Z',
    'M7 22.8v-9.9c0-1.4 1.1-2.5 2.5-2.5h13c1.1 0 2.1.6 2.7 1.5l3.6 5.4c.4.5.6 1.1.6 1.8v3.7c0 .9-.7 1.6-1.6 1.6H8.6c-.9 0-1.6-.7-1.6-1.6Z'),
  '<path d="M20 10.8h2.6c.5 0 1 .3 1.3.7l2.6 4H20Z" fill="{soft}"/>', line('M1.8 12.6h3.4M1 16.4h4.2M1.8 20.2h3.4', '#F78028', 1.6),
  wheel(11.8, 23, 3.4), wheel(24.4, 23, 3.4)]);
add('kupovina', 'Kupovina', 'usluge', 'orange', [
  line('M11.6 12.4V9.6c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v2.8', '#077958', 1.9),
  body('M7.4 11.4h17.2l1.2 14.4c.1 1.4-1 2.6-2.4 2.6H8.6c-1.4 0-2.5-1.2-2.4-2.6Z', 'M7.4 12.6h17.2l1.2 14.4c.1 1.4-1 2.6-2.4 2.6H8.6c-1.4 0-2.5-1.2-2.4-2.6Z'),
  shine('M9.4 14.4v8'), '<circle cx="11.6" cy="15.2" r="1.2" fill="' + DARK + '"/><circle cx="20.4" cy="15.2" r="1.2" fill="' + DARK + '"/>']);
add('dostava', 'Dostava', 'usluge', 'orange', [box(4, 11.4, 16.4, 14.4),
  '<path d="M24.6 22.4s5-4.8 5-8.6a5 5 0 0 0-10 0c0 3.8 5 8.6 5 8.6Z" fill="#077958"/><path d="M24.6 21.4s5-4.8 5-8.6a5 5 0 0 0-10 0c0 3.8 5 8.6 5 8.6Z" fill="#079C77"/>',
  '<circle cx="24.6" cy="12.8" r="1.9" fill="#FFFFFF"/>']);
add('racunar-pomoc', 'Pomoć oko računara', 'usluge', 'green', [
  '<rect x="3.6" y="6.4" width="20" height="13.8" rx="2" fill="' + DARK + '"/>', '<rect x="5.2" y="8" width="16.8" height="10.6" rx="1" fill="{soft}"/>',
  line('M8 11h8M8 13.6h11.2M8 16.2h6', '{light}', 1.3), '<path d="M.8 21.6h25.6l-1.4 2.9c-.2.5-.7.8-1.2.8H3.4c-.5 0-1-.3-1.2-.8Z" fill="' + STEEL + '"/>',
  '<circle cx="25" cy="21.6" r="5.2" fill="#CF5B12"/><circle cx="25" cy="20.8" r="5.2" fill="#F78028"/>',
  '<circle cx="25" cy="20.8" r="1.9" fill="none" stroke="#FFFFFF" stroke-width="1.5"/>', line('M25 16.9v1.4M25 23.3v1.4M21.1 20.8h1.4M27.5 20.8h1.4', WHITE, 1.4)]);
add('ljubimci', 'Čuvanje ljubimca', 'usluge', 'orange', [
  '<path d="M16 16.4c-4 0-7.4 3.4-7.4 6.6 0 2.4 2 3.6 4 3.6 1.4 0 2.2-.8 3.4-.8s2 .8 3.4.8c2 0 4-1.2 4-3.6 0-3.2-3.4-6.6-7.4-6.6Z" fill="{edge}"/>',
  '<path d="M16 15.4c-4 0-7.4 3.4-7.4 6.6 0 2.4 2 3.6 4 3.6 1.4 0 2.2-.8 3.4-.8s2 .8 3.4.8c2 0 4-1.2 4-3.6 0-3.2-3.4-6.6-7.4-6.6Z" fill="{grad}"/>',
  '<ellipse cx="7" cy="13.6" rx="2.6" ry="3.4" transform="rotate(-20 7 13.6)" fill="{grad}"/>', '<ellipse cx="12.4" cy="8.6" rx="2.6" ry="3.4" transform="rotate(-8 12.4 8.6)" fill="{grad}"/>',
  '<ellipse cx="19.6" cy="8.6" rx="2.6" ry="3.4" transform="rotate(8 19.6 8.6)" fill="{grad}"/>', '<ellipse cx="25" cy="13.6" rx="2.6" ry="3.4" transform="rotate(20 25 13.6)" fill="{grad}"/>',
  shine('M11.8 19.4a4.6 4.6 0 0 1 2.6-1.6')]);
add('ucenje', 'Časovi i učenje', 'usluge', 'green', [
  '<path d="M16 9.4c-3.4-2.4-7.6-3-11.6-2.2v17.4c4-.8 8.2-.2 11.6 2.2 3.4-2.4 7.6-3 11.6-2.2V7.2C23.6 6.4 19.4 7 16 9.4Z" fill="{edge}"/>',
  '<path d="M16 8.6C12.6 6.2 8.4 5.6 4.4 6.4v17.4c4-.8 8.2-.2 11.6 2.2 3.4-2.4 7.6-3 11.6-2.2V6.4c-4-.8-8.2-.2-11.6 2.2Z" fill="{grad}"/>',
  '<path d="M16 8.6C12.6 6.2 8.4 5.6 5.6 6.2v16.4c3.6-.4 7.4.4 10.4 2.6Z" fill="#FFFFFF"/>', '<path d="M16 8.6c3-2.2 6.8-3 10.4-2.4v16.4c-3.6-.4-7.4.4-10.4 2.6Z" fill="#F4F7F5"/>',
  line('M8.2 11h4.6M8.2 14h4.6M8.2 17h3.4M19.2 11h4.6M19.2 14h4.6', '#9AA59D', 1.1), '<path d="M21.6 5.6h3v6.4l-1.5-1.2-1.5 1.2Z" fill="#F78028"/>']);
add('stariji', 'Pomoć starijima', 'usluge', 'orange', [
  line('M8.6 27.6V11.4c0-2.6 2-4.6 4.4-4.6s4.4 2 4.4 4.4', DARK, 2.2),
  '<path d="M22 27s-7.4-4.6-7.4-9.6c0-2.2 1.7-3.8 3.7-3.8 1.5 0 2.7.8 3.7 2 1-1.2 2.2-2 3.7-2 2 0 3.7 1.6 3.7 3.8 0 5-7.4 9.6-7.4 9.6Z" fill="{edge}"/>',
  '<path d="M22 26s-7.4-4.6-7.4-9.6c0-2.2 1.7-3.8 3.7-3.8 1.5 0 2.7.8 3.7 2 1-1.2 2.2-2 3.7-2 2 0 3.7 1.6 3.7 3.8 0 5-7.4 9.6-7.4 9.6Z" fill="{grad}"/>',
  shine('M16.6 16.4a2.4 2.4 0 0 1 1.8-1.6')]);
add('cuvanje', 'Čuvanje dece', 'usluge', 'green', [
  '<path d="M6 16.4h19.6c0 4.8-3.8 8.4-8.6 8.4h-2.4C9.8 24.8 6 21.2 6 16.4Z" fill="{edge}"/>', '<path d="M6 15.6h19.6c0 4.8-3.8 8.4-8.6 8.4h-2.4C9.8 24 6 20.4 6 15.6Z" fill="{grad}"/>',
  '<path d="M6 15.6C6 9.8 10.4 5.4 16 5.4v10.2Z" fill="#F78028"/>', shine('M8.6 18.4a6 6 0 0 0 3 3.4'), line('M25.6 15.6 28.4 9.4h2', INK, 1.8),
  wheel(10.4, 27, 2.4), wheel(21.6, 27, 2.4)]);
add('fizicki', 'Fizička ispomoć', 'usluge', 'orange', [
  body('M9.4 27.6V15.6c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8V11c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v-1c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v1.6c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v9.8c0 3.4-2.8 6.2-6.2 6.2Z',
    'M9.4 28.8V16.8c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v-4.6c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v-1c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v1.6c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v9.8c0 3.4-2.8 6.2-6.2 6.2Z'),
  '<path d="M9.4 21.6c-2.6-1.4-4.6-.6-5 .8-.3 1.2.5 2.2 1.8 2.6l3.2 1.2Z" fill="{grad}"/>', '<rect x="9" y="26.2" width="14.2" height="2.6" rx="1.2" fill="#079C77"/>',
  line('M13 12.2v4M16.6 11.2v4.6M20.2 11.8v4', '{edge}', 1)]);
add('admin', 'Administrativna pomoć', 'usluge', 'green', [
  '<path d="M4 8.6c0-1.1.9-2 2-2h6l2 2.4h12c1.1 0 2 .9 2 2v14.4c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2Z" fill="{edge}"/>',
  '<rect x="8" y="5" width="15.6" height="14" rx="1.2" fill="#FFFFFF" stroke="#CCD4CE" stroke-width="1"/>', line('M10.8 8.4h10M10.8 11.2h7', '#9AA59D', 1.2),
  '<path d="M4 15.4c0-1.1.9-2 2-2h20c1.1 0 2 .9 2 2v9.8c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2Z" fill="{grad}"/>', shine('M6.8 16.6h6'),
  '<rect x="13.6" y="19" width="4.8" height="2.4" rx="1.2" fill="#FFFFFF" opacity="0.85"/>']);
add('ostalo', 'Ostalo', 'usluge', 'green', [
  '<rect x="5" y="5" width="9.6" height="9.6" rx="3" fill="{grad}"/>', '<rect x="17.4" y="5" width="9.6" height="9.6" rx="3" fill="#F78028"/>',
  '<rect x="5" y="17.4" width="9.6" height="9.6" rx="3" fill="#FFBE85"/>', '<rect x="17.4" y="17.4" width="9.6" height="9.6" rx="3" fill="{soft}" stroke="{light}" stroke-width="1"/>',
  '<circle cx="22.2" cy="22.2" r="1" fill="{front}"/><circle cx="19.6" cy="22.2" r="1" fill="{front}"/><circle cx="24.8" cy="22.2" r="1" fill="{front}"/>']);

// ── Ljudi i kapacitet ──────────────────────────────────────────────────────────────────────────────────────────
const person = (cx, cy, s, tone = '{grad}', edge = '{edge}') => {
  const r = 3.6 * s, bw = 8.4 * s, bh = 7 * s;
  return `<circle cx="${cx}" cy="${cy - bh + 0.6}" r="${r}" fill="${edge}"/><circle cx="${cx}" cy="${cy - bh}" r="${r}" fill="${tone}"/>`
    + `<path d="M${cx - bw / 2} ${cy + bh * 0.9}v-${(bh * 0.55).toFixed(2)}a${bw / 2} ${bw / 2} 0 0 1 ${bw} 0v${(bh * 0.55).toFixed(2)}Z" fill="${tone}"/>`;
};
add('osoba', 'Jedna osoba', 'ljudi', 'orange', [person(16, 16, 1.5)]);
add('dve-osobe', 'Dve osobe', 'ljudi', 'orange', [person(21.6, 16.4, 1.2, '{soft}', '{light}'), person(11.4, 17.6, 1.35)]);
add('tim', 'Tim', 'ljudi', 'orange', [person(7.8, 17.4, 1.05, '{soft}', '{light}'), person(24.2, 17.4, 1.05, '{soft}', '{light}'), person(16, 18.6, 1.3)]);
add('sedista', 'Broj sedišta', 'ljudi', 'green', [
  '<path d="M9.6 5.6c0-1.1.9-2 2-2h3.6c1.1 0 2 .9 2 2v12.6H9.6Z" fill="{edge}"/>', '<path d="M9.6 4.8c0-1.1.9-2 2-2h3.6c1.1 0 2 .9 2 2v12.4H9.6Z" fill="{grad}"/>',
  '<path d="M8.6 18.6h13.6c1.2 0 2.2 1 2.2 2.2v1.6c0 .7-.5 1.2-1.2 1.2H9.4c-.9 0-1.6-.7-1.6-1.6v-2.6c0-.4.3-.8.8-.8Z" fill="{grad}"/>',
  line('M12 24.6v3.4M20 24.6v3.4', INK, 1.8), shine('M11.4 6v8'),
  '<circle cx="25.4" cy="8.6" r="4.8" fill="#CF5B12"/><circle cx="25.4" cy="7.8" r="4.8" fill="#F78028"/>', line('M23.2 7.8h4.4M25.4 5.6V10', WHITE, 1.5)]);
add('nosivost', 'Nosivost', 'ljudi', 'green', [
  '<rect x="3.6" y="23.6" width="24.8" height="3.8" rx="1.9" fill="' + INK + '"/><rect x="3.6" y="22.8" width="24.8" height="3.8" rx="1.9" fill="' + METAL + '"/>',
  line('M6.4 24.2h4', '#C5CDC7', 1.1),
  '<rect x="8.6" y="10.4" width="14.8" height="12" rx="1.6" fill="#CF5B12"/><rect x="8.6" y="9.6" width="14.8" height="12" rx="1.6" fill="#F78028"/>',
  '<rect x="14.8" y="9.6" width="2.4" height="12" fill="#FFBE85" opacity="0.8"/>',
  '<circle cx="26" cy="7.6" r="4.4" fill="{edge}"/><circle cx="26" cy="6.8" r="4.4" fill="{grad}"/>', line('M26 4.6v4.2M24.2 7.2 26 9l1.8-1.8', WHITE, 1.5)]);
add('kapacitet', 'Kapacitet vozila', 'ljudi', 'green', [
  body('M3 21.4v-9.9C3 10.1 4.1 9 5.5 9h16c1.1 0 2.1.6 2.7 1.5l4.2 6.1c.4.5.6 1.1.6 1.8v3c0 .9-.7 1.6-1.6 1.6H4.6c-.9 0-1.6-.7-1.6-1.6Z',
    'M3 22.8v-9.9c0-1.4 1.1-2.5 2.5-2.5h16c1.1 0 2.1.6 2.7 1.5l4.2 6.1c.4.5.6 1.1.6 1.8v3c0 .9-.7 1.6-1.6 1.6H4.6c-.9 0-1.6-.7-1.6-1.6Z'),
  '<rect x="4.8" y="10.8" width="12.4" height="9.4" rx="1" fill="#FFFFFF"/>',
  '<rect x="6" y="14.8" width="5" height="4.6" rx=".8" fill="#F78028"/><rect x="11.4" y="15.8" width="4.6" height="3.6" rx=".8" fill="#FFBE85"/><rect x="7.6" y="11.4" width="4.4" height="3.4" rx=".8" fill="#CF5B12"/>',
  '<path d="M18.6 10.8h2.8c.5 0 1 .3 1.3.7l3.2 4.7h-7.3Z" fill="{soft}"/>', wheel(8.5, 23, 3.6), wheel(23.5, 23, 3.6)]);
add('pomocnik', 'Dostupan pomoćnik', 'ljudi', 'orange', [person(14, 16.6, 1.45), badgeCheck(24.4, 8.6)]);
add('ekipa', 'Dostupna ekipa', 'ljudi', 'orange', [person(6.8, 18, 1, '{soft}', '{light}'), person(20.8, 18, 1, '{soft}', '{light}'), person(13.8, 19.2, 1.22), badgeCheck(25, 7.6)]);

// Reusable tone values live in src/theme/colorTokens.ts; the native generator reads them through sys.
module.exports = { K };

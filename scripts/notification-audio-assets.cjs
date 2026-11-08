'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

// Original deterministic synthesis; no recordings, downloaded samples or melodies.
// The three cues share a soft bell timbre. They are native-resource candidates;
// the existing server still routes to the user's unchanged default channel.
const SAMPLE_RATE = 22050;
const CUES = Object.freeze([
 { file: 'uskoci_message_v1.wav', duration: 0.24, notes: [[0, 880, 0.20, 0.15]] },
 { file: 'uskoci_opportunity_v1.wav', duration: 0.42, notes: [[0, 659.255, 0.24, 0.13], [0.12, 880, 0.26, 0.12]] },
 { file: 'uskoci_confirm_v1.wav', duration: 0.46, notes: [[0, 659.255, 0.24, 0.11], [0.11, 880, 0.25, 0.10], [0.21, 987.767, 0.21, 0.09]] },
]);
const SOUND_ASSETS = Object.freeze(CUES.map(cue => `./assets/audio/${cue.file}`));

function synthesize(cue) {
 const samples = Math.round(cue.duration * SAMPLE_RATE), pcm = Buffer.alloc(samples * 2);
 for (let i = 0; i < samples; i++) {
  const now = i / SAMPLE_RATE;
  let value = 0;
  for (const [start, frequency, duration, gain] of cue.notes) {
   const t = now - start;
   if (t < 0 || t >= duration) continue;
   const attack = Math.min(1, t / 0.008);
   const release = Math.min(1, (duration - t) / 0.045);
   const envelope = attack * release * Math.exp(-7 * t);
   value += gain * envelope * (Math.sin(2 * Math.PI * frequency * t)
    + 0.22 * Math.sin(2 * Math.PI * frequency * 2 * t)
    + 0.07 * Math.sin(2 * Math.PI * frequency * 3 * t));
  }
  if (Math.abs(value) >= 1) throw Error('SYNTHESIS_CLIPPING');
  pcm.writeInt16LE(Math.round(value * 32767), i * 2);
 }
 const header = Buffer.alloc(44);
 header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
 header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
 header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 2, 28);
 header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36);
 header.writeUInt32LE(pcm.length, 40);
 return Buffer.concat([header, pcm]);
}

if (require.main === module) {
 const root = path.resolve(__dirname, '..');
 fs.mkdirSync(path.join(root, 'assets/audio'), { recursive: true });
 for (const cue of CUES) {
  const bytes = synthesize(cue);
  fs.writeFileSync(path.join(root, 'assets/audio', cue.file), bytes);
  console.log(JSON.stringify({ file: cue.file, bytes: bytes.length, seconds: cue.duration,
   sha256: createHash('sha256').update(bytes).digest('hex') }));
 }
}
module.exports = { CUES, SOUND_ASSETS, SAMPLE_RATE, synthesize };

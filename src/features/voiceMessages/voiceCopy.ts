/** Plain Serbian for the voice message flow: no grammatical gender, no server wording, one sentence each. */
export type VoiceErrorCode =
  | 'MIC_PERMISSION_DENIED' | 'MIC_PERMISSION_BLOCKED' | 'MIC_UNAVAILABLE' | 'RECORDING_FAILED' | 'RECORDING_TOO_SHORT' | 'RECORDING_INTERRUPTED'
  | 'RECORDING_INVALID' | 'NOT_AVAILABLE' | 'VERSION_CHANGED' | 'UPLOAD_UNCONFIRMED' | 'SEND_NOT_STORED' | 'OUTCOME_UNKNOWN'
  | 'PLAYBACK_FAILED' | 'PLAYBACK_UNAVAILABLE';

export const VOICE_ERROR_COPY: Readonly<Record<VoiceErrorCode, string>> = {
  MIC_PERMISSION_DENIED: 'Mikrofon nije dozvoljen. Dozvolu možeš da promeniš u podešavanjima telefona.',
  MIC_PERMISSION_BLOCKED: 'Mikrofon je isključen u podešavanjima telefona. Uključi ga za glasovnu poruku.',
  MIC_UNAVAILABLE: 'Mikrofon trenutno nije dostupan.',
  RECORDING_FAILED: 'Snimanje nije uspelo. Pokušaj ponovo.',
  RECORDING_TOO_SHORT: 'Snimak je prekratak. Drži malo duže.',
  RECORDING_INTERRUPTED: 'Snimanje je prekinuto. Možeš da preslušaš šta je snimljeno.',
  RECORDING_INVALID: 'Snimak nije ispravan. Snimi ponovo.',
  NOT_AVAILABLE: 'U ovom Dogovoru trenutno ne možeš da šalješ poruke.',
  VERSION_CHANGED: 'Uslovi Dogovora su se promenili. Osveži Dogovor pa snimi ponovo.',
  UPLOAD_UNCONFIRMED: 'Ne znamo da li je snimak stigao. Pokušaj ponovo; neće se poslati dvaput.',
  SEND_NOT_STORED: 'Poruka nije sačuvana za slanje. Pokušaj ponovo.',
  OUTCOME_UNKNOWN: 'Ne znamo da li je snimak stigao. Proveri vezu i pokušaj ponovo.',
  PLAYBACK_FAILED: 'Glasovna poruka se ne može pustiti. Pokušaj ponovo.',
  PLAYBACK_UNAVAILABLE: 'Glasovna poruka trenutno nije dostupna.',
};

/** 0:07, 1:05, 12:30: minutes without a leading zero, seconds with one. Never negative, never NaN. */
export function voiceClock(milliseconds: number): string {
  const total = Number.isFinite(milliseconds) && milliseconds > 0 ? Math.floor(milliseconds / 1000) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
/** How a person hears a voice message row: who, what and how long. */
export function voiceSpoken(durationMs: number): string { return `Glasovna poruka, ${voiceClock(durationMs)}`; }
/** Shown to an older build, to a support reader and wherever the audio itself cannot be. */
export const VOICE_OLD_BUILD_NOTICE = 'Glasovna poruka. Ažuriraj aplikaciju da je poslušaš.';

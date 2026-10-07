/** Recovery credentials never become the marketplace session or a route parameter. */
export type RecoveryErrorCode =
  | 'UNCONFIGURED' | 'INVALID_EMAIL' | 'INVALID_LINK' | 'SIGNED_IN' | 'ACCOUNT_CHANGED'
  | 'BUSY' | 'VERIFY_UNAVAILABLE' | 'REQUEST_UNCONFIRMED' | 'RATE_LIMITED'
  | 'WEAK_PASSWORD' | 'SAME_PASSWORD' | 'UPDATE_UNKNOWN' | 'RESTRICTED_ACCOUNT';

const messages: Record<RecoveryErrorCode, string> = {
  UNCONFIGURED: 'Oporavak lozinke još nije podešen za ovu verziju aplikacije.',
  INVALID_EMAIL: 'Unesi ispravnu email adresu.',
  INVALID_LINK: 'Link je nevažeći ili je istekao. Zatraži novi link.',
  SIGNED_IN: 'Najpre se odjavi sa otvorenog naloga, pa ponovo otvori link za oporavak.',
  ACCOUNT_CHANGED: 'Nalog je promenjen. Ponovo otvori link za oporavak.',
  BUSY: 'Prethodni zahtev se još obrađuje.',
  VERIFY_UNAVAILABLE: 'Ne možemo da proverimo link. Proveri vezu i pokušaj ponovo.',
  REQUEST_UNCONFIRMED: 'Ne možemo da potvrdimo slanje zahteva. Proveri email pre ponovnog pokušaja.',
  RATE_LIMITED: 'Previše zahteva za kratko vreme. Sačekaj pre ponovnog pokušaja.',
  WEAK_PASSWORD: 'Nova lozinka ne ispunjava bezbednosne uslove. Izaberi dužu i manje predvidljivu lozinku.',
  SAME_PASSWORD: 'Nova lozinka mora da se razlikuje od prethodne.',
  UPDATE_UNKNOWN: 'Nije potvrđeno da li je lozinka promenjena. Pokušaj prijavu novom lozinkom ili zatraži novi link.',
  // Owner decision 2026-10-07: a restricted account is told so, not that its link expired. The screens draw it as the
  // restricted-account panel; this sentence is the same fact for anything that only reads the message.
  RESTRICTED_ACCOUNT: 'Pristup ovom nalogu je ograničen, pa oporavak lozinke trenutno nije moguć.',
};

export class PasswordRecoveryError extends Error {
  constructor(readonly code: RecoveryErrorCode) {
    super(messages[code]);
    this.name = 'PasswordRecoveryError';
  }
}

export interface RecoveryIdentity { email: string }
export interface PasswordRecoverySession {
  verify(link: string): Promise<RecoveryIdentity>;
  updatePassword(password: string): Promise<void>;
  dispose(): void;
}

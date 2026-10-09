import * as Linking from 'expo-linking';
import { passwordRecoveryIntent } from '../store/passwordRecoveryIntent';
import { signupConfirmationIntent } from '../store/signupConfirmationIntent';
import { hasSignupReturnData, signupReturnKind } from '../data/signupConfirmationReturn';
import { sesijaSada } from '../store/sesija';

/** Native OS callbacks enter through a clean route, never token-bearing params. */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  let link = path;
  if (path === '/oporavak' || path.startsWith('/oporavak#') || path.startsWith('/oporavak?')) {
    link = 'uskociapp://oporavak' + path.slice('/oporavak'.length);
  }
  if (path === '/auth' || path.startsWith('/auth#') || path.startsWith('/auth?')) {
    link = 'uskociapp://auth' + path.slice('/auth'.length);
  }
  let url: URL;
  try { url = new URL(link); } catch { return path; }
  if (url.protocol === 'uskociapp:' && url.hostname === 'auth' && hasSignupReturnData(url)) {
    try { Linking.clearInitialURL(); } catch { /* No credential is handed to Router. */ }
    const previous = signupConfirmationIntent.snapshot();
    if (sesijaSada().user) {
      if (previous) signupConfirmationIntent.clear(previous.id);
      return initial ? '/' : null;
    }
    signupConfirmationIntent.publish(signupReturnKind(link, 'uskociapp://auth?form=login'));
    return '/auth?form=login';
  }
  if (url.protocol !== 'uskociapp:' || url.hostname !== 'oporavak') return path;
  passwordRecoveryIntent.publish(link);
  try { Linking.clearInitialURL(); } catch { /* The transient handoff already owns this callback. */ }
  return '/oporavak';
}

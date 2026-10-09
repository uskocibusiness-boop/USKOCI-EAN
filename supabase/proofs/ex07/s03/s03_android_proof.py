"""EX-07 S03 - the REAL app on a DISPOSABLE Android emulator, against the DISPOSABLE GoTrue + Mailpit.

The scenarios (docs: EX07_S03_AUTH_CALLBACKS_PROOF_20261002.md):
  G1 fresh install: UI sign-up -> confirmation stage -> Mailpit message -> UI resend and its limit -> the confirmation link
     opened WARM (app in the background) -> the app adopts no session -> login -> signed in.
  G2 with that account signed in: a confirmation callback of ANOTHER account; a recovery callback of another account (refused,
     and applied at the provider as a positive control); the same, now OLD, callback replayed.
  G3 signed out (app data cleared, emulator only): sign-in before confirmation is refused; used / wrong / expired confirmation
     callbacks open the login form; the cold confirmation callback opens the login form; recovery in the UI; replay of the used
     recovery callback (observation); sign-in after confirmation.
  Final: the logcat of the whole run and the app's private storage are searched for every callback credential.

Evidence level: DISPOSABLE EMULATOR evidence. NOT the hosted provider, NOT a physical handset, NOT iOS, NOT real e-mail delivery.
Run inside the emulator step of .github/workflows/ex07-s03-auth-callbacks-proof.yml:  python3 s03_android_proof.py
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Callable, Optional

import s03_core as core
import s03_http as net
import s03_provider_proof as prov
from s03_device import Adb, Device, RefusedDevice, Screen, UiTimeout

HERE = Path(__file__).resolve().parent
LOGIN_URL = core.SIGNUP_REDIRECT                  # uskociapp://auth?form=login: what the provider opens after a confirmation
AUTH_STATES = tuple(sorted(core.AUTH_SURFACE_STATES))
OPORAVAK_REFUSAL_STATES = ('OPORAVAK_SIGNED_IN', 'OPORAVAK_FORM', 'OPORAVAK_INVALID', 'OPORAVAK_SUCCESS')


class Precondition(RuntimeError):
    """An earlier scenario did not leave the state this one needs: the checks are NOT_RUN, not ERROR and not FAIL."""


class AndroidCtx(prov.Ctx):
    def __init__(self, gt: net.GoTrue, mail: net.Mailbox, clock: net.Clock, report: core.Report, secrets: core.SecretSet,
                 dev: Device, suffix: Optional[str] = None) -> None:
        super().__init__(gt, mail, clock, report, secrets, suffix)
        self.dev = dev
        self.ui_account: Optional[prov.Account] = None
        self.latest_link: Optional[net.VerifyLink] = None
        self.ui_signup_at: float = 0.0
        self.signed_in_account: Optional[prov.Account] = None
        self.u3: Optional[tuple[prov.Account, net.VerifyLink]] = None
        self.u3_success_location: Optional[str] = None
        self.cold_account: Optional[prov.Account] = None
        self.app_scans: list[dict[str, Any]] = []


# ------------------------------------------------------------------------------------------------ helpers
def callback_for(ctx: AndroidCtx, acct: prov.Account, kind: str, redirect: str) -> tuple[net.VerifyLink, net.VerifyOutcome]:
    """Mailbox -> provider verify (the redirect is READ, never followed) -> the callback the OS would hand to the app."""
    link, _ = prov.mail_link(ctx, acct, kind)
    out = ctx.gt.follow_verify(link.url, redirect)
    if out.callback:
        ctx.secrets.add_callback(out.callback)
    return link, out


def session_ids(view: Optional[dict[str, Any]]) -> Optional[list[tuple[Any, Any, Any]]]:
    if view is None:
        return None
    return sorted((s.user_id, s.access_fp, s.refresh_fp) for s in view['sessions'])


def signed_in_as(ctx: AndroidCtx, user_id: Optional[str], timeout: float = 30.0) -> Optional[bool]:
    """True/False once the app's storage is readable (the session is written asynchronously); None if it cannot be read."""
    deadline = ctx.clock.now() + timeout
    while True:
        view = ctx.dev.read_storage()
        if view is None:
            return None
        if user_id and user_id in view['userIds']:
            return True
        if ctx.clock.now() >= deadline:
            return False
        ctx.clock.sleep(1.0)


def no_session_stored(ctx: AndroidCtx) -> Optional[bool]:
    view = ctx.dev.read_storage()
    return None if view is None else not view['hasSession']


def submit_ready(ctx: AndroidCtx, screen: Screen) -> bool:
    row = ctx.dev.labels.row('login.submit')
    return core.find_target([n for n in screen.nodes if n.pkg == ctx.dev.package], row['text'], match=row['match']) is not None


def open_login_cold(ctx: AndroidCtx) -> Screen:
    ctx.dev.open_link(LOGIN_URL, cold=True)
    return ctx.dev.wait_for_state('LOGIN_FORM', timeout=90)


def fill_login(ctx: AndroidCtx, acct: prov.Account, password: Optional[str] = None) -> None:
    ctx.dev.set_field('login.field.email', acct.email)
    ctx.dev.set_field('login.field.password', password or acct.password)


def sign_in_succeeds(ctx: AndroidCtx, acct: prov.Account) -> bool:
    """On the login form: type the credentials, press Prijavi se, and see the auth surface go away."""
    scr = ctx.dev.wait_for_state('LOGIN_FORM', timeout=45)
    if scr.state != 'LOGIN_FORM':
        raise UiTimeout('NOT_ON_LOGIN_FORM state=' + scr.state)
    fill_login(ctx, acct)
    ctx.dev.tap('login.submit')
    ctx.clock.sleep(1.5)
    after = ctx.dev.wait_until(lambda s: s.state != 'LOGIN_FORM', timeout=45)
    return after.state != 'LOGIN_FORM'


def sign_in_is_refused(ctx: AndroidCtx, acct: prov.Account) -> bool:
    """The same, for credentials the provider refuses: the login form stays and its button comes back."""
    scr = ctx.dev.wait_for_state('LOGIN_FORM', timeout=45)
    if scr.state != 'LOGIN_FORM':
        raise UiTimeout('NOT_ON_LOGIN_FORM state=' + scr.state)
    fill_login(ctx, acct)
    ctx.dev.tap('login.submit')
    ctx.clock.sleep(6.0)
    after = ctx.dev.wait_until(lambda s: s.state != 'LOGIN_FORM' or submit_ready(ctx, s), timeout=25)
    return after.state == 'LOGIN_FORM'


def checkpoint(ctx: AndroidCtx, name: str) -> None:
    """Search the app's private directory for every callback credential seen so far."""
    scan = ctx.dev.scan_app_data()
    ctx.app_scans.append({'after': name, 'available': scan is not None, 'files': (scan or {}).get('files'),
                          'matches': (scan or {}).get('matches', [])})


def new_password() -> str:
    import secrets as _s
    return _s.token_hex(12) + 'Bb7'


# ------------------------------------------------------------------------------------------------ scenarios
def s_fixtures(ctx: AndroidCtx) -> None:
    """Start the 60 s clock of the link that must EXPIRE before anything else runs."""
    x = ctx.account('expired-signup')
    prov.signup(ctx, x)
    link, _ = prov.mail_link(ctx, x)
    ctx.expiry['signup'] = (x, link, ctx.clock.now())


def s_g1a_open_login(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    scr = open_login_cold(ctx)
    r.expect('E01', scr.state == 'LOGIN_FORM', 'cold uskociapp://auth?form=login', state=scr.state)
    dev.shot('01-login-form')
    if scr.state != 'LOGIN_FORM':
        raise Precondition('login form not reached')


def s_g1a_signup_ui(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    if dev.screen().state != 'LOGIN_FORM':
        raise Precondition('login form not reached')
    a = ctx.account('ui')
    ctx.ui_account = a
    dev.tap('login.to_signup')
    scr = dev.wait_for_state('SIGNUP_FORM', timeout=30)
    if scr.state != 'SIGNUP_FORM':
        raise UiTimeout('SIGNUP_FORM_NOT_REACHED state=' + scr.state)
    for label_id, value in (('signup.field.first', 'Test'), ('signup.field.last', 'Proof'), ('signup.field.city', 'Beograd'),
                            ('login.field.email', a.email), ('login.field.password', a.password)):
        dev.set_field(label_id, value)
    dev.shot('02-signup-form')
    t_signup = ctx.clock.now()
    dev.tap('signup.submit')
    scr = dev.wait_for_state('CONFIRMATION_STAGE', timeout=60)
    dev.shot('03-confirmation-stage')
    msgs = ctx.mail.wait_new(a.email, ctx.known)
    ctx.known.update(m['ID'] for m in msgs if m.get('ID'))
    links = [link for m in msgs for link in core.verify_links(m) if link.kind == 'signup']
    link1 = links[0] if links else None
    ctx.latest_link = link1
    ctx.ui_signup_at = t_signup
    stored = no_session_stored(ctx)
    ok = (scr.state == 'CONFIRMATION_STAGE' and link1 is not None and link1.redirect_to == core.SIGNUP_REDIRECT
          and len(msgs) == 1 and stored is not False)
    r.expect('E02', ok, 'UI sign-up, confirmation stage, message and redirect', state=scr.state, messages=len(msgs),
             redirectTo=(link1.redirect_to if link1 else None), sessionStored=(None if stored is None else (not stored)))
    if stored is None:
        r.unavailable('E02', 'the app private storage is not readable (run-as): the "no session" half is not verified')


def s_g1b_resend_ui(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    a = ctx.ui_account
    if a is None or not ctx.ui_signup_at or ctx.dev.screen().state != 'CONFIRMATION_STAGE':
        raise Precondition('the confirmation stage is not on screen')
    ctx.clock.sleep_until(ctx.ui_signup_at + core.MAX_FREQUENCY_SECONDS + 1.5)    # past the provider's per-address frequency window
    dev.tap('confirm.resend')
    accepted = dev.wait_for_label('confirm.resend_accepted', 30)
    dev.tap('confirm.resend')                                                # inside the window of the resend just accepted
    limited = dev.wait_for_label('confirm.rate_limited', 30)
    dev.shot('04-resend-limit')
    msgs = ctx.mail.wait_new(a.email, ctx.known)
    ctx.known.update(m['ID'] for m in msgs if m.get('ID'))
    ctx.clock.sleep(2.0)
    total = ctx.mail.count_for(a.email)
    links = [link for m in msgs for link in core.verify_links(m) if link.kind == 'signup']
    if links:
        ctx.latest_link = links[0]
    r.expect('E04', accepted and limited and len(msgs) == 1 and total == 2 and bool(links), 'UI resend and its limit',
             acceptedBannerSeen=accepted, rateLimitBannerSeen=limited, newMessages=len(msgs), messagesToAddress=total)


def s_g1c_warm_confirmation(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    a, link = ctx.ui_account, ctx.latest_link
    if a is None or link is None:
        raise Precondition('no confirmation link of the UI account')
    dev.home()
    out = ctx.gt.follow_verify(link.url, core.SIGNUP_REDIRECT)
    if out.callback:
        ctx.secrets.add_callback(out.callback)
    if not out.has_session_tokens or not out.location:
        raise prov.HarnessConfigError('PROVIDER_GAVE_NO_CONFIRMATION_CALLBACK')
    dev.open_link(out.location, cold=False)
    scr = dev.wait_for_state(*AUTH_STATES, timeout=60)
    observed = scr.state
    dev.shot('05-warm-confirmation-callback')
    stored = no_session_stored(ctx)
    if scr.state == 'CONFIRMATION_STAGE':
        dev.tap('confirm.back')
        scr = dev.wait_for_state('LOGIN_FORM', timeout=30)
    on_login = scr.state == 'LOGIN_FORM'
    status, _, uid, _ = prov.login_ids(ctx, a)                    # the provider's own answer for the same credentials
    a.user_id = uid or a.user_id
    signed = sign_in_succeeds(ctx, a) if on_login else False
    present = signed_in_as(ctx, a.user_id)
    ctx.signed_in_account = a if signed else None
    ok = (observed in AUTH_STATES and stored is not False and on_login and status == 200 and signed and present is not False)
    r.expect('E05', ok, 'warm confirmation callback, no session adoption, login afterwards', stateAfterCallback=observed,
             sessionStoredBeforeLogin=(None if stored is None else (not stored)), providerSignInStatus=status,
             appLeftTheAuthSurface=signed, sessionInStorage=present)
    if stored is None or present is None:
        r.unavailable('E05', 'the app private storage is not readable (run-as): session facts are not verified')
    checkpoint(ctx, 'g1')


def s_g2a_other_confirmation(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    a = ctx.signed_in_account
    if a is None:
        raise Precondition('no account is signed in')
    other = ctx.account('other-confirm')
    prov.signup(ctx, other)
    _, out = callback_for(ctx, other, 'signup', core.SIGNUP_REDIRECT)
    if not out.has_session_tokens or not out.location:
        raise prov.HarnessConfigError('PROVIDER_GAVE_NO_CONFIRMATION_CALLBACK')
    before = dev.read_storage()
    dev.open_link(out.location, cold=False)
    ctx.clock.sleep(8.0)
    scr = dev.screen()
    dev.shot('06-confirmation-of-another-account')
    after = dev.read_storage()
    on_surface = scr.state in AUTH_STATES or scr.state.startswith('OPORAVAK')
    ids_before, ids_after = session_ids(before), session_ids(after)
    same = ids_before is not None and ids_before == ids_after and (after or {}).get('userIds') == [a.user_id]
    r.expect('E08', not on_surface and (same or ids_before is None), 'confirmation callback of another account while signed in',
             stateAfter=scr.state, sessionUnchanged=(None if ids_before is None else same))
    if before is None:
        r.unavailable('E08', 'the app private storage is not readable (run-as): the session identity is not verified')
    checkpoint(ctx, 'g2a')


def s_g2b_recovery_while_signed_in(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    a = ctx.signed_in_account
    if a is None:
        raise Precondition('no account is signed in')
    victim = prov.confirm_account(ctx, 'victim')
    resp = ctx.gt.recover(victim.email, redirect=core.RECOVERY_REDIRECT)
    prov.guard_limits(resp)
    _, out = callback_for(ctx, victim, 'recovery', core.RECOVERY_REDIRECT)
    if not out.has_session_tokens or not out.location or not out.callback:
        raise prov.HarnessConfigError('PROVIDER_GAVE_NO_RECOVERY_CALLBACK')
    access = dict(out.callback.secrets)['access_token']
    original_password = victim.password
    before = dev.read_storage()

    dev.open_link(out.location, cold=False)
    scr = dev.wait_for_state(*OPORAVAK_REFUSAL_STATES, timeout=45)
    dev.shot('07-recovery-callback-while-signed-in')
    no_form = not dev.labels.has(scr.nodes, 'oporavak.field.new')
    s_victim, _, uid_victim, _ = prov.login_ids(ctx, victim, original_password)
    s_a, _, uid_a, _ = prov.login_ids(ctx, a)
    after = dev.read_storage()
    unchanged = session_ids(before) == session_ids(after)
    control_password = new_password()
    put = ctx.gt.put_user(access, control_password)                              # positive control: the callback was valid
    control = put.status == 200
    r.expect('E10', scr.state == 'OPORAVAK_SIGNED_IN' and no_form and s_victim == 200 and uid_victim == victim.user_id
             and s_a == 200 and uid_a == a.user_id and unchanged and control,
             'recovery callback of another account while signed in', screenState=scr.state, passwordFormShown=(not no_form),
             victimOriginalPasswordStillWorks=(s_victim == 200), signedInAccountPasswordStillWorks=(s_a == 200),
             sessionUnchanged=unchanged, callbackWasValidAtTheProvider=control)
    if before is None:
        r.unavailable('E10', 'the app private storage is not readable (run-as): the session identity is not verified')
    victim.password = control_password if control else victim.password

    # the same callback is OLD now (used at the provider): the app must still not let it touch anybody
    if dev.labels.has(dev.screen().nodes, 'oporavak.back_app'):
        dev.tap('oporavak.back_app')
        dev.wait_for_state('OTHER', timeout=30)
    before2 = dev.read_storage()
    dev.open_link(out.location, cold=False)
    scr2 = dev.wait_for_state(*OPORAVAK_REFUSAL_STATES, timeout=45)
    dev.shot('08-old-recovery-callback-while-signed-in')
    s_new, _, uid_new, _ = prov.login_ids(ctx, victim)                            # the password the control set
    s_old, code_old, _, _ = prov.login_ids(ctx, victim, original_password)
    s_a2, _, uid_a2, _ = prov.login_ids(ctx, a)
    after2 = dev.read_storage()
    r.expect('E11', scr2.state == 'OPORAVAK_SIGNED_IN' and not dev.labels.has(scr2.nodes, 'oporavak.field.new')
             and s_new == 200 and uid_new == victim.user_id and s_old == 400 and s_a2 == 200 and uid_a2 == a.user_id
             and session_ids(before2) == session_ids(after2),
             'old (used) recovery callback replayed while another account is signed in', screenState=scr2.state,
             victimPasswordIsTheControlOne=(s_new == 200), victimOriginalPasswordRefused=(s_old == 400),
             signedInAccountPasswordStillWorks=(s_a2 == 200))
    if before2 is None:
        r.unavailable('E11', 'the app private storage is not readable (run-as): the session identity is not verified')
    if dev.labels.has(dev.screen().nodes, 'oporavak.back_app'):
        dev.tap('oporavak.back_app')
    checkpoint(ctx, 'g2b')


def s_g3a_unconfirmed_refused(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    dev.force_stop()
    dev.clear_app_data()                       # emulator only, this package only, CI only (core.may_clear_app_data)
    scr = open_login_cold(ctx)
    if scr.state != 'LOGIN_FORM':
        raise Precondition('signed-out login form not reached after clearing the app data')
    u3 = ctx.account('u3')
    prov.signup(ctx, u3)
    link, _ = prov.mail_link(ctx, u3)
    ctx.u3 = (u3, link)
    refused = sign_in_is_refused(ctx, u3)
    dev.shot('09-unconfirmed-sign-in')
    stored = no_session_stored(ctx)
    r.expect('E03', refused and stored is not False, 'sign-in before confirmation', staysOnLoginForm=refused,
             sessionStored=(None if stored is None else (not stored)))
    if stored is None:
        r.unavailable('E03', 'the app private storage is not readable (run-as): the "no session" half is not verified')


def s_g3b_error_callbacks(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    if ctx.u3 is None or 'signup' not in ctx.expiry:
        raise Precondition('no unconfirmed account to build the callbacks from')
    u3, link_u3 = ctx.u3
    first = ctx.gt.follow_verify(link_u3.url, core.SIGNUP_REDIRECT)           # confirms u3; the SECOND use is the "used" link
    if first.callback:
        ctx.secrets.add_callback(first.callback)
    if first.has_session_tokens and first.location:
        ctx.u3_success_location = first.location
        ctx.cold_account = u3
    used = ctx.gt.follow_verify(link_u3.url, core.SIGNUP_REDIRECT)
    w = ctx.account('wrong')
    prov.signup(ctx, w)
    link_w, _ = prov.mail_link(ctx, w)
    wrong = ctx.gt.follow_verify(core.tamper_token(link_w.url), core.SIGNUP_REDIRECT)
    x, link_x, t_x = ctx.expiry['signup']
    ctx.clock.sleep_until(t_x + core.OTP_EXPIRY_SECONDS + 3.0)
    expired = ctx.gt.follow_verify(link_x.url, core.SIGNUP_REDIRECT)
    results: dict[str, Any] = {}
    executed_ok: list[bool] = []
    skipped: list[str] = []
    for name, outcome in (('used', used), ('wrong', wrong), ('expired', expired)):
        if not outcome.refused or outcome.kind != 'REDIRECT' or not outcome.location:
            results[name] = {'skipped': 'the provider did not answer with an error redirect', 'outcome': outcome.public()}
            skipped.append(name)
            continue
        leaks_before = len(dev.leaks)
        dev.open_link(outcome.location, cold=True)
        scr = dev.wait_for_state('LOGIN_FORM', timeout=90)
        dev.shot(f'10-{name}-link')
        stored = no_session_stored(ctx)
        clean = len(dev.leaks) == leaks_before
        results[name] = {'state': scr.state, 'sessionStored': (None if stored is None else (not stored)), 'nothingProviderSuppliedOnScreen': clean}
        executed_ok.append(scr.state == 'LOGIN_FORM' and stored is not False and clean)
    if executed_ok:
        r.expect('E07', all(executed_ok), 'error callbacks opened cold', **results)
    if skipped:
        r.not_run('E07', 'no error redirect to open for: ' + ', '.join(skipped) + ' (see P06/P07/P08)')
    if no_session_stored(ctx) is None:
        r.unavailable('E07', 'the app private storage is not readable (run-as): the "no session" half is not verified')
    checkpoint(ctx, 'g3b')


def s_g3c_cold_confirmation(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    location, u3 = ctx.u3_success_location, ctx.cold_account
    if u3 is None or not location:
        raise Precondition('no confirmation callback of the cleared-state account')
    dev.open_link(location, cold=True)
    scr = dev.wait_for_state('LOGIN_FORM', timeout=90)
    dev.shot('11-cold-confirmation-callback')
    stored = no_session_stored(ctx)
    r.expect('E06', scr.state == 'LOGIN_FORM' and stored is not False, 'cold confirmation callback opens the login form',
             state=scr.state, sessionStored=(None if stored is None else (not stored)))
    if stored is None:
        r.unavailable('E06', 'the app private storage is not readable (run-as): the "no session" half is not verified')


def s_g3d_recovery_ui(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    rec = prov.confirm_account(ctx, 'recover-ui')
    bystander = prov.confirm_account(ctx, 'bystander-ui')
    scr = open_login_cold(ctx)
    if scr.state != 'LOGIN_FORM':
        raise Precondition('signed-out login form not reached')
    dev.tap('login.forgot')
    scr = dev.wait_for_state('RECOVERY_REQUEST', timeout=30)
    if scr.state != 'RECOVERY_REQUEST':
        raise UiTimeout('RECOVERY_REQUEST_NOT_REACHED state=' + scr.state)
    dev.set_field('login.field.email', rec.email)
    dev.tap('recovery.request.submit')
    scr = dev.wait_for_state('RECOVERY_SENT', timeout=60)
    dev.shot('12-recovery-requested')
    _, out = callback_for(ctx, rec, 'recovery', core.RECOVERY_REDIRECT)
    if not out.has_session_tokens or not out.location:
        raise prov.HarnessConfigError('PROVIDER_GAVE_NO_RECOVERY_CALLBACK')
    dev.open_link(out.location, cold=False)
    scr = dev.wait_for_state('OPORAVAK_FORM', 'OPORAVAK_INVALID', 'OPORAVAK_SIGNED_IN', timeout=60)
    dev.shot('13-recovery-form')
    shows_account = scr.has_text(rec.email, 'contains')
    password = new_password()
    on_form = scr.state == 'OPORAVAK_FORM'
    mismatch_ok = False
    untouched = False
    saved = False
    old_rejected = new_accepted = bystander_ok = False
    if on_form:
        dev.set_field('oporavak.field.new', password)
        dev.set_field('oporavak.field.confirm', password + 'x')
        dev.tap('oporavak.save')
        mismatch_ok = dev.wait_for_label('oporavak.mismatch', 20)
        s_old, _, _, _ = prov.login_ids(ctx, rec)                        # nothing may have been written yet
        untouched = s_old == 200
        dev.set_field('oporavak.field.confirm', password)
        dev.tap('oporavak.save')
        done = dev.wait_for_state('OPORAVAK_SUCCESS', 'OPORAVAK_INVALID', timeout=60)
        dev.shot('14-recovery-saved')
        saved = done.state == 'OPORAVAK_SUCCESS'
        s_old2, code_old2, _, _ = prov.login_ids(ctx, rec)
        s_new, _, uid_new, _ = prov.login_ids(ctx, rec, password)
        s_by, _, uid_by, _ = prov.login_ids(ctx, bystander)
        old_rejected = s_old2 == 400 and code_old2 == 'invalid_credentials'
        new_accepted = s_new == 200 and uid_new == rec.user_id
        bystander_ok = s_by == 200 and uid_by == bystander.user_id
        rec.password = password if new_accepted else rec.password
    r.expect('E09', on_form and shows_account and mismatch_ok and untouched and saved and old_rejected and new_accepted and bystander_ok,
             'recovery in the UI', formShown=on_form, formNamesTheCallbackAccount=shows_account,
             mismatchWarningAndNothingWritten=(mismatch_ok and untouched), successShown=saved, oldPasswordRefused=old_rejected,
             newPasswordAccepted=new_accepted, otherAccountUntouched=bystander_ok)
    # E12: the used callback replayed while signed out (observation)
    if saved and dev.labels.has(dev.screen().nodes, 'oporavak.success.login'):
        dev.tap('oporavak.success.login')
        dev.wait_for_state('LOGIN_FORM', timeout=30)
        dev.open_link(out.location, cold=False)
        replay = dev.wait_for_state('OPORAVAK_FORM', 'OPORAVAK_INVALID', 'OPORAVAK_SIGNED_IN', timeout=60)
        dev.shot('15-used-recovery-callback-replayed-signed-out')
        r.observe('E12', 'used recovery callback replayed signed out', screenState=replay.state,
                  showsTheSameAccount=replay.has_text(rec.email, 'contains'),
                  showsAnotherAccount=replay.has_text(bystander.email, 'contains'),
                  note='a form here means the provider kept the recovery session valid (see P14); saving was not attempted')
        dev.press_back()
        dev.wait_for_state(*AUTH_STATES, timeout=30)
    else:
        r.not_run('E12', 'the recovery did not reach the success screen')
    checkpoint(ctx, 'g3d')


def s_g3e_sign_in_after_confirmation(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    u3 = ctx.cold_account
    if u3 is None:
        raise Precondition('no confirmed account to sign in with')
    scr = open_login_cold(ctx)
    if scr.state != 'LOGIN_FORM':
        raise Precondition('signed-out login form not reached')
    status, _, uid, _ = prov.login_ids(ctx, u3)
    u3.user_id = uid or u3.user_id
    signed = sign_in_succeeds(ctx, u3)
    present = signed_in_as(ctx, u3.user_id)
    r.expect('E06', status == 200 and signed and present is not False, 'the confirmed account signs in', providerStatus=status,
             appLeftTheAuthSurface=signed, sessionInStorage=present)
    if present is None:
        r.unavailable('E06', 'the app private storage is not readable (run-as): the session is not verified')


def s_final(ctx: AndroidCtx) -> None:
    dev, r = ctx.dev, ctx.report
    checkpoint(ctx, 'final')
    dev.stop_logcat()
    log = dev.logcat_scan()
    app_log, all_log = log['app'], log['all']
    system_matches = max(all_log['matches'] - app_log['matches'], 0)
    system_tags = sorted(set(all_log['tags']) - set(app_log['tags']))
    if app_log['lines'] == 0:
        r.unavailable('E13', 'the capture of the lines the app itself wrote is empty: nothing was searched')
    else:
        r.expect('E13', app_log['matches'] == 0, 'logcat lines written by the app uid, whole run', appLines=app_log['lines'],
                 credentialMatchesInAppLines=app_log['matches'], appTags=app_log['tags'], allBufferLines=all_log['lines'],
                 fatalLines=all_log['fatalLines'], anrLines=all_log['anrLines'])
    scans = ctx.app_scans
    matches = [m for s in scans for m in s['matches']]
    if not scans:
        r.not_run('E14', 'no private-storage scan ran')
    elif not all(s['available'] for s in scans):
        r.unavailable('E14', 'the app private directory could not be read (run-as / tar): not verified')
    if scans and any(s['available'] for s in scans):
        r.expect('E14', not matches, 'private storage scans', scans=[{'after': s['after'], 'available': s['available'], 'files': s['files'],
                                                                      'matches': len(s['matches'])} for s in scans],
                 where=[m['path'] for m in matches])
    unique = {json.dumps(item, sort_keys=True) for item in dev.leaks}
    r.expect('E15', not dev.leaks, 'credentials or provider text on screen', screensWithLeaks=sorted(unique)[:10])
    r.observe('E16', 'operating-system activity records and system log', systemLogCredentialMatches=system_matches,
              systemLogTags=system_tags, **dev.os_retention())


SCENARIOS: list[tuple[str, tuple[str, ...], Callable[[AndroidCtx], None]]] = [
    ('fixtures', (), s_fixtures),
    ('g1a-open-login', ('E01',), s_g1a_open_login),
    ('g1a-signup-ui', ('E02',), s_g1a_signup_ui),
    ('g1b-resend-ui', ('E04',), s_g1b_resend_ui),
    ('g1c-warm-confirmation', ('E05',), s_g1c_warm_confirmation),
    ('g2a-other-confirmation-while-signed-in', ('E08',), s_g2a_other_confirmation),
    ('g2b-recovery-while-signed-in', ('E10', 'E11'), s_g2b_recovery_while_signed_in),
    ('g3a-unconfirmed-refused', ('E03',), s_g3a_unconfirmed_refused),
    ('g3b-error-callbacks', ('E07',), s_g3b_error_callbacks),
    ('g3c-cold-confirmation', ('E06',), s_g3c_cold_confirmation),
    ('g3d-recovery-ui', ('E09', 'E12'), s_g3d_recovery_ui),
    ('g3e-sign-in-after-confirmation', ('E06',), s_g3e_sign_in_after_confirmation),
    ('final-scans', ('E13', 'E14', 'E15', 'E16'), s_final),
]


def run_all(ctx: AndroidCtx, scenarios: Optional[list[tuple[str, tuple[str, ...], Callable[[AndroidCtx], None]]]] = None) -> None:
    for name, ids, fn in (scenarios or SCENARIOS):
        started = ctx.clock.now()
        try:
            fn(ctx)
            ctx.report.step(name, outcome='OK', seconds=round(ctx.clock.now() - started, 1))
        except Precondition as pre:
            for check_id in ids:
                ctx.report.not_run(check_id, f'{name}: {pre}')
            ctx.report.step(name, outcome='NOT_RUN', reason=str(pre))
        except Exception as error:                  # a harness problem: every check of the scenario is ERROR, never a finding
            for check_id in ids:
                ctx.report.error(check_id, error)
            failure = {'step': name, 'outcome': 'ERROR', 'error': core.sanitize_exception(error, ctx.secrets)}
            failure['inputTrace'] = list(getattr(ctx.dev, 'input_trace', [])[-12:])
            try:
                failure['screenshot'] = ctx.dev.shot('failure-' + name)
                failure['visibleWords'] = ctx.dev.inventory()
            except Exception:
                pass
            ctx.report.timeline.append(failure)
            ctx.report.step(name + '-seconds', seconds=round(ctx.clock.now() - started, 1))


# ------------------------------------------------------------------------------------------------ entry point
def apk_facts(apk: Path) -> dict[str, Any]:
    return {'file': apk.name, 'bytes': apk.stat().st_size, 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest()}


def main(argv: Optional[list[str]] = None, *, device: Optional[Device] = None, transport: Optional[net.Transport] = None,
         clock: Optional[net.Clock] = None) -> int:
    env = os.environ
    api, mail_url, anon = env.get('EX07_API_URL', ''), env.get('EX07_MAIL_URL', ''), env.get('EX07_ANON_KEY', '')
    if api != 'http://127.0.0.1:54321' or mail_url != 'http://127.0.0.1:54324' or not anon:
        print('REFUSED: only the disposable loopback GoTrue and Mailpit may be used (EX07_API_URL, EX07_MAIL_URL, EX07_ANON_KEY)')
        return 2
    out_dir = Path(env.get('EX07_OUT', 'artifacts/ex07-s03-native'))
    out_dir.mkdir(parents=True, exist_ok=True)
    clock = clock or net.Clock()
    secrets = device.secrets if device is not None else core.SecretSet()      # one set: the device and the report must search the same credentials
    labels = core.Labels.load(HERE / 'ui_labels.json')
    dev = device or Device(Adb(), labels, out_dir, secrets, clock, env=dict(env))
    apk_path = Path(env['EX07_S03_APK']) if env.get('EX07_S03_APK') else None
    head = prov.git_head()
    apk_source = env.get('EX07_S03_APK_SOURCE')
    if apk_source and head != 'unknown' and apk_source != head:
        print(f'REFUSED: the APK was built from {apk_source[:12]} but this checkout is {head[:12]}')
        return 2
    meta: dict[str, Any] = {'schemaVersion': 1, 'slice': core.SLICE, 'label': core.LABEL, 'labelDetail': core.LABEL_DETAIL,
                            'source': prov.source_block(),
                            'environment': {'kind': 'disposable-android-emulator-and-local-gotrue-mailpit', 'package': core.PACKAGE,
                                            'apk': (apk_facts(apk_path) if apk_path and apk_path.exists() else None),
                                            'apkSource': apk_source, 'gotrueImage': env.get('EX07_GOTRUE_IMAGE'),
                                            'supabaseCli': env.get('EX07_SUPABASE_CLI'), 'otpExpirySeconds': core.OTP_EXPIRY_SECONDS,
                                            'maxFrequencySeconds': core.MAX_FREQUENCY_SECONDS,
                                            'timingsAreCiEmulatorNumbersNotPhoneNumbers': True}}
    report = core.Report('EMULATOR', meta, secrets)
    http = net.Http(transport or net.urllib_transport)
    ctx = AndroidCtx(net.GoTrue(http, api, anon), net.Mailbox(http, mail_url, clock), clock, report, secrets, dev)
    try:
        ctx.mail.clear()
        info = dev.prepare(apk_path)
        report.meta['environment']['device'] = info
    except RefusedDevice as refused:
        print('REFUSED: ' + str(refused))
        return 2
    except Exception as error:
        report.step('prepare', outcome='ERROR', error=core.sanitize_exception(error, secrets))
        for check in core.CATALOG:
            if check['level'] == 'EMULATOR':
                report.error(check['id'], error)
        return _finish(report, out_dir, secrets, dev, started=time.time())
    started = time.time()
    try:
        run_all(ctx)
    finally:
        dev.stop_logcat()
    return _finish(report, out_dir, secrets, dev, started)


def _finish(report: core.Report, out_dir: Path, secrets: core.SecretSet, dev: Device, started: float) -> int:
    data = report.finalize()
    data['seconds'] = round(time.time() - started)
    data['screenshots'] = list(dev.shots)
    data['inputTrace'] = list(getattr(dev, 'input_trace', []))
    if dev.leaks:
        # A credential was visible on screen: the screenshots would publish it. Keep the finding, withhold the pictures.
        for picture in out_dir.glob('*.png'):
            picture.unlink()
        data['screenshots'] = []
        data['screenshotsWithheld'] = True
    text = json.dumps(data, indent=2, ensure_ascii=False)
    assert not secrets.find_in_text(text), 'the report would contain a credential'
    (out_dir / 'native-report.json').write_text(text + '\n', encoding='utf-8')
    prov.print_summary(data)
    return 0 if data['result'] == 'PASS' else 1


if __name__ == '__main__':
    sys.exit(main())

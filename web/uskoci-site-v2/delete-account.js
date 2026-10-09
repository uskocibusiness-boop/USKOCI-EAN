/* USKOČI web account closure: canonical V5 RPC contract, no client admin privileges.
   PREVIEW IS NON-DESTRUCTIVE. No account/credential is sent to a different Supabase project.
   The existing native app remains the contract authority. */
(() => {
  'use strict';
  const BASE = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_o_I-YOn57oPCrIboF0OjPQ_c3DHmOZW';
  const PRODUCTION_HOST = location.protocol === 'https:' && ['uskoci.rs', 'www.uskoci.rs'].includes(location.hostname);
  const VERIFIED_PRODUCTION_ERASURE_ENABLED = false; // Fails closed until isolated prod backend, legal policy and disposable E2E receipt are approved.
  const LOCAL_KEY = 'uskoci.web.closure.intent.v1';
  const HASH = /^[a-f0-9]{64}$/;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const loginForm = document.getElementById('delete-login-form');
  const confirmForm = document.getElementById('delete-confirm-form');
  const loginCard = document.getElementById('delete-login');
  const confirmCard = document.getElementById('delete-confirm');
  const doneCard = document.getElementById('delete-done');
  const status = document.getElementById('delete-status');
  const emailEcho = document.querySelector('[data-email-echo]');
  const steps = [...document.querySelectorAll('[data-delete-step]')];
  const submit = confirmForm?.querySelector('button[type="submit"]');
  let token = null, accountId = null, currentReview = null, busy = false;

  const step = n => steps.forEach((s, i) => s.classList.toggle('active', i === n));
  const notice = (msg, level = '') => {
    status.textContent = msg;
    status.className = 'delete-status show ' + level;
  };
  const failClosed = msg => {
    if (submit) submit.disabled = true;
    notice(msg, 'error');
  };
  const clearNotice = () => { status.className = 'delete-status'; status.textContent = ''; };
  const setBusy = b => {
    busy = b;
    if (loginForm) loginForm.querySelector('button[type="submit"]').disabled = b;
    if (submit) submit.disabled = b || !currentReview?.ready;
  };
  const getPending = () => {
    try {
      const p = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      return p && p.accountId === accountId && UUID.test(p.clientRequestId) &&
        UUID.test(p.requestId) && Number.isInteger(p.expectedRevision) &&
        HASH.test(p.policySha256) ? p : null;
    } catch { return null; }
  };
  const storePending = p => localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
  const removePending = () => localStorage.removeItem(LOCAL_KEY);

  // Preview links are for design/legal review only. Credentials MUST NOT be used there.
  if (!PRODUCTION_HOST || !VERIFIED_PRODUCTION_ERASURE_ENABLED) {
    if (loginForm) loginForm.querySelector('button[type="submit"]').disabled = true;
    failClosed(PRODUCTION_HOST ? 'Brisanje naloga je privremeno nedostupno dok se ne potvrde produkciona baza, pravna pravila i stvarni test brisanja. Obrati se podršci; nalog nije obrisan.' : 'Ovo je pregled sajta. Prijava i brisanje naloga su onemogućeni na preview adresi. Zvaničan postupak mora prvo proći test sa namenskim nalogom na kanonskom backendu.');
    return;
  }
  async function request(path, body, authed) {
    const headers = { apikey: PUBLIC_KEY, 'content-type': 'application/json' };
    if (authed) {
      if (!token) throw new Error('AUTH_REQUIRED');
      headers.authorization = 'Bearer ' + token;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(BASE + path, { method:'POST', headers, body: JSON.stringify(body), cache:'no-store', signal:ctrl.signal });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const e = new Error('REQUEST_FAILED');
        e.code = data?.code || data?.message || data?.error_code || 'REQUEST_FAILED';
        e.status = res.status;
        throw e;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  const rpc = (name, body) => request('/rest/v1/rpc/' + name, body, true);
  async function signIn(email, password) {
    const data = await request('/auth/v1/token?grant_type=password', { email, password }, false);
    if (!data?.access_token || !UUID.test(data?.user?.id)) throw new Error('LOGIN_INVALID_RESPONSE');
    token = data.access_token; accountId = data.user.id;
    return accountId;
  }
  function makeReady(r) {
    return !!(r && r.authoritative === true && r.accountId === accountId &&
      r.ready === true && UUID.test(r.requestId) && Number.isInteger(r.revision) &&
      r.revision > 0 && HASH.test(r.policySha256) &&
      Array.isArray(r.blockers) && r.blockers.length === 0 && r.code === null);
  }
  async function review() {
    const r = await rpc('rpc_review_account_closure_execution', { p_expected_user_id: accountId });
    if (r?.authoritative !== true || r?.accountId !== accountId) throw new Error('UNVERIFIED_REVIEW');
    currentReview = r;
    if (makeReady(r)) {
      submit.disabled = false;
      clearNotice();
      return true;
    }
    submit.disabled = true;
    if (r?.code === 'CLOSURE_PREPARATION_REQUIRED') {
      notice('Pre završnog koraka potrebno je pripremiti pregled obaveza. Priprema ne briše nalog.');
      let b = document.getElementById('prepare-web-review');
      if (!b) {
        b = document.createElement('button');
        b.id = 'prepare-web-review'; b.type = 'button'; b.className = 'btn secondary';
        b.textContent = 'Pripremi pregled';
        confirmForm.before(b);
        b.addEventListener('click', prepare);
      }
      b.disabled = false;
    } else if (r?.blockers?.length) {
      failClosed('Zatvaranje je zaustavljeno zbog postojećih obaveza (' + r.blockers.join(', ') + '). Završi aktivne Dogovore, zadatke ili prijave u aplikaciji i zatim proveri ponovo.');
    } else if (r?.code === 'CLOSURE_POLICY_NOT_READY') {
      failClosed('Pravila stvarnog brisanja i čuvanja podataka nisu aktivirana na serveru. Brisanje ne može da se pokrene i nalog nije obrisan.');
    } else {
      failClosed('Server trenutno nije potvrdio da je brisanje dozvoljeno. Obrati se USKOČI podršci. Nalog nije obrisan.');
    }
    return false;
  }
  async function prepare() {
    if (busy || !accountId || !token) return;
    setBusy(true); notice('Pripremamo proveru obaveza…');
    try {
      const state = await rpc('rpc_get_account_closure', { p_expected_user_id: accountId });
      if (state?.authoritative !== true || state?.accountId !== accountId ||
          !Number.isInteger(state.revision)) throw new Error('UNVERIFIED_STATE');
      const clientId = crypto.randomUUID();
      const receipt = await rpc('rpc_prepare_account_closure', {
        p_expected_user_id: accountId, p_expected_revision: state.revision, p_client_request_id: clientId
      });
      if (receipt?.authoritative !== true || receipt?.accountId !== accountId) throw new Error('UNVERIFIED_PREPARATION');
      await review();
    } catch {
      failClosed('Priprema nije potvrđena. Proveri stanje u aplikaciji ili kontaktiraj podršku. Nalog nije obrisan.');
    } finally { setBusy(false); }
  }
  async function readPending(p) {
    const r = await rpc('rpc_read_account_closure_execution', {
      p_expected_user_id: accountId, p_client_request_id: p.clientRequestId
    });
    if (!r || r.authoritative !== true || r.accountId !== accountId ||
        r.clientRequestId !== p.clientRequestId) throw new Error('UNVERIFIED_RECEIPT');
    if (!r.found) {
      failClosed('Server ne nalazi potvrdu ovog zahteva. Zbog bezbednosti se isti postupak ne šalje automatski ponovo. Obrati se podršci.');
      return;
    }
    const e = r.execution;
    if (e?.authoritative !== true || e.accountId !== accountId || e.requestId !== p.requestId) throw new Error('UNVERIFIED_EXECUTION');
    if (e.state === 'CLOSED' && e.closedAt && Array.isArray(e.exceptions) && e.exceptions.length === 0) {
      removePending(); token = null; currentReview = null;
      confirmCard.classList.add('hidden'); doneCard.classList.remove('hidden');
      document.querySelector('[data-request-id]').textContent = p.requestId;
      step(2); clearNotice();
    } else {
      const exceptions = Array.isArray(e.exceptions) && e.exceptions.length
        ? ' Potrebna je posebna provera izdvojenih dokaza.' : '';
      notice('Zahtev je primljen. Server trenutno potvrđuje postupak; nalog se još ne prikazuje kao zatvoren.' + exceptions, 'success');
      addRefresh(p);
    }
  }
  function addRefresh(p) {
    let b = document.getElementById('refresh-web-deletion');
    if (!b) {
      b = document.createElement('button'); b.id = 'refresh-web-deletion'; b.type = 'button'; b.className = 'btn secondary';
      b.textContent = 'Proveri stanje zahteva'; status.after(b);
    }
    b.onclick = async () => { if (busy) return; setBusy(true); try { await readPending(p); } catch { notice('Stanje nije moglo da se potvrdi. Nije označeno kao završeno. Proveri ponovo.', 'error'); } finally { setBusy(false); } };
  }
  loginForm?.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return; setBusy(true); notice('Proveravamo nalog…');
    try {
      const f = new FormData(loginForm), email = String(f.get('email') || '').trim();
      const password = String(f.get('password') || '');
      await signIn(email, password);
      loginForm.reset();
      loginCard.classList.add('hidden'); confirmCard.classList.remove('hidden');
      emailEcho.textContent = email; step(1);
      const p = getPending();
      if (p) { failClosed('Pronađen je ranije pokrenut zahtev. Najpre proveravamo njegovo stanje.'); await readPending(p); }
      else await review();
    } catch { failClosed('Prijava nije uspela ili server ne potvrđuje nalog. Lozinka nije sačuvana. Za pomoć koristi kontakt ispod obrasca.'); }
    finally { setBusy(false); }
  });
  confirmForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !accountId || !token || !makeReady(currentReview) || getPending()) return;
    const f = new FormData(confirmForm), phrase = String(f.get('phrase') || '').trim().toUpperCase();
    if (phrase !== 'ZATVORI NALOG' || f.get('accept') !== 'yes') {
      failClosed('Moraš eksplicitno označiti potvrdu i upisati ZATVORI NALOG.');
      return;
    }
    setBusy(true);
    const p = { accountId, kind: 'START', clientRequestId: crypto.randomUUID(),
      requestId: currentReview.requestId, expectedRevision: currentReview.revision,
      policySha256: currentReview.policySha256 };
    storePending(p); // persist exact opaque intent BEFORE irreversible call
    notice('Zahtev je sačuvan. Pokrećemo zatvaranje…');
    try {
      await rpc('rpc_start_account_closure_execution', {
        p_expected_user_id: accountId, p_request_id: p.requestId,
        p_expected_revision: p.expectedRevision,
        p_client_request_id: p.clientRequestId, p_policy_sha256: p.policySha256
      });
      await readPending(p);
    } catch {
      failClosed('Ishod pokretanja nije potvrđen. Zbog zaštite podataka ne pokrećemo novi zahtev. Prijavi se ponovo i proveri sačuvani zahtev.');
      addRefresh(p);
    } finally { setBusy(false); }
  });
})();

/* ─────────────────────────────────────────────
   INPUT STATE MACHINE
   default → focus → filled | error
   ───────────────────────────────────────────── */
function initInputStates () {
  document.querySelectorAll('.auth-input').forEach(function (input) {
    var wrap = input.parentElement;

    // inject valid-icon checkmark
    if (!wrap.querySelector('.auth-valid-icon')) {
      var vi = document.createElement('span');
      vi.className = 'auth-valid-icon';
      vi.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      wrap.appendChild(vi);
    }

    var vi = wrap.querySelector('.auth-valid-icon');

    input.addEventListener('blur', function () {
      var field   = input.closest('.auth-field');
      var hasErr  = field && field.classList.contains('has-error');
      if (input.value.trim() && !hasErr) {
        input.classList.add('auth-input-filled');
        input.classList.remove('auth-input-error');
        if (vi) vi.classList.add('visible');
      } else if (!input.value.trim()) {
        input.classList.remove('auth-input-filled');
        if (vi) vi.classList.remove('visible');
      }
    });

    input.addEventListener('focus', function () {
      input.classList.remove('auth-input-filled');
      if (vi) vi.classList.remove('visible');
    });

    input.addEventListener('input', function () {
      if (input.classList.contains('auth-input-error')) {
        var field = input.closest('.auth-field');
        if (field) field.classList.remove('has-error');
        input.classList.remove('auth-input-error');
      }
    });
  });
}

/* ─────────────────────────────────────────────
   PASSWORD TOGGLE
   ───────────────────────────────────────────── */
function togglePw (id, btn) {
  var el     = document.getElementById(id);
  var isText = el.type === 'text';
  el.type    = isText ? 'password' : 'text';

  var eyeOpen  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var eyeClosed = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  btn.innerHTML = isText ? eyeOpen : eyeClosed;
}

/* ─────────────────────────────────────────────
   PASSWORD STRENGTH
   ───────────────────────────────────────────── */
function checkStrength (val, barId, lblId, wrapId) {
  barId  = barId  || 'pwBar';
  lblId  = lblId  || 'pwLabel';
  wrapId = wrapId || 'pwStrength';

  var bar  = document.getElementById(barId);
  var lbl  = document.getElementById(lblId);
  var wrap = document.getElementById(wrapId);
  if (!bar || !lbl || !wrap) return;

  if (!val) { wrap.classList.remove('visible'); return; }
  wrap.classList.add('visible');

  var score = 0;
  if (val.length >= 8)          score++;
  if (val.length >= 12)         score++;
  if (/[A-Z]/.test(val))        score++;
  if (/[0-9]/.test(val))        score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  var levels = [
    { w: '20%',  bg: '#e03e3e', t: 'Too weak' },
    { w: '40%',  bg: '#e03e3e', t: 'Weak'     },
    { w: '60%',  bg: '#d97706', t: 'Fair'      },
    { w: '80%',  bg: '#555',    t: 'Good'      },
    { w: '100%', bg: '#111',    t: 'Strong'    }
  ];

  var lv = levels[Math.min(score, 4)];
  bar.style.width      = lv.w;
  bar.style.background = lv.bg;
  lbl.textContent      = lv.t;
  lbl.style.color      = lv.bg;
}

/* ─────────────────────────────────────────────
   PW HINT DOTS (reset screen)
   ───────────────────────────────────────────── */
function setHint (id, met) {
  var el  = document.getElementById(id);
  if (!el) return;
  var dot = el.querySelector('.hint-dot');
  el.style.color        = met ? '#111' : '#bbb';
  if (dot) dot.style.background = met ? '#111' : '#ddd';
}

/* ─────────────────────────────────────────────
   FIELD ERROR HELPER
   ───────────────────────────────────────────── */
function setFieldError (fieldId, input, show) {
  var field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.toggle('has-error', show);
  input.classList.toggle('auth-input-error', show);
  if (show) input.classList.remove('auth-input-filled');
}

/* ─────────────────────────────────────────────
   BUTTON STATE HELPERS
   ───────────────────────────────────────────── */
function btnLoading (btn, label) {
  btn.classList.add('btn-loading');
  var t = btn.querySelector('.btn-text');
  if (t) t.textContent = label || 'Please wait…';
}

function btnReset (btn, label) {
  btn.classList.remove('btn-loading', 'btn-success');
  var t = btn.querySelector('.btn-text');
  if (t) t.textContent = label;
}

function btnSuccess (btn, label) {
  btn.classList.remove('btn-loading');
  btn.classList.add('btn-success');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ' + (label || 'Done');
}

/* ─────────────────────────────────────────────
   SLIDE TRANSITION (between steps/states)
   ───────────────────────────────────────────── */
function slideTransition (hideId, showId, dir) {
  var hide = document.getElementById(hideId);
  var show = document.getElementById(showId);
  if (!hide || !show) return;

  hide.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  hide.style.opacity    = '0';
  hide.style.transform  = 'translateX(' + (dir * 20) + 'px)';

  setTimeout(function () {
    hide.style.display = 'none';
    show.style.display = 'block';
    show.style.opacity = '0';
    show.style.transform = 'translateX(' + (dir * -20) + 'px)';
    show.style.transition = 'opacity 0.22s ease, transform 0.22s ease';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        show.style.opacity   = '1';
        show.style.transform = 'translateX(0)';
      });
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 220);
}

/* ─────────────────────────────────────────────
   CHECKBOX TOGGLE
   ───────────────────────────────────────────── */
function toggleCheckbox (wrap) {
  wrap.querySelector('.auth-checkbox').classList.toggle('checked');
}

/* ─────────────────────────────────────────────
   CLERK SHIM
   Replace these with real Clerk SDK calls.
   Docs: https://clerk.com/docs/references/javascript
   ───────────────────────────────────────────── */

/*
  LOGIN  → Clerk.client.signIn.create({ identifier, password })
  SIGNUP → Clerk.client.signUp.create({ firstName, lastName, emailAddress, password })
  VERIFY → signUp.attemptEmailAddressVerification({ code })
  FORGOT → Clerk.client.signIn.create({ strategy: 'reset_password_email_code', identifier })
  RESET  → signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code, password })
*/

// Stub for demo: simulates a 1.4s async Clerk response
function simulateClerkCall (successCallback, failCallback, shouldFail) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (shouldFail) {
        if (failCallback) failCallback();
      } else {
        if (successCallback) successCallback();
      }
      resolve();
    }, 1400);
  });
}

/* ─────────────────────────────────────────────
   INIT on DOM ready
   ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', initInputStates);
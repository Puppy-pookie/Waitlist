/* ---------- Lattice background: a grid that drifts and periodically resolves into alignment ---------- */
(function () {
  const canvas = document.getElementById('lattice');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w, h, cols, rows, spacing = 64;
  let nodes = [];
  let t = 0;

  function resize() {
    const hero = canvas.parentElement;
    w = canvas.width = hero.offsetWidth * devicePixelRatio;
    h = canvas.height = hero.offsetHeight * devicePixelRatio;
    canvas.style.width = hero.offsetWidth + 'px';
    canvas.style.height = hero.offsetHeight + 'px';
    cols = Math.ceil(w / (spacing * devicePixelRatio)) + 2;
    rows = Math.ceil(h / (spacing * devicePixelRatio)) + 2;
    nodes = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        nodes.push({
          x0: i * spacing * devicePixelRatio,
          y0: j * spacing * devicePixelRatio,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.3
        });
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const align = (Math.sin(t * 0.15) + 1) / 2; // 0..1, cycles between drift and near-alignment
    const settle = Math.pow(align, 3);

    ctx.strokeStyle = 'rgba(250, 246, 238, 0.10)';
    ctx.lineWidth = 1;

    for (const n of nodes) {
      const drift = (1 - settle) * 10;
      n.x = n.x0 + Math.sin(t * n.speed + n.phase) * drift;
      n.y = n.y0 + Math.cos(t * n.speed + n.phase * 1.3) * drift;
    }

    // horizontal lines
    for (let j = 0; j < rows; j++) {
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const n = nodes[i * rows + j];
        if (!n) continue;
        if (i === 0) ctx.moveTo(n.x, n.y);
        else ctx.lineTo(n.x, n.y);
      }
      ctx.stroke();
    }
    // vertical lines
    for (let i = 0; i < cols; i++) {
      ctx.beginPath();
      for (let j = 0; j < rows; j++) {
        const n = nodes[i * rows + j];
        if (!n) continue;
        if (j === 0) ctx.moveTo(n.x, n.y);
        else ctx.lineTo(n.x, n.y);
      }
      ctx.stroke();
    }

    // brass accent nodes at intersections near full alignment
    if (settle > 0.6) {
      ctx.fillStyle = `rgba(176, 141, 87, ${(settle - 0.6) * 0.8})`;
      for (const n of nodes) {
        if ((Math.floor(n.x0 / spacing) + Math.floor(n.y0 / spacing)) % 7 === 0) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function loop() {
    t += 0.01;
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);

  if (reduceMotion) {
    draw();
  } else {
    loop();
  }
})();

/* ---------- Form + Google Sign-In ---------- */
(function () {
  const form = document.getElementById('waitlist-form');
  const submitBtn = document.getElementById('submit-btn');
  const successEl = document.getElementById('success-message');
  const emailInput = document.getElementById('email');

  let googleCredential = null; // set if the person used "Continue with Google"

  // Google Identity Services callback — see README for setting GOOGLE_CLIENT_ID
  window.handleGoogleCredential = function (response) {
    googleCredential = response.credential;
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      if (payload.email) {
        emailInput.value = payload.email;
        emailInput.readOnly = true;
      }
    } catch (e) { /* noop */ }
  };

  function initGoogleButton() {
    const clientId = window.GOOGLE_CLIENT_ID; // injected via public/config.js
    if (!clientId || !window.google) return;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: window.handleGoogleCredential
    });
    google.accounts.id.renderButton(document.getElementById('google-btn-wrap'), {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      width: 320
    });
  }
  window.addEventListener('load', initGoogleButton);

  const schoolNameInput = document.getElementById('school_name');
  const schoolTypeInput = document.getElementById('school_type');
  const countryInput = document.getElementById('country');
  const formError = document.getElementById('form-error');

  function fieldError(id) {
    return document.querySelector(`[data-error-for="${id}"]`);
  }

  function showFieldError(input, message) {
    input.classList.add('invalid');
    const el = fieldError(input.id);
    if (el) { el.textContent = message; el.hidden = false; }
  }

  function clearFieldError(input) {
    input.classList.remove('invalid');
    const el = fieldError(input.id);
    if (el) { el.hidden = true; }
  }

  // Clear a field's error as soon as the person starts fixing it.
  [schoolNameInput, emailInput, schoolTypeInput, countryInput].forEach((input) => {
    const evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, () => clearFieldError(input));
  });

  function validate() {
    let firstInvalid = null;
    let valid = true;

    const checks = [
      [schoolNameInput, schoolNameInput.value.trim().length >= 2, 'Enter your school\u2019s name.'],
      [emailInput, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim()), 'Enter a valid email address.'],
      [schoolTypeInput, !!schoolTypeInput.value, 'Select a school type.'],
      [countryInput, countryInput.value.trim().length >= 2, 'Enter a country.']
    ];

    for (const [input, isValid, message] of checks) {
      if (!isValid) {
        showFieldError(input, message);
        if (!firstInvalid) firstInvalid = input;
        valid = false;
      } else {
        clearFieldError(input);
      }
    }

    if (firstInvalid) firstInvalid.focus();
    return valid;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    formError.hidden = true;

    if (!validate()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const payload = {
      school_name: schoolNameInput.value.trim(),
      email: emailInput.value.trim(),
      school_type: schoolTypeInput.value,
      country: countryInput.value.trim(),
      google_credential: googleCredential || null
    };

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      form.hidden = true;
      document.getElementById('google-btn-wrap').hidden = true;
      document.querySelector('.divider').hidden = true;
      successEl.hidden = false;
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Join the waitlist';
      formError.textContent = err.message || 'Something went wrong — please try again, or email us directly.';
      formError.hidden = false;
    }
  });
})();

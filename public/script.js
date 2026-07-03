(function () {
  const form = document.getElementById('waitlist-form');
  const submitBtn = document.getElementById('submit-btn');
  const successEl = document.getElementById('success-message');
  const emailInput = document.getElementById('email');
  const schoolNameInput = document.getElementById('school_name');
  const schoolTypeInput = document.getElementById('school_type');
  const countryInput = document.getElementById('country');
  const formError = document.getElementById('form-error');

  let googleCredential = null;

  window.handleGoogleCredential = function (response) {
    googleCredential = response.credential;
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      if (payload.email) {
        emailInput.value = payload.email;
        emailInput.readOnly = true;
        clearFieldError(emailInput);
      }
    } catch (e) { /* noop */ }
  };

  function initGoogleButton() {
    const clientId = window.GOOGLE_CLIENT_ID;
    if (!clientId || !window.google) return;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: window.handleGoogleCredential
    });
    google.accounts.id.renderButton(document.getElementById('google-btn-wrap'), {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 320
    });
  }
  window.addEventListener('load', initGoogleButton);

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
      submitBtn.innerHTML = 'Secure Early Access <span class="material-symbols-outlined">arrow_forward</span>';
      formError.textContent = err.message || 'Something went wrong — please try again, or email us directly.';
      formError.hidden = false;
    }
  });
})();

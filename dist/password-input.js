(() => {
  const unsupported = /[^\x20-\x7E]/;
  const message = 'ใช้ได้เฉพาะตัวอักษรอังกฤษ A–Z, a–z ตัวเลข 0–9 และสัญลักษณ์มาตรฐาน';
  const fields = new WeakMap();
  let sequence = 0;
  const isPassword = input => input instanceof HTMLInputElement && !input.readOnly &&
    (input.type === 'password' || ['new-password', 'current-password'].includes(input.autocomplete) || fields.has(input));

  function details(input) {
    if (fields.has(input)) return fields.get(input);
    const warning = document.createElement('span');
    warning.id = 'password-characters-' + ++sequence;
    warning.className = 'password-character-error';
    warning.hidden = true;
    warning.setAttribute('role', 'alert');
    (input.closest('.password-input') || input).insertAdjacentElement('afterend', warning);
    const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    describedBy.add(warning.id);
    input.setAttribute('aria-describedby', [...describedBy].join(' '));
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    const state = { warning, value: unsupported.test(input.value) ? '' : input.value, composing: false, rejectedComposition: false };
    fields.set(input, state);
    return state;
  }

  function reject(input) {
    const state = details(input);
    if (state.composing) state.rejectedComposition = true;
    // Reject the whole insertion, so a pasted password is never silently rewritten.
    if (unsupported.test(input.value)) input.value = state.value;
    state.warning.textContent = message;
    state.warning.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.setCustomValidity(message);
  }

  function validate(input) {
    const state = details(input);
    if (unsupported.test(input.value)) { reject(input); return false; }
    state.value = input.value;
    state.warning.hidden = true;
    state.warning.textContent = '';
    input.removeAttribute('aria-invalid');
    input.setCustomValidity('');
    return true;
  }

  document.addEventListener('focusin', event => {
    if (!isPassword(event.target)) return;
    details(event.target);
    if (unsupported.test(event.target.value)) reject(event.target);
  });
  document.addEventListener('beforeinput', event => {
    if (!isPassword(event.target)) return;
    details(event.target);
    if (event.data && unsupported.test(event.data)) { if (event.cancelable) event.preventDefault(); reject(event.target); }
  });
  document.addEventListener('paste', event => {
    if (!isPassword(event.target)) return;
    const text = event.clipboardData?.getData('text');
    if (text && unsupported.test(text)) { event.preventDefault(); reject(event.target); }
  });
  for (const name of ['input', 'change']) document.addEventListener(name, event => {
    if (!isPassword(event.target)) return;
    const state = details(event.target);
    if (!unsupported.test(event.target.value) && ((name === 'change' && state.value === event.target.value) || (state.composing && state.rejectedComposition))) return;
    validate(event.target);
  });
  document.addEventListener('compositionstart', event => {
    if (!isPassword(event.target)) return;
    const state = details(event.target); state.composing = true; state.rejectedComposition = false;
  });
  document.addEventListener('compositionend', event => {
    if (!isPassword(event.target)) return;
    const state = details(event.target); state.composing = false;
    if (!state.rejectedComposition || unsupported.test(event.target.value)) validate(event.target);
    state.rejectedComposition = false;
  });
  document.addEventListener('submit', event => {
    for (const input of event.target.querySelectorAll('input')) {
      if (!isPassword(input)) continue;
      if (unsupported.test(input.value)) { reject(input); event.preventDefault(); event.stopImmediatePropagation(); input.focus(); break; }
    }
  }, true);
})();

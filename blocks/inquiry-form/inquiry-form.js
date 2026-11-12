const FIELD_TYPES = ['text', 'email', 'tel', 'textarea', 'hidden', 'honeypot', 'recaptcha', 'submit'];
const CONFIG_KEYS = ['action', 'method', 'success', 'error'];
const AUTOCOMPLETE = {
  name: 'name', 'full-name': 'name', company: 'organization', 'company-name': 'organization', email: 'email', phone: 'tel',
};

let recaptchaPromise;
function loadRecaptcha() {
  if (!recaptchaPromise) {
    recaptchaPromise = new Promise((resolve, reject) => {
      window.inquiryFormRecaptchaReady = () => resolve(window.grecaptcha);
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?onload=inquiryFormRecaptchaReady&render=explicit';
      script.async = true;
      script.onerror = reject;
      document.head.append(script);
    });
  }
  return recaptchaPromise;
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cellText(cell) {
  return cell ? cell.textContent.trim() : '';
}

/** Parse "Full name *" / "Phone (optional)" into label parts. */
function parseLabel(raw) {
  let text = raw.trim();
  const required = /\*\s*$/.test(text);
  text = text.replace(/\*\s*$/, '').trim();
  const optionalMatch = text.match(/\((optional)\)\s*$/i);
  if (optionalMatch) text = text.replace(optionalMatch[0], '').trim();
  return { text, required, optional: !!optionalMatch };
}

function buildLabel(id, parts) {
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = parts.text;
  if (parts.required) {
    const star = document.createElement('span');
    star.className = 'inquiry-form-required';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = ' *';
    label.append(star);
  }
  if (parts.optional) {
    const opt = document.createElement('span');
    opt.className = 'inquiry-form-optional';
    opt.textContent = ' (optional)';
    label.append(opt);
  }
  return label;
}

function buildField(field, uid) {
  const parts = parseLabel(field.label);
  const name = field.name || slug(parts.text).replace(/-/g, '_') || field.type;
  const id = `${uid}-${slug(name)}`;
  const wrapper = document.createElement('div');
  wrapper.className = `inquiry-form-field inquiry-form-${field.type}`;

  if (field.type === 'hidden') {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = field.value;
    return input;
  }

  if (field.type === 'submit') {
    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'button';
    button.textContent = parts.text || 'Submit';
    wrapper.append(button);
    return wrapper;
  }

  if (field.type === 'recaptcha') {
    if (!field.value) return null;
    const widget = document.createElement('div');
    widget.className = 'inquiry-form-recaptcha-widget';
    widget.dataset.sitekey = field.value;
    wrapper.append(widget);
    return wrapper;
  }

  if (field.type === 'honeypot') {
    // hidden from people, visible to bots; a filled value marks the submission as spam
    wrapper.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.id = id;
    input.tabIndex = -1;
    input.autocomplete = 'off';
    wrapper.append(buildLabel(id, parts), input);
    return wrapper;
  }

  const control = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
  if (field.type === 'textarea') {
    control.rows = 8;
    control.value = field.value;
  } else {
    control.type = field.type;
    if (field.value) control.placeholder = field.value;
    const auto = AUTOCOMPLETE[slug(parts.text)] || (field.type === 'email' ? 'email' : null)
      || (field.type === 'tel' ? 'tel' : null);
    if (auto) control.autocomplete = auto;
  }
  control.id = id;
  control.name = name;
  control.required = parts.required;
  wrapper.append(buildLabel(id, parts), control);
  return wrapper;
}

/**
 * Read the authored rows.
 * - A row whose only cell holds headings/text is the intro.
 * - `Label | type | value` rows are fields; type is one of FIELD_TYPES.
 *   Mark required fields with a trailing `*`, optional ones with `(optional)`.
 *   value: default text (textarea), placeholder (inputs), field value (hidden),
 *   site key (recaptcha). An optional 4th cell overrides the field name.
 * - `action | URL`, `method | post`, `success | message`, `error | message` are config.
 */
function readRows(block) {
  const intro = [];
  const fields = [];
  const config = { method: 'post' };
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length === 1) {
      intro.push(...cells[0].childNodes);
      return;
    }
    const key = cellText(cells[0]);
    const type = cellText(cells[1]).toLowerCase();
    if (FIELD_TYPES.includes(type)) {
      let value = '';
      if (cells[2]) {
        const paras = cells[2].querySelectorAll('p');
        value = paras.length > 1
          ? [...paras].map((p) => p.textContent.trim()).join('\n')
          : cells[2].innerText?.trim() ?? cellText(cells[2]);
      }
      fields.push({
        label: key, type, value, name: cellText(cells[3]),
      });
    } else if (CONFIG_KEYS.includes(key.toLowerCase())) {
      const link = cells[1].querySelector('a[href]');
      config[key.toLowerCase()] = link && key.toLowerCase() === 'action' ? link.href : cellText(cells[1]);
    }
  });
  return { intro, fields, config };
}

function setStatus(status, message, state) {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

/**
 * inquiry-form: intro text beside a booking/inquiry form.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const { intro, fields, config } = readRows(block);
  const uid = `inquiry-form-${Math.random().toString(36).slice(2, 8)}`;

  const form = document.createElement('form');
  form.className = 'inquiry-form-form';
  form.noValidate = true;
  if (config.action) form.action = config.action;
  form.method = config.method;

  const status = document.createElement('div');
  status.className = 'inquiry-form-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  form.append(status);

  const grid = document.createElement('div');
  grid.className = 'inquiry-form-fields';
  fields.forEach((field) => {
    const el = buildField(field, uid);
    if (el) grid.append(el);
  });
  if (!fields.some((f) => f.type === 'submit')) grid.append(buildField({ label: 'Submit', type: 'submit', value: '' }, uid));
  form.append(grid);

  // reCAPTCHA loads on first interaction to keep it off the critical path
  const widget = form.querySelector('.inquiry-form-recaptcha-widget');
  let widgetId;
  if (widget) {
    form.addEventListener('focusin', () => {
      loadRecaptcha().then((grecaptcha) => {
        if (widgetId === undefined) {
          widgetId = grecaptcha.render(widget, { sitekey: widget.dataset.sitekey, theme: 'dark' });
        }
      }).catch(() => { /* captcha unavailable; server-side check decides */ });
    }, { once: true });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add('is-validated');
      form.querySelector(':invalid')?.focus();
      setStatus(status, 'Please fill in the required fields.', 'error');
      return;
    }
    const honeypot = form.querySelector('.inquiry-form-honeypot input');
    const successMsg = config.success || 'Thank you! Your message is on its way.';
    if (honeypot && honeypot.value) {
      setStatus(status, successMsg, 'success');
      form.reset();
      return;
    }
    if (widget && window.grecaptcha && widgetId !== undefined
      && !window.grecaptcha.getResponse(widgetId)) {
      setStatus(status, 'Please confirm you are not a robot.', 'error');
      return;
    }
    if (!config.action) {
      setStatus(status, config.error || 'This form is not configured to send messages yet.', 'error');
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const url = new URL(config.action, window.location.href);
      const sameOrigin = url.origin === window.location.origin;
      const resp = await fetch(url, {
        method: config.method.toUpperCase(),
        body: new FormData(form),
        mode: sameOrigin ? 'same-origin' : 'no-cors',
      });
      if (resp.type !== 'opaque' && !resp.ok) throw new Error(`HTTP ${resp.status}`);
      setStatus(status, successMsg, 'success');
      form.reset();
      form.classList.remove('is-validated');
      if (widget && window.grecaptcha && widgetId !== undefined) window.grecaptcha.reset(widgetId);
    } catch (err) {
      setStatus(status, config.error || 'Sorry, something went wrong. Please try again later.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  const children = [];
  if (intro.length) {
    const introCol = document.createElement('div');
    introCol.className = 'inquiry-form-intro';
    introCol.append(...intro);
    children.push(introCol);
  }
  const formCol = document.createElement('div');
  formCol.className = 'inquiry-form-body';
  formCol.append(form);
  children.push(formCol);
  block.replaceChildren(...children);
}

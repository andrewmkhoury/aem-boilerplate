/**
 * Header: brand logo + menu toggle that opens a full-screen overlay menu.
 * Content comes from the nav fragment (nav.plain.html):
 *   section 1: brand link (logo image)
 *   section 2: list of menu links (in-page anchors or page links)
 */

const OPEN_CLASS = 'is-open';
const SCROLLED_CLASS = 'is-scrolled';

/**
 * Fetches the nav fragment: /content first (local preview), then the site root (DA/EDS).
 * @returns {Promise<{html: string, base: string}|null>}
 */
async function fetchNav() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
  if (!resp.ok) return null;
  return { html: await resp.text(), base: resp.url };
}

function toggleIcon() {
  // Three lines that collapse, then two lines that rotate into an X
  return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
    <line class="line-1" x1="0" y1="13" x2="26" y2="13"/>
    <line class="line-2" x1="9.631" y1="19.783" x2="26" y2="19.783"/>
    <line class="line-3" x1="0" y1="6.217" x2="26" y2="6.217"/>
    <line class="line-close-1" x1="0" y1="13" x2="26" y2="13"/>
    <line class="line-close-2" x1="13" y1="0" x2="13" y2="26"/>
  </svg>`;
}

function setOpen(nav, open) {
  const toggle = nav.querySelector('.nav-toggle');
  const menu = nav.querySelector('.nav-menu');
  nav.classList.toggle(OPEN_CLASS, open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.hidden = !open;
  if (open) menu.querySelector('a')?.focus({ preventScroll: true });
}

/** Scrolls to an in-page target, leaving room for the (compact, scrolled) fixed header bar. */
function scrollToTarget(target, nav) {
  const styles = getComputedStyle(nav);
  const barHeight = parseFloat(styles.getPropertyValue('--nav-bar-height')) || 0;
  const pad = parseFloat(styles.getPropertyValue('--nav-pad-top-scrolled')) || 0;
  const offset = barHeight + pad * 2;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: Math.max(top, 0), behavior: smooth ? 'smooth' : 'auto' });
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await fetchNav();
  block.textContent = '';
  if (!fragment) return;

  const source = document.createElement('div');
  source.innerHTML = fragment.html;
  // Resolve relative image paths against the fragment's own URL
  source.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), fragment.base).href;
  });
  const [brandSection, menuSection] = source.querySelectorAll(':scope > div');

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');

  // Bar: brand + toggle
  const bar = document.createElement('div');
  bar.className = 'nav-bar';

  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  const brandLink = brandSection?.querySelector('a');
  if (brandLink) {
    brandLink.className = 'nav-brand-link';
    if (!brandLink.getAttribute('aria-label')) {
      brandLink.setAttribute('aria-label', 'Back to home');
    }
    brand.append(brandLink);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-controls', 'nav-menu');
  toggle.innerHTML = toggleIcon();

  bar.append(brand, toggle);

  // Overlay menu
  const menu = document.createElement('div');
  menu.className = 'nav-menu';
  menu.id = 'nav-menu';
  const list = menuSection?.querySelector('ul');
  if (list) {
    list.className = 'nav-menu-list';
    menu.append(list);
  }

  nav.append(bar, menu);
  setOpen(nav, false);

  toggle.addEventListener('click', () => setOpen(nav, !nav.classList.contains(OPEN_CLASS)));

  menu.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const hash = link.getAttribute('href')?.startsWith('#') ? link.getAttribute('href') : '';
    setOpen(nav, false);
    if (!hash) return;
    const target = hash === '#home' ? document.body : document.getElementById(hash.slice(1));
    if (!target) return;
    e.preventDefault();
    if (target === document.body) window.scrollTo({ top: 0, behavior: 'smooth' });
    else scrollToTarget(target, nav);
    window.history.replaceState(null, '', hash);
    toggle.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains(OPEN_CLASS)) {
      setOpen(nav, false);
      toggle.focus();
    }
  });

  // Compact bar once the page is scrolled
  const onScroll = () => nav.classList.toggle(SCROLLED_CLASS, window.scrollY > 0);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Close the menu when the layout switches between mobile and desktop
  window.matchMedia('(width >= 900px)').addEventListener('change', () => setOpen(nav, false));

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.append(nav);
  block.append(wrapper);
}

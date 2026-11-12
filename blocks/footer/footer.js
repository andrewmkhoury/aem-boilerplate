/**
 * Footer: brand column (logo + tagline) and a meta column (links + legal line).
 * Content comes from the footer fragment (footer.plain.html):
 *   section 1: brand (image paragraph, then text)
 *   section 2: meta (links and copyright)
 */

/**
 * Fetches the footer fragment: /content first (local preview), then the site root (DA/EDS).
 * @returns {Promise<{html: string, base: string}|null>}
 */
async function fetchFooter() {
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;
  return { html: await resp.text(), base: resp.url };
}

/** Smooth-scrolls in-page links (e.g. "Back to top") instead of jumping. */
function handleAnchorClick(e) {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href').slice(1);
  const target = id ? document.getElementById(id) : null;
  if (id && !target) return;
  e.preventDefault();
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = target ? target.getBoundingClientRect().top + window.scrollY : 0;
  window.scrollTo({ top: Math.max(top, 0), behavior: smooth ? 'smooth' : 'auto' });
  window.history.replaceState(null, '', `#${id}`);
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooter();
  block.textContent = '';
  if (!fragment) return;

  const source = document.createElement('div');
  source.innerHTML = fragment.html;
  // Resolve relative image paths against the fragment's own URL
  source.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), fragment.base).href;
    img.loading = 'lazy';
  });

  const inner = document.createElement('div');
  inner.className = 'footer-inner';

  const [brandSection, metaSection] = source.querySelectorAll(':scope > div');

  if (brandSection) {
    const brand = document.createElement('div');
    brand.className = 'footer-brand';
    [...brandSection.children].forEach((p) => {
      p.classList.add(p.querySelector('img') ? 'footer-brand-logo' : 'footer-brand-text');
      brand.append(p);
    });
    inner.append(brand);
  }

  if (metaSection) {
    const meta = document.createElement('div');
    meta.className = 'footer-meta';
    [...metaSection.children].forEach((p) => {
      p.classList.add(p.querySelector('a') ? 'footer-meta-links' : 'footer-meta-legal');
      meta.append(p);
    });
    inner.append(meta);
  }

  inner.addEventListener('click', handleAnchorClick);
  block.append(inner);
}

import { createOptimizedPicture } from '../../scripts/aem.js';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

// Opacity stops [value, progress]: fully visible until 30%, gone at 60%.
const FADE = [[1, 0.3], [0, 0.6]];

// Scroll motion per collage slot (photo n uses slot n % 12), taken from the source:
// x/y = end translate (vw/vh), scale = end scale, yAt = progress where y is reached,
// blur = end blur (px), easing = UIkit-style exponent (eased = p ^ (easing + 1)).
// Slot positions and sizes live in the CSS (nth-child).
const m = (x, y, scale, extra = {}) => ({
  x, y, scale, ...extra,
});
const MOTION = [
  m(-80, -70, 3),
  m(-50, -30, 2.5, { opacity: FADE }),
  m(-50, 60, 2.5, { opacity: FADE }),
  m(-30, -100, 2.3, { opacity: FADE, easing: 1.5 }),
  m(40, -50, 3, { opacity: FADE }),
  m(30, 10, 2, { opacity: FADE, blur: 1 }),
  m(-5, 5, 2.5, { opacity: FADE }),
  m(30, 30, 2, { yAt: 0.7, opacity: [[1, 0], [0, 0.6]], blur: 1 }),
  m(50, -70, 1.4),
  m(70, 50, 2),
  m(-60, -60, 3, { opacity: FADE }),
  m(70, 60, 3, { opacity: FADE }),
];

const COLLAGE_QUERY = '(min-width: 600px) and (prefers-reduced-motion: no-preference)';

const clamp01 = (n) => Math.min(Math.max(n, 0), 1);

function interpolate(stops, e) {
  const [first] = stops;
  const last = stops[stops.length - 1];
  if (e <= first[1]) return first[0];
  if (e >= last[1]) return last[0];
  for (let i = 1; i < stops.length; i += 1) {
    const [v0, p0] = stops[i - 1];
    const [v1, p1] = stops[i];
    if (e <= p1) return v0 + ((v1 - v0) * (e - p0)) / (p1 - p0);
  }
  return last[0];
}

function applyMotion(item, motion, progress) {
  const {
    x, y, yAt = 1, scale, opacity, blur, easing = 1,
  } = motion;
  const e = progress ** (easing + 1);
  const ty = y * Math.min(e / yAt, 1);
  item.style.transform = `translate(${(x * e).toFixed(3)}vw, ${ty.toFixed(3)}vh) scale(${(1 + (scale - 1) * e).toFixed(4)})`;
  if (opacity) item.style.opacity = interpolate(opacity, e).toFixed(3);
  if (blur) item.style.filter = `blur(${(blur * e).toFixed(3)}px)`;
}

function resetMotion(item) {
  item.style.removeProperty('transform');
  item.style.removeProperty('opacity');
  item.style.removeProperty('filter');
}

function isImageUrl(href) {
  try {
    return IMAGE_EXT.test(new URL(href, window.location.href).pathname);
  } catch (e) {
    return false;
  }
}

function buildLightbox(block, items) {
  const dialog = document.createElement('dialog');
  dialog.className = 'cards-photo-collage-lightbox';
  dialog.setAttribute('aria-label', 'Photo viewer');

  const figure = document.createElement('figure');
  const img = document.createElement('img');
  img.alt = '';
  const caption = document.createElement('figcaption');
  figure.append(img, caption);

  const makeButton = (cls, label, text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `cards-photo-collage-lightbox-${cls}`;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<span aria-hidden="true">${text}</span>`;
    return button;
  };
  const close = makeButton('close', 'Close', '×');
  const prev = makeButton('prev', 'Previous photo', '‹');
  const next = makeButton('next', 'Next photo', '›');
  dialog.append(close, prev, figure, next);

  let current = 0;
  let opener = null;

  const show = (index) => {
    current = (index + items.length) % items.length;
    const { full, alt } = items[current];
    img.src = full;
    img.alt = alt;
    caption.textContent = alt;
    caption.hidden = !alt;
  };

  const open = (index, trigger) => {
    opener = trigger;
    show(index);
    dialog.showModal();
    close.focus();
  };

  close.addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  // click on the backdrop closes
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  // Escape closes natively (cancel event); restore focus to the opener
  dialog.addEventListener('close', () => {
    img.removeAttribute('src');
    if (opener) opener.focus();
  });

  block.append(dialog);
  return open;
}

function bindScroll(block, list) {
  const mq = window.matchMedia(COLLAGE_QUERY);
  const items = [...list.children];
  // progress runs from the section entering the viewport bottom
  // until it leaves the top (or the page cannot scroll further)
  const target = block.closest('.section') || block;
  let ticking = false;

  const update = () => {
    ticking = false;
    if (!mq.matches) {
      items.forEach(resetMotion);
      return;
    }
    const viewport = window.innerHeight;
    const top = target.getBoundingClientRect().top + window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - viewport;
    const start = Math.max(0, top - viewport);
    const end = Math.min(maxScroll, top + target.offsetHeight);
    const progress = end > start ? clamp01((window.scrollY - start) / (end - start)) : 1;
    items.forEach((item, i) => applyMotion(item, MOTION[i % MOTION.length], progress));
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  mq.addEventListener('change', onScroll);
  update();
}

/**
 * cards-photo-collage: photo gallery with a lightbox.
 * Authoring: one row per photo; the cell holds an image (alt text required),
 * linked to its full-size file (link wrapping the image, or a link next to it).
 * Mobile: horizontal swipe slider. From 600px (motion allowed): sticky,
 * scroll-driven collage where photos scatter from a stack. Reduced motion: grid.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'cards-photo-collage-list';
  const items = [];

  [...block.children].forEach((row) => {
    const img = row.querySelector('img');
    if (!img) return;
    const link = row.querySelector('a[href]');
    const alt = (img.getAttribute('alt') || '').trim();
    const full = link && isImageUrl(link.href) ? link.href : img.src;

    let picture = img.closest('picture');
    if (!picture) {
      picture = document.createElement('picture');
      picture.append(img);
    }

    const index = items.length;
    const li = document.createElement('li');
    li.className = 'cards-photo-collage-item';

    const anchor = document.createElement('a');
    anchor.className = 'cards-photo-collage-link';
    anchor.href = full;
    anchor.setAttribute('aria-label', alt ? `View photo: ${alt}` : `View photo ${index + 1}`);
    anchor.append(picture);
    li.append(anchor);
    list.append(li);
    items.push({ full, alt, anchor });
  });

  list.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });

  const stage = document.createElement('div');
  stage.className = 'cards-photo-collage-stage';
  stage.append(list);
  block.replaceChildren(stage);

  if (!items.length) return;

  const open = buildLightbox(block, items);
  items.forEach(({ anchor }, index) => {
    anchor.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      open(index, anchor);
    });
  });

  bindScroll(block, list);
}

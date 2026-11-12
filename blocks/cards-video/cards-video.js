import { createOptimizedPicture } from '../../scripts/aem.js';

const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i;

const ICONS = {
  close: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><line fill="none" stroke="currentColor" stroke-width="1.4" x1="1" y1="1" x2="19" y2="19"/><line fill="none" stroke="currentColor" stroke-width="1.4" x1="19" y1="1" x2="1" y2="19"/></svg>',
  previous: '<svg width="14" height="24" viewBox="0 0 14 24" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.4" points="12.775,1 1.225,12 12.775,23"/></svg>',
  next: '<svg width="14" height="24" viewBox="0 0 14 24" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.4" points="1.225,23 12.775,12 1.225,1"/></svg>',
};

function isVideoHref(href) {
  try {
    return VIDEO_EXT.test(new URL(href, window.location.href).pathname);
  } catch (e) {
    return false;
  }
}

function findVideoLink(li) {
  return [...li.querySelectorAll('a[href]')].find((a) => isVideoHref(a.href));
}

function lightboxButton(name, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `cards-video-lightbox-${name}`;
  button.setAttribute('aria-label', label);
  button.innerHTML = ICONS[name];
  return button;
}

/**
 * Builds the modal video lightbox shared by all cards of a block:
 * one video at a time, autoplay, previous/next through the block's videos.
 * @param {Element} block The block element
 * @param {Array<{href: string, caption: string}>} items The block's videos
 * @returns {Function} open(index)
 */
function createLightbox(block, items) {
  const dialog = document.createElement('dialog');
  dialog.className = 'cards-video-lightbox';
  dialog.setAttribute('aria-label', 'Video player');

  const stage = document.createElement('div');
  stage.className = 'cards-video-lightbox-stage';
  const caption = document.createElement('p');
  caption.className = 'cards-video-lightbox-caption';
  const close = lightboxButton('close', 'Close');
  const prev = lightboxButton('previous', 'Previous video');
  const next = lightboxButton('next', 'Next video');
  if (items.length < 2) {
    prev.hidden = true;
    next.hidden = true;
  }
  dialog.append(stage, caption, close, prev, next);

  let current = 0;
  let opener = null;

  const show = (index) => {
    current = (index + items.length) % items.length;
    const { href, caption: text } = items[current];
    const video = document.createElement('video');
    video.src = href;
    video.controls = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('aria-label', text || `Video ${current + 1} of ${items.length}`);
    stage.replaceChildren(video);
    caption.textContent = text;
    caption.hidden = !text;
    video.play().catch(() => { /* autoplay blocked; controls remain available */ });
  };

  const stop = () => {
    const video = stage.querySelector('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    stage.replaceChildren();
  };

  close.addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  // click on the dimmed area outside the video closes, like the source lightbox
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target === stage) dialog.close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (items.length < 2) return;
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  dialog.addEventListener('close', () => {
    stop();
    document.body.style.removeProperty('overflow');
    if (opener) opener.focus();
  });

  block.append(dialog);

  return (index, trigger) => {
    opener = trigger || null;
    show(index);
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
    close.focus();
  };
}

/**
 * cards-video: grid of cards that each open a video in a lightbox.
 * Authoring: one row per card. Cells: image | body (optional title,
 * subtitle, and a link to a video file such as .mp4). A row may also hold only
 * an image and a video link. Option `text-over-image` overlays the body on the image.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  const items = [];

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-video-card';
    while (row.firstElementChild) li.append(row.firstElementChild);

    // an image wrapped in its video link: unwrap the image, keep the link as text
    li.querySelectorAll('a[href]').forEach((a) => {
      if (!a.querySelector('picture, img')) return;
      const { href } = a;
      const holder = a.closest('li > div');
      a.replaceWith(...a.childNodes);
      if (holder && isVideoHref(href)) {
        const body = document.createElement('div');
        const p = document.createElement('p');
        const link = document.createElement('a');
        link.href = href;
        link.textContent = 'Play video';
        p.append(link);
        body.append(p);
        holder.after(body);
      }
    });

    [...li.children].forEach((div) => {
      const onlyImage = div.children.length === 1
        && (div.querySelector('picture') || div.querySelector(':scope > p > img'));
      if (onlyImage) {
        div.className = 'cards-video-card-image';
        const img = div.querySelector('img');
        if (!img.closest('picture')) {
          const picture = document.createElement('picture');
          picture.append(img);
          div.replaceChildren(picture);
        }
      } else if (div.textContent.trim() || div.querySelector('a')) {
        div.className = 'cards-video-card-body';
      } else {
        div.remove();
      }
    });

    const link = findVideoLink(li);
    if (link) {
      const { href } = link;
      const label = link.textContent.trim() || 'Play video';
      const heading = li.querySelector('h1, h2, h3, h4, h5, h6');
      const img = li.querySelector('img');
      const caption = heading ? heading.textContent.trim() : '';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cards-video-play';
      const icon = document.createElement('span');
      icon.className = 'cards-video-play-icon';
      icon.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'cards-video-play-label';
      text.textContent = label;
      button.append(icon, text);

      const linkParent = link.closest('p');
      if (linkParent && linkParent.textContent.trim() === link.textContent.trim()) {
        linkParent.replaceWith(button);
      } else {
        link.replaceWith(button);
      }
      // body holding only the video link: the play button covers the image
      const body = li.querySelector('.cards-video-card-body');
      const media = li.querySelector('.cards-video-card-image');
      if (body && media && body.textContent.trim() === button.textContent.trim()) {
        media.append(button);
        body.remove();
        li.classList.add('has-overlay-play');
        if (img && img.alt) button.setAttribute('aria-label', img.alt);
      } else if (caption) {
        button.setAttribute('aria-label', `${label}: ${caption}`);
      }

      li.classList.add('has-video');
      li.dataset.videoIndex = items.length;
      items.push({ href, caption });
    }

    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });

  block.replaceChildren(ul);

  if (!items.length) return;
  const open = createLightbox(block, items);
  ul.addEventListener('click', (e) => {
    const li = e.target.closest('.cards-video-card.has-video');
    if (!li || e.target.closest('a')) return;
    open(Number(li.dataset.videoIndex), li.querySelector('.cards-video-play'));
  });
}

/**
 * Hero with a muted, looping background video behind a large title.
 * Rows: 1) link to the video file (or an image), 2) title and optional text.
 * Respects prefers-reduced-motion (shows the first frame, no autoplay).
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [mediaRow, textRow] = block.children;
  const media = document.createElement('div');
  media.className = 'hero-video-media';

  const link = mediaRow?.querySelector('a[href]');
  const picture = mediaRow?.querySelector('picture');
  if (link && /\.(mp4|webm|mov)(\?|$)/i.test(link.href)) {
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    video.preload = 'metadata';
    video.src = link.href;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.autoplay = true;
      video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
    }
    media.append(video);
  } else if (picture) {
    media.append(picture);
  }

  const content = document.createElement('div');
  content.className = 'hero-video-content';
  if (textRow) content.append(...textRow.querySelector(':scope > div')?.childNodes || []);

  block.replaceChildren(media, content);
}

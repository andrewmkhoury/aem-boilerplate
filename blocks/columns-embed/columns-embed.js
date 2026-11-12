/**
 * Map a share URL to its embeddable player URL. Returns null for unknown providers.
 * @param {URL} url
 * @returns {{src: string, provider: string} | null}
 */
function toEmbed(url) {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'open.spotify.com') {
    const path = url.pathname.startsWith('/embed/') ? url.pathname : `/embed${url.pathname}`;
    // dark player theme (as on the source site) unless the author set one
    const params = new URLSearchParams(url.search);
    if (!params.has('theme')) params.set('theme', '0');
    return { src: `https://open.spotify.com${path}?${params}`, provider: 'spotify' };
  }
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    if (!id && url.pathname.startsWith('/embed/')) [, , id] = url.pathname.split('/');
    return id ? { src: `https://www.youtube-nocookie.com/embed/${id}`, provider: 'youtube' } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).pop();
    return /^\d+$/.test(id) ? { src: `https://player.vimeo.com/video/${id}`, provider: 'vimeo' } : null;
  }
  return null;
}

function embedLink(col) {
  if (col.querySelector('iframe')) return col.querySelector('iframe');
  const links = col.querySelectorAll('a[href]');
  if (links.length !== 1) return null;
  const [a] = links;
  // the cell must hold nothing but the link
  if (col.textContent.trim() !== a.textContent.trim()) return null;
  try {
    return toEmbed(new URL(a.href, window.location.href)) ? a : null;
  } catch (e) {
    return null;
  }
}

function buildIframe(a) {
  const { src, provider } = toEmbed(new URL(a.href, window.location.href));
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = a.title || (a.textContent.trim() !== a.href ? a.textContent.trim() : `${provider} player`);
  iframe.loading = 'lazy';
  iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  const wrapper = document.createElement('div');
  wrapper.className = `columns-embed-frame columns-embed-${provider}`;
  wrapper.append(iframe);
  return wrapper;
}

/**
 * Classify the text cell: standalone link paragraphs become CTAs, the first other
 * paragraph is the lead, and a number opening the lead (e.g. "84 Song Repertoire")
 * is wrapped so it can be highlighted.
 * @param {Element} col
 */
function decorateText(col) {
  const paragraphs = [...col.querySelectorAll(':scope > p')];
  paragraphs.forEach((p) => {
    const links = p.querySelectorAll('a[href]');
    if (links.length === 1 && p.textContent.trim() === links[0].textContent.trim()) {
      p.classList.add('columns-embed-cta');
    }
  });
  const lead = paragraphs.find((p) => !p.classList.contains('columns-embed-cta'));
  if (!lead) return;
  lead.classList.add('columns-embed-lead');
  const first = lead.firstChild;
  const match = first && first.nodeType === Node.TEXT_NODE && first.textContent.match(/^(\s*)(\d[\d,.]*)(?=\s)/);
  if (!match) return;
  const count = document.createElement('span');
  count.className = 'columns-embed-count';
  const [matched, space, number] = match;
  count.textContent = number;
  first.textContent = first.textContent.slice(matched.length);
  lead.prepend(space, count);
}

/**
 * columns-embed: text column beside an embedded player (Spotify, YouTube, Vimeo).
 * Authoring: one row, two cells. One cell holds heading, text and links; the
 * other holds only the share link of the media to embed.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('columns-embed-row');
    [...row.children].forEach((col) => {
      const target = embedLink(col);
      if (!target) {
        col.classList.add('columns-embed-text');
        decorateText(col);
        return;
      }
      col.classList.add('columns-embed-media');
      if (target.tagName === 'IFRAME') {
        const wrapper = document.createElement('div');
        wrapper.className = 'columns-embed-frame';
        wrapper.append(target);
        col.replaceChildren(wrapper);
        return;
      }
      const load = () => col.replaceChildren(buildIframe(target));
      if (!('IntersectionObserver' in window)) {
        load();
        return;
      }
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          load();
        }
      }, { rootMargin: '200px' });
      observer.observe(col);
    });
  });
}

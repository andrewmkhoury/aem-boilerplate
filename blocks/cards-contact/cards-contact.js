/**
 * cards-contact: boxed tiles, each a short label over a handle/link. No images.
 * Authoring: one row per tile. Either two cells (label | link) or one cell
 * holding a label paragraph followed by a link paragraph.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-contact-card';

    const paragraphs = [];
    [...row.children].forEach((cell) => {
      const blocks = cell.querySelectorAll(':scope > p, :scope > h2, :scope > h3, :scope > h4');
      if (blocks.length) paragraphs.push(...blocks);
      else if (cell.textContent.trim()) {
        const p = document.createElement('p');
        while (cell.firstChild) p.append(cell.firstChild);
        paragraphs.push(p);
      }
    });
    if (!paragraphs.length) return;

    const label = paragraphs.find((p) => !p.querySelector('a'));
    if (label) {
      const span = document.createElement('p');
      span.className = 'cards-contact-label';
      span.textContent = label.textContent.trim();
      li.append(span);
    }

    paragraphs.filter((p) => p !== label).forEach((p) => {
      p.className = 'cards-contact-value';
      p.querySelectorAll('a').forEach((a) => {
        a.classList.remove('button', 'primary', 'secondary');
        a.closest('.button-container')?.classList.remove('button-container');
        const url = new URL(a.href, window.location.href);
        if (/^https?:$/.test(url.protocol) && url.origin !== window.location.origin) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
      });
      li.append(p);
    });

    ul.append(li);
  });
  block.replaceChildren(ul);
}

const ALLOWED = {
  a: ['href', 'title', 'target', 'rel'],
  b: [],
  strong: [],
  i: [],
  em: [],
  u: [],
  s: [],
  p: [],
  h1: [],
  h2: [],
  h3: [],
  blockquote: [],
  pre: [],
  code: [],
  ul: [],
  ol: [],
  li: [],
  br: [],
  hr: [],
  img: ['src', 'alt', 'title'],
};

ALLOWED.span = ['style'];

function sanitizeStyle(value) {
  const safe = [];
  value.split(';').forEach((rule) => {
    const [prop, rawVal] = rule.split(':').map((s) => s && s.trim());
    if (!prop || !rawVal) return;

    const p = prop.toLowerCase();
    const v = rawVal.toLowerCase();

    const okColor = /^(#([0-9a-f]{3}|[0-9a-f]{6})|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)|transparent|inherit|initial|unset)$/i.test(v);

    if ((p === 'color' || p === 'background-color' || p === 'text-decoration-color') && okColor) {
      safe.push(`${p}:${v}`);
    }

    if (p === 'text-decoration' || p === 'text-decoration-line') {
      const okDecoration = /^(none|underline|overline|line-through|inherit|initial|unset)$/i.test(v);
      if (okDecoration) {
        safe.push(`${p}:${v}`);
      }
    }

    if (p === 'text-decoration-style') {
      const okDecorationStyle = /^(solid|double|dotted|dashed|wavy|inherit|initial|unset)$/i.test(v);
      if (okDecorationStyle) {
        safe.push(`${p}:${v}`);
      }
    }

    if (p === 'text-decoration-thickness') {
      const okThickness = /^(auto|from-font|inherit|initial|unset|\d+(\.\d+)?(px|em|rem|%)?)$/i.test(v);
      if (okThickness) {
        safe.push(`${p}:${v}`);
      }
    }

    if (p === 'font-weight') {
      const okWeight = /^(normal|bold|bolder|lighter|[1-9]00|inherit|initial|unset)$/i.test(v);
      if (okWeight) {
        safe.push(`${p}:${v}`);
      }
    }

    if (p === 'font-style') {
      const okStyle = /^(normal|italic|oblique|inherit|initial|unset)$/i.test(v);
      if (okStyle) {
        safe.push(`${p}:${v}`);
      }
    }
  });
  return safe.join('; ');
}

function sanitizeHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html;

  const isAllowedUrl = (attr, val) => {
    if (attr === 'href') {
      return /^(https?:|mailto:|#)/i.test(val);
    }
    if (attr === 'src') {
      return /^(data:image\/(png|jpeg|jpg|gif|webp);base64,|file:\/\/)/i.test(val);
    }
    return true;
  };

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];

  while (walker.nextNode()) {
    const el = walker.currentNode;
    const tag = el.tagName?.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(ALLOWED, tag)) {
      toRemove.push(el);
      continue;
    }

    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }

      if (name === 'style' && tag === 'span') {
        const cleaned = sanitizeStyle(value);
        if (cleaned) {
          el.setAttribute('style', cleaned);
        } else {
          el.removeAttribute('style');
        }
        return;
      }

      if (!ALLOWED[tag].includes(name)) {
        el.removeAttribute(attr.name);
        return;
      }

      if (!isAllowedUrl(name, value)) {
        el.removeAttribute(attr.name);
        return;
      }

      if (tag === 'a' && name === 'href') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  toRemove.forEach((node) => node.remove());
  return template.innerHTML;
}

function getAllowedTags() {
  return ALLOWED;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sanitizeStyle, sanitizeHTML, getAllowedTags };
}


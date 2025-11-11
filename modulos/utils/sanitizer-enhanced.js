// modulos/utils/sanitizer-enhanced.js
function enhancedSanitizeHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();

  // Lista más completa de elementos y atributos permitidos
  const ALLOWED_TAGS = {
    'a': ['href', 'title', 'target', 'rel'],
    'br': [], 'hr': [], 'p': [], 'div': [],
    'span': ['style', 'class'], // Permitir class para estilos
    'strong': [], 'b': [], 'em': [], 'i': [], 'u': [], 's': [],
    'h1': [], 'h2': [], 'h3': [], 'h4': [], 'h5': [], 'h6': [],
    'blockquote': [], 'pre': [], 'code': [], 'ul': [], 'ol': [], 'li': [],
    'table': [], 'thead': [], 'tbody': [], 'tr': [], 'th': [], 'td': [],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'mark': [], // Para texto resaltado
    'sub': [], 'sup': [] // Para superíndice y subíndice
  };

  const ALLOWED_STYLES = [
    'color', 'background-color', 'text-decoration', 
    'text-decoration-line', 'text-decoration-style',
    'text-decoration-thickness', 'text-decoration-color',
    'font-weight', 'font-style', 'font-family', 'font-size',
    'text-align', 'line-height', 'margin', 'padding'
  ];

  function sanitizeStyle(styleValue) {
    const declarations = styleValue.split(';');
    const safeDeclarations = [];

    declarations.forEach(declaration => {
      const [property, value] = declaration.split(':').map(s => s.trim());
      if (!property || !value) return;

      const lowerProperty = property.toLowerCase();
      
      // Verificar si la propiedad está permitida
      if (ALLOWED_STYLES.includes(lowerProperty)) {
        // Validaciones específicas por propiedad
        if (lowerProperty.includes('color')) {
          if (isValidColor(value)) {
            safeDeclarations.push(`${lowerProperty}:${value}`);
          }
        } else if (lowerProperty.includes('font')) {
          if (isValidFontValue(value)) {
            safeDeclarations.push(`${lowerProperty}:${value}`);
          }
        } else {
          safeDeclarations.push(`${lowerProperty}:${value}`);
        }
      }
    });

    return safeDeclarations.join('; ');
  }

  function isValidColor(color) {
    return /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|currentColor|transparent|inherit|initial|unset)$/i.test(color);
  }

  function walkAndSanitize(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // Remover elementos no permitidos
      if (!ALLOWED_TAGS[tagName]) {
        node.remove();
        return;
      }

      // Sanitizar atributos
      Array.from(node.attributes).forEach(attr => {
        const attrName = attr.name.toLowerCase();
        
        if (attrName === 'style') {
          const sanitizedStyle = sanitizeStyle(attr.value);
          if (sanitizedStyle) {
            node.setAttribute('style', sanitizedStyle);
          } else {
            node.removeAttribute('style');
          }
        } else if (attrName.startsWith('on')) {
          // Remover event handlers
          node.removeAttribute(attr.name);
        } else if (!ALLOWED_TAGS[tagName].includes(attrName)) {
          // Remover atributos no permitidos
          node.removeAttribute(attr.name);
        }
      });

      // Sanitizar hijos recursivamente
      Array.from(node.childNodes).forEach(walkAndSanitize);
    }
  }

  walkAndSanitize(template.content);
  return template.innerHTML;
}

module.exports = { enhancedSanitizeHTML };
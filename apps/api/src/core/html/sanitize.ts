import sanitizeHtml from 'sanitize-html';

/**
 * What a lesson body may contain. Staff write lessons as HTML, and a learner's browser renders it
 * inside the app, so anything that can run or restyle the page is removed: scripts, event handlers,
 * inline styles, frames, forms and `javascript:` links. What is left is document structure.
 */
const LESSON_POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2',
    'h3',
    'h4',
    'h5',
    'p',
    'br',
    'hr',
    'blockquote',
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'sub',
    'sup',
    'mark',
    'small',
    'kbd',
    'code',
    'pre',
    'span',
    'div',
    'a',
    'img',
    'figure',
    'figcaption',
    'table',
    'caption',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'details',
    'summary',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    ol: ['start', 'type'],
    // Language hints for code blocks (`language-java`) and nothing else.
    code: ['class'],
    pre: ['class'],
  },
  allowedClasses: {
    code: [/^language-[a-z0-9+#-]+$/],
    pre: [/^language-[a-z0-9+#-]+$/],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: { img: ['https', 'http'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // A link may open a new tab, and one that does must not hand the lesson's window to the page
    // it opens. Any other target is dropped.
    a: (tagName, attribs) => {
      const { target, rel: _rel, ...rest } = attribs;
      return {
        tagName,
        attribs: target === '_blank' ? { ...rest, target, rel: 'noopener noreferrer' } : rest,
      };
    },
  },
};

/** A lesson body with everything executable removed; safe to render as HTML. */
export function sanitizeLessonHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, LESSON_POLICY);
}

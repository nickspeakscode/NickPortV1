// CMS text is escaped separately; URL protocols also need validating.
export function safeHref(value, protocols = ['http:', 'https:', 'mailto:']) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim(), 'https://www.bynickthomas.com/');
    return protocols.includes(url.protocol) ? value.trim() : '';
  } catch {
    return '';
  }
}

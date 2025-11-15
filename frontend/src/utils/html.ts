export function sanitizeHtml(input: string): string {
  if (!input) return ''
  const doc = new DOMParser().parseFromString(input, 'text/html')
  doc.querySelectorAll('script').forEach((el) => el.remove())
  const removeOnAttrs = (el: Element) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name)
      if (attr.name === 'src' && /^javascript:/i.test(attr.value)) el.removeAttribute('src')
      if (attr.name === 'href' && /^javascript:/i.test(attr.value)) el.removeAttribute('href')
    }
  }
  doc.querySelectorAll('*').forEach(removeOnAttrs)
  return doc.body.innerHTML
}

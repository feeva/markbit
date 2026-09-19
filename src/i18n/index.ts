// Markbit MVP 0.1: minimal i18n stub.
// starissue's AnnotationEditor only calls L(key, ...args), so we only need to satisfy
// that signature plus its {0}/{1}-style placeholder interpolation.
//
// This is a pure passthrough (key -> key, with {n} args substituted), NOT a Korean
// dictionary. Two reasons:
//   1. The ported .cy.ts tests assert on the literal English strings (e.g.
//      cy.contains('Blur Size: 25px')), because ToolSettingsDropdown.vue composes
//      already-translated labels into templates: L('{0}: {1}px', L('Blur Size'), value).
//      Translating 'Blur Size' would break that composed assertion.
//   2. Markbit hasn't decided on a localization strategy yet — real multi-locale
//      support (locale switching, browser-language detection, a ko.json) is out of
//      scope until the product needs more than one language.
type LocalizeArg = string | number | boolean | null | undefined

const interpolate = (template: string, args: LocalizeArg[]): string =>
  template.replace(/\{(\d+)\}/g, (match, rawIndex) => {
    const arg = args[Number(rawIndex)]
    return arg === undefined || arg === null ? match : String(arg)
  })

export function L(key: string, ...args: LocalizeArg[]): string {
  return interpolate(key, args)
}

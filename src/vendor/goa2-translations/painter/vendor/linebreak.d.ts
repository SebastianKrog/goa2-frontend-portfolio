// Vendored from goa2-translations (src/painter/vendor/linebreak.d.ts). Do not edit — see scripts/sync-translations.mjs.
interface LineBreak {
  position: number
  required: boolean
}

export default class LineBreaker {
  constructor(text: string)
  nextBreak(): LineBreak | null
}

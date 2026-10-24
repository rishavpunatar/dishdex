const FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅕': 1 / 5, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
}
const FR = '½⅓⅔¼¾⅕⅛⅜⅝⅞'
const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?:\\s?[${FR}])?|[${FR}])`
const UNIT =
  '(?:\\s?(?:kg|g|grams?|mg|ml|millilitres?|milliliters?|l|litres?|liters?|tsps?|teaspoons?|tbsps?|tablespoons?|cups?|oz|lbs?|pounds?|pinch(?:es)?|cloves?|cans?|tins?|handfuls?|bunch(?:es)?|slices?|sticks?|pieces?|pcs)\\b\\.?)?'
const LEAD = new RegExp(`^\\s*(${NUM})(\\s*(?:-|–|to)\\s*(${NUM}))?(${UNIT})`, 'i')

export function parseNum(s: string): number {
  s = s.trim().replace(',', '.')
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s)
  if (m) return +m[1] + +m[2] / +m[3]
  m = /^(\d+)\/(\d+)$/.exec(s)
  if (m) return +m[1] / +m[2]
  m = new RegExp(`^(\\d+(?:\\.\\d+)?)?\\s?([${FR}])?$`).exec(s)
  if (m && (m[1] || m[2])) return (m[1] ? +m[1] : 0) + (m[2] ? FRACTIONS[m[2]] : 0)
  return NaN
}

const NICE: [number, string][] = [[1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']]

export function formatNum(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n >= 20) return String(Math.round(n))
  const whole = Math.floor(n)
  const frac = n - whole
  if (frac < 0.06) return String(whole || n.toFixed(2).replace(/0+$/, ''))
  if (frac > 0.94) return String(whole + 1)
  for (const [v, g] of NICE) if (Math.abs(frac - v) < 0.05) return whole ? `${whole}${g}` : g
  return (Math.round(n * 10) / 10).toString()
}

export interface ScaledLine {
  qty: string | null
  rest: string
}

/** Scale the leading quantity of an ingredient line ("200g rice", "1 1/2 cups milk", "2-3 chillies"). */
export function scaleLine(line: string, factor: number): ScaledLine {
  const m = LEAD.exec(line)
  if (!m) return { qty: null, rest: line }
  const a = parseNum(m[1])
  if (!Number.isFinite(a)) return { qty: null, rest: line }
  const b = m[3] ? parseNum(m[3]) : NaN
  let unit = m[4] ?? ''
  // "1 cup" -> "2 cups"
  if (a <= 1 && a * factor > 1 && /^\s?(cup|clove|can|tin|handful|slice|stick|piece|pound)$/i.test(unit)) unit += 's'
  const range = Number.isFinite(b) ? `–${formatNum(b * factor)}` : ''
  const qty = factor === 1 ? m[0].trim() : `${formatNum(a * factor)}${range}${unit}`.trim()
  return { qty, rest: line.slice(m[0].length).trimStart() }
}

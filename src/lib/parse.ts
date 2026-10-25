import { scaleLine } from './quantity'

/** What an import produces before it becomes a dish: the editor opens with this filled in. */
export interface ImportedRecipe {
  title: string
  servings: number
  minutes: number
  temp: '' | 'hot' | 'cold'
  cuisine: string
  types: string[]
  ingredients: string[]
  steps: string[]
  notes: string
}

const ING_HEAD = /^(ingredients?|you(?:'|’)?ll need|you will need|what you need|shopping list)\b[\s:]*$/i
const STEP_HEAD = /^(method|directions?|instructions?|steps|preparation|how to (?:make|cook)(?: it)?|to make)\b[\s:]*$/i
const NOTE_HEAD = /^(notes?|tips?|cook'?s notes?|serving suggestions?|to serve)\b[\s:]*$/i
const SUB_HEAD = /^(for the [^:]{2,40}|[A-Z][\w ]{2,30}):$/
const BULLET = /^\s*(?:[-*•·–▪◦]|\(?\d{1,2}[.)]|step\s*\d+[:.)]?)\s+/i
const STEP_NUM = /^\s*(?:step\s*)?\d{1,2}\s*[.):-]\s*/i

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

function minutesIn(text: string): number {
  const total = /total(?: time)?\s*[:\-]?\s*([^\n]+)/i.exec(text)
  const parse = (s: string) => {
    let m = 0
    const h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i.exec(s)
    const mn = /(\d+)\s*(?:m|min|mins|minute|minutes)\b/i.exec(s)
    if (h) m += Math.round(Number(h[1]) * 60)
    if (mn) m += Number(mn[1])
    return m
  }
  if (total) {
    const t = parse(total[1])
    if (t) return t
  }
  let sum = 0
  for (const label of ['prep', 'cook']) {
    const m = new RegExp(`${label}(?:aration)?(?:\\s*time)?\\s*[:\\-]?\\s*([^\\n·|,;]+)`, 'i').exec(text)
    if (m) sum += parse(m[1])
  }
  return sum
}

function servingsIn(text: string): number {
  const m = /(?:serves|servings?|feeds|makes)\s*[:\-]?\s*(\d{1,2})/i.exec(text) || /(\d{1,2})\s*(?:servings|portions|people)\b/i.exec(text)
  return m ? Number(m[1]) : 0
}

const looksLikeIngredient = (l: string) => !!scaleLine(l, 1).qty || /^(a |an |pinch|handful|salt|pepper|oil|butter|small|large)\b/i.test(l)

/**
 * Best-effort, on-device reading of a pasted recipe. Returns null when it can't
 * find at least a couple of ingredients and a step — the app then hands the text
 * to the importer model instead.
 */
export function parseRecipeText(raw: string): ImportedRecipe | null {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').trimEnd())
  const nonEmpty = lines.map(clean).filter(Boolean)
  if (nonEmpty.length < 3) return null

  let title = ''
  let section: 'intro' | 'ing' | 'steps' | 'notes' = 'intro'
  const ingredients: string[] = []
  const steps: string[] = []
  const notes: string[] = []
  const intro: string[] = []
  let sawHeads = false

  for (const rawLine of lines) {
    const line = clean(rawLine)
    if (!line) continue
    if (ING_HEAD.test(line)) {
      section = 'ing'
      sawHeads = true
      continue
    }
    if (STEP_HEAD.test(line)) {
      section = 'steps'
      sawHeads = true
      continue
    }
    if (NOTE_HEAD.test(line)) {
      section = 'notes'
      continue
    }
    if (!title && section === 'intro') {
      if (line.length <= 90 && !/^(serves|prep|cook|total|makes)\b/i.test(line)) {
        title = line.replace(/[.:]$/, '')
        continue
      }
    }
    if (section === 'ing') {
      if (SUB_HEAD.test(line) && !looksLikeIngredient(line)) continue // "For the sauce:"
      ingredients.push(line.replace(BULLET, ''))
    } else if (section === 'steps') {
      const isNew = STEP_NUM.test(line) || BULLET.test(line)
      const text = line.replace(STEP_NUM, '').replace(BULLET, '')
      const prev = steps[steps.length - 1]
      // A line that doesn't start a new step and follows an unfinished sentence is a wrapped line.
      if (!isNew && prev && !/[.!?)]$/.test(prev)) steps[steps.length - 1] = `${prev} ${text}`
      else steps.push(text)
    } else if (section === 'notes') {
      notes.push(line)
    } else {
      intro.push(line)
    }
  }

  // No headings at all: sort lines by shape.
  if (!sawHeads) {
    for (const line of intro.splice(0)) {
      if (looksLikeIngredient(line) && line.length < 90) ingredients.push(line.replace(BULLET, ''))
      else if (STEP_NUM.test(line) || line.length > 60) steps.push(line.replace(STEP_NUM, '').replace(BULLET, ''))
      else intro.push(line)
    }
  }

  if (ingredients.length < 2 || steps.length < 1) return null
  const all = nonEmpty.join('\n')
  return {
    title: title || 'Imported dish',
    servings: Math.min(servingsIn(all), 50),
    minutes: Math.min(minutesIn(all), 2880),
    temp: '',
    cuisine: '',
    types: [],
    ingredients,
    steps,
    notes: notes.join('\n'),
  }
}

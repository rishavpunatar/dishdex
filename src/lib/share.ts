import { copyText } from './device'
import { photoBlob } from './photos'
import { toast } from './store'
import type { Person, Recipe } from './types'

export function recipeText(r: Recipe, people: Person[]) {
  const who = r.knownBy.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).join(' & ')
  const lines = [
    r.title,
    `Serves ${r.servings}${r.minutes ? ` · ${r.minutes} min` : ''}${r.temp ? ` · served ${r.temp}` : ''}${who ? ` · ${who}’s recipe` : ''}`,
    '',
    'Ingredients',
    ...r.ingredients.map((i) => `• ${i}`),
    '',
    'Method',
    ...r.steps.map((s, i) => `${i + 1}. ${s}`),
  ]
  if (r.notes) lines.push('', 'Notes', r.notes)
  lines.push('', '— from our Dishdex')
  return lines.join('\n')
}

export async function shareRecipe(r: Recipe, people: Person[]) {
  const text = recipeText(r, people)
  const data: ShareData = { title: r.title, text }
  if (r.photo) {
    try {
      const blob = await photoBlob(r.photo.path)
      const file = new File([blob], `${r.title.replace(/[^\w]+/g, '-').toLowerCase() || 'dish'}.jpg`, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) data.files = [file]
    } catch {
      /* share without the photo */
    }
  }
  if (navigator.share) {
    try {
      await navigator.share(data)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Couldn’t open the share sheet')
    }
    return
  }
  if (await copyText(text)) toast('Recipe copied to clipboard')
}

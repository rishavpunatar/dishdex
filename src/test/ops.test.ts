import { describe, expect, it } from 'vitest'
import { applyRecipeOp, normalizeRecipe, type RecipeOp } from '../lib/ops'

const base = normalizeRecipe({
  id: 'r1', title: 'Dal', servings: 4, ingredients: ['1 cup toor dal'], steps: ['Boil'],
  knownBy: ['p1'], learning: { p2: { from: 'p1', at: '2026-01-01' } }, createdBy: 'p1',
})

describe('applyRecipeOp', () => {
  it('merges set-like fields instead of overwriting', () => {
    // Phone A edits the title while phone B (already applied remotely) marked p2 as knowing it.
    const remote = applyRecipeOp(base, { opId: 'x', kind: 'recipe', id: 'r1', knownAdd: ['p2'] })!
    const op: RecipeOp = { opId: 'y', kind: 'recipe', id: 'r1', set: { title: 'Dal tadka' } }
    const merged = applyRecipeOp(remote, op)!
    expect(merged.title).toBe('Dal tadka')
    expect(merged.knownBy).toEqual(['p1', 'p2'])
  })
  it('clears a learn request once that person knows the dish', () => {
    const r = applyRecipeOp(base, { opId: 'x', kind: 'recipe', id: 'r1', knownAdd: ['p2'] })!
    expect(r.learning).toEqual({})
  })
  it('does not resurrect a dish deleted on the other phone', () => {
    expect(applyRecipeOp(null, { opId: 'x', kind: 'recipe', id: 'r1', set: { title: 'x' } })).toBeNull()
  })
  it('drops removed optional fields', () => {
    const r = applyRecipeOp({ ...base, minutes: 30 }, { opId: 'x', kind: 'recipe', id: 'r1', set: { minutes: undefined } })!
    expect(JSON.parse(JSON.stringify(r)).minutes).toBeUndefined()
  })
})

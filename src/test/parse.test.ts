import { describe, expect, it } from 'vitest'
import { parseRecipeText } from '../lib/parse'

describe('parseRecipeText', () => {
  it('reads a recipe with headings, numbered steps and wrapped lines', () => {
    const r = parseRecipeText(`Lemon Garlic Pasta
Serves 2 · Prep 10 mins · Cook 15 mins

Ingredients
- 200g spaghetti
- 2 cloves garlic, sliced
- 1 lemon, zested and juiced
- 3 tbsp olive oil

Method
1. Cook the pasta in salted water
until al dente.
2. Gently fry the garlic in the oil.
3. Toss everything together with the lemon.

Notes
Add chilli flakes if you like heat.`)!
    expect(r.title).toBe('Lemon Garlic Pasta')
    expect(r.servings).toBe(2)
    expect(r.minutes).toBe(25)
    expect(r.ingredients).toEqual(['200g spaghetti', '2 cloves garlic, sliced', '1 lemon, zested and juiced', '3 tbsp olive oil'])
    expect(r.steps).toEqual([
      'Cook the pasta in salted water until al dente.',
      'Gently fry the garlic in the oil.',
      'Toss everything together with the lemon.',
    ])
    expect(r.notes).toBe('Add chilli flakes if you like heat.')
  })

  it('skips sub-headings inside the ingredient list', () => {
    const r = parseRecipeText(`Fish tacos
Ingredients:
For the slaw:
1/4 red cabbage
1 lime
For the fish:
400g cod
Directions:
Make the slaw. Fry the fish. Assemble.`)!
    expect(r.ingredients).toEqual(['1/4 red cabbage', '1 lime', '400g cod'])
    expect(r.steps).toHaveLength(1)
  })

  it('copes with no headings', () => {
    const r = parseRecipeText(`Overnight oats
50g oats
100ml milk
1 tbsp honey
Stir everything together in a jar and leave in the fridge overnight, then top with fruit.`)!
    expect(r.ingredients).toEqual(['50g oats', '100ml milk', '1 tbsp honey'])
    expect(r.steps).toHaveLength(1)
  })

  it('gives up on text that is not a recipe', () => {
    expect(parseRecipeText('Hey, are we still on for dinner on Friday?\nLet me know!\nx')).toBeNull()
  })
})

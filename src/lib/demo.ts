// Dev-only sample data so the UI can be exercised without a GitHub repo.
import { processPhoto } from './image'
import { createProfiles, saveRecipe, useApp } from './store'

const SAMPLES = [
  {
    title: 'Dal tadka', types: ['curry'], servings: 4, minutes: 40, emoji: '🍛', bg: ['#F6C453', '#C4561D'], who: ['p1', 'p2'],
    ingredients: ['1 cup toor dal', '1 onion, finely chopped', '2 tomatoes', '2 green chillies', '1 tsp cumin seeds', '½ tsp turmeric', '2 tbsp ghee', 'Salt to taste'],
    steps: ['Rinse the dal and pressure cook with turmeric and 3 cups water for 4 whistles.', 'Heat ghee, crackle the cumin, then soften the onion and chillies.', 'Add tomatoes and cook down to a jammy masala.', 'Stir in the dal, loosen with water, simmer 5 minutes and season.'],
  },
  {
    title: 'Shakshuka', types: ['breakfast'], servings: 2, minutes: 25, emoji: '🍳', bg: ['#FF8A5B', '#B8321C'], who: ['p2'],
    ingredients: ['4 eggs', '1 tin chopped tomatoes', '1 red pepper', '2 cloves garlic', '1 tsp smoked paprika', 'Feta and parsley to finish'],
    steps: ['Soften the pepper and garlic in olive oil.', 'Add paprika and tomatoes, simmer until thick.', 'Make wells, crack in the eggs, cover until just set.', 'Crumble feta over and serve with bread.'],
  },
  {
    title: 'Tiramisu', types: ['dessert'], servings: 6, minutes: 30, emoji: '🍰', bg: ['#E9C9A6', '#7A4A2B'], who: ['p1'],
    ingredients: ['250g mascarpone', '3 eggs, separated', '75g caster sugar', '200ml strong coffee', '200g savoiardi', 'Cocoa for dusting'],
    steps: ['Whisk yolks with sugar until pale, then fold in mascarpone.', 'Whip whites to soft peaks and fold through.', 'Dip biscuits in coffee and layer with the cream.', 'Chill overnight and dust with cocoa.'],
  },
  {
    title: 'Pesto pasta', types: ['pasta'], servings: 2, minutes: 15, emoji: '🍝', bg: ['#B9D97A', '#3F7A2E'], who: ['p1', 'p2'],
    ingredients: ['200g spaghetti', '2 handfuls basil', '30g pine nuts', '40g parmesan', '1 clove garlic', '80ml olive oil'],
    steps: ['Boil the pasta in well-salted water.', 'Blitz basil, nuts, garlic, parmesan and oil.', 'Toss with pasta and a splash of the cooking water.'],
  },
  {
    title: 'Masala chai', types: ['drink'], servings: 2, minutes: 10, emoji: '☕', bg: ['#E7B98A', '#8A4E24'], who: ['p2'],
    ingredients: ['1 cup water', '1 cup milk', '2 tsp loose black tea', '3 cardamom pods, crushed', '1 inch ginger, grated', '2 tsp sugar'],
    steps: ['Boil water with ginger and cardamom.', 'Add tea, then milk and sugar.', 'Bring to a rolling boil twice and strain.'],
  },
  { title: 'Roast potatoes', types: ['side'], servings: 4, minutes: 70, emoji: '🥔', bg: ['#F3D27A', '#B07A26'], who: ['p1'], ingredients: ['1kg Maris Piper potatoes', '4 tbsp goose fat', 'Rosemary', 'Flaky salt'], steps: ['Parboil 8 minutes and rough up.', 'Roast in smoking-hot fat at 220°C for 50 minutes, turning once.'] },
]

async function art(emoji: string, [a, b]: string[]) {
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 1500
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(420, 380, 60, 600, 750, 1100)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = 'rgba(255,255,255,.9)'
  ctx.beginPath()
  ctx.arc(600, 760, 430, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,.06)'
  ctx.beginPath()
  ctx.arc(600, 760, 330, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '520px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 600, 790)
  return new Promise<Blob>((r) => c.toBlob((x) => r(x!), 'image/jpeg', 0.9))
}

export async function seedDemo() {
  if (!useApp.getState().profiles) {
    await createProfiles(
      [
        { id: 'p1', name: 'Alex', emoji: '🧑‍🍳', color: '#E4482F' },
        { id: 'p2', name: 'Sam', emoji: '🦊', color: '#7357F6' },
      ],
      'p1',
    )
  }
  for (const [i, x] of SAMPLES.entries()) {
    const photo = i === SAMPLES.length - 1 ? ('keep' as const) : await processPhoto(await art(x.emoji, x.bg))
    await saveRecipe({ title: x.title, types: x.types, servings: x.servings, minutes: x.minutes, ingredients: x.ingredients, steps: x.steps, knownBy: x.who, photo }, null)
  }
}

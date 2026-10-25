// Dev-only sample data so the UI can be exercised without a GitHub repo.
import { processPhoto } from './image'
import { createProfiles, saveRecipe, useApp } from './store'

const SAMPLES = [
  {
    title: 'Dal tadka', cuisine: 'indian', temp: 'hot' as const, types: ['curry'], servings: 4, minutes: 40, emoji: '🍛', bg: ['#F6C453', '#C4561D'], who: ['p1', 'p2'],
    ingredients: ['1 cup toor dal', '1 onion, finely chopped', '2 tomatoes', '2 green chillies', '1 tsp cumin seeds', '½ tsp turmeric', '2 tbsp ghee', 'Salt to taste'],
    steps: ['Rinse the dal and pressure cook with turmeric and 3 cups water for 4 whistles.', 'Heat ghee, crackle the cumin, then soften the onion and chillies.', 'Add tomatoes and cook down to a jammy masala.', 'Stir in the dal, loosen with water, simmer 5 minutes and season.'],
  },
  {
    title: 'Shakshuka', cuisine: 'middle-eastern', temp: 'hot' as const, types: ['breakfast'], servings: 2, minutes: 25, emoji: '🍳', bg: ['#FF8A5B', '#B8321C'], who: ['p2'],
    ingredients: ['4 eggs', '1 tin chopped tomatoes', '1 red pepper', '2 cloves garlic', '1 tsp smoked paprika', 'Feta and parsley to finish'],
    steps: ['Soften the pepper and garlic in olive oil.', 'Add paprika and tomatoes, simmer until thick.', 'Make wells, crack in the eggs, cover until just set.', 'Crumble feta over and serve with bread.'],
  },
  {
    title: 'Tiramisu', cuisine: 'italian', temp: 'cold' as const, types: ['dessert'], servings: 6, minutes: 30, emoji: '🍰', bg: ['#E9C9A6', '#7A4A2B'], who: ['p1'],
    ingredients: ['250g mascarpone', '3 eggs, separated', '75g caster sugar', '200ml strong coffee', '200g savoiardi', 'Cocoa for dusting'],
    steps: ['Whisk yolks with sugar until pale, then fold in mascarpone.', 'Whip whites to soft peaks and fold through.', 'Dip biscuits in coffee and layer with the cream.', 'Chill overnight and dust with cocoa.'],
  },
  {
    title: 'Pesto pasta', cuisine: 'italian', temp: 'hot' as const, types: ['pasta'], servings: 2, minutes: 15, emoji: '🍝', bg: ['#B9D97A', '#3F7A2E'], who: ['p1', 'p2'],
    ingredients: ['200g spaghetti', '2 handfuls basil', '30g pine nuts', '40g parmesan', '1 clove garlic', '80ml olive oil'],
    steps: ['Boil the pasta in well-salted water.', 'Blitz basil, nuts, garlic, parmesan and oil.', 'Toss with pasta and a splash of the cooking water.'],
  },
  {
    title: 'Masala chai', cuisine: 'indian', temp: 'hot' as const, types: ['drink'], servings: 2, minutes: 10, emoji: '☕', bg: ['#E7B98A', '#8A4E24'], who: ['p2'],
    ingredients: ['1 cup water', '1 cup milk', '2 tsp loose black tea', '3 cardamom pods, crushed', '1 inch ginger, grated', '2 tsp sugar'],
    steps: ['Boil water with ginger and cardamom.', 'Add tea, then milk and sugar.', 'Bring to a rolling boil twice and strain.'],
  },
  { title: 'Roast potatoes', cuisine: 'british', temp: 'hot' as const, types: ['side'], servings: 4, minutes: 70, emoji: '🥔', bg: ['#F3D27A', '#B07A26'], who: ['p1'], ingredients: ['1kg Maris Piper potatoes', '4 tbsp goose fat', 'Rosemary', 'Flaky salt'], steps: ['Parboil 8 minutes and rough up.', 'Roast in smoking-hot fat at 220°C for 50 minutes, turning once.'] },
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

const EXTRA = ['Lemon risotto', 'Aloo gobi', 'Banana bread', 'Gazpacho', 'Chicken katsu', 'Panzanella', 'Paneer tikka', 'Crème brûlée', 'Mushroom ragù', 'Iced matcha', 'Chana masala', 'Focaccia', 'Miso soup', 'Ceviche', 'Pad thai']
const EXTRA_CUISINES = ['italian', 'indian', 'british', 'spanish', 'japanese', 'italian', 'indian', 'french', 'italian', 'japanese', 'indian', 'italian', 'japanese', 'mexican', 'thai']
const EXTRA_TYPES = ['rice', 'curry', 'baking', 'soup', 'main', 'salad', 'curry', 'dessert', 'pasta', 'drink', 'curry', 'bread', 'soup', 'main', 'main']

export async function seedDemo(extra = 0) {
  if (!useApp.getState().profiles) {
    await createProfiles(
      [
        { id: 'p1', name: 'Alex', emoji: '', color: '#7D2E36' },
        { id: 'p2', name: 'Sam', emoji: '', color: '#2E4A6B' },
      ],
      'p1',
    )
  }
  for (const [i, x] of SAMPLES.entries()) {
    const photo = i === SAMPLES.length - 1 ? ('keep' as const) : await processPhoto(await art(x.emoji, x.bg))
    await saveRecipe({ title: x.title, cuisine: x.cuisine, temp: x.temp, types: x.types, servings: x.servings, minutes: x.minutes, ingredients: x.ingredients, steps: x.steps, knownBy: x.who, photo }, null)
  }
  for (let i = 0; i < extra; i++) {
    const title = EXTRA[i % EXTRA.length]
    await saveRecipe(
      { title, cuisine: EXTRA_CUISINES[i % EXTRA_CUISINES.length], temp: i % 3 === 1 ? 'cold' : 'hot', types: [EXTRA_TYPES[i % EXTRA_TYPES.length]], servings: 2 + (i % 4), minutes: 15 + 5 * (i % 9), ingredients: ['Something good'], steps: ['Cook it with love'], knownBy: i % 2 ? ['p1'] : ['p1', 'p2'], photo: 'keep' },
      null,
    )
  }
}

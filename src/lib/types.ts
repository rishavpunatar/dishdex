export type PersonId = string

export interface Person {
  id: PersonId
  name: string
  emoji: string
  color: string
}

export interface Profiles {
  v: 1
  people: Person[]
}

export interface PhotoRef {
  path: string
  w: number
  h: number
}

export interface LearnRequest {
  from: PersonId
  at: string
  note?: string
}

export interface Recipe {
  v: 1
  id: string
  title: string
  servings: number
  minutes?: number
  types: string[]
  ingredients: string[]
  steps: string[]
  notes?: string
  knownBy: PersonId[]
  /** People who've been sent this dish to learn, keyed by the learner. */
  learning: Record<PersonId, LearnRequest>
  photo?: PhotoRef
  /** Small inline JPEG (data URL) so the grid paints instantly. */
  thumb?: string
  createdAt: string
  createdBy: PersonId
  updatedAt: string
  updatedBy: PersonId
}

export interface Connection {
  repo: string
  token: string
  branch: string
}

export interface DishType {
  id: string
  label: string
  color: string
  emoji: string
}

export const DISH_TYPES: DishType[] = [
  { id: 'breakfast', label: 'Breakfast', color: '#F0A030', emoji: '🍳' },
  { id: 'main', label: 'Main', color: '#E4482F', emoji: '🍽️' },
  { id: 'curry', label: 'Curry', color: '#D97A1E', emoji: '🍛' },
  { id: 'pasta', label: 'Pasta', color: '#D9A21E', emoji: '🍝' },
  { id: 'rice', label: 'Rice & grains', color: '#B8925A', emoji: '🍚' },
  { id: 'soup', label: 'Soup', color: '#DD6B33', emoji: '🍲' },
  { id: 'salad', label: 'Salad', color: '#4E9E52', emoji: '🥗' },
  { id: 'side', label: 'Side', color: '#6E9F3F', emoji: '🥦' },
  { id: 'bread', label: 'Bread', color: '#A9733F', emoji: '🫓' },
  { id: 'snack', label: 'Snack', color: '#C98A12', emoji: '🥨' },
  { id: 'dessert', label: 'Dessert', color: '#DB5A93', emoji: '🍰' },
  { id: 'baking', label: 'Baking', color: '#B86E3E', emoji: '🥐' },
  { id: 'drink', label: 'Drink', color: '#3D8BD1', emoji: '🍹' },
  { id: 'sauce', label: 'Sauce & dip', color: '#B0403A', emoji: '🫙' },
]

export const typeById = (id: string) => DISH_TYPES.find((t) => t.id === id)

export const PERSON_COLORS = ['#E4482F', '#7357F6', '#159A88', '#E39B2D', '#DD4F92', '#2F7FE8', '#4F9A43', '#8A5A3B']

export const PERSON_EMOJI = ['🧑‍🍳', '🦊', '🐻', '🐼', '🐯', '🐸', '🐙', '🦄', '🐝', '🌶️', '🥑', '🍋', '🍓', '🧄', '🍩', '🌮', '🥟', '🍜', '🧁', '🍕']

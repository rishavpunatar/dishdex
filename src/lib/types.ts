export type PersonId = string

export interface Person {
  id: PersonId
  name: string
  /** Legacy: avatars are always the initial now; kept so older profiles still parse. */
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
  /** How it's served. */
  temp?: 'hot' | 'cold'
  /** One cuisine id from CUISINES. */
  cuisine?: string
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
  { id: 'breakfast', label: 'Breakfast', color: '#C1903A', emoji: '🍳' },
  { id: 'main', label: 'Main', color: '#8E3B2F', emoji: '🍽️' },
  { id: 'curry', label: 'Curry', color: '#B0662B', emoji: '🍛' },
  { id: 'pasta', label: 'Pasta', color: '#B89A45', emoji: '🍝' },
  { id: 'rice', label: 'Rice & grains', color: '#A08B62', emoji: '🍚' },
  { id: 'soup', label: 'Soup', color: '#A85F3C', emoji: '🍲' },
  { id: 'salad', label: 'Salad', color: '#5C8550', emoji: '🥗' },
  { id: 'side', label: 'Side', color: '#76874A', emoji: '🥦' },
  { id: 'bread', label: 'Bread', color: '#93704C', emoji: '🫓' },
  { id: 'snack', label: 'Snack', color: '#A9843A', emoji: '🥨' },
  { id: 'dessert', label: 'Dessert', color: '#A8566F', emoji: '🍰' },
  { id: 'baking', label: 'Baking', color: '#9C6744', emoji: '🥐' },
  { id: 'drink', label: 'Drink', color: '#3E7189', emoji: '🍹' },
  { id: 'sauce', label: 'Sauce & dip', color: '#87403C', emoji: '🫙' },
]

export const typeById = (id: string) => DISH_TYPES.find((t) => t.id === id)

export interface Cuisine {
  id: string
  label: string
  color: string
}

export const CUISINES: Cuisine[] = [
  { id: 'indian', label: 'Indian', color: '#C07A2C' },
  { id: 'korean', label: 'Korean', color: '#A8413A' },
  { id: 'japanese', label: 'Japanese', color: '#B04C55' },
  { id: 'chinese', label: 'Chinese', color: '#9E3A2E' },
  { id: 'thai', label: 'Thai', color: '#5E8A4A' },
  { id: 'vietnamese', label: 'Vietnamese', color: '#6E8F45' },
  { id: 'spanish', label: 'Spanish', color: '#B5652F' },
  { id: 'italian', label: 'Italian', color: '#4F7A4E' },
  { id: 'greek', label: 'Greek', color: '#3E6F92' },
  { id: 'middle-eastern', label: 'Middle Eastern', color: '#A9813F' },
  { id: 'turkish', label: 'Turkish', color: '#8E3B45' },
  { id: 'british', label: 'British', color: '#3F5370' },
  { id: 'french', label: 'French', color: '#5A5E8C' },
  { id: 'mexican', label: 'Mexican', color: '#A8562E' },
  { id: 'american', label: 'American', color: '#6A5446' },
]

export const cuisineById = (id?: string) => (id ? CUISINES.find((c) => c.id === id) : undefined)

export const PERSON_COLORS = ['#7D2E36', '#2E4A6B', '#2E5446', '#A27A43', '#8A5A3E', '#5E6A4A', '#6A4A6E', '#3D6B6A']


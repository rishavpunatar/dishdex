/**
 * The dex levels up as the pair of you log more dishes. Every ten unlocks a
 * medal and a new tier; medals are collected (with a ceremony) on each phone.
 */
export interface Tier {
  key: string
  name: string
  title: string
  at: number
  /** light, mid, dark stops of the metal */
  colors: [string, string, string]
  ink: string
}

export const TIERS: Tier[] = [
  { key: 'stone', name: 'Stone', title: 'Kitchen rookies', at: 0, colors: ['#E4E0D9', '#ABA59C', '#6E685F'], ink: '#3A362F' },
  { key: 'bronze', name: 'Bronze', title: 'Home cooks', at: 10, colors: ['#F6D2AA', '#C1814B', '#74401C'], ink: '#43220C' },
  { key: 'silver', name: 'Silver', title: 'Sous chefs', at: 20, colors: ['#FFFFFF', '#C9CED4', '#78818B'], ink: '#323840' },
  { key: 'gold', name: 'Gold', title: 'Head chefs', at: 30, colors: ['#FFF2C2', '#DDB14E', '#8F6310'], ink: '#4A3003' },
  { key: 'platinum', name: 'Platinum', title: 'Executive chefs', at: 40, colors: ['#FCFDFF', '#CED6E8', '#717DA0'], ink: '#262E44' },
  { key: 'diamond', name: 'Diamond', title: 'Culinary legends', at: 50, colors: ['#F2FEFF', '#A8E7F3', '#3488AB'], ink: '#0A374B' },
]

export const MILESTONES = TIERS.filter((t) => t.at > 0)
export const TOP = MILESTONES[MILESTONES.length - 1].at

export const tierFor = (n: number) => [...TIERS].reverse().find((t) => n >= t.at)!
export const nextTier = (n: number) => TIERS.find((t) => t.at > n) ?? null

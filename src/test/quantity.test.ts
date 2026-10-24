import { describe, expect, it } from 'vitest'
import { formatNum, parseNum, scaleLine } from '../lib/quantity'

describe('parseNum', () => {
  it('reads common quantity forms', () => {
    expect(parseNum('2')).toBe(2)
    expect(parseNum('1.5')).toBe(1.5)
    expect(parseNum('1,5')).toBe(1.5)
    expect(parseNum('1/2')).toBe(0.5)
    expect(parseNum('1 1/2')).toBe(1.5)
    expect(parseNum('½')).toBe(0.5)
    expect(parseNum('2½')).toBe(2.5)
  })
})

describe('formatNum', () => {
  it('prefers kitchen fractions', () => {
    expect(formatNum(0.5)).toBe('½')
    expect(formatNum(1.5)).toBe('1½')
    expect(formatNum(0.333)).toBe('⅓')
    expect(formatNum(3)).toBe('3')
    expect(formatNum(266.67)).toBe('267')
    expect(formatNum(1.2)).toBe('1.2')
  })
})

describe('scaleLine', () => {
  it('leaves lines alone at 1x', () => {
    expect(scaleLine('200g basmati rice', 1)).toEqual({ qty: '200g', rest: 'basmati rice' })
  })
  it('scales grams, cups, ranges and counts', () => {
    expect(scaleLine('200g basmati rice', 2)).toEqual({ qty: '400g', rest: 'basmati rice' })
    expect(scaleLine('1 1/2 cups milk', 2)).toEqual({ qty: '3 cups', rest: 'milk' })
    expect(scaleLine('2-3 green chillies', 2)).toEqual({ qty: '4–6', rest: 'green chillies' })
    expect(scaleLine('3 eggs', 0.5)).toEqual({ qty: '1½', rest: 'eggs' })
    expect(scaleLine('½ tsp salt', 2)).toEqual({ qty: '1 tsp', rest: 'salt' })
    expect(scaleLine('1 cup toor dal', 2)).toEqual({ qty: '2 cups', rest: 'toor dal' })
  })
  it('ignores lines without a leading amount', () => {
    expect(scaleLine('Salt to taste', 3)).toEqual({ qty: null, rest: 'Salt to taste' })
  })
})

import { describe, it, expect } from 'vitest'
import { computeProjectProgressFromTasks } from '../lib/utils/recalc-progress'

describe('computeProjectProgressFromTasks', () => {
  it('computes 21% for 12 done out of 56', () => {
    const tasks = Array.from({ length: 56 }).fill(null).map((_, i) => ({ status: i < 12 ? 'Done' : 'To Do' }))
    const progress = computeProjectProgressFromTasks(tasks)
    expect(progress).toBe(21)
  })

  it('returns 0 when there are no tasks', () => {
    expect(computeProjectProgressFromTasks([])).toBe(0)
  })
})

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

  it('ignores tasks that do not affect project progress', () => {
    const progress = computeProjectProgressFromTasks([
      { status: 'Done' },
      { status: 'To Do' },
      { status: 'To Do', affects_project_progress: false },
      { status: 'Done', affects_project_progress: false },
    ])

    expect(progress).toBe(50)
  })

  it('returns 0 when all tasks are excluded from project progress', () => {
    expect(computeProjectProgressFromTasks([
      { status: 'Done', affects_project_progress: false },
      { status: 'To Do', affects_project_progress: false },
    ])).toBe(0)
  })
})

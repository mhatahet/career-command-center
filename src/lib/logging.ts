/* ============================================================================
   Activity logging
   ----------------------------------------------------------------------------
   Completing work anywhere in the app appends to the same activity log, which is
   the single source for streaks, heat maps, velocity and hours-by-skill.

   Kept here as a pure function rather than duplicated per page, so the shape of
   an activity row can never drift between the Dashboard and the Learning Path.
   ========================================================================= */

import type { ActivityLog, ID, ISODate, TaskArea } from './types'

export interface WorkLogEntry {
  hours: number
  xp: number
  area: TaskArea
  /** Hours are split evenly across these competencies. */
  skillIds?: ID[]
  /** Optional note attached to the day. */
  note?: string
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Add a completed piece of work to `date`'s row, creating the row if today has
 * nothing logged yet. Returns a new array — the input is never mutated.
 */
export function addHoursToToday(
  activity: ActivityLog[],
  date: ISODate,
  entry: WorkLogEntry,
): ActivityLog[] {
  const skillIds = entry.skillIds ?? []
  const perSkill = skillIds.length > 0 ? entry.hours / skillIds.length : 0
  const existing = activity.find((row) => row.date === date)

  if (!existing) {
    const bySkill: Record<ID, number> = {}
    for (const skillId of skillIds) bySkill[skillId] = round2(perSkill)

    return [
      ...activity,
      {
        date,
        hours: round1(entry.hours),
        xp: entry.xp,
        tasksCompleted: 1,
        bySkill,
        byArea: { [entry.area]: round1(entry.hours) } as Partial<Record<TaskArea, number>>,
        note: entry.note,
      },
    ].sort((a, b) => a.date.localeCompare(b.date))
  }

  const bySkill: Record<ID, number> = { ...existing.bySkill }
  for (const skillId of skillIds) {
    bySkill[skillId] = round2((bySkill[skillId] ?? 0) + perSkill)
  }

  return activity.map((row) =>
    row.date === date
      ? {
          ...row,
          hours: round1(row.hours + entry.hours),
          xp: row.xp + entry.xp,
          tasksCompleted: row.tasksCompleted + 1,
          bySkill,
          byArea: {
            ...row.byArea,
            [entry.area]: round1((row.byArea[entry.area] ?? 0) + entry.hours),
          },
          note: entry.note ?? row.note,
        }
      : row,
  )
}

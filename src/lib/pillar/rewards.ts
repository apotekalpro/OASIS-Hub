export type IncentiveBasis = 'per_outlet' | 'per_pax'
export type RewardCategory = 'bronze' | 'silver' | 'gold' | 'platinum' | 'titanium'

export interface RewardAssignmentInput {
  status: string
  incentive1_amount: number
  incentive1_basis: IncentiveBasis
}

export interface RewardTierMatrix {
  t1_reward: number
  t2_reward: number
  t3_reward: number
}

export interface RewardTargets {
  t1: number
  t2: number
  t3: number
}

export interface RewardBreakdown {
  incentive1: { achieved: number; potential: number }
  incentive2: { achieved: number; potential: number; tierHit: 0 | 1 | 2 | 3 }
  incentive3: { achieved: number; potential: number }
  total: { achieved: number; potential: number }
}

export const FOCUS_PRODUCT_THRESHOLD_PCT = 32
export const INCENTIVE3_BOOST_RATE = 0.3

function incentiveAmount(amount: number, basis: IncentiveBasis, headcount: number) {
  return basis === 'per_pax' ? amount * headcount : amount
}

export function calcIncentive1(assignments: RewardAssignmentInput[], headcount: number) {
  const achieved = assignments
    .filter(a => a.status === 'completed')
    .reduce((sum, a) => sum + incentiveAmount(a.incentive1_amount, a.incentive1_basis, headcount), 0)
  const potential = assignments
    .reduce((sum, a) => sum + incentiveAmount(a.incentive1_amount, a.incentive1_basis, headcount), 0)
  return { achieved, potential }
}

export function calcIncentive2(revenue: number, targets: RewardTargets | null, matrix: RewardTierMatrix | null, headcount: number) {
  if (!targets || !matrix) return { achieved: 0, potential: 0, tierHit: 0 as const }
  let tierHit: 0 | 1 | 2 | 3 = 0
  let rewardPerPax = 0
  if (targets.t3 > 0 && revenue >= targets.t3) { tierHit = 3; rewardPerPax = matrix.t3_reward }
  else if (targets.t2 > 0 && revenue >= targets.t2) { tierHit = 2; rewardPerPax = matrix.t2_reward }
  else if (targets.t1 > 0 && revenue >= targets.t1) { tierHit = 1; rewardPerPax = matrix.t1_reward }

  return {
    achieved: rewardPerPax * headcount,
    potential: matrix.t3_reward * headcount,
    tierHit,
  }
}

export function calcIncentive3(focusProductPct: number, incentive1: { achieved: number; potential: number }, incentive2: { achieved: number; potential: number }) {
  const achievedBase = incentive1.achieved + incentive2.achieved
  const potentialBase = incentive1.potential + incentive2.potential
  const qualifies = focusProductPct >= FOCUS_PRODUCT_THRESHOLD_PCT
  return {
    achieved: qualifies ? achievedBase * INCENTIVE3_BOOST_RATE : 0,
    potential: potentialBase * INCENTIVE3_BOOST_RATE,
  }
}

export function calcRewardBreakdown(params: {
  assignments: RewardAssignmentInput[]
  headcount: number
  revenue: number
  focusProductPct: number
  targets: RewardTargets | null
  matrix: RewardTierMatrix | null
}): RewardBreakdown {
  const headcount = Math.max(1, params.headcount)
  const incentive1 = calcIncentive1(params.assignments, headcount)
  const incentive2 = calcIncentive2(params.revenue, params.targets, params.matrix, headcount)
  const incentive3 = calcIncentive3(params.focusProductPct, incentive1, incentive2)

  return {
    incentive1,
    incentive2,
    incentive3,
    total: {
      achieved: incentive1.achieved + incentive2.achieved + incentive3.achieved,
      potential: incentive1.potential + incentive2.potential + incentive3.potential,
    },
  }
}

export const REWARD_CATEGORIES: RewardCategory[] = ['bronze', 'silver', 'gold', 'platinum', 'titanium']

export function monthToDate(month: string) {
  return `${month.slice(0, 7)}-01`
}

/**
 * Linearly extrapolate a month-to-date revenue figure to a full-month forecast,
 * e.g. Rp 200jt as of day 20 of a 30-day month -> (200jt / 20) * 30.
 * Returns the input revenue unchanged if no as-of date is available.
 */
export function forecastRevenue(revenue: number, asOfDate: string | null | undefined): number {
  if (!asOfDate) return revenue
  const date = new Date(asOfDate)
  if (Number.isNaN(date.getTime())) return revenue
  const dayOfMonth = date.getDate()
  if (dayOfMonth <= 0) return revenue
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return (revenue / dayOfMonth) * daysInMonth
}

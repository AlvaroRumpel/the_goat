import type { Award, Career, Tier, Verdict } from './types'

const AWARDS: Award[] = ['allstar', 'mvp', 'dpoy', 'scoring', 'fmvp', 'ring']

export function computeVerdict(career: Career): Verdict {
  const counts = Object.fromEntries(AWARDS.map(a => [a, 0])) as Record<Award, number>
  let points = 0, rebounds = 0, assists = 0, peakPpg = 0
  for (const s of career.seasons) {
    points += s.ppg * s.games
    rebounds += s.rpg * s.games
    assists += s.apg * s.games
    peakPpg = Math.max(peakPpg, s.ppg)
    for (const a of s.awards) counts[a]++
  }
  const loyalty =
    career.seasons.length >= 10 &&
    new Set(career.seasons.map(s => s.finalTeamId)).size === 1 ? 40 : 0

  const score = Math.round(
    counts.ring * 120 + counts.fmvp * 60 + counts.mvp * 80 + counts.dpoy * 25 +
    counts.scoring * 20 + counts.allstar * 15 +
    points / 400 + peakPpg * 2 + loyalty + career.fame * 0.5,
  )
  const totals = {
    points: Math.round(points), rebounds: Math.round(rebounds),
    assists: Math.round(assists), seasons: career.seasons.length,
  }

  let tier: Tier =
    score >= 1950 ? 'goat' :
    score >= 950 ? 'legend' :
    score >= 650 ? 'superstar' :
    score >= 400 ? 'allstar' :
    score >= 220 ? 'starter' :
    score >= 100 ? 'rolePlayer' : 'peladeiro'

  // Iconic gate: a high score alone doesn't make a GOAT. Needs Jordan-style
  // dominance (rings + MVPs) or LeBron-style longevity (totals + rings).
  if (tier === 'goat') {
    const jordanPath = counts.ring >= 5 && counts.mvp >= 3
    const lebronPath = totals.points >= 38000 && counts.ring >= 4
    if (!jordanPath && !lebronPath) tier = 'legend'
  }

  return { score, tier, counts, totals }
}

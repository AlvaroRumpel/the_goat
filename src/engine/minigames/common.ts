import { ageMultiplier } from '../season'
import type { Archetype, Build, LeaguePlayer, LeagueState, LeagueTag, WatchedGameKind } from '../types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface OppPlayer { id: string; name: string; short: string; pos: Archetype; ovr: number; tags: LeagueTag[]; speed: number; reach: number }

function toOpp(p: LeaguePlayer): OppPlayer {
  const speed = clamp((3.2 + (p.ovr - 55) / 45 * 1.2) * (p.tags.includes('defender') ? 1.08 : 1), 3.0, 4.4)
  const reach = p.pos === 'C' ? 2.9 : p.pos === 'PF' ? 2.8 : 2.7
  return { id: p.id, name: p.name, short: (p.name.split(' ').at(-1) ?? p.name).toUpperCase(), pos: p.pos, ovr: p.ovr, tags: p.tags, speed, reach }
}
export function opponentFive(league: LeagueState, teamId: string): OppPlayer[] {
  return league.players.filter(p => p.teamId === teamId).sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id)).slice(0, 5).map(toOpp)
}
export function opponentStar(league: LeagueState, teamId: string): OppPlayer { return opponentFive(league, teamId)[0] }
export function bestDefender(five: OppPlayer[]): OppPlayer {
  const d = five.filter(p => p.tags.includes('defender')).sort((a, b) => b.ovr - a.ovr)[0]
  return d ?? five[0]
}

export interface Tendencies { shoot: number; drive: number; pass: number; side: 'left' | 'right' }
export function tendencies(p: OppPlayer): Tendencies {
  let shoot = 0.4, drive = 0.35, pass = 0.25
  if (p.tags.includes('shooter')) { shoot = 0.6; drive = 0.2; pass = 0.2 }
  else if (p.tags.includes('playmaker')) { shoot = 0.3; drive = 0.25; pass = 0.45 }
  else if (p.tags.includes('rebounder') || p.tags.includes('defender')) { shoot = 0.25; drive = 0.55; pass = 0.2 }
  const side = p.id.charCodeAt(p.id.length - 1) % 2 === 0 ? 'right' : 'left'   // determinístico por jogador
  return { shoot, drive, pass, side }
}

export function difficulty(kind: WatchedGameKind, starOvr: number): number {
  const base = kind === 'finals' ? 1.22 : kind === 'playoff' ? 1.12 : 1.0
  return base * (0.85 + (starOvr - 60) / 100)
}

export interface AttrMods {
  speed: number; feint: number; stripResist: number; laneSafety: number; jumpWindow: number
  reactMs: number; stealWindow: number; boxWindow: number; tremor: number; fatigue: number
  tol: Record<'layup' | 'floater' | 'mid' | 'three' | 'dunk', number>
}
// x = atributo efetivo − 60 (−20..39); cada mod é linear em x, clampado
export function attrMods(build: Build, age: number, quarter = 1): AttrMods {
  const m = ageMultiplier(age, build.attributes.physical)
  const a = (s: keyof Build['attributes']) => build.attributes[s] * m - 60
  const lin = (x: number, at0: number, per: number, lo: number, hi: number) => clamp(at0 + x * per, lo, hi)
  const physical = build.attributes.physical * m
  const fatigue = quarter >= 4 && physical < 65 ? clamp((65 - physical) / 65, 0, 0.3) : 0
  return {
    speed: lin(a('physical'), 1.0, 0.006, 0.8, 1.22),
    feint: lin(a('handles'), 0.8, 0.02, 0.5, 1.6),
    stripResist: lin(a('handles'), 1.0, 0.012, 0.7, 1.45),
    laneSafety: lin(a('passing'), 1.0, 0.014, 0.7, 1.5),
    jumpWindow: lin(a('physical'), 0.1, 0.0025, 0.06, 0.2) * (1 - fatigue * 0.6),
    reactMs: lin(a('defense'), 0, 3, -60, 120),
    stealWindow: lin(a('defense'), 0.12, 0.003, 0.07, 0.24),
    boxWindow: lin(a('rebounding'), 0.15, 0.003, 0.08, 0.26),
    tremor: lin(a('clutch'), 1.0, -0.015, 0.3, 1.3),
    fatigue,
    tol: {
      layup: lin(a('finishing'), 1.0, 0.008, 0.8, 1.3), floater: lin(a('finishing'), 0.95, 0.008, 0.75, 1.25),
      mid: lin(a('handles'), 1.0, 0.008, 0.8, 1.3), three: lin(a('three'), 1.0, 0.008, 0.8, 1.3), dunk: lin(a('finishing'), 1.0, 0.008, 0.8, 1.3),
    },
  }
}

export function timingHit(t: number, center: number, halfWidth: number): 'perfect' | 'hit' | 'miss' {
  const d = Math.abs(t - center)
  return d <= halfWidth * 0.25 ? 'perfect' : d <= halfWidth ? 'hit' : 'miss'
}
export function freeThrowP(ovr: number): number { return clamp(0.62 + (ovr - 60) * 0.006, 0.4, 0.92) }

// janela do rebote ofensivo (spec §2.3): seu box-out contra o reboteiro deles —
// tag `rebounder`, senão o maior ovr entre C/PF, senão o primeiro do five.
export function reboundWindow(mods: AttrMods, five: OppPlayer[]): number {
  const r = five.find(p => p.tags.includes('rebounder'))
    ?? five.filter(p => p.pos === 'C' || p.pos === 'PF').sort((a, b) => b.ovr - a.ovr)[0]
    ?? five[0]
  return clamp(mods.boxWindow * (1 - (r.ovr - 75) / 100), 0.05, 0.3)
}

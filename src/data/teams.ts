import type { Team } from '../engine/types'

export const TEAMS: Team[] = [
  { id: 'atl', city: 'Atlanta',       name: 'Hawks',         strength: 65, bigMarket: false },
  { id: 'bos', city: 'Boston',        name: 'Celtics',       strength: 82, bigMarket: true },
  { id: 'bkn', city: 'Brooklyn',      name: 'Nets',          strength: 60, bigMarket: true },
  { id: 'cha', city: 'Charlotte',     name: 'Hornets',       strength: 56, bigMarket: false },
  { id: 'chi', city: 'Chicago',       name: 'Bulls',         strength: 64, bigMarket: true },
  { id: 'cle', city: 'Cleveland',     name: 'Cavaliers',     strength: 76, bigMarket: false },
  { id: 'dal', city: 'Dallas',        name: 'Mavericks',     strength: 74, bigMarket: false },
  { id: 'den', city: 'Denver',        name: 'Nuggets',       strength: 80, bigMarket: false },
  { id: 'det', city: 'Detroit',       name: 'Pistons',       strength: 62, bigMarket: false },
  { id: 'gsw', city: 'Golden State',  name: 'Warriors',      strength: 75, bigMarket: true },
  { id: 'hou', city: 'Houston',       name: 'Rockets',       strength: 70, bigMarket: false },
  { id: 'ind', city: 'Indiana',       name: 'Pacers',        strength: 72, bigMarket: false },
  { id: 'lac', city: 'LA',            name: 'Clippers',      strength: 68, bigMarket: true },
  { id: 'lal', city: 'Los Angeles',   name: 'Lakers',        strength: 73, bigMarket: true },
  { id: 'mem', city: 'Memphis',       name: 'Grizzlies',     strength: 67, bigMarket: false },
  { id: 'mia', city: 'Miami',         name: 'Heat',          strength: 71, bigMarket: true },
  { id: 'mil', city: 'Milwaukee',     name: 'Bucks',         strength: 74, bigMarket: false },
  { id: 'min', city: 'Minnesota',     name: 'Timberwolves',  strength: 76, bigMarket: false },
  { id: 'nop', city: 'New Orleans',   name: 'Pelicans',      strength: 63, bigMarket: false },
  { id: 'nyk', city: 'New York',      name: 'Knicks',        strength: 77, bigMarket: true },
  { id: 'okc', city: 'Oklahoma City', name: 'Thunder',       strength: 85, bigMarket: false },
  { id: 'orl', city: 'Orlando',       name: 'Magic',         strength: 69, bigMarket: false },
  { id: 'phi', city: 'Philadelphia',  name: '76ers',         strength: 66, bigMarket: true },
  { id: 'phx', city: 'Phoenix',       name: 'Suns',          strength: 64, bigMarket: false },
  { id: 'por', city: 'Portland',      name: 'Trail Blazers', strength: 58, bigMarket: false },
  { id: 'sac', city: 'Sacramento',    name: 'Kings',         strength: 61, bigMarket: false },
  { id: 'sas', city: 'San Antonio',   name: 'Spurs',         strength: 68, bigMarket: false },
  { id: 'tor', city: 'Toronto',       name: 'Raptors',       strength: 60, bigMarket: false },
  { id: 'uta', city: 'Utah',          name: 'Jazz',          strength: 55, bigMarket: false },
  { id: 'was', city: 'Washington',    name: 'Wizards',       strength: 57, bigMarket: false },
]

export function teamById(id: string): Team {
  const t = TEAMS.find(t => t.id === id)
  if (!t) throw new Error(`unknown team: ${id}`)
  return t
}

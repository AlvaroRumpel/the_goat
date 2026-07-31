import type { Team } from '../engine/types'

export const TEAMS: Team[] = [
  { id: 'atl', city: 'Atlanta',       name: 'Hawks',         strength: 65, bigMarket: false, conf: 'east', motif: 'wing' },
  { id: 'bos', city: 'Boston',        name: 'Celtics',       strength: 82, bigMarket: true,  conf: 'east', motif: 'leprechaun' },
  { id: 'bkn', city: 'Brooklyn',      name: 'Nets',          strength: 60, bigMarket: true,  conf: 'east', motif: 'net' },
  { id: 'cha', city: 'Charlotte',     name: 'Hornets',       strength: 56, bigMarket: false, conf: 'east', motif: 'bee' },
  { id: 'chi', city: 'Chicago',       name: 'Bulls',         strength: 64, bigMarket: true,  conf: 'east', motif: 'bull' },
  { id: 'cle', city: 'Cleveland',     name: 'Cavaliers',     strength: 76, bigMarket: false, conf: 'east', motif: 'spear' },
  { id: 'dal', city: 'Dallas',        name: 'Mavericks',     strength: 74, bigMarket: false, conf: 'west', motif: 'horseshoe' },
  { id: 'den', city: 'Denver',        name: 'Nuggets',       strength: 80, bigMarket: false, conf: 'west', motif: 'pickaxe' },
  { id: 'det', city: 'Detroit',       name: 'Pistons',       strength: 62, bigMarket: false, conf: 'east', motif: 'gear' },
  { id: 'gsw', city: 'Golden State',  name: 'Warriors',      strength: 75, bigMarket: true,  conf: 'west', motif: 'bridge' },
  { id: 'hou', city: 'Houston',       name: 'Rockets',       strength: 70, bigMarket: false, conf: 'west', motif: 'rocket' },
  { id: 'ind', city: 'Indiana',       name: 'Pacers',        strength: 72, bigMarket: false, conf: 'east', motif: 'wheel' },
  { id: 'lac', city: 'LA',            name: 'Clippers',      strength: 68, bigMarket: true,  conf: 'west', motif: 'anchor' },
  { id: 'lal', city: 'Los Angeles',   name: 'Lakers',        strength: 73, bigMarket: true,  conf: 'west', motif: 'palm' },
  { id: 'mem', city: 'Memphis',       name: 'Grizzlies',     strength: 67, bigMarket: false, conf: 'west', motif: 'claw' },
  { id: 'mia', city: 'Miami',         name: 'Heat',          strength: 71, bigMarket: true,  conf: 'east', motif: 'flame' },
  { id: 'mil', city: 'Milwaukee',     name: 'Bucks',         strength: 74, bigMarket: false, conf: 'east', motif: 'deer' },
  { id: 'min', city: 'Minnesota',     name: 'Timberwolves',  strength: 76, bigMarket: false, conf: 'west', motif: 'wolf' },
  { id: 'nop', city: 'New Orleans',   name: 'Pelicans',      strength: 63, bigMarket: false, conf: 'west', motif: 'pelican' },
  { id: 'nyk', city: 'New York',      name: 'Knicks',        strength: 77, bigMarket: true,  conf: 'east', motif: 'lighthouse' },
  { id: 'okc', city: 'Oklahoma City', name: 'Thunder',       strength: 85, bigMarket: false, conf: 'west', motif: 'bolt' },
  { id: 'orl', city: 'Orlando',       name: 'Magic',         strength: 69, bigMarket: false, conf: 'east', motif: 'star' },
  { id: 'phi', city: 'Philadelphia',  name: '76ers',         strength: 66, bigMarket: true,  conf: 'east', motif: 'bell' },
  { id: 'phx', city: 'Phoenix',       name: 'Suns',          strength: 64, bigMarket: false, conf: 'west', motif: 'sun' },
  { id: 'por', city: 'Portland',      name: 'Trail Blazers', strength: 58, bigMarket: false, conf: 'west', motif: 'pine' },
  { id: 'sac', city: 'Sacramento',    name: 'Kings',         strength: 61, bigMarket: false, conf: 'west', motif: 'crown' },
  { id: 'sas', city: 'San Antonio',   name: 'Spurs',         strength: 68, bigMarket: false, conf: 'west', motif: 'cactus' },
  { id: 'tor', city: 'Toronto',       name: 'Raptors',       strength: 60, bigMarket: false, conf: 'east', motif: 'dino' },
  { id: 'uta', city: 'Utah',          name: 'Jazz',          strength: 55, bigMarket: false, conf: 'west', motif: 'mountain' },
  { id: 'was', city: 'Washington',    name: 'Wizards',       strength: 57, bigMarket: false, conf: 'east', motif: 'wand' },
]

export function teamById(id: string): Team {
  const t = TEAMS.find(t => t.id === id)
  if (!t) throw new Error(`unknown team: ${id}`)
  return t
}

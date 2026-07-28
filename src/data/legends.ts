import type { Legend } from '../engine/types'

export const LEGENDS: Legend[] = [
  // three
  { id: 'curry',    name: 'Stephen Curry',       slot: 'three',      value: 99, malusSlot: 'physical',   malus: 8 },
  { id: 'bird',     name: 'Larry Bird',          slot: 'three',      value: 95, malusSlot: 'handles',    malus: 6 },
  { id: 'ray',      name: 'Ray Allen',           slot: 'three',      value: 92, malusSlot: 'rebounding', malus: 4 },
  // finishing
  { id: 'shaq',     name: 'Shaquille O\'Neal',   slot: 'finishing',  value: 99, malusSlot: 'three',      malus: 9 },
  { id: 'kareem',   name: 'Kareem Abdul-Jabbar', slot: 'finishing',  value: 96, malusSlot: 'handles',    malus: 6 },
  { id: 'duncan',   name: 'Tim Duncan',          slot: 'finishing',  value: 92, malusSlot: 'three',      malus: 4 },
  // passing
  { id: 'magic',    name: 'Magic Johnson',       slot: 'passing',    value: 99, malusSlot: 'defense',    malus: 8 },
  { id: 'nash',     name: 'Steve Nash',          slot: 'passing',    value: 95, malusSlot: 'defense',    malus: 6 },
  { id: 'oscar',    name: 'Oscar Robertson',     slot: 'passing',    value: 92, malusSlot: 'three',      malus: 4 },
  // handles
  { id: 'kyrie',    name: 'Kyrie Irving',        slot: 'handles',    value: 98, malusSlot: 'defense',    malus: 8 },
  { id: 'iverson',  name: 'Allen Iverson',       slot: 'handles',    value: 96, malusSlot: 'physical',   malus: 7 },
  { id: 'penny',    name: 'Penny Hardaway',      slot: 'handles',    value: 91, malusSlot: 'clutch',     malus: 4 },
  // defense
  { id: 'russell',  name: 'Bill Russell',        slot: 'defense',    value: 99, malusSlot: 'three',      malus: 8 },
  { id: 'hakeem',   name: 'Hakeem Olajuwon',     slot: 'defense',    value: 96, malusSlot: 'passing',    malus: 6 },
  { id: 'kawhi',    name: 'Kawhi Leonard',       slot: 'defense',    value: 93, malusSlot: 'passing',    malus: 4 },
  // rebounding
  { id: 'rodman',   name: 'Dennis Rodman',       slot: 'rebounding', value: 99, malusSlot: 'clutch',     malus: 9 },
  { id: 'wilt',     name: 'Wilt Chamberlain',    slot: 'rebounding', value: 97, malusSlot: 'three',      malus: 6 },
  { id: 'moses',    name: 'Moses Malone',        slot: 'rebounding', value: 93, malusSlot: 'passing',    malus: 4 },
  // physical
  { id: 'lebron',   name: 'LeBron James',        slot: 'physical',   value: 99, malusSlot: 'clutch',     malus: 7 },
  { id: 'giannis',  name: 'Giannis Antetokounmpo', slot: 'physical', value: 96, malusSlot: 'three',      malus: 6 },
  { id: 'karl',     name: 'Karl Malone',         slot: 'physical',   value: 93, malusSlot: 'clutch',     malus: 5 },
  // clutch
  { id: 'jordan',   name: 'Michael Jordan',      slot: 'clutch',     value: 99, malusSlot: 'three',      malus: 7 },
  { id: 'kobe',     name: 'Kobe Bryant',         slot: 'clutch',     value: 97, malusSlot: 'passing',    malus: 6 },
  { id: 'durant',   name: 'Kevin Durant',        slot: 'clutch',     value: 94, malusSlot: 'physical',   malus: 4 },
]

import pt from './data/i18n/pt.json'
import en from './data/i18n/en.json'

export type Lang = 'pt' | 'en'
const DICTS: Record<Lang, Record<string, string>> = { pt, en }

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

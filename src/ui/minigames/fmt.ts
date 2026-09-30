import type { Lang } from '../../i18n'

// número com 1 casa no separador do idioma (pt usa vírgula): "4,6" / "4.6"
export const fmt1 = (lang: Lang, x: number): string => x.toFixed(1).replace('.', lang === 'pt' ? ',' : '.')
// metros: "4,6 m"
export const fmtM = (lang: Lang, x: number): string => fmt1(lang, x) + ' m'

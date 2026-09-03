// Sondagem de WebGL — módulo SEM `three` de propósito: o roteador (Minigame.tsx) precisa
// dela no chunk principal, e importá-la de useThreeScene puxava o pacote inteiro junto.
let probed: boolean | null = null
// `thegoat:noWebgl = '1'` força o fallback 2D (teste manual/e2e). A sondagem real custa um
// canvas: feita uma vez e guardada, porque o roteamento chama isto a cada render do painel.
export function hasWebGL(): boolean {
  try { if (localStorage.getItem('thegoat:noWebgl') === '1') return false } catch { /* sem storage */ }
  if (probed === null) {
    try {
      const c = document.createElement('canvas')
      probed = !!(c.getContext('webgl2') || c.getContext('webgl'))
    } catch {
      probed = false
    }
  }
  return probed
}

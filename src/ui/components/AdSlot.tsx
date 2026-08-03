// Placeholder de anúncio — ciclo 3 injeta o conteúdo. Com --ad-h: 0px não ocupa nada.
export function AdSlot({ slot }: { slot: string }) {
  if (slot === 'bar') return <div className="ad-bar" data-slot="bar" />
  return <div className="ad-slot" data-slot={slot} />
}

interface Props {
  value: string
  label: string
}

export function StatLine({ value, label }: Props) {
  return (
    <div className="stat-line">
      <div className="stat-line__num">{value}</div>
      <div className="stat-line__label">{label}</div>
    </div>
  )
}


function Devu({
  color = 'blue',
  number = '01',
  size = 100,
  className = '',
}) {
  const validColors = ['blue', 'red', 'yellow', 'green']

  const safeColor = validColors.includes(color) ? color : 'blue'
  const safeNumber = Math.min(12, Math.max(1, Number(number) || 1))

  const filename = `${safeColor}_${String(safeNumber).padStart(2, '0')}.svg`

  return (
    <img
      src={`/mascots/${filename}`}
      alt={`${safeColor} Devu mascot`}
      width={size}
      height={size}
      className={className}
    />
  )
}

export default Devu

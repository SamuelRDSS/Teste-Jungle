const decimalScale = 10n ** 18n

export function parseEth(value: string): bigint {
  if (!/^\d+(?:\.\d{1,18})?$/.test(value)) {
    throw new Error(`Invalid ETH decimal: ${value}`)
  }

  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * decimalScale + BigInt(fraction.padEnd(18, '0'))
}

export function formatEth(value: bigint): string {
  const whole = value / decimalScale
  const preciseFraction = String(value % decimalScale)
    .padStart(18, '0')
    .replace(/0+$/, '')
  const fraction = preciseFraction.padEnd(4, '0')
  return `${whole}.${fraction}`
}

export function multiplyEth(price: string, quantity: number): string {
  return formatEth(parseEth(price) * BigInt(quantity))
}

export function buildCartQuote(
  lines: Array<{ priceEth: string; quantity: number }>,
  couponCode: string | null,
): {
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
} {
  const subtotal = lines.reduce(
    (sum, line) => sum + parseEth(line.priceEth) * BigInt(line.quantity),
    0n,
  )
  const discount = couponCode === 'SAVE10' ? (subtotal * 10n) / 100n : 0n
  const networkFee = lines.length > 0 ? parseEth('0.003') : 0n
  const total = subtotal - discount + networkFee

  return {
    subtotalEth: formatEth(subtotal),
    discountEth: formatEth(discount),
    networkFeeEth: formatEth(networkFee),
    totalEth: formatEth(total),
  }
}

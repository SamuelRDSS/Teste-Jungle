export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export type OrderLine = {
  nftId: string
  name: string
  artist: string
  image: string
  edition: string
  quantity: number
  unitPriceEth: string
  lineTotalEth: string
}

export type OrderReceipt = {
  orderId: string
  idempotencyKey: string
  userId: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  declinedAt: string | null
  transactionRef: string | null
  explorerUrl: string | null
  collectorName: string
  collectorEmail: string
  walletLabel: string
  walletAddress: string
  network: 'Ethereum' | 'Polygon'
  items: OrderLine[]
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  couponCode: string | null
  message?: string
}

export type CheckoutQuote = {
  quoteId: string
  issuedAt: string
  expiresAt: string
  items: Array<{
    nftId: string
    name: string
    artist: string
    image: string
    quantity: number
    unitPriceEth: string
    lineTotalEth: string
    quantityAvailable: number
  }>
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  couponCode: string | null
  warnings: string[]
}

export type CreateOrderInput = {
  idempotencyKey: string
  quoteId: string
  collectorName: string
  collectorEmail: string
  walletId: string
  network: 'Ethereum' | 'Polygon'
}

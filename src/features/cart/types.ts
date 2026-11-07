import type { Nft } from '@/features/nfts/types'

export type CartLine = {
  nft: Nft
  quantity: number
  lineTotalEth: string
}

export type CartQuote = {
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  couponCode: string | null
}

export type Cart = CartQuote & {
  items: CartLine[]
  itemCount: number
}

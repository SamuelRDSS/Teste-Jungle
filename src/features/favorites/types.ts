import type { Nft } from '@/features/nfts/types'

export type FavoriteItem = {
  nftId: string
  nft: Nft
  createdAt: string
}

export type FavoritesResponse = {
  items: FavoriteItem[]
}

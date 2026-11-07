export const nftCategories = ['Art', 'Collectibles', 'Gaming', 'Photography'] as const

export type NftCategory = (typeof nftCategories)[number]

export type CatalogSort = 'popular' | 'price-asc' | 'price-desc' | 'newest'

export type CatalogSearch = {
  q: string
  category: NftCategory | 'All'
  sort: CatalogSort
  page: number
}

export type Nft = {
  id: string
  name: string
  collection: string
  artist: string
  category: NftCategory
  image: string
  gallery: string[]
  description: string
  priceEth: string
  edition: string
  quantityAvailable: number
  version: number
  chain: 'Ethereum' | 'Polygon'
  createdAt: string
  featured?: boolean
}

export type NftPage = {
  items: Nft[]
  total: number
  page: number
  pageSize: number
}

export const defaultCatalogSearch: CatalogSearch = {
  q: '',
  category: 'All',
  sort: 'popular',
  page: 1,
}

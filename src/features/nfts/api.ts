import type { AxiosResponse } from 'axios'
import { api } from '@/lib/api'
import type {
  CatalogSearch,
  Nft,
  NftPage,
} from './types'

export async function fetchNfts(
  search: CatalogSearch,
  signal: AbortSignal,
): Promise<NftPage> {
  const response: AxiosResponse<NftPage> = await api.get('/nfts', {
    params: search,
    signal,
  })

  return response.data
}

export async function fetchNft(
  nftId: string,
  signal: AbortSignal,
): Promise<Nft> {
  const response: AxiosResponse<Nft> = await api.get(`/nfts/${encodeURIComponent(nftId)}`, {
    signal,
  })

  return response.data
}

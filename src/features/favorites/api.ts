import type { AxiosResponse } from 'axios'
import { api } from '@/lib/api'
import type { FavoritesResponse } from './types'

export async function fetchFavorites(signal?: AbortSignal): Promise<FavoritesResponse> {
  const response: AxiosResponse<FavoritesResponse> = await api.get('/favorites', { signal })
  return response.data
}

export async function addFavorite(nftId: string): Promise<FavoritesResponse> {
  const response: AxiosResponse<FavoritesResponse> = await api.post('/favorites', { nftId })
  return response.data
}

export async function removeFavorite(nftId: string): Promise<FavoritesResponse> {
  const response: AxiosResponse<FavoritesResponse> = await api.delete(`/favorites/${encodeURIComponent(nftId)}`)
  return response.data
}

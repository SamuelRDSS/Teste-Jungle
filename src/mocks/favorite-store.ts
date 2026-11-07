import { getCurrentSession } from './auth-store'
import { getNft } from './nft-store'
import type { FavoritesResponse } from '@/features/favorites/types'

const storageKey = 'mintora:mock-favorites:v1'

type State = Record<string, string[]>

function read(): State {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    return JSON.parse(raw) as State
  } catch {
    return {}
  }
}

function write(state: State): void {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

async function requireUserId(): Promise<string> {
  const session = await getCurrentSession()
  if (!session) throw new Error('UNAUTHENTICATED')
  return session.user.id
}

export async function listFavorites(): Promise<FavoritesResponse> {
  const userId = await requireUserId()
  const ids = read()[userId] ?? []
  return {
    items: ids.flatMap((nftId) => {
      const nft = getNft(nftId)
      return nft ? [{ nftId, nft, createdAt: new Date().toISOString() }] : []
    }),
  }
}

export async function addFavorite(nftId: string): Promise<FavoritesResponse> {
  if (!getNft(nftId)) throw new Error('NFT_NOT_FOUND')
  const userId = await requireUserId()
  const state = read()
  const list = new Set(state[userId] ?? [])
  list.add(nftId)
  state[userId] = [...list]
  write(state)
  return listFavorites()
}

export async function removeFavorite(nftId: string): Promise<FavoritesResponse> {
  const userId = await requireUserId()
  const state = read()
  state[userId] = (state[userId] ?? []).filter((id) => id !== nftId)
  write(state)
  return listFavorites()
}

export function clearFavoritesForUser(userId: string): void {
  const state = read()
  delete state[userId]
  write(state)
}

export function resetFavorites(): void {
  localStorage.removeItem(storageKey)
}

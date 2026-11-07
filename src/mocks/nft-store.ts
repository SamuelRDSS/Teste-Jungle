import { nfts as initialNfts } from './data'
import type { Nft } from '@/features/nfts/types'

const storageKey = 'mintora:mock-nfts:v1'

function read(): Nft[] {
  if (typeof localStorage === 'undefined') return structuredClone(initialNfts)
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return structuredClone(initialNfts)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return structuredClone(initialNfts)
    return parsed as Nft[]
  } catch {
    return structuredClone(initialNfts)
  }
}

function write(items: Nft[]): void {
  localStorage.setItem(storageKey, JSON.stringify(items))
}

export function listNfts(): Nft[] {
  return read()
}

export function getNft(id: string): Nft | undefined {
  return read().find((item) => item.id === id)
}

export function updateNft(id: string, patch: Partial<Pick<Nft, 'priceEth' | 'quantityAvailable'>>): Nft | null {
  const items = read()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return null
  const next: Nft = { ...items[index], ...patch, version: items[index].version + 1 }
  items[index] = next
  write(items)
  return next
}

export function decrementStock(purchases: Array<{ nftId: string; quantity: number }>): { ok: true } | { ok: false; nftId: string } {
  const items = read()
  for (const purchase of purchases) {
    const nft = items.find((item) => item.id === purchase.nftId)
    if (!nft || nft.quantityAvailable < purchase.quantity) return { ok: false, nftId: purchase.nftId }
  }
  for (const purchase of purchases) {
    const nft = items.find((item) => item.id === purchase.nftId)
    if (!nft) continue
    nft.quantityAvailable -= purchase.quantity
    nft.version += 1
  }
  write(items)
  return { ok: true }
}

export function resetNfts(): void {
  localStorage.removeItem(storageKey)
}

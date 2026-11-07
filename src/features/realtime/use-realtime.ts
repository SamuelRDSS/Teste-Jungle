import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import type { Nft } from '@/features/nfts/types'
import type { OrderReceipt } from '@/features/orders/types'

type NftUpdatedEvent = { eventId: string; resourceId: string; version: number; nft: Nft }
type OrderUpdatedEvent = { eventId: string; resourceId: string; version: number; order: OrderReceipt; userId?: string }

export function useRealtime(userId?: string | null) {
  const queryClient = useQueryClient()
  const versions = useRef(new Map<string, number>())
  const seen = useRef(new Set<string>())

  useEffect(() => {
    const socket: Socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 500,
      timeout: 5000,
      autoConnect: true,
    })

    socket.on('connect', () => {
      socket.emit('subscribe', { userId: userId ?? null })
      void queryClient.invalidateQueries({ queryKey: ['nfts'] })
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      if (userId) void queryClient.invalidateQueries({ queryKey: ['orders'] })
    })

    socket.on('nft.updated', (event: NftUpdatedEvent) => {
      if (seen.current.has(event.eventId)) return
      seen.current.add(event.eventId)
      const key = `nft:${event.resourceId}`
      const last = versions.current.get(key) ?? 0
      if (event.version <= last) return
      versions.current.set(key, event.version)
      queryClient.setQueryData(['nft', event.resourceId], event.nft)
      queryClient.setQueriesData<{ items?: Nft[] } & Record<string, unknown>>({ queryKey: ['nfts'] }, (current) => {
        if (!current || !Array.isArray(current.items)) return current
        return { ...current, items: current.items.map((item) => (item.id === event.nft.id ? event.nft : item)) }
      })
      queryClient.setQueriesData<{ items?: Array<{ nft: Nft }> } & Record<string, unknown>>({ queryKey: ['cart'] }, (current) => {
        if (!current || !Array.isArray(current.items)) return current
        return { ...current, items: current.items.map((item) => (item.nft.id === event.nft.id ? { ...item, nft: event.nft } : item)) }
      })
    })

    socket.on('order.updated', (event: OrderUpdatedEvent) => {
      if (event.userId && userId && event.userId !== userId) return
      if (seen.current.has(event.eventId)) return
      seen.current.add(event.eventId)
      const key = `order:${event.resourceId}`
      const last = versions.current.get(key) ?? 0
      if (event.version <= last) return
      versions.current.set(key, event.version)
      queryClient.setQueryData(['order', event.resourceId], event.order)
      queryClient.setQueriesData<OrderReceipt[]>({ queryKey: ['orders'] }, (current) =>
        Array.isArray(current) ? current.map((item) => (item.orderId === event.order.orderId ? event.order : item)) : current,
      )
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [queryClient, userId])
}

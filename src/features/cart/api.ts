import type { AxiosResponse } from 'axios'
import { api } from '@/lib/api'
import type { Cart } from './types'

export const cartQueryKey = ['cart'] as const

export async function fetchCart(signal?: AbortSignal): Promise<Cart> {
  const response: AxiosResponse<Cart> = await api.get('/cart', { signal })
  return response.data
}

export async function addCartItem(input: {
  nftId: string
  quantity: number
}): Promise<Cart> {
  const response: AxiosResponse<Cart> = await api.post('/cart/items', input)
  return response.data
}

export async function updateCartItem(
  nftId: string,
  quantity: number,
): Promise<Cart> {
  const response: AxiosResponse<Cart> = await api.patch(
    `/cart/items/${encodeURIComponent(nftId)}`,
    { quantity },
  )
  return response.data
}

export async function removeCartItem(nftId: string): Promise<Cart> {
  const response: AxiosResponse<Cart> = await api.delete(
    `/cart/items/${encodeURIComponent(nftId)}`,
  )
  return response.data
}

export async function applyCartCoupon(code: string): Promise<Cart> {
  const response: AxiosResponse<Cart> = await api.post('/cart/coupon', { code })
  return response.data
}

export async function removeCartCoupon(): Promise<Cart> {
  const response: AxiosResponse<Cart> = await api.delete('/cart/coupon')
  return response.data
}

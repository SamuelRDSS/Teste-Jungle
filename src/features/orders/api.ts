import type { AxiosResponse } from 'axios'
import { api } from '@/lib/api'
import type { CheckoutQuote, CreateOrderInput, OrderReceipt } from './types'

export async function fetchQuote(signal?: AbortSignal): Promise<CheckoutQuote> {
  const response: AxiosResponse<CheckoutQuote> = await api.post('/checkout/quote', {}, { signal })
  return response.data
}

export async function createOrder(input: CreateOrderInput): Promise<OrderReceipt> {
  const response: AxiosResponse<OrderReceipt> = await api.post('/orders', input, {
    headers: { 'Idempotency-Key': input.idempotencyKey },
  })
  return response.data
}

export async function fetchOrders(signal?: AbortSignal): Promise<OrderReceipt[]> {
  const response: AxiosResponse<OrderReceipt[]> = await api.get('/orders', { signal })
  return response.data
}

export async function fetchOrder(orderId: string, signal?: AbortSignal): Promise<OrderReceipt> {
  const response: AxiosResponse<OrderReceipt> = await api.get(`/orders/${encodeURIComponent(orderId)}`, { signal })
  return response.data
}

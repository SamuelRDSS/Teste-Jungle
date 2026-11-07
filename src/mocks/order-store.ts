import { getCurrentSession } from './auth-store'
import { getCart, removeItem } from './cart-store'
import { decrementStock, getNft, updateNft } from './nft-store'
import { getScenario, type MockScenario } from './scenarios'
import type { CheckoutQuote, CreateOrderInput, OrderReceipt } from '@/features/orders/types'
import { multiplyEth } from '@/features/cart/money'

const storageKey = 'mintora:mock-orders:v1'
const quoteKey = 'mintora:mock-quotes:v1'

type OrderStore = { orders: OrderReceipt[] }
type QuoteStore = { quotes: CheckoutQuote[] }

function readOrders(): OrderStore {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as OrderStore) : { orders: [] }
  } catch {
    return { orders: [] }
  }
}

function writeOrders(state: OrderStore): void {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

function readQuotes(): QuoteStore {
  try {
    const raw = localStorage.getItem(quoteKey)
    return raw ? (JSON.parse(raw) as QuoteStore) : { quotes: [] }
  } catch {
    return { quotes: [] }
  }
}

function writeQuotes(state: QuoteStore): void {
  localStorage.setItem(quoteKey, JSON.stringify(state))
}

async function requireSession() {
  const session = await getCurrentSession()
  if (!session) throw new Error('UNAUTHENTICATED')
  return session
}

function nowIso() {
  return new Date().toISOString()
}

export async function createQuote(): Promise<CheckoutQuote> {
  await requireSession()
  const cart = await getCart()
  if (cart.items.length === 0) throw new Error('CART_EMPTY')
  const scenario = getScenario()
  if (scenario.priceChangeOnCheckout && cart.items[0]) {
    updateNft(cart.items[0].nft.id, { priceEth: (Number(cart.items[0].nft.priceEth) + 0.11).toFixed(2) })
  }
  if (scenario.outOfStockOnCheckout && cart.items[0]) {
    updateNft(cart.items[0].nft.id, { quantityAvailable: 0 })
  }
  const warnings: string[] = []
  const items = cart.items.flatMap((line) => {
    const nft = getNft(line.nft.id)
    if (!nft) return []
    if (nft.priceEth !== line.nft.priceEth) warnings.push(`O preco de ${nft.name} foi atualizado.`)
    if (nft.quantityAvailable < line.quantity) warnings.push(`${nft.name} nao possui unidades suficientes.`)
    return [{
      nftId: nft.id,
      name: nft.name,
      artist: nft.artist,
      image: nft.image,
      quantity: line.quantity,
      unitPriceEth: nft.priceEth,
      lineTotalEth: multiplyEth(nft.priceEth, line.quantity),
      quantityAvailable: nft.quantityAvailable,
    }]
  })
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotalEth), 0)
  const discount = cart.couponCode === 'SAVE10' ? subtotal * 0.1 : 0
  const networkFee = items.length ? 0.003 : 0
  const quote: CheckoutQuote = {
    quoteId: crypto.randomUUID(),
    issuedAt: nowIso(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    items,
    subtotalEth: subtotal.toFixed(4),
    discountEth: discount.toFixed(4),
    networkFeeEth: networkFee.toFixed(4),
    totalEth: (subtotal - discount + networkFee).toFixed(4),
    couponCode: cart.couponCode,
    warnings,
  }
  const store = readQuotes()
  store.quotes.push(quote)
  writeQuotes(store)
  return quote
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<{ status: number; body: OrderReceipt | { code: string; message: string; orderId?: string } }> {
  const session = await requireSession()
  const scenario = getScenario()
  const orders = readOrders()
  const existing = orders.orders.find(
    (order) => order.idempotencyKey === input.idempotencyKey && order.userId === session.user.id,
  )
  if (existing) {
    const fingerprint = localStorage.getItem(`mintora:idempo:${input.idempotencyKey}`)
    const nextFingerprint = JSON.stringify({
      quoteId: input.quoteId,
      collectorEmail: input.collectorEmail,
      walletId: input.walletId,
      network: input.network,
    })
    if (fingerprint && fingerprint !== nextFingerprint) {
      return {
        status: 409,
        body: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Esta chave de idempotencia ja foi usada com um conteudo diferente.',
          orderId: existing.orderId,
        },
      }
    }
    return { status: 200, body: existing }
  }
  localStorage.setItem(
    `mintora:idempo:${input.idempotencyKey}`,
    JSON.stringify({
      quoteId: input.quoteId,
      collectorEmail: input.collectorEmail,
      walletId: input.walletId,
      network: input.network,
    }),
  )
  const quote = readQuotes().quotes.find((item) => item.quoteId === input.quoteId)
  if (!quote) return { status: 404, body: { code: 'QUOTE_NOT_FOUND', message: 'A cotacao nao foi encontrada. Solicite uma nova cotacao.' } }
  if (new Date(quote.expiresAt).getTime() < Date.now()) {
    return { status: 409, body: { code: 'QUOTE_EXPIRED', message: 'A cotacao expirou. Revise os valores atualizados.' } }
  }
  if (quote.warnings.length) {
    return { status: 409, body: { code: 'QUOTE_STALE', message: 'Preco ou disponibilidade foram alterados. Revise e confirme novamente.' } }
  }
  const stock = decrementStock(quote.items.map((item) => ({ nftId: item.nftId, quantity: item.quantity })))
  if (!stock.ok) {
    return { status: 409, body: { code: 'OUT_OF_STOCK', message: 'Uma edicao ficou indisponivel. Revise seu carrinho.' } }
  }
  const createdAt = nowIso()
  const order: OrderReceipt = {
    orderId: crypto.randomUUID(),
    idempotencyKey: input.idempotencyKey,
    userId: session.user.id,
    status:
      scenario.paymentResult === 'approved'
        ? 'confirmed'
        : scenario.paymentResult === 'declined'
          ? 'declined'
          : 'pending',
    createdAt,
    updatedAt: createdAt,
    confirmedAt: scenario.paymentResult === 'approved' ? createdAt : null,
    declinedAt: scenario.paymentResult === 'declined' ? createdAt : null,
    transactionRef: scenario.paymentResult === 'approved' ? `tx_${crypto.randomUUID().slice(0, 12)}` : null,
    explorerUrl:
      scenario.paymentResult === 'approved'
        ? `https://explorer.example/tx/tx_${crypto.randomUUID().slice(0, 8)}`
        : null,
    collectorName: input.collectorName,
    collectorEmail: input.collectorEmail,
    walletLabel: 'Carteira selecionada',
    walletAddress: input.walletId,
    network: input.network,
    items: quote.items.map((item) => ({
      nftId: item.nftId,
      name: item.name,
      artist: item.artist,
      image: item.image,
      edition: getNft(item.nftId)?.edition ?? 'â€”',
      quantity: item.quantity,
      unitPriceEth: item.unitPriceEth,
      lineTotalEth: item.lineTotalEth,
    })),
    subtotalEth: quote.subtotalEth,
    discountEth: quote.discountEth,
    networkFeeEth: quote.networkFeeEth,
    totalEth: quote.totalEth,
    couponCode: quote.couponCode,
    message:
      scenario.paymentResult === 'declined'
        ? 'Pagamento recusado pela simulacao de carteira.'
        : scenario.paymentResult === 'pending-timeout'
          ? 'Pedido pendente. Aguardando confirmacao apos timeout simulado.'
          : undefined,
  }
  orders.orders.push(order)
  writeOrders(orders)
  // Keep cart for declined/pending so the user can retry or recover.
  if (order.status === 'confirmed') {
    for (const item of quote.items) await removeItem(item.nftId)
  }
  schedulePendingResolution(order.orderId, scenario)
  return { status: 201, body: order }
}

function resolvePendingOrder(orderId: string) {
  const store = readOrders()
  const order = store.orders.find((item) => item.orderId === orderId && item.status === 'pending')
  if (!order) return
  order.status = 'confirmed'
  order.confirmedAt = nowIso()
  order.updatedAt = nowIso()
  order.transactionRef = `tx_${crypto.randomUUID().slice(0, 12)}`
  order.explorerUrl = `https://explorer.example/tx/${order.transactionRef}`
  order.message = 'Pedido confirmado apos recuperacao.'
  writeOrders(store)
  for (const item of order.items) void removeItem(item.nftId)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mintora:order-updated', { detail: { orderId, version: Date.now() } }))
  }
}

function schedulePendingResolution(orderId: string, scenario: MockScenario) {
  if (scenario.paymentResult !== 'pending-timeout') return
  // Resolve on next tick so refresh/poll observes confirmed state even when
  // the mock socket event path is not wired in the current execution context.
  setTimeout(() => resolvePendingOrder(orderId), 0)
}

export async function listOrders(): Promise<OrderReceipt[]> {
  const session = await requireSession()
  return readOrders()
    .orders.filter((order) => order.userId === session.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getOrder(orderId: string): Promise<OrderReceipt | null> {
  const session = await requireSession()
  return readOrders().orders.find((order) => order.orderId === orderId && order.userId === session.user.id) ?? null
}

export function getOrderForRealtime(orderId: string): OrderReceipt | null {
  return readOrders().orders.find((order) => order.orderId === orderId) ?? null
}

export function resetOrders(): void {
  localStorage.removeItem(storageKey)
  localStorage.removeItem(quoteKey)
}

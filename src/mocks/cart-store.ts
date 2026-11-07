import { getNft } from './nft-store'
import { getCurrentSession } from './auth-store'
import { buildCartQuote, multiplyEth } from '@/features/cart/money'
import type { Cart, CartLine } from '@/features/cart/types'
import type { Nft } from '@/features/nfts/types'

const storageKey = 'mintora:mock-cart:v1'

type StoredCart = {
  lines: Array<{ nftId: string; quantity: number }>
  couponCode: string | null
}

type StoredCartState = {
  guest: StoredCart
  users: Record<string, StoredCart>
}

function isStoredCart(value: unknown): value is StoredCart {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('lines' in value) ||
    !Array.isArray(value.lines) ||
    !('couponCode' in value) ||
    !(value.couponCode === null || typeof value.couponCode === 'string')
  ) {
    return false
  }

  return value.lines.every(
    (line) =>
      typeof line === 'object' &&
      line !== null &&
      'nftId' in line &&
      typeof line.nftId === 'string' &&
      'quantity' in line &&
      typeof line.quantity === 'number' &&
      Number.isInteger(line.quantity) &&
      line.quantity > 0,
  )
}

function isStoredCartState(value: unknown): value is StoredCartState {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('guest' in value) ||
    !isStoredCart(value.guest) ||
    !('users' in value) ||
    typeof value.users !== 'object' ||
    value.users === null
  ) {
    return false
  }

  return Object.values(value.users).every(isStoredCart)
}

function emptyStoredCart(): StoredCart {
  return { lines: [], couponCode: null }
}

function readState(): StoredCartState {
  const raw = localStorage.getItem(storageKey)
  if (!raw) {
    return { guest: emptyStoredCart(), users: {} }
  }

  const parsed: unknown = JSON.parse(raw)
  if (!isStoredCartState(parsed)) {
    throw new Error('Stored mock cart data is invalid. Clear the Mintora mock cart to continue.')
  }
  return parsed
}

function writeState(state: StoredCartState): void {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

async function getActiveCart(): Promise<{ state: StoredCartState; cart: StoredCart }> {
  const state = readState()
  let session: Awaited<ReturnType<typeof getCurrentSession>>
  try {
    session = await getCurrentSession()
  } catch (error) {
    if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
      return { state, cart: state.guest }
    }
    throw error
  }
  if (!session) {
    return { state, cart: state.guest }
  }

  const accountCart = state.users[session.user.id] ?? emptyStoredCart()
  for (const guestLine of state.guest.lines) {
    const existing = accountCart.lines.find((line) => line.nftId === guestLine.nftId)
    if (existing) {
        existing.quantity = Math.min(
          existing.quantity + guestLine.quantity,
          getNft(guestLine.nftId)?.quantityAvailable ?? existing.quantity,
        )
    } else {
      accountCart.lines.push({ ...guestLine })
    }
  }
  if (!accountCart.couponCode) {
    accountCart.couponCode = state.guest.couponCode
  }
  state.guest = emptyStoredCart()
  state.users[session.user.id] = accountCart
  writeState(state)
  return { state, cart: accountCart }
}

function resolveLine(nftId: string, quantity: number): CartLine | null {
  const nft = getNft(nftId) satisfies Nft | undefined
  if (!nft) {
    return null
  }
  return {
    nft,
    quantity,
    lineTotalEth: multiplyEth(nft.priceEth, quantity),
  }
}

export async function getCart(): Promise<Cart> {
  const { cart } = await getActiveCart()
  const items = cart.lines.flatMap((line) => {
    const item = resolveLine(line.nftId, line.quantity)
    return item ? [item] : []
  })
  const quote = buildCartQuote(
    items.map((item) => ({ priceEth: item.nft.priceEth, quantity: item.quantity })),
    cart.couponCode,
  )

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    ...quote,
    couponCode: cart.couponCode,
  }
}

export async function addItem(nftId: string, quantity: number): Promise<Cart | null> {
  const { state, cart } = await getActiveCart()
  const nft = getNft(nftId)
  if (!nft) {
    return null
  }

  const existing = cart.lines.find((line) => line.nftId === nftId)
  const nextQuantity = (existing?.quantity ?? 0) + quantity
  if (nextQuantity > nft.quantityAvailable) {
    throw new Error('INSUFFICIENT_STOCK')
  }

  if (existing) {
    existing.quantity = nextQuantity
  } else {
    cart.lines.push({ nftId, quantity })
  }
  persistActiveCart(state, cart)
  return getCart()
}

export async function updateItem(nftId: string, quantity: number): Promise<Cart | null> {
  const { state, cart } = await getActiveCart()
  const nft = getNft(nftId)
  const existing = cart.lines.find((line) => line.nftId === nftId)
  if (!nft || !existing) {
    return null
  }
  if (quantity > nft.quantityAvailable) {
    throw new Error('INSUFFICIENT_STOCK')
  }

  existing.quantity = quantity
  persistActiveCart(state, cart)
  return getCart()
}

export async function removeItem(nftId: string): Promise<Cart> {
  const { state, cart } = await getActiveCart()
  cart.lines = cart.lines.filter((line) => line.nftId !== nftId)
  if (cart.lines.length === 0) {
    cart.couponCode = null
  }
  persistActiveCart(state, cart)
  return getCart()
}

export async function setCoupon(code: string): Promise<Cart> {
  const normalizedCode = code.trim().toUpperCase()
  if (normalizedCode === 'EXPIRED') {
    throw new Error('COUPON_EXPIRED')
  }
  if (normalizedCode !== 'SAVE10') {
    throw new Error('COUPON_INVALID')
  }

  const { state, cart } = await getActiveCart()
  if (cart.lines.length === 0) {
    throw new Error('CART_EMPTY')
  }
  cart.couponCode = normalizedCode
  persistActiveCart(state, cart)
  return getCart()
}

export async function clearCoupon(): Promise<Cart> {
  const { state, cart } = await getActiveCart()
  cart.couponCode = null
  persistActiveCart(state, cart)
  return getCart()
}

function persistActiveCart(state: StoredCartState, cart: StoredCart): void {
  const session = state.users
  const ownerId = Object.keys(session).find((key) => session[key] === cart)
  if (ownerId) {
    state.users[ownerId] = cart
  } else {
    state.guest = cart
  }
  writeState(state)
}

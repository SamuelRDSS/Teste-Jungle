import { delay, http, HttpResponse } from 'msw'
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { listNfts, getNft, updateNft, resetNfts } from './nft-store'
import {
  authenticate,
  createAccount,
  endSession,
  expireCurrentSession,
  getCurrentSession,
  ensureAuthState,
} from './auth-store'
import {
  addItem,
  clearCoupon,
  getCart,
  removeItem,
  setCoupon,
  updateItem,
} from './cart-store'
import { addFavorite, listFavorites, removeFavorite, resetFavorites } from './favorite-store'
import { changePassword, createWallet, getProfile, listWallets, resetProfiles, updateProfile, updateWallet } from './profile-store'
import { createOrder, createQuote, getOrder, getOrderForRealtime, listOrders, resetOrders } from './order-store'
import { defaultScenario, getScenario, resetScenario, setScenario, type MockScenario } from './scenarios'
import type { CatalogSearch, NftPage } from '@/features/nfts/types'

const pageSize = 8
const realtime = ws.link(/socket\.io/)
const orderVersions = new Map<string, number>()
const nftVersions = new Map<string, number>()

function authError() {
  return HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'Entre na sua conta para continuar.' }, { status: 401 })
}

async function maybeScenario(_request: Request, key?: keyof MockScenario) {
  const scenario = getScenario()
  if (scenario.offline) throw new Error('Failed to fetch')
  if (scenario.httpErrorRate >= 1) return HttpResponse.json({ code: 'SERVER_ERROR', message: 'Falha transitoria simulada.' }, { status: 500 })
  if (scenario.timeoutRate >= 1) {
    await delay(12_000)
    return HttpResponse.json({ code: 'TIMEOUT', message: 'Tempo esgotado.' }, { status: 504 })
  }
  if (key && scenario[key] === true) {
    await delay(12_000)
    return HttpResponse.json({ code: 'TIMEOUT', message: 'Tempo esgotado.' }, { status: 504 })
  }
  const extra = scenario.outOfOrder ? Math.floor(Math.random() * scenario.jitterMs) : 0
  await delay(scenario.latencyMs + extra)
  return null
}

async function requireSessionResponse() {
  try {
    const session = await getCurrentSession()
    if (!session) return { response: authError() as Response }
    return { session }
  } catch (error) {
    if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
      return {
        response: HttpResponse.json(
          { code: 'SESSION_EXPIRED', message: 'Sua sessao expirou. Entre novamente.' },
          { status: 401 },
        ) as Response,
      }
    }
    throw error
  }
}

const ioConnections = new Set<ReturnType<typeof toSocketIo>>()

function broadcastOrderUpdated(orderId: string) {
  const order = getOrderForRealtime(orderId)
  if (!order) return
  const version = Date.now()
  const last = orderVersions.get(orderId) ?? 0
  if (version <= last) return
  orderVersions.set(orderId, version)
  for (const io of ioConnections) {
    io.client.emit('order.updated', { eventId: crypto.randomUUID(), resourceId: orderId, version, order, userId: order.userId })
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('mintora:order-updated', (event) => {
    const detail = (event as CustomEvent<{ orderId: string }>).detail
    if (detail?.orderId) broadcastOrderUpdated(detail.orderId)
  })
}

export const handlers = [
  http.post('/api/test/scenario', async ({ request }) => {
    const body = (await request.json()) as Partial<MockScenario> & { name?: string; reset?: boolean }
    if (body.reset) {
      resetScenario()
      resetNfts()
      resetOrders()
      resetFavorites()
      resetProfiles()
      localStorage.removeItem('mintora:mock-auth:v1')
      localStorage.removeItem('mintora:mock-cart:v1')
      await ensureAuthState()
      return HttpResponse.json({ ok: true, scenario: defaultScenario })
    }
    return HttpResponse.json({ ok: true, scenario: setScenario(body) })
  }),
  http.get('/api/test/scenario', () => HttpResponse.json(getScenario())),

  http.get('/api/nfts', async ({ request }) => {
    const blocked = await maybeScenario(request)
    if (blocked) return blocked
    const url = new URL(request.url)
    const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase()
    const category = url.searchParams.get('category') ?? 'All'
    const sort = (url.searchParams.get('sort') ?? 'popular') as CatalogSearch['sort']
    const requestedPage = Number(url.searchParams.get('page') ?? '1')
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const filtered = listNfts().filter((nft) => {
      const matchesQuery = query.length === 0 || `${nft.name} ${nft.collection} ${nft.artist}`.toLocaleLowerCase().includes(query)
      const matchesCategory = category === 'All' || nft.category === category
      return matchesQuery && matchesCategory
    })
    const sorted = [...filtered]
    if (sort === 'price-asc') sorted.sort((a, b) => Number(a.priceEth) - Number(b.priceEth))
    else if (sort === 'price-desc') sorted.sort((a, b) => Number(b.priceEth) - Number(a.priceEth))
    else if (sort === 'newest') sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    else sorted.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
    const response: NftPage = { items: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length, page, pageSize }
    return HttpResponse.json(response)
  }),
  http.get('/api/nfts/:nftId', async ({ params, request }) => {
    const blocked = await maybeScenario(request)
    if (blocked) return blocked
    const nft = getNft(String(params.nftId))
    if (!nft) return HttpResponse.json({ code: 'NFT_NOT_FOUND', message: 'Esta obra nao foi encontrada.' }, { status: 404 })
    return HttpResponse.json(nft)
  }),

  http.get('/api/cart', async ({ request }) => {
    const blocked = await maybeScenario(request)
    if (blocked) return blocked
    return HttpResponse.json(await getCart())
  }),
  http.post('/api/cart/items', async ({ request }) => {
    const blocked = await maybeScenario(request)
    if (blocked) return blocked
    const body = (await request.json()) as { nftId?: string; quantity?: number }
    if (typeof body.nftId !== 'string' || typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity < 1) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'A quantidade deve ser um numero inteiro positivo.' }, { status: 400 })
    }
    try {
      const cart = await addItem(body.nftId, body.quantity)
      if (!cart) return HttpResponse.json({ code: 'NFT_NOT_FOUND', message: 'Esta obra nao esta mais disponivel.' }, { status: 404 })
      return HttpResponse.json(cart)
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
        return HttpResponse.json({ code: 'INSUFFICIENT_STOCK', message: 'A quantidade solicitada excede as unidades disponíveis.' }, { status: 409 })
      }
      throw error
    }
  }),
  http.patch('/api/cart/items/:nftId', async ({ params, request }) => {
    const blocked = await maybeScenario(request)
    if (blocked) return blocked
    const body = (await request.json()) as { quantity?: number }
    if (typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity < 1) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'A quantidade deve ser um numero inteiro positivo.' }, { status: 400 })
    }
    try {
      const cart = await updateItem(String(params.nftId), body.quantity)
      if (!cart) return HttpResponse.json({ code: 'CART_ITEM_NOT_FOUND', message: 'Este item nao esta no carrinho.' }, { status: 404 })
      return HttpResponse.json(cart)
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
        return HttpResponse.json({ code: 'INSUFFICIENT_STOCK', message: 'A quantidade solicitada excede as unidades disponíveis.' }, { status: 409 })
      }
      throw error
    }
  }),
  http.delete('/api/cart/items/:nftId', async ({ params, request }) => {
    const blocked = await maybeScenario(request)
    if (blocked) return blocked
    await removeItem(String(params.nftId))
    return HttpResponse.json(await getCart())
  }),
  http.post('/api/cart/coupon', async ({ request }) => {
    const blocked = await maybeScenario(request)
    if (blocked) return blocked
    const body = (await request.json()) as { code?: string }
    if (typeof body.code !== 'string' || body.code.trim().length === 0) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Informe um codigo de cupom.' }, { status: 400 })
    }
    try {
      return HttpResponse.json(await setCoupon(body.code))
    } catch (error) {
      if (error instanceof Error && error.message === 'COUPON_INVALID') return HttpResponse.json({ code: 'COUPON_INVALID', message: 'Cupom inválido. Confira o código e tente novamente.' }, { status: 422 })
      if (error instanceof Error && error.message === 'COUPON_EXPIRED') return HttpResponse.json({ code: 'COUPON_EXPIRED', message: 'Este cupom expirou.' }, { status: 422 })
      if (error instanceof Error && error.message === 'CART_EMPTY') return HttpResponse.json({ code: 'CART_EMPTY', message: 'Adicione uma obra antes de aplicar o cupom.' }, { status: 409 })
      throw error
    }
  }),
  http.delete('/api/cart/coupon', async ({ request }) => {
    const blocked = await maybeScenario(request)
    if (blocked) return blocked
    return HttpResponse.json(await clearCoupon())
  }),

  http.get('/api/auth/session', async () => {
    try {
      const session = await getCurrentSession()
      if (getScenario().sessionExpired && session) return HttpResponse.json({ code: 'SESSION_EXPIRED', message: 'Sua sessao expirou. Entre novamente.' }, { status: 401 })
      return HttpResponse.json({ user: session?.user ?? null, expiresAt: session?.expiresAt ?? null })
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
        return HttpResponse.json({ code: 'SESSION_EXPIRED', message: 'Sua sessao expirou. Entre novamente.' }, { status: 401 })
      }
      throw error
    }
  }),
  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { name?: string; email?: string; password?: string }
    if (typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Preencha todos os campos corretamente.' }, { status: 400 })
    }
    const name = body.name.trim()
    const email = body.email.trim().toLowerCase()
    const password = body.password
    if (name.length < 2 || name.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Confira o nome, o e-mail e a senha (minimo de 8 caracteres).' }, { status: 400 })
    }
    try {
      const session = await createAccount({ id: crypto.randomUUID(), name, email }, password)
      return HttpResponse.json(session, { status: 201 })
    } catch (error) {
      if (error instanceof Error && error.message === 'EMAIL_ALREADY_REGISTERED') {
        return HttpResponse.json({ code: 'EMAIL_CONFLICT', message: 'Este e-mail já possui uma conta.' }, { status: 409 })
      }
      throw error
    }
  }),
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length === 0) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Informe um e-mail e uma senha validos.' }, { status: 400 })
    }
    const session = await authenticate(body.email.trim().toLowerCase(), body.password)
    if (!session) return HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' }, { status: 401 })
    return HttpResponse.json(session)
  }),
  http.post('/api/auth/logout', async () => {
    await endSession()
    return new HttpResponse(null, { status: 204 })
  }),
  http.post('/api/auth/expire', async () => {
    const expired = await expireCurrentSession()
    if (!expired) return HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'Entre na sua conta para continuar.' }, { status: 401 })
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/favorites', async () => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    return HttpResponse.json(await listFavorites())
  }),
  http.post('/api/favorites', async ({ request }) => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    const body = (await request.json()) as { nftId?: string }
    if (typeof body.nftId !== 'string') return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'NFT invalido.' }, { status: 400 })
    try {
      return HttpResponse.json(await addFavorite(body.nftId), { status: 201 })
    } catch {
      return HttpResponse.json({ code: 'NFT_NOT_FOUND', message: 'Esta obra nao foi encontrada.' }, { status: 404 })
    }
  }),
  http.delete('/api/favorites/:nftId', async ({ params }) => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    return HttpResponse.json(await removeFavorite(String(params.nftId)))
  }),

  http.get('/api/profile', async () => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    return HttpResponse.json(await getProfile())
  }),
  http.patch('/api/profile', async ({ request }) => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    const body = (await request.json()) as { name?: string; email?: string; avatarUrl?: string | null }
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Confira nome e e-mail.' }, { status: 400 })
    }
    try {
      return HttpResponse.json(await updateProfile({ name: body.name.trim(), email: body.email.trim().toLowerCase(), avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : null }))
    } catch (error) {
      if (error instanceof Error && error.message === 'EMAIL_CONFLICT') return HttpResponse.json({ code: 'EMAIL_CONFLICT', message: 'Este e-mail ja esta em uso.' }, { status: 409 })
      throw error
    }
  }),
  http.post('/api/profile/password', async ({ request }) => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string }
    if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'A nova senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
    }
    try {
      await changePassword({ currentPassword: body.currentPassword, newPassword: body.newPassword })
      return new HttpResponse(null, { status: 204 })
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CURRENT_PASSWORD') return HttpResponse.json({ code: 'INVALID_CURRENT_PASSWORD', message: 'A senha atual esta incorreta.' }, { status: 422 })
      throw error
    }
  }),

  http.get('/api/wallets', async () => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    return HttpResponse.json(await listWallets())
  }),
  http.post('/api/wallets', async ({ request }) => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    const body = (await request.json()) as { label?: string; address?: string; network?: 'Ethereum' | 'Polygon'; primary?: boolean }
    if (typeof body.label !== 'string' || body.label.trim().length < 2 || typeof body.address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(body.address) || (body.network !== 'Ethereum' && body.network !== 'Polygon')) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Confira os dados da carteira.' }, { status: 400 })
    }
    try {
      return HttpResponse.json(await createWallet({ label: body.label.trim(), address: body.address, network: body.network, primary: body.primary === true }), { status: 201 })
    } catch (error) {
      if (error instanceof Error && error.message === 'WALLET_CONFLICT') return HttpResponse.json({ code: 'WALLET_CONFLICT', message: 'Este endereco ja esta cadastrado.' }, { status: 409 })
      throw error
    }
  }),
  http.patch('/api/wallets/:walletId', async ({ params, request }) => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    const body = (await request.json()) as { label?: string; address?: string; network?: 'Ethereum' | 'Polygon'; primary?: boolean }
    if (typeof body.label !== 'string' || body.label.trim().length < 2 || typeof body.address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(body.address) || (body.network !== 'Ethereum' && body.network !== 'Polygon')) {
      return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Confira os dados da carteira.' }, { status: 400 })
    }
    try {
      return HttpResponse.json(await updateWallet(String(params.walletId), { label: body.label.trim(), address: body.address, network: body.network, primary: body.primary === true }))
    } catch (error) {
      if (error instanceof Error && error.message === 'WALLET_CONFLICT') return HttpResponse.json({ code: 'WALLET_CONFLICT', message: 'Este endereco ja esta cadastrado.' }, { status: 409 })
      if (error instanceof Error && error.message === 'WALLET_NOT_FOUND') return HttpResponse.json({ code: 'WALLET_NOT_FOUND', message: 'Carteira nao encontrada.' }, { status: 404 })
      throw error
    }
  }),

  http.post('/api/checkout/quote', async () => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    try {
      return HttpResponse.json(await createQuote())
    } catch (error) {
      if (error instanceof Error && error.message === 'CART_EMPTY') return HttpResponse.json({ code: 'CART_EMPTY', message: 'Seu carrinho esta vazio.' }, { status: 409 })
      throw error
    }
  }),
  http.post('/api/orders', async ({ request }) => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    const body = (await request.json()) as Record<string, unknown>
    const required = ['idempotencyKey', 'quoteId', 'collectorName', 'collectorEmail', 'walletId', 'network'] as const
    for (const field of required) {
      if (typeof body[field] !== 'string' || (body[field] as string).trim().length === 0) {
        return HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Preencha todos os campos do checkout.' }, { status: 400 })
      }
    }
    const result = await createOrder({
      idempotencyKey: String(body.idempotencyKey),
      quoteId: String(body.quoteId),
      collectorName: String(body.collectorName).trim(),
      collectorEmail: String(body.collectorEmail).trim().toLowerCase(),
      walletId: String(body.walletId),
      network: body.network as 'Ethereum' | 'Polygon',
    })
    return HttpResponse.json(result.body, { status: result.status })
  }),
  http.get('/api/orders', async () => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    return HttpResponse.json(await listOrders())
  }),
  http.get('/api/orders/:orderId', async ({ params }) => {
    const auth = await requireSessionResponse()
    if ('response' in auth) return auth.response
    const order = await getOrder(String(params.orderId))
    if (!order) return HttpResponse.json({ code: 'ORDER_NOT_FOUND', message: 'Pedido nao encontrado.' }, { status: 404 })
    return HttpResponse.json(order)
  }),

  realtime.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    ioConnections.add(io)
    io.client.on('subscribe', (_event, payload: { userId?: string }) => {
      ;(connection as unknown as { __mintoraUserId?: string }).__mintoraUserId = payload?.userId
      io.client.emit('subscribed', { ok: true })
    })
    io.client.on('debug:nft-updated', (_event, payload: { nftId: string; priceEth?: string; quantityAvailable?: number; version?: number }) => {
      const nft = updateNft(payload.nftId, { priceEth: payload.priceEth, quantityAvailable: payload.quantityAvailable })
      if (!nft) return
      const version = payload.version ?? nft.version
      const last = nftVersions.get(nft.id) ?? 0
      if (version <= last) return
      nftVersions.set(nft.id, version)
      for (const peer of ioConnections) {
        peer.client.emit('nft.updated', { eventId: crypto.randomUUID(), resourceId: nft.id, version, nft })
      }
    })
    io.client.on('debug:order-updated', (_event, payload: { orderId: string; version?: number }) => {
      broadcastOrderUpdated(payload.orderId)
      void payload.version
    })
    connection.client.addEventListener('close', () => {
      ioConnections.delete(io)
    })
  }),
]

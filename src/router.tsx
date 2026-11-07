import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowDown, ArrowLeft, ArrowRight, Search, Sparkles } from 'lucide-react'
import { type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchNft, fetchNfts } from '@/features/nfts/api'
import { LoginPage, RegisterPage } from '@/features/auth/pages'
import { sessionQueryOptions } from '@/features/auth/api'
import { AddToCartButton, CartCount, CartPage } from '@/features/cart/pages'
import { ProfileDashboard } from '@/features/account/components'
import { FavoriteButton, FavoritesPage } from '@/features/favorites/components'
import { CheckoutPage, OrderDetailPage, OrdersPage } from '@/features/orders/components'
import { useRealtime } from '@/features/realtime/use-realtime'
import { queryClient } from '@/lib/query-client'
import {
  defaultCatalogSearch,
  nftCategories,
  type CatalogSearch,
  type CatalogSort,
  type Nft,
  type NftCategory,
} from '@/features/nfts/types'

type RouterContext = { queryClient: typeof queryClient }

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: MarketplaceLayout,
  notFoundComponent: NotFoundPage,
})

function validateAuthSearch(search: Record<string, unknown>) {
  return {
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
    expired: search.expired === true || search.expired === 'true',
  }
}

async function requireAuth(context: RouterContext, href: string) {
  try {
    const session = await context.queryClient.fetchQuery(sessionQueryOptions())
    if (!session.user) throw redirect({ to: '/login', search: { returnTo: href, expired: false } })
    return session
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      context.queryClient.setQueryData(['auth', 'session'], { user: null, expiresAt: null })
      throw redirect({ to: '/login', search: { returnTo: href, expired: true } })
    }
    throw error
  }
}

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    q: typeof search.q === 'string' ? search.q : defaultCatalogSearch.q,
    category:
      search.category === 'Art' || search.category === 'Collectibles' || search.category === 'Gaming' || search.category === 'Photography'
        ? search.category
        : defaultCatalogSearch.category,
    sort:
      search.sort === 'price-asc' || search.sort === 'price-desc' || search.sort === 'newest' || search.sort === 'popular'
        ? search.sort
        : defaultCatalogSearch.sort,
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 0 ? search.page : defaultCatalogSearch.page,
  }),
  component: CatalogPage,
})

const nftRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nft/$nftId', component: NftDetailPage })
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: CartPage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', validateSearch: validateAuthSearch, component: () => <LoginPage search={loginRoute.useSearch()} /> })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', validateSearch: validateAuthSearch, component: () => <RegisterPage search={registerRoute.useSearch()} /> })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/profile', beforeLoad: ({ context, location }) => requireAuth(context, location.href), component: ProfileDashboard })
const favoritesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/favorites', beforeLoad: ({ context, location }) => requireAuth(context, location.href), component: FavoritesPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', beforeLoad: ({ context, location }) => requireAuth(context, location.href), component: CheckoutPage })
const ordersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/orders', beforeLoad: ({ context, location }) => requireAuth(context, location.href), component: OrdersPage })
const orderDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/orders/$orderId', beforeLoad: ({ context, location }) => requireAuth(context, location.href), component: OrderDetailRoutePage })

const routeTree = rootRoute.addChildren([catalogRoute, nftRoute, cartRoute, loginRoute, registerRoute, profileRoute, favoritesRoute, checkoutRoute, ordersRoute, orderDetailRoute])
export const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent', scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function MarketplaceLayout() {
  const sessionQuery = useQuery(sessionQueryOptions())
  useRealtime(sessionQuery.data?.user?.id)
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#111116]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
          <Link to="/" search={defaultCatalogSearch} className="flex shrink-0 items-center gap-2.5" aria-label="Mintora, inicio">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles size={19} aria-hidden="true" /></span>
            <span className="text-xl font-semibold tracking-tight">mintora</span>
          </Link>
          <nav aria-label="Navegacao principal" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link to="/" search={defaultCatalogSearch} className="text-foreground transition hover:text-primary">Explorar</Link>
            <Link to="/favorites" className="transition hover:text-foreground">Favoritos</Link>
            <Link to="/orders" className="transition hover:text-foreground">Pedidos</Link>
          </nav>
          <div className="flex items-center gap-2">
            <CartCount />
            {sessionQuery.data?.user ? (
              <Link to="/profile" className="hidden max-w-[190px] truncate rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-foreground transition hover:bg-white/[0.08] sm:block">{sessionQuery.data.user.name}</Link>
            ) : (
              <Link to="/login" search={{ returnTo: '/profile', expired: false }} className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-2.5 text-sm text-foreground transition hover:bg-white/[0.08]">Entrar</Link>
            )}
          </div>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="mt-20 border-t border-white/8"><div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><p>Mintora — marketplace de arte digital.</p><p>Demonstracao com mocks REST e Socket.IO.</p></div></footer>
    </div>
  )
}

function OrderDetailRoutePage() {
  const { orderId } = orderDetailRoute.useParams()
  return <OrderDetailPage orderId={orderId} />
}

function CatalogPage() {
  const search = catalogRoute.useSearch()
  const navigate = catalogRoute.useNavigate()
  const query = useQuery({ queryKey: ['nfts', search], queryFn: ({ signal }) => fetchNfts(search, signal) })

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    void navigate({ search: (previous) => ({ ...previous, q: String(formData.get('q') ?? '').trim(), page: 1 }) })
  }
  function setCategory(category: NftCategory | 'All') { void navigate({ search: (previous) => ({ ...previous, category, page: 1 }) }) }
  function setSort(sort: CatalogSort) { void navigate({ search: (previous) => ({ ...previous, sort, page: 1 }) }) }

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1
  const featuredNft = query.data?.items.find((nft) => nft.featured) ?? query.data?.items[0]

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 sm:px-8 lg:px-12 lg:pt-12">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1c20] px-6 py-10 sm:px-10 lg:min-h-[300px] lg:px-14 lg:py-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_76%_45%,rgba(83,190,144,0.2),transparent_38%),linear-gradient(115deg,#191a1f_20%,#20262a_100%)]" />
        <div className="max-w-[620px]">
          <Badge className="mb-5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary hover:bg-primary/10"><Sparkles size={13} className="mr-1.5" aria-hidden="true" />Arte que atravessa dimensões</Badge>
          <h1 className="max-w-[580px] text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[58px]">Descubra arte que <span className="text-primary">merece ser colecionada.</span></h1>
          <p className="mt-4 max-w-[470px] text-sm leading-6 text-muted-foreground sm:text-base">Um universo de criações digitais únicas, direto dos artistas para a sua coleção.</p>
          <a href="#catalogo" className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110">Explorar catálogo <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
        <div className="absolute -right-2 top-1/2 hidden h-[340px] w-[340px] -translate-y-1/2 rotate-6 overflow-hidden rounded-[36px] border border-white/15 shadow-2xl shadow-black/40 lg:block xl:right-16">
          {featuredNft ? <img className="size-full object-cover" src={featuredNft.image} alt="" /> : <Skeleton className="size-full rounded-none" />}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-6 pb-5 pt-16"><p className="text-sm font-semibold">{featuredNft?.name ?? 'Destaque da semana'}</p><p className="mt-1 text-xs text-white/65">{featuredNft?.artist ?? 'Artista em destaque'}</p></div>
        </div>
      </section>

      <section id="catalogo" className="scroll-mt-24 pt-12">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">Explore</p><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Colecoes em destaque</h2><p className="mt-2 text-sm text-muted-foreground">Encontre a proxima peca favorita da sua colecao.</p></div>
          <form key={search.q} onSubmit={submitSearch} role="search" className="flex w-full gap-2 sm:max-w-[390px]">
            <label htmlFor="nft-search" className="sr-only">Buscar NFTs, coleções ou artistas</label>
            <div className="relative flex-1"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="nft-search" name="q" defaultValue={search.q} placeholder="Buscar NFTs, coleções..." className="h-11 rounded-full border-white/10 bg-white/[0.035] pl-10 text-sm placeholder:text-muted-foreground/75" /></div>
            <Button type="submit" className="h-11 rounded-full px-5">Buscar</Button>
          </form>
        </div>
        <div className="flex flex-col gap-7 lg:flex-row">
          <aside aria-label="Filtros de catalogo" className="shrink-0 lg:w-[190px]">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Categoria</h3>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
              {(['All', ...nftCategories] as const).map((category) => {
                const active = search.category === category
                const label = category === 'All' ? 'Todas as obras' : category
                return <button key={category} type="button" aria-pressed={active} onClick={() => setCategory(category)} className={`shrink-0 rounded-full px-3.5 py-2 text-left text-sm transition lg:rounded-lg ${active ? 'bg-primary/12 font-medium text-primary' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'}`}>{label}</button>
              })}
            </div>
          </aside>
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">{query.isLoading ? 'Carregando obras...' : `${query.data?.total ?? 0} obras encontradas`}{search.q && <span> para "{search.q}"</span>}</p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><span>Ordenar:</span><select aria-label="Ordenar obras" value={search.sort} onChange={(event) => setSort(event.target.value as CatalogSort)} className="h-9 rounded-lg border border-white/10 bg-[#191a20] px-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"><option value="popular">Em destaque</option><option value="newest">Mais recentes</option><option value="price-asc">Menor preco</option><option value="price-desc">Maior preco</option></select></label>
            </div>
            {query.isError && <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm"><p className="font-medium">Nao foi possivel carregar o catalogo.</p><p className="mt-1 text-muted-foreground">Verifique sua conexao e tente novamente.</p><Button className="mt-4" variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
            {query.isLoading && <NftGridSkeleton />}
            {query.isSuccess && query.data.items.length === 0 && <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-16 text-center"><Search className="mx-auto mb-4 text-muted-foreground" size={25} aria-hidden="true" /><h3 className="font-medium">Nenhuma obra encontrada</h3><p className="mt-2 text-sm text-muted-foreground">Tente outra busca ou remova algum filtro.</p></div>}
            {query.isSuccess && query.data.items.length > 0 && <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{query.data.items.map((nft) => <NftCard key={nft.id} nft={nft} />)}</div>
              {totalPages > 1 && <nav aria-label="Paginação do catálogo" className="mt-8 flex items-center justify-center gap-4"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={search.page <= 1} onClick={() => void navigate({ search: (previous) => ({ ...previous, page: search.page - 1 }) })}><ArrowLeft size={16} aria-hidden="true" /></Button><span className="text-sm text-muted-foreground">Página {search.page} de {totalPages}</span><Button variant="outline" size="icon" aria-label="Próxima página" disabled={search.page >= totalPages} onClick={() => void navigate({ search: (previous) => ({ ...previous, page: search.page + 1 }) })}><ArrowRight size={16} aria-hidden="true" /></Button></nav>}
            </>}
          </div>
        </div>
      </section>
    </div>
  )
}

function NftCard({ nft }: { nft: Nft }) {
  return (
    <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="group block rounded-2xl focus-visible:outline-primary" aria-label={`Ver ${nft.name}, ${nft.priceEth} ETH`}>
      <Card className="overflow-hidden rounded-2xl border-white/[0.08] bg-[#17181d] p-2 transition duration-300 group-hover:-translate-y-1 group-hover:border-white/15 group-hover:bg-[#1b1c22]">
        <div className="relative aspect-[1.22/1] overflow-hidden rounded-xl bg-muted"><img src={nft.image} alt={`Arte digital ${nft.name}`} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.04]" /><Badge className="absolute left-3 top-3 border border-white/15 bg-black/55 text-[10px] font-medium text-white backdrop-blur-md hover:bg-black/55">{nft.category}</Badge></div>
        <div className="px-2 pb-2 pt-3">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{nft.name}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{nft.artist} · {nft.collection}</p></div><div className="shrink-0 text-right"><p className="text-[10px] text-muted-foreground">Preco atual</p><p className="mt-1 text-sm font-semibold">{nft.priceEth} ETH</p></div></div>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 text-[11px] text-muted-foreground"><span>{nft.edition}</span><span>{nft.quantityAvailable} disponiveis</span></div>
        </div>
      </Card>
    </Link>
  )
}

function NftGridSkeleton() {
  return <div aria-label="Carregando catalogo" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Card key={index} className="overflow-hidden rounded-2xl border-white/[0.08] bg-[#17181d] p-2"><Skeleton className="shimmer aspect-[1.22/1] rounded-xl" /><div className="space-y-3 px-2 pb-2 pt-4"><Skeleton className="shimmer h-4 w-2/3" /><Skeleton className="shimmer h-3 w-1/2" /><Skeleton className="shimmer mt-5 h-3 w-full" /></div></Card>)}</div>
}

function NftDetailPage() {
  const { nftId } = nftRoute.useParams()
  const session = useQuery(sessionQueryOptions())
  const query = useQuery({ queryKey: ['nft', nftId], queryFn: ({ signal }) => fetchNft(nftId, signal) })
  if (query.isLoading) return <div className="mx-auto grid max-w-[1100px] gap-8 px-5 py-10 md:grid-cols-2 md:py-16"><Skeleton className="shimmer aspect-square rounded-3xl" /><div className="space-y-5 py-4"><Skeleton className="shimmer h-5 w-32" /><Skeleton className="shimmer h-12 w-4/5" /><Skeleton className="shimmer h-5 w-1/2" /><Skeleton className="shimmer mt-12 h-32 w-full" /></div></div>
  if (query.isError) {
    const status = axios.isAxiosError(query.error) ? query.error.response?.status : undefined
    const missing = status === 404
    return <div className="mx-auto max-w-[700px] px-5 py-24 text-center"><h1 className="text-3xl font-semibold">{missing ? 'Obra não encontrada' : 'Não foi possível carregar esta obra'}</h1><p className="mt-3 text-sm text-muted-foreground">{missing ? 'O link pode estar incorreto ou a obra não está mais disponível.' : 'Tente novamente em alguns instantes.'}</p>{!missing && <Button className="mt-6" variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button>}<div><Link to="/" search={defaultCatalogSearch} className="mt-5 inline-block text-sm text-primary hover:underline">Voltar ao catálogo</Link></div></div>
  }
  const nft = query.data
  if (!nft) return null
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 md:py-14">
      <Link to="/" search={defaultCatalogSearch} className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao catalogo</Link>
      <div className="grid gap-8 md:grid-cols-[1.05fr_0.95fr] md:gap-12">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-card"><img src={nft.image} alt={`Arte digital ${nft.name}`} className="aspect-square size-full object-cover" /></div>
          {nft.gallery.length > 1 && <div className="grid grid-cols-3 gap-3">{nft.gallery.slice(0, 3).map((src, index) => <img key={src} src={src} alt={`Galeria ${index + 1} de ${nft.name}`} className="aspect-square rounded-2xl border border-white/10 object-cover" />)}</div>}
        </div>
        <section className="flex flex-col py-1 md:py-4">
          <Badge className="w-fit border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">{nft.category}</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{nft.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Criado por <span className="font-medium text-foreground">{nft.artist}</span> · {nft.collection}</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{nft.description}</p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <p className="text-xs text-muted-foreground">Preco atual</p>
            <p className="mt-2 text-3xl font-semibold">{nft.priceEth} <span className="text-lg text-primary">ETH</span></p>
            <p className="mt-2 text-xs text-muted-foreground">{nft.quantityAvailable} unidades disponiveis · {nft.chain}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <AddToCartButton nftId={nft.id} disabled={nft.quantityAvailable < 1} />
              <FavoriteButton nftId={nft.id} enabled={Boolean(session.data?.user)} />
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-3">
            <DetailProperty label="Colecao" value={nft.collection} />
            <DetailProperty label="Edicao" value={nft.edition} />
            <DetailProperty label="Rede" value={nft.chain} />
            <DetailProperty label="Categoria" value={nft.category} />
          </dl>
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ArrowDown size={14} aria-hidden="true" /> Dados sincronizados por REST e atualizacoes Socket.IO simuladas.</div>
        </section>
      </div>
    </div>
  )
}

function DetailProperty({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>
}

function NotFoundPage() {
  return <div className="px-5 py-24 text-center"><h1 className="text-3xl font-semibold">Pagina nao encontrada</h1><p className="mt-3 text-sm text-muted-foreground">Confira o endereco ou volte para explorar o catalogo.</p><Link to="/" search={defaultCatalogSearch} className="mt-6 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-110">Ir para o catalogo</Link></div>
}

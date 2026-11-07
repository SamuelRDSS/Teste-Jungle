import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  addCartItem,
  applyCartCoupon,
  cartQueryKey,
  fetchCart,
  removeCartCoupon,
  removeCartItem,
  updateCartItem,
} from './api'
import type { Cart } from './types'

function useCartQuery() {
  return useQuery({
    queryKey: cartQueryKey,
    queryFn: ({ signal }) => fetchCart(signal),
    staleTime: 10_000,
  })
}

function saveCart(queryClient: ReturnType<typeof useQueryClient>, cart: Cart) {
  queryClient.setQueryData(cartQueryKey, cart)
}

function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data.message ?? fallback
  }
  return fallback
}

export function CartCount() {
  const cart = useCartQuery()
  const count = cart.data?.itemCount ?? 0

  return (
    <Link
      to="/cart"
      aria-label={`Carrinho${count ? `, ${count} ${count === 1 ? 'item' : 'itens'}` : ''}`}
      className="relative grid size-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.03] text-foreground transition hover:bg-white/[0.08]"
    >
      <ShoppingBag size={17} aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

export function AddToCartButton({ nftId, disabled }: { nftId: string; disabled?: boolean }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => addCartItem({ nftId, quantity: 1 }),
    onSuccess: (cart) => saveCart(queryClient, cart),
  })

  return (
    <div>
      <Button
        disabled={disabled || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="mt-6 h-12 w-full rounded-xl text-sm"
      >
        {mutation.isPending ? 'Adicionando...' : 'Adicionar ao carrinho'}
      </Button>
      {mutation.isError && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {getApiError(mutation.error, 'Não foi possível adicionar esta obra. Tente novamente.')}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="mt-3 text-sm text-primary">
          Obra adicionada ao carrinho.
        </p>
      )}
    </div>
  )
}

export function CartPage() {
  const queryClient = useQueryClient()
  const query = useCartQuery()
  const [couponInput, setCouponInput] = useState('')
  const [couponMessage, setCouponMessage] = useState('')
  const [couponError, setCouponError] = useState('')
  const [cartActionError, setCartActionError] = useState('')

  const mutationOptions = {
    onSuccess: (cart: Cart) => {
      saveCart(queryClient, cart)
      setCartActionError('')
    },
  }
  const updateMutation = useMutation({
    mutationFn: ({ nftId, quantity }: { nftId: string; quantity: number }) =>
      updateCartItem(nftId, quantity),
    ...mutationOptions,
    onError: (error) => setCartActionError(getApiError(error, 'Não foi possível atualizar a quantidade.')),
  })
  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    ...mutationOptions,
    onError: (error) => setCartActionError(getApiError(error, 'Não foi possível remover este item.')),
  })
  const applyCouponMutation = useMutation({
    mutationFn: applyCartCoupon,
    onSuccess: (cart) => {
      saveCart(queryClient, cart)
      setCouponError('')
      setCouponMessage('Cupom aplicado. Seu desconto foi atualizado.')
    },
    onError: (error) => {
      setCouponMessage('')
      setCouponError(getApiError(error, 'Não foi possível validar o cupom.'))
    },
  })
  const removeCouponMutation = useMutation({
    mutationFn: removeCartCoupon,
    onSuccess: (cart) => {
      saveCart(queryClient, cart)
      setCouponMessage('Cupom removido.')
      setCouponError('')
    },
    onError: (error) => setCouponError(getApiError(error, 'Não foi possível remover o cupom.')),
  })
  const isMutating =
    updateMutation.isPending ||
    removeMutation.isPending ||
    applyCouponMutation.isPending ||
    removeCouponMutation.isPending

  function applyCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCouponError('')
    setCouponMessage('')
    applyCouponMutation.mutate(couponInput.trim())
  }

  if (query.isLoading) {
    return <CartSkeleton />
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[760px] px-5 py-20 text-center">
        <h1 className="text-2xl font-semibold">Não foi possível carregar o carrinho</h1>
        <p className="mt-2 text-sm text-muted-foreground">Seus itens continuam salvos. Tente carregar novamente.</p>
        <Button onClick={() => void query.refetch()} variant="outline" className="mt-6">Tentar novamente</Button>
      </div>
    )
  }

  const cart = query.data
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-[760px] px-5 py-16 text-center sm:py-24">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShoppingBag size={28} aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Seu carrinho está vazio</h1>
        <p className="mt-3 text-sm text-muted-foreground">Descubra uma obra especial e adicione à sua coleção.</p>
        <Link
          to="/"
          search={{ q: '', category: 'All', sort: 'popular', page: 1 }}
          className="mt-7 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:brightness-110"
        >
          Explorar obras
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-9 sm:px-8 sm:py-12">
      <Link to="/" search={{ q: '', category: 'All', sort: 'popular', page: 1 }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Continuar explorando
      </Link>
      <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">Sua seleção</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Carrinho</h1>
        </div>
        <p className="text-sm text-muted-foreground">{cart.itemCount} {cart.itemCount === 1 ? 'item' : 'itens'}</p>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Itens no carrinho" className="space-y-3">
          {cart.items.map((line) => (
            <Card key={line.nft.id} className="flex flex-col gap-4 rounded-2xl border-white/8 bg-card p-3 sm:flex-row sm:items-center sm:p-4">
              <img
                src={line.nft.image}
                alt={`Arte digital ${line.nft.name}`}
                className="aspect-[1.4/1] w-full rounded-xl object-cover sm:size-24 sm:aspect-square"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{line.nft.collection}</p>
                <h2 className="mt-1 truncate font-semibold">{line.nft.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{line.nft.priceEth} ETH cada · {line.nft.quantityAvailable} disponíveis</p>
                <p className="mt-2 text-sm font-medium sm:hidden">{line.lineTotalEth} ETH</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="flex items-center rounded-full border border-white/10 bg-white/[0.025]">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Diminuir quantidade de ${line.nft.name}`}
                    disabled={isMutating || line.quantity <= 1}
                    onClick={() => updateMutation.mutate({ nftId: line.nft.id, quantity: line.quantity - 1 })}
                    className="size-9 rounded-full"
                  >
                    <Minus size={14} aria-hidden="true" />
                  </Button>
                  <span aria-label={`Quantidade: ${line.quantity}`} className="min-w-7 text-center text-sm tabular-nums">{line.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Aumentar quantidade de ${line.nft.name}`}
                    disabled={isMutating || line.quantity >= line.nft.quantityAvailable}
                    onClick={() => updateMutation.mutate({ nftId: line.nft.id, quantity: line.quantity + 1 })}
                    className="size-9 rounded-full"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </Button>
                </div>
                <p className="hidden min-w-24 text-right text-sm font-semibold sm:block">{line.lineTotalEth} ETH</p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${line.nft.name} do carrinho`}
                  disabled={isMutating}
                  onClick={() => removeMutation.mutate(line.nft.id)}
                  className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-red-300"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            </Card>
          ))}
          {cartActionError && (
            <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-sm text-red-200">
              {cartActionError.includes('disponiveis') ? 'A quantidade solicitada excede as unidades disponíveis.' : cartActionError}
            </p>
          )}
        </section>

        <aside aria-label="Resumo do pedido" className="lg:sticky lg:top-24">
          <Card className="rounded-2xl border-white/8 bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Resumo do pedido</h2>
            <form onSubmit={applyCoupon} className="mt-5">
              <label htmlFor="cart-coupon" className="mb-2 block text-xs font-medium text-muted-foreground">Cupom de desconto</label>
              <div className="flex gap-2">
                <Input
                  id="cart-coupon"
                  name="coupon"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  placeholder="Digite o código"
                  autoComplete="off"
                  className="h-10 min-w-0 rounded-xl border-white/10 bg-white/[0.025] text-sm"
                  aria-describedby={couponError ? 'coupon-error' : couponMessage ? 'coupon-success' : undefined}
                />
                <Button type="submit" variant="outline" disabled={isMutating || !couponInput.trim()} className="h-10 rounded-xl px-4">
                  Aplicar
                </Button>
              </div>
              {couponError && <p id="coupon-error" role="alert" className="mt-2 text-xs text-red-300">{couponError}</p>}
              {couponMessage && <p id="coupon-success" role="status" className="mt-2 text-xs text-primary">{couponMessage}</p>}
            </form>

            {cart.couponCode && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/8 px-3 py-2 text-xs">
                <span className="font-medium text-primary">Cupom {cart.couponCode} aplicado</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isMutating}
                  onClick={() => removeCouponMutation.mutate()}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Remover
                </Button>
              </div>
            )}

            <dl className="mt-6 space-y-3 border-t border-white/8 pt-5 text-sm">
              <SummaryLine label="Subtotal" value={cart.subtotalEth} />
              <SummaryLine label="Desconto" value={`- ${cart.discountEth}`} />
              <SummaryLine label="Taxa de rede" value={cart.networkFeeEth} />
              <div className="flex items-end justify-between border-t border-white/8 pt-4">
                <dt className="font-semibold">Total</dt>
                <dd className="text-xl font-semibold">{cart.totalEth} <span className="text-xs text-primary">ETH</span></dd>
              </div>
            </dl>
              <Link to="/checkout" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:brightness-110">
                Ir para checkout <ArrowRight size={16} className="ml-2" aria-hidden="true" />
              </Link>
              <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
                A cotacao final sera validada no checkout antes da confirmacao.
              </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-muted-foreground">
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value} ETH</dd>
    </div>
  )
}

function CartSkeleton() {
  return (
    <div aria-label="Carregando carrinho" className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8">
      <Skeleton className="shimmer h-10 w-48" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="shimmer h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="shimmer h-[360px] rounded-2xl" />
      </div>
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { createOrder, fetchOrder, fetchOrders, fetchQuote } from './api'
import { fetchWallets } from '@/features/account/api'
import { fetchSession } from '@/features/auth/api'
import type { CheckoutQuote } from './types'

export function CheckoutPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const session = useQuery({ queryKey: ['auth', 'session'], queryFn: ({ signal }) => fetchSession(signal) })
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: ({ signal }) => fetchWallets(signal), enabled: Boolean(session.data?.user) })
  const quote = useQuery({ queryKey: ['checkout', 'quote'], queryFn: ({ signal }) => fetchQuote(signal), retry: false })
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [walletState, setWalletState] = useState<'connected' | 'refused' | 'disconnected'>('connected')
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])

  const orderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      void navigate({ to: '/orders/$orderId', params: { orderId: order.orderId } })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Nao foi possivel concluir o pedido.'),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!quote.data) return
    if (quote.data.warnings.length) return setError('Revise a cotacao atualizada antes de confirmar.')
    if (walletState !== 'connected') return setError('Conecte uma carteira antes de enviar o pedido.')
    if (!confirmed) return setError('Confirme a revisao do pedido antes de enviar.')
    const form = new FormData(event.currentTarget)
    orderMutation.mutate({
      idempotencyKey,
      quoteId: quote.data.quoteId,
      collectorName: String(form.get('collectorName') ?? ''),
      collectorEmail: String(form.get('collectorEmail') ?? ''),
      walletId: String(form.get('walletId') ?? ''),
      network: String(form.get('network') ?? 'Ethereum') as 'Ethereum' | 'Polygon',
    })
  }

  if (quote.isLoading || session.isLoading || wallets.isLoading) return <CheckoutSkeleton />
  if (quote.isError || !quote.data) return <div className="mx-auto max-w-[760px] px-5 py-16 text-center"><h1 className="text-2xl font-semibold">Nao foi possivel obter a cotacao</h1><Button className="mt-5" onClick={() => void quote.refetch()}>Tentar novamente</Button></div>

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-2xl border-white/8 bg-card p-5 sm:p-6">
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do colecionador" name="collectorName" defaultValue={session.data?.user?.name ?? ''} required />
              <Field label="E-mail" name="collectorEmail" type="email" defaultValue={session.data?.user?.email ?? ''} required />
            </div>
            <label className="block space-y-2 text-sm"><span className="font-medium">Carteira</span>
              <select name="walletId" required className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.025] px-3">
                <option value="">Selecione</option>
                {(wallets.data ?? []).map((wallet) => <option key={wallet.id} value={wallet.address}>{wallet.label} — {wallet.address}</option>)}
              </select>
            </label>
            <label className="block space-y-2 text-sm"><span className="font-medium">Rede</span>
              <select name="network" className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.025] px-3"><option>Ethereum</option><option>Polygon</option></select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setWalletState('connected')}>Conectar carteira</Button>
              <Button type="button" variant="outline" onClick={() => setWalletState('refused')}>Simular recusa</Button>
              <Button type="button" variant="outline" onClick={() => setWalletState('disconnected')}>Simular desconexao</Button>
              <span aria-live="polite" className="self-center text-sm text-muted-foreground">Estado: {walletState}</span>
            </div>
            {quote.data.warnings.length > 0 && <div role="alert" className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200">{quote.data.warnings.map((w) => <p key={w}>{w}</p>)}</div>}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> <span>Revisei preco, disponibilidade, cupom, taxas e total desta cotacao.</span></label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => { setConfirmed(false); void quote.refetch() }}>Solicitar nova cotacao</Button>
              <Button type="submit" disabled={orderMutation.isPending || quote.isFetching}>{orderMutation.isPending ? 'Enviando...' : 'Confirmar pedido'}</Button>
            </div>
          </form>
        </Card>
        <QuoteSummary quote={quote.data} />
      </div>
    </div>
  )
}

function QuoteSummary({ quote }: { quote: CheckoutQuote }) {
  return (
    <Card className="rounded-2xl border-white/8 bg-card p-5 sm:p-6 lg:sticky lg:top-24">
      <h2 className="text-lg font-semibold">Revisao da cotacao</h2>
      <p className="mt-1 text-xs text-muted-foreground">Cotacao {quote.quoteId.slice(0, 8)} · expira em {new Date(quote.expiresAt).toLocaleTimeString()}</p>
      <div className="mt-4 space-y-2">
        {quote.items.map((item) => <div key={item.nftId} className="flex justify-between gap-3 text-sm"><span className="truncate">{item.name} x{item.quantity}</span><span>{item.lineTotalEth} ETH</span></div>)}
      </div>
      <dl className="mt-5 space-y-2 border-t border-white/8 pt-4 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{quote.subtotalEth} ETH</dd></div>
        <div className="flex justify-between"><dt>Desconto</dt><dd>- {quote.discountEth} ETH</dd></div>
        <div className="flex justify-between"><dt>Taxa de rede</dt><dd>{quote.networkFeeEth} ETH</dd></div>
        <div className="flex justify-between border-t border-white/8 pt-3 font-semibold"><dt>Total</dt><dd>{quote.totalEth} ETH</dd></div>
      </dl>
    </Card>
  )
}

export function OrdersPage() {
  const orders = useQuery({ queryKey: ['orders'], queryFn: ({ signal }) => fetchOrders(signal) })
  if (orders.isLoading) return <div className="mx-auto max-w-[900px] px-5 py-12"><Skeleton className="shimmer h-48 rounded-3xl" /></div>
  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Pedidos</h1>
      <div className="mt-6 space-y-3">
        {(orders.data ?? []).map((order) => (
          <Link key={order.orderId} to="/orders/$orderId" params={{ orderId: order.orderId }} className="block rounded-2xl border border-white/8 bg-card p-4 hover:bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-medium">Pedido {order.orderId.slice(0, 8)}</p><p className="mt-1 text-sm text-muted-foreground">{order.status} · {order.items.length} item(ns)</p></div>
              <p className="font-semibold">{order.totalEth} ETH</p>
            </div>
          </Link>
        ))}
        {!orders.data?.length && <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>}
      </div>
    </div>
  )
}

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const order = useQuery({ queryKey: ['order', orderId], queryFn: ({ signal }) => fetchOrder(orderId, signal), refetchInterval: (q) => (q.state.data?.status === 'pending' ? 1500 : false) })
  if (order.isLoading) return <div className="mx-auto max-w-[900px] px-5 py-12"><Skeleton className="shimmer h-56 rounded-3xl" /></div>
  if (order.isError || !order.data) return <div className="mx-auto max-w-[760px] px-5 py-16 text-center">Pedido nao encontrado.</div>
  const receipt = order.data
  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Confirmacao / recibo</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Pedido {receipt.orderId.slice(0, 8)}</h1>
      {receipt.status === 'confirmed' && <p role="status" className="mt-3 text-sm text-primary">Pedido confirmado.</p>}
      {receipt.status === 'declined' && <p role="alert" className="mt-3 text-sm text-red-300">Pagamento recusado.</p>}
      {receipt.status === 'pending' && <p role="status" className="mt-3 text-sm text-amber-200">Pedido pendente.</p>}
      <Card className="mt-6 rounded-2xl border-white/8 bg-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <p><span className="text-muted-foreground">Status:</span> <strong>{receipt.status}</strong></p>
          <p><span className="text-muted-foreground">Total:</span> <strong>{receipt.totalEth} ETH</strong></p>
          <p><span className="text-muted-foreground">Rede:</span> {receipt.network}</p>
          <p><span className="text-muted-foreground">Carteira:</span> <span className="break-all">{receipt.walletAddress}</span></p>
          {receipt.transactionRef && <p><span className="text-muted-foreground">Transacao:</span> {receipt.transactionRef}</p>}
          {receipt.explorerUrl && <p><a className="text-primary underline" href={receipt.explorerUrl} target="_blank" rel="noreferrer">Explorador simulado</a></p>}
        </div>
        {receipt.message && <p role="status" className="mt-4 rounded-xl bg-white/[0.03] p-3 text-sm">{receipt.message}</p>}
        <div className="mt-5 space-y-2 border-t border-white/8 pt-4">
          {receipt.items.map((item) => <div key={item.nftId + item.quantity} className="flex justify-between gap-3 text-sm"><span>{item.name} x{item.quantity}</span><span>{item.lineTotalEth} ETH</span></div>)}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">O recibo preserva o snapshot do pedido. Alteracoes posteriores no catalogo nao afetam estes valores.</p>
      </Card>
      <div className="mt-5 flex gap-3"><Link to="/orders" className="text-sm text-primary underline">Voltar aos pedidos</Link><Link to="/" search={{ q: '', category: 'All', sort: 'popular', page: 1 }} className="text-sm text-primary underline">Catalogo</Link></div>
    </div>
  )
}

function CheckoutSkeleton() {
  return <div className="mx-auto max-w-[1180px] px-5 py-10"><Skeleton className="shimmer h-10 w-48" /><div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><Skeleton className="shimmer h-[420px] rounded-3xl" /><Skeleton className="shimmer h-[320px] rounded-3xl" /></div></div>
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  const id = `checkout-${name}`
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} name={name} {...props} className="h-10 rounded-xl border-white/10 bg-white/[0.025]" /></div>
}

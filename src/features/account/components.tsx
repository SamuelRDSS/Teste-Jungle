import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { changePassword, createWallet, fetchProfile, fetchWallets, updateProfile, updateWallet } from './api'
import { fetchOrders } from '@/features/orders/api'
import { expireSession, logout } from '@/features/auth/api'
import { fetchFavorites } from '@/features/favorites/api'
import type { OrderReceipt } from '@/features/orders/types'
import type { UserProfile, Wallet } from './types'

export function useProfile(enabled = true) {
  return useQuery({ queryKey: ['profile'], queryFn: ({ signal }) => fetchProfile(signal), enabled })
}

export function ProfileDashboard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const profile = useProfile()
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: ({ signal }) => fetchWallets(signal), enabled: profile.isSuccess })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: ({ signal }) => fetchFavorites(signal), enabled: profile.isSuccess })
  const orders = useQuery({ queryKey: ['orders'], queryFn: ({ signal }) => fetchOrders(signal), enabled: profile.isSuccess })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.setQueryData(['auth', 'session'], { user: null, expiresAt: null })
      queryClient.removeQueries({ queryKey: ['profile'] })
      queryClient.removeQueries({ queryKey: ['favorites'] })
      queryClient.removeQueries({ queryKey: ['orders'] })
      queryClient.removeQueries({ queryKey: ['wallets'] })
      await navigate({ to: '/', search: { q: '', category: 'All', sort: 'popular', page: 1 }, replace: true })
    },
  })
  const expireMutation = useMutation({
    mutationFn: expireSession,
    onSuccess: async () => {
      queryClient.setQueryData(['auth', 'session'], { user: null, expiresAt: null })
      await navigate({ to: '/login', search: { returnTo: '/profile', expired: true }, replace: true })
    },
  })

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data)
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
      setMessage('Perfil atualizado.')
      setError('')
    },
    onError: () => setError('Nao foi possivel atualizar o perfil.'),
  })
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setMessage('Senha alterada com sucesso.')
      setError('')
    },
    onError: () => setError('Nao foi possivel alterar a senha. Verifique a senha atual.'),
  })

  if (profile.isLoading) return <div className="mx-auto max-w-[1100px] px-5 py-12"><Skeleton className="shimmer h-64 rounded-3xl" /></div>
  if (profile.isError || !profile.data) return <div className="mx-auto max-w-[760px] px-5 py-16 text-center">Nao foi possivel carregar o perfil.</div>

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">Conta</p>
          <h1 className="text-3xl font-semibold tracking-tight">Perfil do colecionador</h1>
          <h2 className="mt-2 text-lg font-medium text-foreground/90">{profile.data.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="max-[420px]:w-full" onClick={() => void navigate({ to: '/orders' })}>Ver pedidos</Button>
          <Button variant="outline" className="max-[420px]:w-full" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}><LogOut size={16} className="mr-2" aria-hidden="true" />{logoutMutation.isPending ? 'Saindo...' : 'Sair da conta'}</Button>
          <Button variant="outline" disabled={expireMutation.isPending} onClick={() => expireMutation.mutate()} className="border-amber-300/20 text-amber-200 hover:bg-amber-300/5 max-[420px]:w-full max-[420px]:text-xs" aria-label="Simular sessão expirada">{expireMutation.isPending ? 'Simulando...' : 'Simular sessão expirada'}</Button>
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ProfileForm profile={profile.data} pending={profileMutation.isPending} onSubmit={(values) => profileMutation.mutate(values)} />
          <PasswordForm pending={passwordMutation.isPending} onSubmit={(values) => passwordMutation.mutate(values)} />
          <WalletsPanel wallets={wallets.data ?? []} />
        </div>
        <aside className="space-y-6">
          <Card className="rounded-2xl border-white/8 bg-card p-5">
            <h2 className="text-lg font-semibold">Favoritos</h2>
            <p className="mt-2 text-sm text-muted-foreground">{favorites.data?.items.length ?? 0} obras salvas</p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => void navigate({ to: '/favorites' })}>Abrir favoritos</Button>
          </Card>
          <Card className="rounded-2xl border-white/8 bg-card p-5">
            <h2 className="text-lg font-semibold">Pedidos recentes</h2>
            <div className="mt-3 space-y-2 text-sm">
              {(orders.data ?? []).slice(0, 3).map((order) => <OrderRow key={order.orderId} order={order} />)}
              {!orders.data?.length && <p className="text-muted-foreground">Nenhum pedido ainda.</p>}
            </div>
          </Card>
        </aside>
      </div>
      {message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    </div>
  )
}

function OrderRow({ order }: { order: OrderReceipt }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 px-3 py-2">
      <span className="truncate text-xs text-muted-foreground">{order.orderId.slice(0, 8)}</span>
      <span className="text-xs font-medium">{order.status}</span>
      <span className="text-xs">{order.totalEth} ETH</span>
    </div>
  )
}

function ProfileForm({ profile, pending, onSubmit }: { profile: UserProfile; pending: boolean; onSubmit: (v: { name: string; email: string; avatarUrl: string | null }) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSubmit({ name: String(form.get('name') ?? ''), email: String(form.get('email') ?? ''), avatarUrl: String(form.get('avatarUrl') ?? '') || null })
  }
  return (
    <Card className="min-w-0 rounded-2xl border-white/8 bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Dados do perfil</h2>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Nome" name="name" defaultValue={profile.name} required minLength={2} />
        <Field label="E-mail" name="email" type="email" defaultValue={profile.email} required />
        <div className="sm:col-span-2"><Field label="Avatar (URL)" name="avatarUrl" defaultValue={profile.avatarUrl ?? ''} placeholder="https://..." /></div>
        <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'Salvando...' : 'Salvar perfil'}</Button></div>
      </form>
    </Card>
  )
}

function PasswordForm({ pending, onSubmit }: { pending: boolean; onSubmit: (v: { currentPassword: string; newPassword: string }) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSubmit({ currentPassword: String(form.get('currentPassword') ?? ''), newPassword: String(form.get('newPassword') ?? '') })
    event.currentTarget.reset()
  }
  return (
    <Card className="min-w-0 rounded-2xl border-white/8 bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Alterar senha</h2>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Senha atual" name="currentPassword" type="password" required minLength={8} />
        <Field label="Nova senha" name="newPassword" type="password" required minLength={8} />
        <div className="sm:col-span-2"><Button type="submit" variant="outline" disabled={pending}>{pending ? 'Alterando...' : 'Alterar senha'}</Button></div>
      </form>
    </Card>
  )
}

function WalletsPanel({ wallets }: { wallets: Wallet[] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Wallet | null>(null)
  const save = useMutation({
    mutationFn: (values: { id?: string; label: string; address: string; network: 'Ethereum' | 'Polygon'; primary: boolean }) =>
      values.id ? updateWallet(values.id, values) : createWallet(values),
    onSuccess: (data) => {
      queryClient.setQueryData(['wallets'], data)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setEditing(null)
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save.mutate({
      id: editing?.id,
      label: String(form.get('label') ?? ''),
      address: String(form.get('address') ?? ''),
      network: String(form.get('network') ?? 'Ethereum') as 'Ethereum' | 'Polygon',
      primary: form.get('primary') === 'on',
    })
    event.currentTarget.reset()
  }
  return (
    <Card className="min-w-0 rounded-2xl border-white/8 bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Carteiras</h2><Button size="sm" variant="outline" onClick={() => setEditing(null)}>Nova</Button></div>
      <div className="mt-4 space-y-2">
        {wallets.map((wallet) => (
          <button key={wallet.id} type="button" onClick={() => setEditing(wallet)} className="flex w-full flex-col items-start gap-2 rounded-xl sm:flex-row sm:items-center sm:justify-between border border-white/8 p-3 text-left hover:bg-white/[0.03]">
            <div><p className="text-sm font-medium">{wallet.label} {wallet.primary && <span className="text-xs text-primary">(principal)</span>}</p><p className="mt-1 break-all text-xs text-muted-foreground">{wallet.address}</p></div>
            <span className="text-xs text-muted-foreground">{wallet.network}</span>
          </button>
        ))}
      </div>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submit} key={editing?.id ?? 'new'}>
        <Field label="Rótulo" name="label" defaultValue={editing?.label ?? ''} required minLength={2} />
        <Field label="Endereço" name="address" defaultValue={editing?.address ?? ''} required pattern="^0x[a-fA-F0-9]{40}$" placeholder="0x..." />
        <label className="space-y-2 text-sm"><span className="font-medium">Rede</span><select name="network" defaultValue={editing?.network ?? 'Ethereum'} className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.025] px-3"><option>Ethereum</option><option>Polygon</option></select></label>
        <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" name="primary" defaultChecked={editing?.primary} /> Principal</label>
        <div className="sm:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando...' : editing ? 'Atualizar carteira' : 'Cadastrar carteira'}</Button></div>
      </form>
    </Card>
  )
}

function Field({ label, name, className = '', ...props }: { label: string; name: string; className?: string } & React.ComponentProps<typeof Input>) {
  const id = `account-${name}`
  return <div className={`min-w-0 space-y-2 ${className}`}><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} name={name} {...props} className="h-10 w-full min-w-0 rounded-xl border-white/10 bg-white/[0.025]" /></div>
}

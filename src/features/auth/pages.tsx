import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { expireSession, login, logout, register } from './api'
import type { AuthenticatedSession, User } from './types'

type AuthSearch = {
  returnTo: string | undefined
  expired: boolean
}

const defaultReturnTo = '/profile'

function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return defaultReturnTo
  }
  if (value.startsWith('/login') || value.startsWith('/register')) {
    return defaultReturnTo
  }
  return value
}

async function setAuthenticatedSession(
  queryClient: ReturnType<typeof useQueryClient>,
  session: AuthenticatedSession,
): Promise<void> {
  const previous = queryClient.getQueryData<{ user: User | null }>(['auth', 'session'])
  if (previous?.user && previous.user.id !== session.user.id) {
    clearPrivateCache(queryClient)
  }
  queryClient.setQueryData(['auth', 'session'], {
    user: session.user,
    expiresAt: session.expiresAt,
  })
  await queryClient.invalidateQueries({ queryKey: ['cart'] })
}

function clearPrivateCache(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.removeQueries({
    predicate: (query) =>
      ['profile', 'favorites', 'cart', 'wallets', 'orders'].includes(String(query.queryKey[0])),
  })
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data.message ?? fallback
  }
  return fallback
}

function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-[500px] px-5 py-12 sm:py-16">
      <Link to="/" search={{ q: '', category: 'All', sort: 'popular', page: 1 }} className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Voltar ao catálogo
      </Link>
      <section className="rounded-3xl border border-white/10 bg-card p-6 sm:p-9">
        <div className="mb-7 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck size={23} aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {children}
      </section>
    </div>
  )
}

export function LoginPage({ search }: { search: AuthSearch }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (session) => {
      await setAuthenticatedSession(queryClient, session)
      await navigate({ to: safeReturnTo(search.returnTo), replace: true })
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Não foi possível entrar. Tente novamente.'))
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const formData = new FormData(event.currentTarget)
    mutation.mutate({
      email: String(formData.get('email') ?? '').trim().toLowerCase(),
      password: String(formData.get('password') ?? ''),
    })
  }

  return (
    <AuthShell title="Boas-vindas de volta" description="Entre na sua conta para acessar seu perfil e sua coleção.">
      {search.expired && (
        <p role="status" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200">
          Sua sessão expirou. Entre novamente para continuar.
        </p>
      )}
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <Field label="E-mail" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" />
        <Field label="Senha" name="password" type="password" autoComplete="current-password" minLength={8} placeholder="Sua senha" />
        {formError && <p role="alert" className="text-sm text-red-300">{formError}</p>}
        <Button type="submit" disabled={mutation.isPending} className="h-11 w-full rounded-xl">
          {mutation.isPending ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link to="/register" search={{ returnTo: search.returnTo, expired: search.expired }} className="font-medium text-primary hover:underline">Criar conta</Link>
      </p>
      <div className="mt-7 border-t border-white/8 pt-5 text-xs leading-5 text-muted-foreground">
        <p className="font-medium text-foreground/80">Conta de demonstração</p>
        <p className="mt-1">demo@mintora.art · Mintora2026!</p>
      </div>
    </AuthShell>
  )
}

export function RegisterPage({ search }: { search: AuthSearch }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const mutation = useMutation({
    mutationFn: register,
    onSuccess: async (session) => {
      await setAuthenticatedSession(queryClient, session)
      await navigate({ to: safeReturnTo(search.returnTo), replace: true })
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Não foi possível criar a conta. Tente novamente.'))
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')
    if (password !== confirmPassword) {
      setFormError('As senhas não coincidem.')
      return
    }

    mutation.mutate({
      name: String(formData.get('name') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim().toLowerCase(),
      password,
    })
  }

  return (
    <AuthShell title="Crie sua conta" description="Junte-se à comunidade e comece sua coleção.">
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <Field label="Nome" name="name" autoComplete="name" minLength={2} maxLength={60} placeholder="Seu nome" />
        <Field label="E-mail" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" />
        <Field label="Senha" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Mínimo de 8 caracteres" />
        <Field label="Confirme a senha" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} placeholder="Digite a senha novamente" />
        {formError && <p role="alert" className="text-sm text-red-300">{formError}</p>}
        <Button type="submit" disabled={mutation.isPending} className="h-11 w-full rounded-xl">
          {mutation.isPending ? 'Criando conta...' : 'Criar conta'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link to="/login" search={{ returnTo: search.returnTo, expired: search.expired }} className="font-medium text-primary hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  )
}

export function ProfilePage({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.cancelQueries()
      clearPrivateCache(queryClient)
      queryClient.setQueryData(['auth', 'session'], { user: null, expiresAt: null })
      await navigate({
        to: '/',
        search: { q: '', category: 'All', sort: 'popular', page: 1 },
        replace: true,
      })
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Não foi possível encerrar a sessão. Tente novamente.'))
    },
  })
  const expireMutation = useMutation({
    mutationFn: expireSession,
    onSuccess: async () => {
      clearPrivateCache(queryClient)
      queryClient.setQueryData(['auth', 'session'], { user: null, expiresAt: null })
      await navigate({
        to: '/login',
        search: { returnTo: '/profile', expired: true },
        replace: true,
      })
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Não foi possível simular a expiração. Tente novamente.'))
    },
  })

  return (
    <div className="mx-auto max-w-[760px] px-5 py-12 sm:py-16">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">Sua conta</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Perfil do colecionador</h1>
      <section className="mt-8 rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
        <div className="flex items-center gap-4 border-b border-white/8 pb-6">
          <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <UserRound size={25} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          Esta área é privada. A sessão de demonstração é persistida neste navegador e expira após oito horas.
        </p>
        {formError && <p role="alert" className="mt-5 text-sm text-red-300">{formError}</p>}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            disabled={logoutMutation.isPending || expireMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            className="h-10 gap-2 rounded-xl"
          >
            <LogOut size={16} aria-hidden="true" />
            {logoutMutation.isPending ? 'Saindo...' : 'Sair da conta'}
          </Button>
          <Button
            variant="outline"
            disabled={logoutMutation.isPending || expireMutation.isPending}
            onClick={() => expireMutation.mutate()}
            className="h-10 rounded-xl border-amber-300/20 text-amber-200 hover:bg-amber-300/5"
          >
            {expireMutation.isPending ? 'Simulando...' : 'Simular sessão expirada'}
          </Button>
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  name,
  ...inputProps
}: {
  label: string
  name: string
} & React.ComponentProps<typeof Input>) {
  const id = `auth-${name}`
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <Input
        id={id}
        name={name}
        required
        {...inputProps}
        className="h-11 rounded-xl border-white/10 bg-white/[0.025] px-3 text-sm"
      />
    </div>
  )
}

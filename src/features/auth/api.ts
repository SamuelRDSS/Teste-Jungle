import type { AxiosResponse } from 'axios'
import { api } from '@/lib/api'
import type {
  AuthenticatedSession,
  AuthSnapshot,
  LoginInput,
  RegisterInput,
} from './types'

export async function fetchSession(signal?: AbortSignal): Promise<AuthSnapshot> {
  const response: AxiosResponse<AuthSnapshot> = await api.get('/auth/session', { signal })
  return response.data
}

export async function register(input: RegisterInput): Promise<AuthenticatedSession> {
  const response: AxiosResponse<AuthenticatedSession> = await api.post('/auth/register', input)
  return response.data
}

export async function login(input: LoginInput): Promise<AuthenticatedSession> {
  const response: AxiosResponse<AuthenticatedSession> = await api.post('/auth/login', input)
  return response.data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function expireSession(): Promise<void> {
  await api.post('/auth/expire')
}

export function sessionQueryOptions() {
  return {
    queryKey: ['auth', 'session'] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchSession(signal),
    staleTime: 0,
    retry: false,
  }
}

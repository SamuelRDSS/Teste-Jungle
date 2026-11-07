import type { AxiosResponse } from 'axios'
import { api } from '@/lib/api'
import type { PasswordChangeInput, ProfileUpdateInput, UserProfile, Wallet, WalletInput } from './types'

export async function fetchProfile(signal?: AbortSignal): Promise<UserProfile> {
  const response: AxiosResponse<UserProfile> = await api.get('/profile', { signal })
  return response.data
}

export async function updateProfile(input: ProfileUpdateInput): Promise<UserProfile> {
  const response: AxiosResponse<UserProfile> = await api.patch('/profile', input)
  return response.data
}

export async function changePassword(input: PasswordChangeInput): Promise<void> {
  await api.post('/profile/password', input)
}

export async function fetchWallets(signal?: AbortSignal): Promise<Wallet[]> {
  const response: AxiosResponse<Wallet[]> = await api.get('/wallets', { signal })
  return response.data
}

export async function createWallet(input: WalletInput): Promise<Wallet[]> {
  const response: AxiosResponse<Wallet[]> = await api.post('/wallets', input)
  return response.data
}

export async function updateWallet(walletId: string, input: WalletInput): Promise<Wallet[]> {
  const response: AxiosResponse<Wallet[]> = await api.patch(`/wallets/${encodeURIComponent(walletId)}`, input)
  return response.data
}

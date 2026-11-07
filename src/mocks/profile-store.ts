import { ensureAuthState, getCurrentSession } from './auth-store'
import type { PasswordChangeInput, ProfileUpdateInput, UserProfile, Wallet, WalletInput } from '@/features/account/types'

const storageKey = 'mintora:mock-profile:v1'
const passwordIterations = 120_000

type ProfileState = Record<string, { avatarUrl: string | null; wallets: Wallet[] }>

function read(): ProfileState {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as ProfileState) : {}
  } catch {
    return {}
  }
}

function write(state: ProfileState): void {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt).buffer, iterations: passwordIterations },
    key,
    256,
  )
  return toBase64(new Uint8Array(bits))
}

function defaultsFor(userId: string): { avatarUrl: string | null; wallets: Wallet[] } {
  return {
    avatarUrl: null,
    wallets: [
      {
        id: `wallet-${userId}-primary`,
        label: 'Carteira principal',
        address: userId === 'user-demo' ? '0xA1b2C3d4E5f60718293aBcDeF0123456789abCde' : '0xB0c1D2e3F4a506172839AbCdEf0123456789BcDe',
        network: 'Ethereum',
        primary: true,
      },
    ],
  }
}

async function requireUser() {
  const session = await getCurrentSession()
  if (!session) throw new Error('UNAUTHENTICATED')
  return session
}

export async function getProfile(): Promise<UserProfile> {
  const session = await requireUser()
  const state = read()
  const extra = state[session.user.id] ?? defaultsFor(session.user.id)
  state[session.user.id] = extra
  write(state)
  return { ...session.user, avatarUrl: extra.avatarUrl, wallets: extra.wallets }
}

export async function updateProfile(input: ProfileUpdateInput): Promise<UserProfile> {
  const session = await requireUser()
  const auth = await ensureAuthState()
  const conflict = auth.accounts.find((account) => account.email === input.email && account.id !== session.user.id)
  if (conflict) throw new Error('EMAIL_CONFLICT')
  const account = auth.accounts.find((item) => item.id === session.user.id)
  if (!account) throw new Error('UNAUTHENTICATED')
  account.name = input.name
  account.email = input.email
  localStorage.setItem('mintora:mock-auth:v1', JSON.stringify(auth))
  const state = read()
  const extra = state[session.user.id] ?? defaultsFor(session.user.id)
  extra.avatarUrl = input.avatarUrl
  state[session.user.id] = extra
  write(state)
  return getProfile()
}

export async function changePassword(input: PasswordChangeInput): Promise<void> {
  const session = await requireUser()
  const auth = await ensureAuthState()
  const account = auth.accounts.find((item) => item.id === session.user.id)
  if (!account) throw new Error('UNAUTHENTICATED')
  const submitted = await hashPassword(input.currentPassword, fromBase64(account.salt))
  if (submitted !== account.passwordHash) throw new Error('INVALID_CURRENT_PASSWORD')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  account.salt = toBase64(salt)
  account.passwordHash = await hashPassword(input.newPassword, salt)
  localStorage.setItem('mintora:mock-auth:v1', JSON.stringify(auth))
}

export async function listWallets(): Promise<Wallet[]> {
  return (await getProfile()).wallets
}

export async function createWallet(input: WalletInput): Promise<Wallet[]> {
  const session = await requireUser()
  const state = read()
  const extra = state[session.user.id] ?? defaultsFor(session.user.id)
  if (extra.wallets.some((wallet) => wallet.address.toLowerCase() === input.address.toLowerCase())) {
    throw new Error('WALLET_CONFLICT')
  }
  const wallet: Wallet = { id: crypto.randomUUID(), ...input }
  if (wallet.primary) extra.wallets = extra.wallets.map((item) => ({ ...item, primary: false }))
  if (extra.wallets.length === 0) wallet.primary = true
  extra.wallets.push(wallet)
  state[session.user.id] = extra
  write(state)
  return extra.wallets
}

export async function updateWallet(walletId: string, input: WalletInput): Promise<Wallet[]> {
  const session = await requireUser()
  const state = read()
  const extra = state[session.user.id] ?? defaultsFor(session.user.id)
  const index = extra.wallets.findIndex((item) => item.id === walletId)
  if (index < 0) throw new Error('WALLET_NOT_FOUND')
  if (extra.wallets.some((wallet) => wallet.id !== walletId && wallet.address.toLowerCase() === input.address.toLowerCase())) {
    throw new Error('WALLET_CONFLICT')
  }
  if (input.primary) extra.wallets = extra.wallets.map((item) => ({ ...item, primary: false }))
  extra.wallets[index] = { ...extra.wallets[index], ...input }
  if (!extra.wallets.some((item) => item.primary) && extra.wallets[0]) extra.wallets[0].primary = true
  state[session.user.id] = extra
  write(state)
  return extra.wallets
}

export function clearProfileForUser(userId: string): void {
  const state = read()
  delete state[userId]
  write(state)
}

export function resetProfiles(): void {
  localStorage.removeItem(storageKey)
}

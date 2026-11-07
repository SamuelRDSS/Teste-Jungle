import type { User } from '@/features/auth/types'

export type Wallet = {
  id: string
  label: string
  address: string
  network: 'Ethereum' | 'Polygon'
  primary: boolean
}

export type UserProfile = User & {
  avatarUrl: string | null
  wallets: Wallet[]
}

export type ProfileUpdateInput = {
  name: string
  email: string
  avatarUrl: string | null
}

export type PasswordChangeInput = {
  currentPassword: string
  newPassword: string
}

export type WalletInput = {
  label: string
  address: string
  network: 'Ethereum' | 'Polygon'
  primary: boolean
}

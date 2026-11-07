export type User = {
  id: string
  name: string
  email: string
}

export type AuthSnapshot = {
  user: User | null
  expiresAt: number | null
}

export type AuthenticatedSession = {
  user: User
  expiresAt: number
}

export type RegisterInput = {
  name: string
  email: string
  password: string
}

export type LoginInput = {
  email: string
  password: string
}

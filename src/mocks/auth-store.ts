import type { AuthenticatedSession, User } from '@/features/auth/types'

const storageKey = 'mintora:mock-auth:v1'
const sessionLifetimeMs = 8 * 60 * 60 * 1000
const passwordIterations = 120_000
const seedAccounts = [
  {
    id: 'user-demo',
    name: 'Alex Morgan',
    email: 'demo@mintora.art',
    password: 'Mintora2026!',
  },
  {
    id: 'user-curator',
    name: 'Rafa Lima',
    email: 'curator@mintora.art',
    password: 'Curator2026!',
  },
]

type StoredAccount = User & {
  salt: string
  passwordHash: string
}

type StoredAuthState = {
  accounts: StoredAccount[]
  session: {
    token: string
    userId: string
    expiresAt: number
  } | null
}

let initialization: Promise<void> | undefined

function isStoredAccount(value: unknown): value is StoredAccount {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    'id' in value && typeof value.id === 'string' &&
    'name' in value && typeof value.name === 'string' &&
    'email' in value && typeof value.email === 'string' &&
    'salt' in value && typeof value.salt === 'string' &&
    'passwordHash' in value && typeof value.passwordHash === 'string'
  )
}

function isStoredSession(value: unknown): value is NonNullable<StoredAuthState['session']> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'token' in value && typeof value.token === 'string' &&
    'userId' in value && typeof value.userId === 'string' &&
    'expiresAt' in value && typeof value.expiresAt === 'number'
  )
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
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

async function createStoredAccount(
  user: User,
  password: string,
): Promise<StoredAccount> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const passwordHash = await hashPassword(password, salt)

  return {
    ...user,
    salt: toBase64(salt),
    passwordHash,
  }
}

function readState(): StoredAuthState | null {
  const stored = localStorage.getItem(storageKey)
  if (!stored) {
    return null
  }

  const parsed: unknown = JSON.parse(stored)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('accounts' in parsed) ||
    !Array.isArray(parsed.accounts) ||
    !parsed.accounts.every(isStoredAccount) ||
    !('session' in parsed)
  ) {
    throw new Error('Stored mock authentication data is invalid. Clear the Mintora mock data to continue.')
  }

  if (parsed.session !== null && !isStoredSession(parsed.session)) {
    throw new Error('Stored mock session data is invalid. Clear the Mintora mock data to continue.')
  }

  return {
    accounts: parsed.accounts,
    session: parsed.session,
  }
}

function writeState(state: StoredAuthState): void {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

async function initializeState(): Promise<void> {
  if (readState()) {
    return
  }

  const accounts = await Promise.all(
    seedAccounts.map(({ password, ...user }) => createStoredAccount(user, password)),
  )
  writeState({ accounts, session: null })
}

export async function ensureAuthState(): Promise<StoredAuthState> {
  initialization ??= initializeState()
  try {
    await initialization
  } catch (error) {
    initialization = undefined
    throw error
  }

  const state = readState()
  if (!state) {
    throw new Error('Mock authentication data could not be initialized.')
  }
  return state
}

export async function createAccount(
  user: User,
  password: string,
): Promise<AuthenticatedSession> {
  const state = await ensureAuthState()
  if (state.accounts.some((account) => account.email === user.email)) {
    throw new Error('EMAIL_ALREADY_REGISTERED')
  }

  const account = await createStoredAccount(user, password)
  const latestState = await ensureAuthState()
  if (latestState.accounts.some((item) => item.email === user.email)) {
    throw new Error('EMAIL_ALREADY_REGISTERED')
  }

  latestState.accounts.push(account)
  return startSession(latestState, account)
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthenticatedSession | null> {
  const state = await ensureAuthState()
  const account = state.accounts.find((item) => item.email === email)
  if (!account) {
    return null
  }

  const submittedHash = await hashPassword(password, fromBase64(account.salt))
  if (submittedHash !== account.passwordHash) {
    return null
  }

  return startSession(state, account)
}

function startSession(state: StoredAuthState, account: StoredAccount): AuthenticatedSession {
  const expiresAt = Date.now() + sessionLifetimeMs
  state.session = {
    token: crypto.randomUUID(),
    userId: account.id,
    expiresAt,
  }
  writeState(state)

  return {
    user: { id: account.id, name: account.name, email: account.email },
    expiresAt,
  }
}

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  const state = await ensureAuthState()
  if (!state.session) {
    return null
  }

  if (state.session.expiresAt <= Date.now()) {
    throw new Error('SESSION_EXPIRED')
  }

  const account = state.accounts.find((item) => item.id === state.session?.userId)
  if (!account) {
    state.session = null
    writeState(state)
    return null
  }

  return {
    user: { id: account.id, name: account.name, email: account.email },
    expiresAt: state.session.expiresAt,
  }
}

export async function endSession(): Promise<void> {
  const state = await ensureAuthState()
  state.session = null
  writeState(state)
}

export async function expireCurrentSession(): Promise<boolean> {
  const state = await ensureAuthState()
  if (!state.session) {
    return false
  }

  state.session.expiresAt = Date.now() - 1
  writeState(state)
  return true
}

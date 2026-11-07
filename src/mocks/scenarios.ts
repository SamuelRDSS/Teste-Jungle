export type MockScenario = {
  latencyMs: number
  jitterMs: number
  httpErrorRate: number
  timeoutRate: number
  offline: boolean
  outOfOrder: boolean
  priceChangeOnCheckout: boolean
  outOfStockOnCheckout: boolean
  paymentResult: 'approved' | 'declined' | 'pending-timeout'
  sessionExpired: boolean
}

export const defaultScenario: MockScenario = {
  latencyMs: 120,
  jitterMs: 0,
  httpErrorRate: 0,
  timeoutRate: 0,
  offline: false,
  outOfOrder: false,
  priceChangeOnCheckout: false,
  outOfStockOnCheckout: false,
  paymentResult: 'approved',
  sessionExpired: false,
}

export const namedScenarios: Record<string, Partial<MockScenario>> = {
  default: {},
  slow: { latencyMs: 900, jitterMs: 500 },
  timeout: { timeoutRate: 1 },
  offline: { offline: true },
  'http-error': { httpErrorRate: 1 },
  'out-of-order': { outOfOrder: true, latencyMs: 220, jitterMs: 600 },
  'price-changed': { priceChangeOnCheckout: true },
  'out-of-stock': { outOfStockOnCheckout: true },
  declined: { paymentResult: 'declined' },
  'pending-timeout': { paymentResult: 'pending-timeout' },
  'session-expired': { sessionExpired: true },
}

const storageKey = 'mintora:mock-scenario:v1'

export function getScenario(): MockScenario {
  if (typeof localStorage === 'undefined') return defaultScenario
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaultScenario
    const parsed = JSON.parse(raw) as Partial<MockScenario> & { name?: string }
    const base = parsed.name ? namedScenarios[parsed.name] ?? {} : {}
    return { ...defaultScenario, ...base, ...parsed }
  } catch {
    return defaultScenario
  }
}

export function setScenario(patch: Partial<MockScenario> & { name?: string }): MockScenario {
  const next = { ...getScenario(), ...(patch.name ? namedScenarios[patch.name] ?? {} : {}), ...patch }
  localStorage.setItem(storageKey, JSON.stringify(next))
  return next
}

export function resetScenario(): void {
  localStorage.removeItem(storageKey)
}

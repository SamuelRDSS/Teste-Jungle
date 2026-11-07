import { expect, type Page } from '@playwright/test'

export async function resetScenario(page: Page, body: Record<string, unknown> = { reset: true }) {
  await page.request.post('/api/test/scenario', { data: body })
}

export async function loginAs(page: Page, email = 'demo@mintora.art', password = 'Mintora2026!', returnTo = '/profile') {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

export async function addToCart(page: Page, nftPath: string) {
  await page.goto(nftPath)
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('status')).toContainText('carrinho')
}

export async function completeCheckout(page: Page) {
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  await page.getByLabel('Nome do colecionador').fill('Alex Morgan')
  await page.getByLabel('E-mail').fill('demo@mintora.art')
  await page.locator('select[name="walletId"]').selectOption({ index: 1 })
  await page.getByRole('checkbox', { name: /Revisei/ }).check()
  await page.getByRole('button', { name: 'Confirmar pedido' }).click()
}

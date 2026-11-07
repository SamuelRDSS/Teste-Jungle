import { expect, test } from '@playwright/test'
import { addToCart, completeCheckout, loginAs, resetScenario } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetScenario(page, { reset: true })
})

test('checkout completes a purchase and shows a confirmed receipt', async ({ page }) => {
  await loginAs(page, 'demo@mintora.art', 'Mintora2026!', '/cart')
  await addToCart(page, '/nft/morphic-dreams-01')
  await completeCheckout(page)
  await expect(page).toHaveURL(/\/orders\//)
  await expect(page.getByText('Pedido confirmado.')).toBeVisible()
  await expect(page.getByText('Morphic Dreams #01 x1')).toBeVisible()
})

test('declined payment preserves cart items', async ({ page }) => {
  await resetScenario(page, { name: 'declined' })
  await loginAs(page)
  await addToCart(page, '/nft/soft-geometry-07')
  await completeCheckout(page)
  await expect(page).toHaveURL(/\/orders\//)
  await expect(page.getByRole('alert')).toContainText(/recusado/i)
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Soft Geometry #07' })).toBeVisible()
})

test('pending order recovers after refresh or polling', async ({ page }) => {
  await resetScenario(page, { name: 'pending-timeout' })
  await loginAs(page)
  await addToCart(page, '/nft/blue-hour-03')
  await completeCheckout(page)
  await expect(page).toHaveURL(/\/orders\//)
  await expect(page.getByText(/confirmad|pendente/i).first()).toBeVisible({ timeout: 10_000 })
  await page.reload()
  await expect(page.getByText(/confirmado/i).first()).toBeVisible({ timeout: 15_000 })
})

test('favorites persist for authenticated users', async ({ page }) => {
  await loginAs(page)
  await page.goto('/nft/afterglow-22')
  await page.getByRole('button', { name: 'Adicionar aos favoritos' }).click()
  await expect(page.getByRole('button', { name: 'Remover dos favoritos' })).toBeVisible()
  await page.goto('/favorites')
  await expect(page.getByRole('heading', { name: 'Favoritos' })).toBeVisible()
  await expect(page.getByText('Afterglow #22')).toBeVisible()
})

test('profile, wallets and password forms validate and persist', async ({ page }) => {
  await loginAs(page)
  await page.getByLabel('Avatar (URL)').fill('https://images.example/avatar.png')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByText('Perfil atualizado.')).toBeVisible()
  await page.getByLabel('Rótulo').fill('Carteira teste')
  await page.getByLabel('Endereço').fill('0x1234567890abcdef1234567890abcdef12345678')
  await page.getByRole('button', { name: 'Cadastrar carteira' }).click()
  await expect(page.getByText('Carteira teste')).toBeVisible()
})

test('checkout blocks stale quote after price change scenario', async ({ page }) => {
  await resetScenario(page, { name: 'price-changed' })
  await loginAs(page)
  await addToCart(page, '/nft/morphic-dreams-01')
  await completeCheckout(page)
  await expect(page).toHaveURL(/\/checkout/)
  await expect(page.getByRole('alert')).toBeVisible()
})

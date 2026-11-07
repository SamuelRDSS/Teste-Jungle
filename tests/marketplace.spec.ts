import { expect, test } from '@playwright/test'

test('catalog loads mocked NFTs and search updates the URL', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Descubra arte que/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Morphic Dreams #01' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Buscar NFTs, coleções ou artistas' }).fill('Arcade')
  await page.getByRole('button', { name: 'Buscar' }).click()

  await expect(page).toHaveURL(/q=Arcade/)
  await expect(page.getByRole('heading', { name: 'Arcade Echo #02' })).toBeVisible()
  await expect(page.getByText('1 obras encontradas')).toBeVisible()
})

test('direct NFT links load and unknown IDs show a not-found state', async ({ page }) => {
  await page.goto('/nft/soft-geometry-07')
  await expect(page.getByRole('heading', { name: 'Soft Geometry #07' })).toBeVisible()

  await page.goto('/nft/not-a-real-nft')
  await expect(page.getByRole('heading', { name: 'Obra não encontrada' })).toBeVisible()
})

test('category, sort, pagination, and browser history stay in sync', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Art', exact: true }).click()

  await expect(page).toHaveURL(/category=Art/)
  await expect(page.getByText('5 obras encontradas')).toBeVisible()

  await page.getByLabel('Ordenar obras').selectOption('price-asc')
  await expect(page).toHaveURL(/sort=price-asc/)

  await page.getByRole('button', { name: 'Todas as obras' }).click()
  await expect(page.getByText('12 obras encontradas')).toBeVisible()
  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText('Página 2 de 2')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByText('Página 1 de 2')).toBeVisible()
})

test('private profile redirects to login and restores the requested route after sign-in', async ({ page }) => {
  await page.goto('/profile')

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Boas-vindas de volta' })).toBeVisible()
  await page.getByLabel('E-mail').fill('demo@mintora.art')
  await page.getByLabel('Senha').fill('Mintora2026!')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/profile/)
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Alex Morgan' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()

  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page).toHaveURL(/\/\?q=&category=All/)
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login/)
})

test('registration validates input, persists a hashed account, and prevents duplicate email', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Nome').fill('Jamie Collector')
  await page.getByLabel('E-mail').fill('jamie@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('SecretPass123')
  await page.getByLabel('Confirme a senha').fill('DifferentPass123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('alert')).toHaveText('As senhas não coincidem.')

  await page.getByLabel('Confirme a senha').fill('SecretPass123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/profile/)
  await expect(page.getByRole('heading', { name: 'Jamie Collector' })).toBeVisible()

  const storedAuth = await page.evaluate(() => localStorage.getItem('mintora:mock-auth:v1'))
  expect(storedAuth).toBeTruthy()
  expect(storedAuth).not.toContain('SecretPass123')

  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/register')
  await page.getByLabel('Nome').fill('Jamie Collector')
  await page.getByLabel('E-mail').fill('jamie@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('AnotherPass123')
  await page.getByLabel('Confirme a senha').fill('AnotherPass123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('alert')).toHaveText('Este e-mail já possui uma conta.')
})

test('expired sessions require sign-in again and preserve the private destination', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('demo@mintora.art')
  await page.getByLabel('Senha').fill('Mintora2026!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/profile/)

  await page.getByRole('button', { name: /Simular sessão expirada|Simular expiração/ }).click()
  await expect(page).toHaveURL(/expired=true/)
  await expect(page.getByRole('status')).toContainText('Sua sessão expirou')

  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login.*expired=true/)
  await page.getByLabel('E-mail').fill('demo@mintora.art')
  await page.getByLabel('Senha').fill('Mintora2026!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/profile/)
})

test('login shows an accessible error for invalid credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('demo@mintora.art')
  await page.getByLabel('Senha').fill('wrong-password')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
})

test('cart supports quantity changes, coupon errors, totals, removal, and refresh persistence', async ({ page }) => {
  await page.goto('/nft/morphic-dreams-01')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('status')).toHaveText('Obra adicionada ao carrinho.')

  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  await expect(page.getByRole('heading', { name: 'Carrinho' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Morphic Dreams #01' })).toBeVisible()
  await expect(page.getByText('0.8400 ETH', { exact: true }).last()).toBeVisible()

  await page.getByRole('button', { name: 'Aumentar quantidade de Morphic Dreams #01' }).click()
  await expect(page.getByLabel('Quantidade: 2')).toBeVisible()
  await expect(page.getByText('1.6800 ETH', { exact: true }).last()).toBeVisible()

  await page.getByLabel('Cupom de desconto').fill('NOPE')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Cupom inválido. Confira o código e tente novamente.')

  await page.getByLabel('Cupom de desconto').fill('EXPIRED')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Este cupom expirou.')

  await page.getByLabel('Cupom de desconto').fill('SAVE10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('status')).toHaveText('Cupom aplicado. Seu desconto foi atualizado.')
  await expect(page.getByText('- 0.1680 ETH')).toBeVisible()
  await expect(page.getByText('1.5150 ETH')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Morphic Dreams #01' })).toBeVisible()
  await expect(page.getByLabel('Quantidade: 2')).toBeVisible()
  await expect(page.getByText('Cupom SAVE10 aplicado')).toBeVisible()

  await page.getByRole('button', { name: 'Remover', exact: true }).click()
  await expect(page.getByText('- 0.0000 ETH')).toBeVisible()
  await page.getByRole('button', { name: 'Remover Morphic Dreams #01 do carrinho' }).click()
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})

test('guest cart is preserved when a visitor signs in', async ({ page }) => {
  await page.goto('/nft/soft-geometry-07')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('status')).toHaveText('Obra adicionada ao carrinho.')

  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('E-mail').fill('demo@mintora.art')
  await page.getByLabel('Senha').fill('Mintora2026!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/profile/)

  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Soft Geometry #07' })).toBeVisible()
  await expect(page.getByText('1 item', { exact: true })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('mintora:mock-cart:v1')
    return raw ? (JSON.parse(raw) as { guest: { lines: unknown[] } }).guest.lines.length : -1
  })).toBe(0)
  const storedCart = await page.evaluate(() => {
    const raw = localStorage.getItem('mintora:mock-cart:v1')
    return raw ? JSON.parse(raw) as { guest: { lines: unknown[] }; users: Record<string, { lines: unknown[] }> } : null
  })
  expect(storedCart?.guest.lines).toHaveLength(0)
  expect(storedCart?.users['user-demo'].lines).toHaveLength(1)
})

test('adding more than the available edition returns a visible stock error without changing the cart', async ({ page }) => {
  await page.goto('/nft/forms-in-motion')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('status')).toHaveText('Obra adicionada ao carrinho.')

  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('alert')).toHaveText('A quantidade solicitada excede as unidades disponíveis.')
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  await expect(page.getByLabel('Quantidade: 1')).toBeVisible()
})

test('authentication and private profile remain usable on a 390px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/register')

  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible()
  await expect(page.getByLabel('Nome')).toBeVisible()
  await expect(page.getByLabel('E-mail')).toBeVisible()
  await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Confirme a senha')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/login')
  await page.getByLabel('E-mail').fill('demo@mintora.art')
  await page.getByLabel('Senha').fill('Mintora2026!')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/profile/)
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Simular sessão expirada|Simular expiração/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('cart remains usable on a 390px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/nft/soft-geometry-07')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()

  await expect(page.getByRole('heading', { name: 'Carrinho' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Resumo do pedido' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
}

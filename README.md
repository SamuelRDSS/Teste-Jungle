# Mintora — NFT Marketplace

Aplicação de demonstração de marketplace de NFTs em React e TypeScript. O projeto está sendo implementado por etapas; catálogo, detalhes e autenticação consultam uma API REST simulada.

## Requisitos

- Node.js 22 ou superior
- npm

## Executar localmente

```bash
npm install
npm run dev
```

O MSW é ativado por padrão e intercepta as chamadas `/api/nfts`. Para iniciar sem mocks, defina `VITE_ENABLE_MOCKS=false` no ambiente antes de executar o Vite. Os dados fictícios ficam em `src/mocks/data.ts`.

Antes de executar os testes E2E pela primeira vez, instale o navegador do Playwright:

```bash
npx playwright install chromium
```

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Verificação TypeScript e build de produção |
| `npm run preview` | Servir o build localmente |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | Oxlint |
| `npm run test:e2e` | Testes E2E com Playwright |

O build de demonstração mantém os mocks habilitados, a menos que `VITE_ENABLE_MOCKS=false` seja definido durante o build.

## Fluxos disponíveis

- Catálogo com busca, categorias, ordenação e paginação persistidas na URL.
- Detalhe por identificador, com suporte a acesso direto e NFT inexistente.
- Estados de carregamento, vazio e erro; skeletons respeitam movimento reduzido.
- API Axios tipada e handlers MSW.
- Cadastro e login com validação, retorno à rota privada, sessão persistida, logout e expiração simulada.
- Perfil privado em `/profile`.
- Carrinho visitante e autenticado com persistência, quantidade, remoção, cupom, totais decimais e erros de estoque/cupom.

No carrinho, `SAVE10` aplica 10% de desconto; `EXPIRED` e qualquer outro código exercitam os erros de cupom expirado e inválido. Os totais são devolvidos pela API simulada e calculados com `BigInt` em ETH decimal. A taxa de rede demonstrativa é `0.003 ETH` por carrinho não vazio.

Credenciais fictícias: `demo@mintora.art` / `Mintora2026!` e `curator@mintora.art` / `Curator2026!`. Novas contas são persistidas no armazenamento local do navegador apenas para os mocks. Senhas são armazenadas como hashes PBKDF2 com salt aleatório; o valor em texto não é persistido. O botão **Simular sessão expirada** no perfil permite reproduzir o fluxo.

Checkout/pedidos, favoritos, edição de perfil/carteiras, eventos Socket.IO e deploy ainda não estão implementados. A identidade visual atual é provisória até receber os assets e referências do Figma.

## Arquitetura e cache

Veja [ARCHITECTURE.md](./ARCHITECTURE.md) para contratos implementados, política atual de cache e as próximas etapas.

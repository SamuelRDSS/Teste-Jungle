# Arquitetura atual

## Camadas implementadas

- **Interface e rotas:** React, TanStack Router e componentes shadcn/ui. Os filtros do catálogo usam parâmetros de busca para permitir refresh e navegação pelo histórico.
- **Estado remoto:** TanStack Query com `staleTime` de 30 segundos, uma tentativa de retry e sem refetch automático ao focar a janela. A chave do catálogo inclui todos os parâmetros da URL; sinais de cancelamento do Query são encaminhados ao Axios.
- **Transporte:** Axios em `src/lib/api.ts`; tipos dos recursos ficam em `src/features/nfts/types.ts`.
- **Autenticação:** `src/features/auth/api.ts` contém os contratos Axios; `src/features/auth/pages.tsx` implementa os formulários e a interface do perfil; a proteção de `/profile` valida a sessão no `beforeLoad` do Router e preserva o destino de retorno.
- **Carrinho:** `src/features/cart/api.ts` contém as chamadas Axios; `src/features/cart/pages.tsx` implementa a interface e mutations; `src/mocks/cart-store.ts` persiste carrinhos de visitante e por usuário. Após login, o primeiro acesso ao carrinho mescla os itens do visitante ao carrinho da conta, respeitando o estoque.
- **Mocks:** MSW intercepta as rotas REST no navegador. Os fixtures são determinísticos e compartilhados por listagem e detalhe. O worker inicia antes da renderização quando `VITE_ENABLE_MOCKS` não está definido como `false`.
- **Sessão simulada:** `src/mocks/auth-store.ts` persiste usuários fictícios e a sessão em `localStorage` para suportar reload. Senhas persistidas usam PBKDF2/SHA-256 e salt aleatório; o mock nunca grava a senha em texto. Sessões simuladas expiram em oito horas. Os usuários de demonstração são apenas fixtures locais, não credenciais de produção.
- **Interface:** Tailwind CSS 4 e tokens CSS escuros provisórios. Imagens de demonstração vêm de URLs públicas do Unsplash; substituí-las por assets fornecidos localmente é parte da integração com o Figma.

## Contrato REST disponível

- `GET /api/nfts?q=&category=&sort=&page=` retorna `{ items, total, page, pageSize }`.
- `GET /api/nfts/:nftId` retorna o NFT ou `404` com `{ code, message }`.
- `POST /api/auth/register` valida e cria uma conta; e-mail duplicado retorna `409`.
- `POST /api/auth/login` valida credenciais e retorna a sessão simulada.
- `GET /api/auth/session` recupera a sessão ou retorna `401` quando expirada.
- `POST /api/auth/logout` encerra a sessão simulada.
- `POST /api/auth/expire` é uma operação de demonstração para exercitar a expiração.
- `GET /api/cart` retorna itens e cotação simulada do carrinho ativo.
- `POST /api/cart/items`, `PATCH /api/cart/items/:nftId` e `DELETE /api/cart/items/:nftId` adicionam, atualizam e removem itens; estoque insuficiente retorna `409`.
- `POST /api/cart/coupon` aplica `SAVE10`; códigos inválidos ou expirados retornam `422`. `DELETE /api/cart/coupon` remove o cupom.
- Preços são representados como strings decimais em ETH; quantidades são inteiras.

## Limites e próximos passos

A autenticação e o carrinho são somente simulações de frontend: não existe servidor confiável, cookie `HttpOnly`, proteção contra manipulação de `localStorage` ou segurança adequada para produção. O hash local demonstra que a senha em texto não é armazenada, mas não transforma o navegador em uma fronteira de segurança. Ainda não há favoritos, pedidos, cenários de rede configuráveis, servidor de eventos Socket.IO nem deploy. Esses comportamentos devem ser implementados na camada de mocks e nos serviços correspondentes, sem lógica de negócio fictícia em componentes. A integração de eventos deverá reconciliar recursos ativos com REST após reconexão e descartar eventos antigos/duplicados.

Os cálculos do mock convertem strings decimais para inteiros `BigInt` na escala de 18 casas, aplicam o desconto percentual e a taxa fixa e retornam valores ETH como strings decimais, com no mínimo quatro casas e sem descartar precisão calculada. O checkout deverá pedir uma nova cotação à API, em vez de tratar o resumo do carrinho como preço final.

O layout não pode ser considerado fiel ao Figma até que seus frames e assets sejam comparados e incorporados. A presente tela estabelece apenas uma base visual responsiva.

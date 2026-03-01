# Multiempresa com Unidades (CNPJ + Filiais)

## Objetivo

Suportar dois cenarios ao mesmo tempo:

1. Uma empresa com o mesmo CNPJ e varias unidades com estoque separado.
2. Um grupo com varios CNPJs e usuarios compartilhados entre eles.

Sem exigir "um login por CNPJ".

## Decisao de produto

- Login unico por pessoa (email unico no sistema).
- Depois do login, o usuario escolhe o contexto ativo:
  - empresa (CNPJ)
  - unidade (loja/filial)
- Permissoes por contexto (empresa/unidade).

## Modelo de dados recomendado

### 1) Manter `companies` como entidade fiscal (CNPJ)

- Cada registro em `companies` representa um CNPJ.
- Continua valido `cnpj` unico.

### 2) Criar `business_units` (unidades operacionais)

Campos sugeridos:

- `id` (pk)
- `company_id` (fk -> companies.id)
- `code` (ex: MATRIZ, LOJA-01)
- `name` (ex: Loja Centro)
- `is_active`
- `created_at`

Regras:

- Unique (`company_id`, `code`)
- Unique (`company_id`, `name`)

### 3) Separar acesso do usuario por vinculo

Hoje `users.company_id` e `users.role_id` fixam o usuario em um unico tenant.

Adicionar:

- `user_company_accesses`
  - `id` (pk)
  - `user_id` (fk -> users.id)
  - `company_id` (fk -> companies.id)
  - `is_default` (bool)
  - `is_active` (bool)
  - `created_at`
  - Unique (`user_id`, `company_id`)

- `user_unit_accesses`
  - `id` (pk)
  - `user_id` (fk -> users.id)
  - `unit_id` (fk -> business_units.id)
  - `role_id` (fk -> roles.id)
  - `is_active` (bool)
  - `created_at`
  - Unique (`user_id`, `unit_id`)

### 4) Estoque por unidade

Hoje o estoque principal esta em `products.stock` (nivel empresa).

Adicionar tabela:

- `product_stocks`
  - `id` (pk)
  - `company_id` (fk)
  - `unit_id` (fk)
  - `product_id` (fk)
  - `variation_id` (fk nullable)
  - `stock`
  - `min_stock`
  - `max_stock`
  - `updated_at`
  - Unique (`unit_id`, `product_id`, `variation_id`)

### 5) Adicionar `unit_id` nas tabelas operacionais

Comecar por:

- `sales`
- `inventory_movements`
- `cash_registers`
- `cash_movements`
- `pos_terminals`
- `payment_machines`

## Fluxo de login recomendado

1. Usuario autentica por email/senha.
2. API retorna lista de contextos disponiveis:
   - empresas permitidas
   - unidades permitidas por empresa
3. Usuario escolhe contexto ativo.
4. Sessao salva:
   - `userId`
   - `activeCompanyId`
   - `activeUnitId`
5. Todas as consultas/escritas usam o contexto ativo.

## Plano de migracao sem quebra

### Fase 0 - Preparacao (sem impacto)

- Criar tabelas novas (`business_units`, `user_company_accesses`, `user_unit_accesses`, `product_stocks`).
- Adicionar `unit_id` nullable nas tabelas operacionais.

### Fase 1 - Backfill inicial

- Para cada empresa existente, criar uma unidade padrao `MATRIZ`.
- Popular:
  - `user_company_accesses` com o `users.company_id` atual.
  - `user_unit_accesses` com a unidade `MATRIZ` e `users.role_id`.
- Preencher `unit_id` nas tabelas operacionais usando a unidade padrao.

### Fase 2 - Dual read/write

- Auth passa a ler acessos das novas tabelas.
- Operacoes de venda/estoque passam a gravar `company_id` + `unit_id`.
- Manter compatibilidade com campos antigos durante transicao.

### Fase 3 - Corte funcional

- UI exige selecao de contexto (empresa/unidade).
- Permissoes passam a considerar `user_unit_accesses.role_id`.
- Estoque de tela passa a vir de `product_stocks` (nao de `products.stock`).

### Fase 4 - Limpeza

- Tornar `unit_id` obrigatorio nas tabelas operacionais.
- Opcional: descontinuar `users.company_id` e `users.role_id` apos todo o codigo migrar.

## Regras de negocio finais

- Mesmo CNPJ com estoque separado: criar varias unidades na mesma empresa.
- Varios CNPJs: cada CNPJ e uma empresa distinta.
- Mesmo usuario em varios CNPJs/unidades: permitido via tabelas de acesso.
- Login por CNPJ: nao recomendado.

## Impacto no codigo atual

Arquivos principais para evolucao:

- `shared/schema.ts`
- `server/auth.ts`
- rotas que usam `req.session.companyId`
- telas de onboarding manager e login (selecao de contexto)

## Ordem sugerida de implementacao

1. Migracoes e schema das novas tabelas.
2. Endpoints de contexto (`/api/auth/contexts`, `/api/auth/context/select`).
3. Sessao com `activeCompanyId` e `activeUnitId`.
4. Estoque por unidade (`product_stocks`) e ajustes de vendas/movimentos.
5. Atualizacao de UI (switch de empresa/unidade).

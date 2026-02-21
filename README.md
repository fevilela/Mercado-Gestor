# Mercado-Gestor

Sistema ERP para varejo com foco em operacao de mercado, PDV e conformidade fiscal brasileira (NF-e/NFC-e e servicos SEFAZ).

## 1. Visao Geral

O projeto e uma aplicacao web full-stack em TypeScript, com backend Express e frontend React. O sistema foi modelado para:

- operar em multiempresa (multi-tenant)
- controlar estoque, vendas, financeiro e caixa
- emitir e gerenciar documentos fiscais eletronicos
- aplicar controle de acesso por perfil e permissao (RBAC)

### Principais capacidades

- Cadastro de empresa, usuarios, perfis e permissoes
- PDV com fechamento de venda e integracao de pagamentos
- Gestao de produtos, variacoes, kits e importacao por XML
- Clientes, fornecedores e tabelas de referencia
- Contas a pagar e receber
- Caixa (abertura, sangria, suprimento, fechamento)
- Central fiscal (NFe/NFCe, carta de correcao, inutilizacao, contingencia)
- Configuracao de certificado digital A1 (PFX/P12)
- Numeracao sequencial autorizada (NSA)

## 2. Stack Tecnologico

### Backend

- Node.js + Express
- TypeScript (ESM em desenvolvimento)
- Sessao com `express-session` + `connect-pg-simple`
- ORM: Drizzle (`drizzle-orm` + `drizzle-kit`)
- Banco: PostgreSQL
- Validacao: Zod

### Frontend

- React + TypeScript
- Roteamento: Wouter
- Estado de servidor: TanStack Query
- UI: Radix + componentes shadcn
- Estilo: Tailwind CSS
- Build/dev: Vite

### Fiscal e Integracoes

- Assinatura XML: `xml-crypto` + `node-forge`
- SEFAZ/SOAP: `soap`
- XML parsing: `xml2js`
- Pagamentos: Mercado Pago Point/Pix e Stone (quando habilitados)
- Consulta externa: ReceitaWS (CNPJ), APIs de EAN/GTIN, IBGE

## 3. Arquitetura da Aplicacao

### 3.1 Estrutura de pastas

- `client/`: aplicacao React
- `server/`: API, regras de negocio e integracoes
- `shared/`: schema Drizzle + tipos compartilhados
- `migrations/`: SQL de migracoes
- `script/`: scripts operacionais (build e refresh IBGE)

### 3.2 Inicializacao do backend

Arquivo principal: `server/index.ts`

Fluxo:

1. Carrega `.env`
2. Configura `express.json` e `express.urlencoded`
3. Configura sessao em Postgres (`tableName: session`)
4. Monta rotas de autenticacao em `/api/auth`
5. Inicializa permissoes padrao (`initializePermissions`)
6. Executa seed fiscal (`seedFiscalData`)
7. Registra todas as rotas da API (`registerRoutes`)
8. Em producao: serve frontend estatico (`server/static.ts`)
9. Em desenvolvimento: injeta Vite middleware (`server/vite.ts`)

### 3.3 Frontend e rotas

Arquivo de roteamento: `client/src/App.tsx`

Rotas publicas:

- `/login`
- `/access`
- `/register`
  - redireciona para `/access`

Rotas protegidas (exemplos):

- `/` dashboard
- `/pos`
- `/inventory`
- `/sales`
- `/finance`
- `/contacts`
- `/reports`
- `/settings`
- `/users`
- `/fiscal-central`
- `/certificates`
- `/sequential-numbering`
- `/fiscal-config`

Controle de acesso no frontend:

- `AuthProvider` chama `/api/auth/me`
- `ProtectedRoute` redireciona para `/login` quando nao autenticado
- Menu lateral (`client/src/components/layout.tsx`) filtra opcoes por permissao

## 4. Autenticacao, Sessao e RBAC

Arquivo principal: `server/auth.ts`

### 4.1 Fluxo de autenticacao

- `POST /api/auth/register`: desativado para auto cadastro
- `POST /api/auth/manager/login`: autentica manager interno (email/senha do .env)
- `GET /api/auth/manager/onboarding-users`: lista/pesquisa usuarios por CNPJ, nome ou email
- `POST /api/auth/manager/companies`: manager cadastra empresa e dispara codigo por e-mail
- `POST /api/auth/manager/resend-invite`: reenvia codigo para empresa ja cadastrada
- `PATCH /api/auth/manager/company`: edita dados da empresa e do responsavel
- `POST /api/auth/manager/company/set-active`: ativa/inativa empresa
- `DELETE /api/auth/manager/company`: exclui empresa (quando sem vinculos impeditivos)
- `POST /api/auth/complete-invite`: responsavel informa email + codigo para criar senha
- `POST /api/auth/forgot-password/request`: envia codigo para redefinir senha com CNPJ + email
- `POST /api/auth/forgot-password/reset`: redefine senha com email + codigo
- `POST /api/auth/login`: autentica email/senha (bcrypt)
- `POST /api/auth/logout`: encerra sessao
- `GET /api/auth/me`: retorna usuario e empresa da sessao

### 4.2 Sessao

Campos gravados na sessao:

- `userId`
- `companyId`
- `roleId`
- `userPermissions[]`

### 4.3 Permissoes

Middleware:

- `requireAuth`
- `requirePermission(...permissoes)`

Permissoes padrao cobrem modulos:

- `pos:*`
- `inventory:*`
- `customers:*`
- `suppliers:*`
- `finance:*`
- `reports:*`
- `settings:*`
- `fiscal:*`
- `users:*`

Perfis de sistema gerados por empresa:

- Administrador
- Gerente
- Caixa
- Caixa Senior
- Estoquista
- Financeiro
- Visualizador

## 5. Modelo de Dados (Resumo)

Definicao central: `shared/schema.ts`

### 5.1 Nucleo de negocio

- `companies`
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `company_settings`

### 5.2 Comercial e operacao

- `products`
- `product_variations`
- `product_media`
- `kit_items`
- `customers`
- `suppliers`
- `sales`
- `sale_items`
- `inventory_movements`

### 5.3 Financeiro e caixa

- `payables`
- `receivables`
- `cash_registers`
- `cash_movements`
- `payment_methods`
- `pos_terminals`
- `notifications`

### 5.4 Fiscal

- `cfop_codes`
- `cst_codes`
- `fiscal_configs`
- `tax_aliquots`
- `fiscal_tax_rules`
- `simples_nacional_aliquots`
- `nfe_submissions`
- `sefaz_transmission_logs`
- `fiscal_xml_storage`
- `manifest_documents`
- `nfe_cancellations`
- `nfe_correction_letters`
- `nfe_number_inutilization`
- `nfe_contingency`
- `sefaz_configs`
- `digital_certificates`
- `sequential_numbering`

## 6. Modulos Funcionais

### 6.1 Produtos e Estoque

- CRUD de produto com campos fiscais (NCM, CEST, CST/CSOSN)
- Variacoes, midias e kits
- Busca por nome e EAN
- Importacao de XML com preview
- Movimentacao de estoque por evento

### 6.2 PDV e Vendas

- Abertura/fechamento de caixa
- Registro de venda e itens
- Persistencia de dados de pagamento (status, NSU, autorizacao)
- Integracao para autorizacao de pagamento eletronico

### 6.3 Financeiro

- Contas a pagar e receber
- Controle de status (pendente/pago/recebido)
- Relatorios consolidados

### 6.4 Fiscal

- Validacao de documentos
- Calculo tributario por regra fiscal
- Emissao e cancelamento
- Carta de correcao
- Inutilizacao de numeracao
- Contingencia
- Logs de transmissao para auditoria
- Armazenamento de XML autorizado

## 7. Integracao Fiscal (SEFAZ)

Arquivos principais:

- `server/fiscal-routes.ts`
- `server/sefaz-service.ts`
- `server/sefaz-integration.ts`
- `server/nfce-emitter.ts`
- `server/nfe-generator.ts`
- `server/xml-signature.ts`
- `server/certificate-service.ts`

Fluxo simplificado de emissao:

1. Monta payload fiscal da venda/nota
2. Gera XML conforme layout
3. Assina XML com certificado A1
4. Envia para endpoint SEFAZ (homologacao/producao)
5. Registra protocolo/status
6. Persiste XML e logs de transmissao

### Certificado digital

- Upload em base64 (PFX/P12)
- Senha armazenada de forma cifrada
- Extração de CNPJ e metadados do certificado
- Validacao de vigencia e status

## 8. Integracao de Pagamentos

Arquivo principal: `server/payment-service.ts`

### Mercado Pago

- Validacao de credenciais e terminal
- Autorizacao de pagamento em terminal Point
- Consulta de status por referencia
- Cancelamento de pendencias
- Geracao de Pix QR

### Stone

- Integracao via `server/stone-connect.ts`
- Captura/cancelamento/status quando habilitado em `company_settings`

Selecao de provedor:

- prioriza toggles e credenciais em `company_settings`
- fallback legado quando toggles nao estao setados

## 9. Variaveis de Ambiente

Obrigatorias:

- `DATABASE_URL` ou `SUPABASE_DATABASE_URL`

Importantes:

- `SESSION_SECRET`
- `MANAGER_EMAIL` (fallback: `SMTP_USER`)
- `MANAGER_PASSWORD`
- `ONBOARDING_CODE_TTL_MINUTES`
- `ONBOARDING_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `NODE_ENV`
- `PORT`, `HOST`
- `CERT_ENCRYPTION_KEY`
- `PASSWORD_ENCRYPTION_KEY`
- `SEFAZ_CA_CERT_PATH`
- `SEFAZ_CLIENT_PEM_PATH`
- `SEFAZ_STRICT_SSL`
- `SEFAZ_REQUEST_TIMEOUT_SECONDS`
- `XMLLINT_PATH`
- `OPENSSL_PATH` ou `OPENSSL_BIN`
- `OPENSSL_CONF`
- `NFCE_DEBUG_XML`
- `NFCE_DEBUG_QR`
- `SEFAZ_DEBUG_XML`
- `IBGE_CACHE_DAYS`
- `IBGE_AUTO_UPDATE`
- `ACCESSORY_PROVIDER_MODE`
- `ACCESSORY_PROVIDER_BEARER_TOKEN`
- `ACCESSORY_PROVIDER_API_KEY`
- `IBPT_TOKEN`

## 10. Setup de Desenvolvimento

### Pre-requisitos

- Node.js 20+
- PostgreSQL acessivel
- arquivo `.env` configurado

### Instalar dependencias

```bash
npm install
```

### Aplicar schema no banco

```bash
npm run db:push
```

### Rodar em desenvolvimento

```bash
npm run dev
```

Servidor padrao:

- API + frontend em `http://localhost:5000`

## 11. Build e Producao

Build completo:

```bash
npm run build
```

- Frontend: Vite gera `dist/public`
- Backend: esbuild gera `dist/index.cjs`

Executar producao:

```bash
npm start
```

## 12. Scripts Operacionais

- `npm run ibge:refresh`: atualiza cache de municipios do IBGE
  - opcional: `-- --uf=SP`

## 13. Migracoes

Pasta: `migrations/`

Migracoes atuais incluem:

- base inicial
- campos fiscais de venda/NFCe
- armazenamento de XML e manifestacao
- logs SEFAZ e ambiente fiscal
- campos de responsavel tecnico
- ajustes de pagamento

## 14. Observacoes Tecnicas

- O arquivo `server/routes.ts` concentra grande parte da API e pode ser modularizado por dominio para facilitar manutencao.
- Existem textos com problema de encoding em algumas respostas (`NÃ£o` etc). Vale padronizar UTF-8 ponta a ponta.
- `seedFiscalData` e executado na inicializacao; em ambientes com grande volume de empresas, considere estrategia de seed incremental controlada.

## 15. Referencias de Codigo

- Entrada backend: `server/index.ts`
- Rotas gerais: `server/routes.ts`
- Rotas fiscais: `server/fiscal-routes.ts`
- Auth/RBAC: `server/auth.ts`
- Middleware auth/permissao: `server/middleware.ts`
- Banco: `server/db.ts`
- Schema compartilhado: `shared/schema.ts`
- App frontend: `client/src/App.tsx`
- Layout e navegacao: `client/src/components/layout.tsx`
- Build: `script/build.ts`


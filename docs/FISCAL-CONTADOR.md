# Guia Fiscal Completo (Contador + Usuario)

## 1) Para que serve este guia

Este documento explica, em linguagem simples e pratica, como usar a parte fiscal do sistema.

Ele foi feito para dois perfis:

- Contador: validar regra tributaria, fechamento e evidencias.
- Usuario operacional (caixa/financeiro/gestor): saber o que preencher e como operar sem erro.

Objetivo final: evitar rejeicao, manter sequencia correta e fechar o mes com tudo rastreavel.

---

## 2) Visao geral: o que o sistema fiscal faz hoje

O sistema cobre principalmente:

- NFC-e (PDV): emissao, cancelamento, inutilizacao, contingencia.
- NF-e: geracao de XML, assinatura, envio SEFAZ, cancelamento, carta de correcao, inutilizacao.
- SPED e Sintegra: gerar arquivo por competencia e registrar entrega.
- Logs de auditoria: tudo fica registrado (acao, retorno, sucesso/falha, data/hora).

Escopo atual deste guia e da operacao:

- Apenas NF-e e NFC-e como documentos fiscais de trabalho.
- SPED e Sintegra como apoio de rotina contabil/fiscal.
- NFS-e, CT-e e MDF-e estao fora do escopo atual e podem ser ignorados por enquanto.

---

## 3) Caminho das telas (onde configurar e onde operar)

### 3.1 Configuracao fiscal

Menu:

1. `Fiscal`
2. `Configuracao Fiscal`

Abas:

- `Responsavel Tecnico`
- `CFOP Codes`
- `Aliquotas`
- `Regras Fiscais`

### 3.2 Certificado digital

Menu:

1. `Fiscal`
2. `Certificado Digital`

Aqui voce:

- envia PFX/P12
- confere validade
- troca/remove certificado

### 3.3 Numeracao (NSA)

Menu:

1. `Fiscal`
2. `Numeracao Sequencial (NSA)`

Aqui voce define:

- tipo do documento
- serie
- faixa de numeros
- numero atual
- ambiente
- autorizacao e validade

### 3.4 Operacao diaria fiscal

Menu:

1. `Fiscal`
2. `Central Fiscal`

Abas:

- `NF-e`
- `NFC-e`
- `Obrigacoes`

---

## 4) Checklist inicial (antes de emitir)

Sem isso, a emissao tende a falhar.

### 4.1 Dados da empresa

- CNPJ com 14 digitos
- IE (quando aplicavel)
- UF correta
- Codigo IBGE do municipio (7 digitos)
- Regime tributario correto

### 4.2 Parametros fiscais

- Ambiente: homologacao ou producao
- NFC-e habilitada (quando PDV consumidor final)
- Emissao fiscal ativa
- CSC ID
- CSC Token
- URL SEFAZ homologacao/producao
- URL QR Code homologacao/producao

### 4.3 Certificado A1

- arquivo instalado
- senha correta
- validade vigente

Se o certificado estiver ausente/invalido/vencido, o sistema bloqueia operacao fiscal critica.

---

## 5) Explicacao simples dos cadastros fiscais

## 5.1 Aba "Responsavel Tecnico"

Campos:

- `CNPJ`: CNPJ do responsavel tecnico.
- `Contato`: nome de contato tecnico.
- `E-mail`: email tecnico.
- `Telefone`: telefone tecnico.

Uso: esses dados entram no XML (tag `infRespTec`) quando exigido.

## 5.2 Aba "CFOP Codes"

Para que serve:

- manter lista de CFOP validos para os contextos da empresa.

Campos principais:

- codigo (ex.: 5102, 5103, 6102, 6103)
- descricao
- tipo (entrada/saida)
- tipo de operacao (venda/compra/devolucao etc.)
- escopo (interna/interestadual/exterior)

## 5.3 Aba "Aliquotas"

Para que serve:

- guardar aliquotas por UF (e opcionalmente por produto).

Campos:

- UF
- produto (opcional)
- ICMS
- reducao ICMS
- IPI
- PIS
- COFINS
- ISS

## 5.4 Aba "Regras Fiscais"

Para que serve:

- dizer exatamente qual combinacao fiscal aplicar em cada situacao.

Voce filtra o contexto e define o resultado.

Filtros de contexto:

- operacao (venda/compra/devolucao/servico)
- tipo de cliente
- regime
- escopo
- UF origem/destino
- NCM
- CEST
- CFOP

Resultado da regra:

- CST ICMS ou CSOSN
- CST PIS/COFINS/IPI
- aliquotas
- prioridade
- ativo/inativo

---

## 6) Como o sistema decide a regra fiscal (ordem real)

Quando voce valida NF-e, o sistema faz nesta ordem:

1. valida estrutura dos dados da nota
2. identifica regime da empresa
3. valida CFOP informado contra contexto
4. item a item:
- busca produto
- valida NCM/CEST
- tenta achar regra em `Regras Fiscais`
- se achar, usa essa regra
- se nao achar, aplica matriz padrao (fallback)
- confere se CFOP/CSOSN do item bate com o esperado
- valida consistencia CSOSN x CFOP
- consulta IBPT (se token configurado)

Resumo pratico:

- Regra cadastrada tem prioridade sobre fallback.
- Se nao tiver regra, entra padrao automatico.

---

## 7) Prioridade de regras (explicado sem linguagem tecnica)

Pense assim:

- regra mais "especifica" ganha da regra "generica".

Exemplo:

- Regra A: so "venda interna".
- Regra B: "venda interna + NCM X + UF destino Y".

A Regra B ganha, porque descreve melhor o caso.

No sistema, isso vira pontuacao por campo.

Campos mais fortes (peso maior):

- NCM, CEST, CFOP

Depois:

- operacao, cliente, regime

Depois:

- UF origem, UF destino, escopo

No fim, soma com a prioridade numerica da regra.

---

## 8) Fallback automatico (quando nao tem regra)

Se nenhuma regra casar, a matriz padrao decide CFOP.

Padrao atual:

- consumidor final interno: 5103
- consumidor final interestadual: 6103
- revenda interna: 5102
- revenda interestadual: 6102

Para Simples Nacional, tende a usar CSOSN padrao de matriz.
Para regime normal, tende a CST padrao.

Recomendacao contabil:

- nao depender de fallback por muito tempo.
- criar regras especificas para os cenarios recorrentes da empresa.

---

## 9) Como os calculos sao feitos (formula clara)

Base do item:

- `base = quantidade x valor unitario`

Formulas usadas:

- `ICMS = base x (aliquota x (1 - reducao/100)) / 100`
- `IPI = base x aliquota / 100`
- `PIS = base x aliquota / 100`
- `COFINS = base x aliquota / 100`
- `ISS = base x aliquota / 100`
- `IRRF = base x aliquota / 100`

Arredondamento:

- 2 casas decimais

Total de tributos do item:

- soma dos tributos calculados

Observacao operacional:

- na simulacao de calculo, se `icmsAliquot` nao vier no item, o sistema usa 18% como default.

---

## 10) Exemplo pratico de calculo (passo a passo)

Item:

- quantidade = 2
- valor unitario = 150,00
- base = 300,00
- ICMS = 18% com reducao 10%
- IPI = 5%
- PIS = 1,65%
- COFINS = 7,60%

Calculo:

- aliquota efetiva ICMS = 18 x (1 - 0,10) = 16,2%
- ICMS = 300 x 16,2% = 48,60
- IPI = 300 x 5% = 15,00
- PIS = 300 x 1,65% = 4,95
- COFINS = 300 x 7,60% = 22,80
- total tributos item = 91,35

---

## 11) Fluxo diario da NFC-e (usuario)

### 11.1 Emissao

1. Venda ocorre no PDV.
2. Sistema tenta emitir NFC-e.
3. Status pode ficar:
- pendente
- processando
- autorizada
- cancelada
- rejeitada

### 11.2 Cancelamento

- exige justificativa minima (15 caracteres)
- deve haver chave/protocolo quando aplicavel

### 11.3 Contingencia

Se sem comunicacao com SEFAZ:

- salva em contingencia
- lista pendentes
- reenvia quando normalizar

Boa pratica:

- zerar contingencia diariamente.

---

## 12) Fluxo da NF-e (contador + fiscal)

### 12.1 Gerar

- sistema monta XML
- assina com A1

### 12.2 Enviar

- envia para SEFAZ
- recebe status/protocolo

### 12.3 Eventos

- cancelamento (chave 44 + protocolo + justificativa)
- carta de correcao (chave 44 + texto)
- inutilizacao (serie + faixa + justificativa)

### 12.4 Historico

- consultar aba NF-e na Central Fiscal
- acompanhar status e protocolo

---

## 13) Obrigacoes acessorias (SPED/Sintegra)

Fluxo na aba `Obrigacoes`:

1. informar competencia (`YYYY-MM`)
2. gerar arquivo
3. baixar arquivo
4. registrar entrega
5. acompanhar historico

Ponto contabil:

- usar como trilha operacional
- validacao final de entrega oficial segue processo do escritorio.

---

## 14) Readiness fiscal (quando dizer "esta pronto")

Use `GET /api/fiscal/readiness`.

A empresa esta pronta quando `ready = true`.

Principais checagens internas:

- emissao fiscal ativa
- NFC-e habilitada
- CNPJ valido
- UF configurada
- municipio IBGE valido
- CSC ID/token
- URL SEFAZ e URL QRCode
- certificado valido

Se `ready = false`, corrija os itens de `messages`.

---

## 15) 3 cenarios praticos para homologacao com contador

## Cenario A: venda interna consumidor final (SN)

Configurar regra:

- operacao: venda
- cliente: consumidor_final
- regime: Simples Nacional
- escopo: interna
- cfop: 5103 (ou 5102 conforme politica)
- csosn: 102

Esperado:

- validacao ok
- regra aplicada correta
- sem divergencia de CFOP/CSOSN

## Cenario B: venda interestadual consumidor final (SN)

Configurar regra:

- operacao: venda
- cliente: consumidor_final
- regime: Simples Nacional
- escopo: interestadual
- cfop: 6103
- csosn: 102

Esperado:

- validacao ok
- regra interestadual vence a interna

## Cenario C: sem regra especifica (teste fallback)

Preparar:

- remover/desativar regra detalhada do caso

Esperado:

- sistema aplica CFOP da matriz padrao
- evidencia que fallback entrou por ausencia de regra

---

## 16) Como testar de forma objetiva (comprovavel)

Para cada cenario, guardar:

1. payload enviado
2. resposta de validacao
3. resposta de calculo
4. print da regra fiscal cadastrada
5. data/hora e responsavel

APIs uteis:

- `POST /api/fiscal/nfe/validate`
- `POST /api/fiscal/nfe/calculate-taxes`
- `POST /api/fiscal-tax-rules/resolve`
- `GET /api/fiscal-tax-rules`
- `GET /api/fiscal/readiness`

---

## 17) Erros comuns e como corrigir

## 17.1 "CFOP invalido para o item"

Causa comum:

- CFOP do item nao bate com contexto (interna/interestadual, tipo de cliente etc.).

Correcao:

- revisar regra fiscal e CFOP do produto/item.

## 17.2 "CSOSN invalido"

Causa comum:

- CSOSN nao compativel com operacao ou regra.

Correcao:

- revisar CSOSN na regra e no cadastro do produto.

## 17.3 "CEST obrigatorio"

Causa comum:

- NCM exige CEST e produto sem CEST.

Correcao:

- completar CEST no cadastro do produto.

## 17.4 "Certificado invalido/expirado"

Causa comum:

- A1 ausente, vencido ou senha incorreta.

Correcao:

- reenviar certificado valido e validar vigencia.

## 17.5 "Nao pronto para emissao"

Causa comum:

- readiness com itens pendentes (CSC/URL/IBGE etc.).

Correcao:

- abrir readiness e corrigir cada pendencia listada.

---

## 18) Rotina de fechamento recomendada

## Diario

- conferir NFC-e pendentes/processando
- tratar rejeicoes
- validar contingencia pendente

## Semanal

- revisar cancelamentos
- revisar inutilizacoes
- revisar cartas de correcao
- conferir sequencia por serie

## Mensal

- gerar SPED/Sintegra
- confrontar vendas x notas autorizadas
- arquivar XML/protocolos/logs
- fechar checklist de compliance

---

## 19) O que NAO fazer sem alinhamento com contador

- alterar regras fiscais ativas em periodo fechado
- mudar regime tributario sem plano de virada
- apagar regra sem analisar impacto em NCM/UF
- usar fallback como regra definitiva

---

## 20) Glossario rapido (usuario)

- CFOP: codigo da natureza da operacao.
- CST/CSOSN: classificacao tributaria.
- NCM: classificacao fiscal do produto.
- CEST: codigo complementar para ST.
- CSC: token da NFC-e usado no QRCode.
- IBGE municipio: codigo oficial da cidade.
- A1: certificado digital da empresa.
- CC-e: carta de correcao eletronica.
- Inutilizacao: fechamento formal de faixa numerica nao usada.
- Contingencia: emissao temporaria sem comunicacao imediata com SEFAZ.

---

## 21) Referencias tecnicas (suporte)

- rotas fiscais: `server/fiscal-routes.ts`
- readiness: `server/fiscal-readiness.ts`
- regras e resolucao: `server/storage.ts`
- calculo: `server/tax-calculator.ts`
- matriz fallback: `server/tax-matrix.ts`
- validacao CFOP: `server/cfop-validator.ts`
- validacao CSOSN: `server/csosn-calculator.ts`
- tela configuracao fiscal: `client/src/pages/fiscal-config.tsx`
- tela central fiscal: `client/src/pages/fiscal-central.tsx`

---

## 22) Aviso final

Este guia explica o comportamento do sistema e como operar com seguranca.
A decisao tributaria oficial (enquadramento, regra fiscal e obrigacao legal) deve sempre ser validada pelo contador responsavel.

# Printer Bridge (Hybrid Printing)

O frontend tenta imprimir em modo hibrido nesta ordem:

1. `window` bridge/SDK (quando existir)
2. navegador (`window.print` / iframe)
3. fallback para PDF manual

## Bridge JS esperado (SDK Android ou injetor local)

O app procura qualquer um destes objetos globais:

- `window.MercadoGestorPrinterBridge`
- `window.MiniPDVPrinter`
- `window.AndroidPrinter`
- `window.Android`

Metodos aceitos:

- `printPdfUrl(url, { fileName? }) => boolean | Promise<boolean>`
- `printPdfBase64(base64, { fileName? }) => boolean | Promise<boolean>`

Retorno:

- `true` (ou qualquer valor diferente de `false`) = impresso/enviado com sucesso
- `false` = falha (o sistema tenta fallback)

## Adaptador localhost (desktop/Windows)

O frontend instala automaticamente `window.MercadoGestorPrinterBridge` como adaptador localhost
caso nenhum bridge nativo exista.

Ele tenta as bases:

- `http://127.0.0.1:18181`
- `http://localhost:18181`
- `http://127.0.0.1:3001`
- `http://localhost:3001`

Endpoints aceitos:

- `POST /print/pdf-url`
- `POST /api/print/pdf-url`
- `POST /print/pdf-base64`
- `POST /api/print/pdf-base64`

Payloads:

```json
{ "url": "/api/fiscal/nfce/123/pdf", "fileName": "nfce-123.pdf" }
```

```json
{ "base64": "<PDF_BASE64>", "fileName": "nfce-123.pdf" }
```

Resposta esperada (opcional):

```json
{ "success": true }
```

Se a resposta nao tiver JSON, qualquer HTTP `2xx` tambem e tratado como sucesso.

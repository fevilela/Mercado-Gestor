import crypto from "node:crypto";
import PdfPrinter from "pdfmake";
import vfsFonts from "pdfmake/build/vfs_fonts.js";
import QRCode from "qrcode";
import { parseStringPromise } from "xml2js";

type XmlNode = Record<string, any>;

let printerInstance: any = null;

function resolvePdfMakeVfs(): Record<string, string> {
  const mod = vfsFonts as any;
  return (
    mod?.pdfMake?.vfs ||
    mod?.default?.pdfMake?.vfs ||
    mod?.vfs ||
    mod?.default?.vfs ||
    {}
  );
}

function getPrinter(): any {
  if (printerInstance) return printerInstance;

  const robotoVfs = resolvePdfMakeVfs();
  const hasRobotoVfs =
    typeof robotoVfs["Roboto-Regular.ttf"] === "string" &&
    typeof robotoVfs["Roboto-Medium.ttf"] === "string" &&
    typeof robotoVfs["Roboto-Italic.ttf"] === "string" &&
    typeof robotoVfs["Roboto-MediumItalic.ttf"] === "string";
  const readFont = (fileName: string) => {
    const base64 = robotoVfs[fileName];
    if (!base64 || typeof base64 !== "string") {
      throw new Error(`Fonte do pdfmake nao encontrada: ${fileName}`);
    }
    return Buffer.from(base64, "base64");
  };

  const fonts = hasRobotoVfs
    ? {
        Roboto: {
          normal: readFont("Roboto-Regular.ttf"),
          bold: readFont("Roboto-Medium.ttf"),
          italics: readFont("Roboto-Italic.ttf"),
          bolditalics: readFont("Roboto-MediumItalic.ttf"),
        },
      }
    : {
        // Fallback para ambientes onde pdfmake/build/vfs_fonts nao expoe Roboto
        // (ex.: bundle server-side em algumas builds). PdfKit possui essas fontes base.
        Roboto: {
          normal: "Helvetica",
          bold: "Helvetica-Bold",
          italics: "Helvetica-Oblique",
          bolditalics: "Helvetica-BoldOblique",
        },
      };

  printerInstance = new PdfPrinter(fonts);
  return printerInstance;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function numberString(value?: string) {
  return value ? Number(value) || 0 : 0;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

function wrapLongToken(value: string, chunkSize: number) {
  const text = String(value || "").trim();
  if (!text) return "";
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks.join("\n");
}

function wrapTextLines(value: string, maxChars: number, maxLines: number) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const words = raw.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const chunks =
      word.length > maxChars
        ? Array.from({ length: Math.ceil(word.length / maxChars) }, (_, idx) =>
            word.slice(idx * maxChars, (idx + 1) * maxChars),
          )
        : [word];
    for (const chunk of chunks) {
      const candidate = current ? `${current} ${chunk}` : chunk;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = chunk;
      }
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  if (raw.length > lines.join(" ").length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length >= 1 ? `${last.slice(0, Math.max(0, maxChars - 1))}…` : "…";
  }
  return lines.join("\n");
}

async function parseNFe(xmlContent: string) {
  const parsed = await parseStringPromise(xmlContent, { explicitArray: false });
  const nfeRoot = (parsed?.NFe ?? parsed?.nfeProc?.NFe) ?? null;
  const inf = nfeRoot?.infNFe ?? parsed?.infNFe;
  const protNfe = parsed?.nfeProc?.protNFe?.infProt ?? parsed?.protNFe?.infProt ?? {};
  const ide: XmlNode = inf?.ide ?? {};
  const emit: XmlNode = inf?.emit ?? {};
  const dest: XmlNode = inf?.dest ?? {};
  const total: XmlNode = inf?.total?.ICMSTot ?? {};
  const detPag = toArray(inf?.pag?.detPag).map((item: any) => ({
    tPag: String(item?.tPag ?? ""),
    vPag: String(item?.vPag ?? "0"),
  }));
  const det = toArray(inf?.det).map((item: any, index: number) => {
    const prod = item?.prod ?? {};
    return {
      idx: index + 1,
      desc: prod.xProd ?? "",
      qty: prod.qCom ?? "0",
      unit: prod.uCom ?? "",
      unitPrice: prod.vUnCom ?? "0",
      total: prod.vProd ?? "0",
    };
  });
  const chave =
    (inf?.["$"]?.Id as string | undefined)?.replace("NFe", "") ??
    (protNfe?.chNFe as string | undefined) ??
    "";
  const protocolo = (protNfe?.nProt as string | undefined) ?? "";

  return { ide, emit, dest, total, det, detPag, chave, protocolo, inf, nfeRoot };
}

function createPdf(docDefinition: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = getPrinter().createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.end();
  });
}

export async function generateDanfeNFeA4(xmlContent: string): Promise<Buffer> {
  const { ide, emit, dest, total, det, chave } = await parseNFe(xmlContent);
  const totalTributos = numberString(total.vTotTrib);
  const totalsBody = [
    ["Valor Produtos", formatCurrency(numberString(total.vProd))],
    ["ICMS", formatCurrency(numberString(total.vICMS))],
    ["IPI", formatCurrency(numberString(total.vIPI))],
    ["PIS", formatCurrency(numberString(total.vPIS))],
    ["COFINS", formatCurrency(numberString(total.vCOFINS))],
  ];
  if (totalTributos > 0) {
    totalsBody.push(["Tributos (IBPT)", formatCurrency(totalTributos)]);
  }
  totalsBody.push(["Valor NF-e", formatCurrency(numberString(total.vNF))]);

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    content: [
      { text: "DANFE - Documento Auxiliar da NF-e", style: "title" },
      { text: `Chave: ${chave}`, style: "small" },
      {
        columns: [
          { width: "50%", text: `Emitente: ${emit.xNome ?? ""}` },
          { width: "50%", text: `CNPJ: ${emit.CNPJ ?? ""}` },
        ],
        margin: [0, 10, 0, 2],
      },
      {
        columns: [
          { width: "50%", text: `Destinatario: ${dest.xNome ?? "N/I"}` },
          { width: "50%", text: `Documento: ${dest.CNPJ ?? dest.CPF ?? ""}` },
        ],
        margin: [0, 2, 0, 10],
      },
      {
        table: {
          widths: [20, "*", 40, 35, 50, 55],
          body: [
            ["#", "Descricao", "Qtde", "Un", "Vlr Unit", "Vlr Total"],
            ...det.map((item) => [
              item.idx,
              item.desc,
              item.qty,
              item.unit,
              formatCurrency(numberString(item.unitPrice)),
              formatCurrency(numberString(item.total)),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          { width: "*", text: "Totais", style: "subtitle" },
          {
            width: 200,
            table: {
              widths: ["*", "*"],
              body: totalsBody,
            },
            layout: "lightHorizontalLines",
          },
        ],
      },
      {
        text: `Data emissao: ${ide.dhEmi ?? ide.dEmi ?? ""}`,
        margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      title: {
        fontSize: 13,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 10],
      },
      subtitle: { fontSize: 11, bold: true, margin: [0, 0, 0, 6] },
      small: { fontSize: 8, margin: [0, 0, 0, 4] },
    },
  };

  return createPdf(docDefinition);
}

function buildNFCeQrUrl(params: {
  sefazUrl: string;
  chave: string;
  versao: string;
  tpAmb: string;
  cDest: string;
  dhEmi: string;
  vNF: string;
  vICMS: string;
  digVal: string;
  cscId: string;
  csc: string;
}) {
  const {
    sefazUrl,
    chave,
    versao,
    tpAmb,
    cDest,
    dhEmi,
    vNF,
    vICMS,
    digVal,
    cscId,
    csc,
  } = params;

  const payload = [
    chave,
    versao,
    tpAmb,
    cDest,
    dhEmi,
    vNF,
    vICMS,
    digVal,
    cscId,
  ].join("|");
  const hash = crypto
    .createHash("sha256")
    .update(payload + csc)
    .digest("hex");
  return `${sefazUrl}?p=${payload}|${hash}`;
}

export async function generateDanfeNFCeThermal(
  xmlContent: string,
  opts: {
    sefazUrl: string;
    cscId: string;
    csc: string;
    sellerName?: string | null;
    showSeller?: boolean;
    headerText?: string | null;
    footerText?: string | null;
    printerColumns?: number | null;
    layout?: Record<string, unknown> | null;
  },
): Promise<Buffer> {
  const { ide, emit, dest, total, det, detPag, chave, protocolo, inf, nfeRoot } =
    await parseNFe(xmlContent);
  const rawLayout = (opts.layout || {}) as Record<string, any>;
  const configuredPaperWidth = String(rawLayout.paperWidth || "auto");
  const paperWidth =
    configuredPaperWidth === "58mm" || configuredPaperWidth === "80mm"
      ? configuredPaperWidth
      : Number(opts.printerColumns || 48) <= 32
        ? "58mm"
        : "80mm";
  const isNarrow = paperWidth === "58mm";
  const configuredFontSize = String(rawLayout.fontSize || "auto");
  const compactItems = rawLayout.compactItems !== false || isNarrow;
  const itemDescriptionLines = Math.min(
    3,
    Math.max(1, Number(rawLayout.itemDescriptionLines || (isNarrow ? 2 : 3))),
  );
  const showProtocol = rawLayout.showProtocol !== false;
  const showAccessKey = rawLayout.showAccessKey !== false;
  const showPayments = rawLayout.showPayments !== false;
  const showQrCode = rawLayout.showQrCode !== false;
  const showCustomer = rawLayout.showCustomer !== false;
  const showCustomerDocument = rawLayout.showCustomerDocument !== false;
  const showTaxes = rawLayout.showTaxes !== false;
  const pageWidth = isNarrow ? 164 : 227;
  const pageMargins: [number, number, number, number] = isNarrow ? [6, 8, 6, 8] : [10, 10, 10, 10];
  const baseFont =
    configuredFontSize === "small" ? 7 : configuredFontSize === "normal" ? 8 : isNarrow ? 7 : 8;
  const smallFont = Math.max(6, baseFont - 1);
  const titleFont = baseFont + (isNarrow ? 1 : 2);
  const qrFit = isNarrow ? [92, 92] : [120, 120];
  const textWrapChars = isNarrow ? 28 : 42;
  const totalTributos = numberString(total.vTotTrib);
  const totalsBody = [
    ["Subtotal", formatCurrency(numberString(total.vProd))],
  ];
  if (showTaxes) {
    totalsBody.push(["ICMS", formatCurrency(numberString(total.vICMS))]);
  }
  if (showTaxes && totalTributos > 0) {
    totalsBody.push(["Tributos (IBPT)", formatCurrency(totalTributos)]);
  }
  totalsBody.push(["Total", formatCurrency(numberString(total.vNF))]);
  const paymentTypeLabel = (code: string) => {
    const normalized = String(code || "").padStart(2, "0");
    const map: Record<string, string> = {
      "01": "Dinheiro",
      "02": "Cheque",
      "03": "Cartao Credito",
      "04": "Cartao Debito",
      "05": "Credito Loja",
      "10": "Vale Alimentacao",
      "11": "Vale Refeicao",
      "12": "Vale Presente",
      "13": "Vale Combustivel",
      "15": "Boleto",
      "16": "Deposito",
      "17": "PIX",
      "18": "Transferencia",
      "19": "Programa fidelidade",
      "90": "Sem pagamento",
      "99": "Outros",
    };
    return map[normalized] || `Codigo ${normalized}`;
  };

  const paymentRows = detPag.length
    ? detPag.map((p) => [
        paymentTypeLabel(p.tPag),
        formatCurrency(numberString(p.vPag)),
      ])
    : [["Forma de pagamento", "Nao informado"]];

  const itemTableBody = compactItems
    ? [
        ["#", "Descricao", "Qtde", "Total"],
        ...det.map((item) => [
          item.idx,
          wrapTextLines(String(item.desc || ""), isNarrow ? 14 : 22, itemDescriptionLines),
          String(item.qty || "0"),
          formatCurrency(numberString(item.total)),
        ]),
      ]
    : [
        ["#", "Descricao", "Qtde", "Vlr Unit", "Vlr Total"],
        ...det.map((item) => [
          item.idx,
          wrapTextLines(String(item.desc || ""), isNarrow ? 14 : 20, itemDescriptionLines),
          String(item.qty || "0"),
          formatCurrency(numberString(item.unitPrice)),
          formatCurrency(numberString(item.total)),
        ]),
      ];

  const suplQr = nfeRoot?.infNFeSupl?.qrCode ?? inf?.infNFeSupl?.qrCode;
  const signature = toArray((nfeRoot as any)?.Signature ?? (inf as any)?.Signature).at(0);
  const digestValue =
    signature?.SignedInfo?.Reference?.[0]?.DigestValue?.[0] ??
    signature?.SignedInfo?.Reference?.DigestValue ??
    "";
  const qrUrl =
    suplQr ??
    buildNFCeQrUrl({
      sefazUrl: opts.sefazUrl,
      chave,
      versao: ide?.verProc ?? "4.00",
      tpAmb: ide?.tpAmb ?? "1",
      cDest: dest?.CNPJ ?? dest?.CPF ?? "",
      dhEmi: ide?.dhEmi ?? ide?.dEmi ?? "",
      vNF: total?.vNF ?? "0",
      vICMS: total?.vICMS ?? "0",
      digVal: digestValue,
      cscId: opts.cscId,
      csc: opts.csc,
    });

  let qrCodeDataUrl = "";
  try {
    qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: "M",
    });
  } catch {
    qrCodeDataUrl = "";
  }

  const docDefinition = {
    pageSize: { width: pageWidth, height: 1200 },
    pageMargins,
    defaultStyle: { font: "Roboto", fontSize: baseFont },
    content: [
      { text: emit.xNome ?? "", style: "title" },
      ...(opts.headerText
        ? [{ text: opts.headerText, alignment: "center", margin: [0, 0, 0, 4] as [number, number, number, number] }]
        : []),
      { text: `CNPJ: ${emit.CNPJ ?? ""}`, margin: [0, 2, 0, 2] },
      {
        text: wrapTextLines(
          emit.enderEmit?.xLgr ? `${emit.enderEmit.xLgr}, ${emit.enderEmit.nro}` : "",
          textWrapChars,
          2,
        ),
      },
      {
        text: wrapTextLines(
          `Bairro: ${emit.enderEmit?.xBairro ?? ""} - ${emit.enderEmit?.xMun ?? ""}`,
          textWrapChars,
          2,
        ),
      },
      {
        text: wrapTextLines(
          `UF: ${emit.enderEmit?.UF ?? ""} CEP: ${emit.enderEmit?.CEP ?? ""}`,
          textWrapChars,
          1,
        ),
        margin: [0, 0, 0, 6],
      },
      {
        text: "DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletronica",
        style: "subtitle",
      },
      {
        text: `Numero: ${ide.nNF ?? ""} Serie: ${ide.serie ?? ""}`,
        margin: [0, 2, 0, 4],
      },
      ...(showProtocol
        ? [
            {
              text: `Protocolo de autorizacao: ${protocolo || "N/A"}`,
              margin: [0, 0, 0, 2],
            },
          ]
        : []),
      ...(showAccessKey
        ? [
            {
              text: `Chave de Acesso:\n${wrapLongToken(String(chave || "").replace(/\s+/g, ""), isNarrow ? 22 : 28)}`,
              style: "small",
              margin: [0, 0, 0, 6],
            },
          ]
        : []),
      {
        table: {
          widths: compactItems
            ? (isNarrow ? [10, "*", 22, 40] : [12, "*", 28, 52])
            : [12, "*", isNarrow ? 22 : 28, isNarrow ? 30 : 40, isNarrow ? 38 : 50],
          body: itemTableBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: ["*", isNarrow ? 52 : 70],
          body: totalsBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 8],
      },
      ...(showPayments
        ? [
            {
              text: "Pagamentos",
              style: "subtitle",
              margin: [0, 2, 0, 4],
            },
            {
              table: {
                widths: ["*", isNarrow ? 52 : 70],
                body: [["Forma", "Valor"], ...paymentRows],
              },
              layout: "lightHorizontalLines",
              margin: [0, 0, 0, 8],
            },
          ]
        : []),
      ...(showQrCode
        ? [
            {
              text: "Consulta via leitor de QR Code",
              alignment: "center",
              margin: [0, 4, 0, 4],
            },
            ...(qrCodeDataUrl
              ? [
                  {
                    image: qrCodeDataUrl,
                    fit: qrFit,
                    alignment: "center",
                    margin: [0, 0, 0, 6],
                  },
                ]
              : []),
            { text: wrapLongToken(qrUrl, isNarrow ? 26 : 42), style: "small", alignment: "center" },
          ]
        : []),
      {
        text: `Data emissao: ${ide.dhEmi ?? ide.dEmi ?? ""}`,
        margin: [0, 6, 0, 0],
      },
      ...(showCustomer
        ? [
            {
              text: wrapTextLines(`Consumidor: ${dest.xNome ?? "Nao identificado"}`, textWrapChars, 2),
              margin: [0, 2, 0, 0],
            },
          ]
        : []),
      ...(showCustomerDocument
        ? [
            {
              text: `Documento: ${dest.CNPJ ?? dest.CPF ?? "Nao informado"}`,
              margin: [0, 1, 0, 0],
            },
          ]
        : []),
      ...(opts.showSeller !== false && opts.sellerName
        ? [
            {
              text: wrapTextLines(`Vendedor: ${opts.sellerName}`, textWrapChars, 2),
              margin: [0, 1, 0, 0],
            },
          ]
        : []),
      ...(opts.footerText
        ? [
            {
              text: wrapTextLines(String(opts.footerText), textWrapChars, 4),
              alignment: "center",
              margin: [0, 6, 0, 0],
            },
          ]
        : []),
    ],
    styles: {
      title: { fontSize: titleFont, bold: true, alignment: "center" },
      subtitle: {
        fontSize: baseFont,
        bold: true,
        alignment: "center",
        margin: [0, 2, 0, 4],
      },
      small: { fontSize: smallFont },
    },
  };

  return createPdf(docDefinition);
}

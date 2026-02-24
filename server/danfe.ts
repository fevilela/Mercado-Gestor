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
    lines[lines.length - 1] = last.length >= 1 ? `${last.slice(0, Math.max(0, maxChars - 1))}â€¦` : "â€¦";
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
    const imposto = item?.imposto ?? {};
    const icmsNode =
      imposto?.ICMS?.ICMS00 ??
      imposto?.ICMS?.ICMS10 ??
      imposto?.ICMS?.ICMS20 ??
      imposto?.ICMS?.ICMS40 ??
      imposto?.ICMS?.ICMSSN102 ??
      imposto?.ICMS?.ICMSSN500 ??
      {};
    const ipiNode = imposto?.IPI?.IPITrib ?? imposto?.IPI?.IPINT ?? {};
    const pisNode = imposto?.PIS?.PISAliq ?? imposto?.PIS?.PISNT ?? {};
    return {
      idx: index + 1,
      code: prod.cProd ?? "",
      desc: prod.xProd ?? "",
      ncm: prod.NCM ?? "",
      cfop: prod.CFOP ?? "",
      cst: icmsNode?.orig !== undefined && (icmsNode?.CST || icmsNode?.CSOSN)
        ? `${icmsNode.orig}${icmsNode.CST || icmsNode.CSOSN}`
        : String(icmsNode?.CST || icmsNode?.CSOSN || ""),
      qty: prod.qCom ?? "0",
      unit: prod.uCom ?? "",
      unitPrice: prod.vUnCom ?? "0",
      total: prod.vProd ?? "0",
      icmsBase: String(icmsNode?.vBC ?? "0"),
      icmsValue: String(icmsNode?.vICMS ?? "0"),
      ipiValue: String(ipiNode?.vIPI ?? "0"),
      icmsAliq: String(icmsNode?.pICMS ?? ""),
      ipiAliq: String(ipiNode?.pIPI ?? ""),
      pisAliq: String(pisNode?.pPIS ?? ""),
    };
  });
  const chave =
    (inf?.["$"]?.Id as string | undefined)?.replace("NFe", "") ??
    (protNfe?.chNFe as string | undefined) ??
    "";
  const protocolo = (protNfe?.nProt as string | undefined) ?? "";
  const protocoloDataHora = (protNfe?.dhRecbto as string | undefined) ?? "";

  return { ide, emit, dest, total, det, detPag, chave, protocolo, protocoloDataHora, inf, nfeRoot };
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

function buildBarcodeCanvasFromKey(key: string, width = 170, height = 34) {
  const digits = String(key || "").replace(/\D/g, "");
  if (!digits) return [];
  const bars: any[] = [];
  let x = 0;
  for (let i = 0; i < digits.length && x < width; i++) {
    const d = Number(digits[i]);
    const barW = d % 2 === 0 ? 1.2 : 2;
    const gapW = d % 3 === 0 ? 1.5 : 1;
    bars.push({ type: "rect", x, y: 0, w: barW, h: height, color: "#000000" });
    x += barW + gapW;
  }
  while (x < width) {
    bars.push({ type: "rect", x, y: 0, w: 1.2, h: height, color: "#000000" });
    x += 2.2;
  }
  return bars;
}

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/")) return raw;
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const response = await fetch(raw);
    if (!response.ok) return null;
    const contentType = String(response.headers.get("content-type") || "image/png");
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function generateDanfeNFeA4(
  xmlContent: string,
  opts?: {
    layout?: Record<string, unknown> | null;
    logoUrl?: string | null;
    protocolOverride?: string | null;
  },
): Promise<Buffer> {
  const { ide, emit, dest, total, det, chave, protocolo, protocoloDataHora, inf } = await parseNFe(xmlContent);
  const resolvedProtocol = String(opts?.protocolOverride || protocolo || "").trim();
  const layout = (opts?.layout || {}) as Record<string, any>;
  const fontSize = layout.fontSize === "small" ? 7 : 8;
  const lineHeight =
    layout.lineSpacing === "compact" ? 1.0 : layout.lineSpacing === "comfortable" ? 1.35 : 1.15;
  const itemDescriptionLines = Math.min(4, Math.max(1, Number(layout.itemDescriptionLines || 2)));
  const showAccessKey = layout.showAccessKey !== false;
  const showCustomerDocument = layout.showCustomerDocument !== false;
  const showTaxes = layout.showTaxes !== false;
  const headerText = String(layout.headerText || "").trim();
  const footerText = String(layout.footerText || "").trim();
  const logoDataUrl = await imageUrlToDataUrl(String(opts?.logoUrl || ""));
  const emitAddr = emit?.enderEmit ?? {};
  const destAddr = dest?.enderDest ?? {};
  const transp = (inf as any)?.transp ?? {};
  const vol = Array.isArray(transp?.vol) ? transp.vol[0] : transp?.vol ?? {};
  const nfNumber = String(ide?.nNF ?? "");
  const nfSerie = String(ide?.serie ?? "");
  const natureOp = String(ide?.natOp ?? "VENDA");
  const ieEmit = String(emit?.IE ?? "");
  const ieDest = String(dest?.IE ?? "");
  const legacyIssueDateTime =
    ide?.dEmi && ide?.hSaiEnt ? `${ide.dEmi}T${ide.hSaiEnt}` : undefined;
  const currentDateTime = String(ide?.dhEmi ?? legacyIssueDateTime ?? ide?.dEmi ?? protocoloDataHora ?? "");
  const entryExitLabel = String(ide?.tpNF ?? "1") === "0" ? "0-ENTRADA" : "1-SAIDA";
  const fmtDateBr = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "";
    return date.toLocaleString("pt-BR");
  };
  const keyFormatted = String(chave || "").replace(/(\d{4})(?=\d)/g, "$1 ");
  const keySingleLine = String(chave || "").replace(/\s+/g, "");
  const totalTributos = numberString(total.vTotTrib);
  const totalsBody = [
    ["Valor Produtos", formatCurrency(numberString(total.vProd))],
  ];
  if (showTaxes) {
    totalsBody.push(["ICMS", formatCurrency(numberString(total.vICMS))]);
    totalsBody.push(["IPI", formatCurrency(numberString(total.vIPI))]);
    totalsBody.push(["PIS", formatCurrency(numberString(total.vPIS))]);
    totalsBody.push(["COFINS", formatCurrency(numberString(total.vCOFINS))]);
  }
  if (showTaxes && totalTributos > 0) {
    totalsBody.push(["Tributos (IBPT)", formatCurrency(totalTributos)]);
  }
  totalsBody.push(["Valor NF-e", formatCurrency(numberString(total.vNF))]);

  const itemRows = det.map((item) => ([
    { text: String(item.code || item.idx), fontSize: 6 },
    { text: wrapTextLines(String(item.desc || ""), 18, itemDescriptionLines), fontSize: 6 },
    { text: String((item as any).ncm || ""), fontSize: 6, alignment: "center" as const },
    { text: String((item as any).cst || ""), fontSize: 6, alignment: "center" as const },
    { text: String((item as any).cfop || ""), fontSize: 6, alignment: "center" as const },
    { text: String(item.unit || ""), fontSize: 6, alignment: "center" as const },
    { text: String(item.qty || ""), fontSize: 6, alignment: "right" as const },
    { text: formatCurrency(numberString(item.unitPrice)), fontSize: 6, alignment: "right" as const },
    { text: formatCurrency(numberString(item.total)), fontSize: 6, alignment: "right" as const },
    { text: formatCurrency(numberString((item as any).icmsBase || "0")), fontSize: 6, alignment: "right" as const },
    { text: formatCurrency(numberString((item as any).icmsValue || "0")), fontSize: 6, alignment: "right" as const },
    { text: formatCurrency(numberString((item as any).ipiValue || "0")), fontSize: 6, alignment: "right" as const },
    { text: String((item as any).icmsAliq || "0"), fontSize: 6, alignment: "right" as const },
    { text: String((item as any).ipiAliq || "0"), fontSize: 6, alignment: "right" as const },
  ]));

  const boxedLayout = {
    hLineWidth: () => 0.4,
    vLineWidth: () => 0.4,
    hLineColor: () => "#000000",
    vLineColor: () => "#000000",
    paddingLeft: () => 2,
    paddingRight: () => 2,
    paddingTop: () => 1,
    paddingBottom: () => 1,
  };
  const barcodeCanvas = buildBarcodeCanvasFromKey(chave, 125, 16);
  const taxCalcCell = (label: string, value: string) => ({
    stack: [
      { text: label, fontSize: 5, bold: true, margin: [0, 0, 0, 1] as [number, number, number, number] },
      { text: value, alignment: "right" as const, bold: true, fontSize: 7 },
    ],
    minHeight: 18,
  });
  const infoCell = (label: string, value: string, opts?: { minHeight?: number; fontSize?: number }) => ({
    stack: [
      { text: label, fontSize: 5, bold: true, margin: [0, 0, 0, 1] as [number, number, number, number] },
      { text: value || "", fontSize: opts?.fontSize ?? 6 },
    ],
    minHeight: opts?.minHeight ?? 20,
  });

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [12, 10, 12, 12],
    defaultStyle: { font: "Roboto", fontSize, lineHeight },
    content: [
      {
        table: {
          widths: [95, "*", 110],
          body: [[
            { text: "DATA DE RECEBIMENTO", fontSize: 6, margin: [0, 12, 0, 0] },
            {
              stack: [
                { text: "RECEBEMOS DE", fontSize: 6, margin: [0, 0, 0, 1] },
                { text: String(emit?.xNome || "").toUpperCase(), fontSize: 8, bold: true },
                { text: "OS PRODUTOS/SERVICOS CONSTANTES DO DANFE AO LADO", fontSize: 6 },
              ],
            },
            {
              stack: [
                { text: "NF-e", bold: true, alignment: "center", margin: [0, 2, 0, 4] },
                { text: `N\u00ba ${nfNumber}`, alignment: "center", bold: true },
                { text: `S\u00e9rie ${nfSerie || "1"}`, alignment: "center" },
              ],
            },
          ]],
        },
        layout: boxedLayout,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: ["*"],
          body: [[
            {
              columns: [
                {
                  width: 160,
                  stack: [
                    ...(logoDataUrl
                      ? [
                          {
                            image: logoDataUrl,
                            fit: [160, 66],
                            alignment: "center" as const,
                            margin: [0, 6, 0, 0] as [number, number, number, number],
                          },
                        ]
                      : []),
                    ...(logoDataUrl
                      ? []
                      : [
                          {
                            text: String(emit?.xNome || ""),
                            bold: true,
                            alignment: "center" as const,
                            margin: [0, 30, 0, 0] as [number, number, number, number],
                          },
                        ]),
                  ],
                },
                {
                  width: 122,
                  stack: [
                    { text: "DANFE", bold: true, fontSize: 11, alignment: "center", margin: [0, 4, 0, 0] },
                    { text: "Documento Auxiliar da Nota Fiscal Eletr\u00f4nica", fontSize: 7, alignment: "center" },
                    { text: entryExitLabel, margin: [0, 6, 0, 0], alignment: "center" },
                    { text: `N\u00ba ${nfNumber}   S\u00e9rie ${nfSerie || "1"}`, bold: true, alignment: "center", margin: [0, 4, 0, 0] },
                    ...(headerText ? [{ text: headerText, fontSize: 7, alignment: "center", margin: [0, 4, 0, 0] }] : []),
                  ],
                  margin: [48, 0, 0, 0],
                },
                {
                  width: "*",
                  stack: [
                    { text: "CHAVE DE ACESSO", fontSize: 6, bold: true, alignment: "center", margin: [0, 4, 0, 0] },
                    ...(showAccessKey && barcodeCanvas.length
                      ? [
                          {
                            columns: [
                              { width: "*", text: "" },
                              { width: 125, canvas: barcodeCanvas },
                              { width: "*", text: "" },
                            ],
                            margin: [0, 3, 0, 2] as [number, number, number, number],
                          },
                        ]
                      : []),
                    ...(showAccessKey
                      ? [
                          {
                            text: keyFormatted || keySingleLine,
                            fontSize: 6.0,
                            alignment: "center",
                            noWrap: true,
                            margin: [0, 1, 0, 2] as [number, number, number, number],
                          },
                        ]
                      : []),
                    { text: "Consulta de autenticidade no portal nacional da NF-e", fontSize: 5, alignment: "center", margin: [0, 0, 0, 0] },
                    { text: "www.nfe.fazenda.gov.br/portal", fontSize: 5, alignment: "center", margin: [0, 0, 0, 0] },
                    { text: `Protocolo: ${resolvedProtocol || "N/A"}`, fontSize: 5, margin: [0, 1, 0, 0], alignment: "center" },
                  ],
                  margin: [88, 0, 0, 0],
                },
              ],
            },
          ]],
        },
        layout: boxedLayout,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: [250, 120, 90, "*"],
          body: [
            [
              infoCell("NATUREZA DA OPERA\u00c7\u00c3O", natureOp),
              infoCell("PROTOCOLO", resolvedProtocol || "N/A"),
              infoCell("DATA EMISS\u00c3O", fmtDateBr(currentDateTime)),
              infoCell("DATA ENTRADA/SA\u00cdDA", ""),
            ],
          ],
        },
        layout: boxedLayout,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: [250, 95, 120, "*"],
          body: [
            [
              infoCell(
                "EMITENTE",
                wrapTextLines(
                  `${emit?.xNome || ""}\n${emitAddr?.xLgr || ""}, ${emitAddr?.nro || ""} - ${emitAddr?.xBairro || ""}\n${emitAddr?.xMun || ""} - ${emitAddr?.UF || ""} CEP ${emitAddr?.CEP || ""}`,
                  44,
                  4,
                ),
                { minHeight: 42 },
              ),
              infoCell("CNPJ", String(emit?.CNPJ || ""), { minHeight: 42 }),
              infoCell("INSCRI\u00c7\u00c3O ESTADUAL", ieEmit, { minHeight: 42 }),
              infoCell("UF", String(emitAddr?.UF || ""), { minHeight: 42 }),
            ],
          ],
        },
        layout: boxedLayout,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: [250, 95, 120, "*"],
          body: [
            [
              infoCell(
                "DESTINAT\u00c1RIO / REMETENTE",
                wrapTextLines(
                  `${dest?.xNome || "N/I"}\n${destAddr?.xLgr || ""}, ${destAddr?.nro || ""} - ${destAddr?.xBairro || ""}\n${destAddr?.xMun || ""} - ${destAddr?.UF || ""} CEP ${destAddr?.CEP || ""}`,
                  44,
                  4,
                ),
                { minHeight: 42 },
              ),
              infoCell("CNPJ/CPF", showCustomerDocument ? String(dest?.CNPJ || dest?.CPF || "") : "", { minHeight: 42 }),
              infoCell("INSCRI\u00c7\u00c3O ESTADUAL", ieDest, { minHeight: 42 }),
              infoCell("UF", String(destAddr?.UF || ""), { minHeight: 42 }),
            ],
          ],
        },
        layout: boxedLayout,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: [150, 85, 75, 80, 30, 65, "*"],
          body: [
            [
              { text: "TRANSPORTADOR / VOLUMES", fontSize: 6, bold: true, colSpan: 7 },
              {}, {}, {}, {}, {}, {},
            ],
            [
              infoCell("NOME / RAZ\u00c3O SOCIAL", String(transp?.xNome || ""), { minHeight: 24 }),
              infoCell(
                "FRETE POR CONTA",
                String(transp?.modFrete ?? "") === "0"
                  ? "(0) Emitente"
                  : String(transp?.modFrete ?? "") === "1"
                    ? "(1) Destinat\u00e1rio"
                    : String(transp?.modFrete || ""),
                { minHeight: 24 },
              ),
              infoCell("C\u00d3DIGO ANTT", String(transp?.RNTC || ""), { minHeight: 24 }),
              infoCell("PLACA DO VE\u00cdCULO", String(transp?.placa || transp?.veicTransp?.placa || ""), { minHeight: 24 }),
              infoCell("UF", String(transp?.veicTransp?.UF || ""), { minHeight: 24 }),
              infoCell("CNPJ / CPF", String(transp?.CNPJ || transp?.CPF || ""), { minHeight: 24 }),
              infoCell("INSCRI\u00c7\u00c3O ESTADUAL", String(transp?.IE || ""), { minHeight: 24 }),
            ],
            [
              infoCell("ENDERE\u00c7O", String(transp?.xEnder || ""), { minHeight: 22 }),
              infoCell("MUNIC\u00cdPIO", String(transp?.xMun || ""), { minHeight: 22 }),
              infoCell("UF", String(transp?.UF || transp?.veicTransp?.UF || ""), { minHeight: 22 }),
              infoCell("INSCRI\u00c7\u00c3O ESTADUAL", String(transp?.IE || ""), { minHeight: 22 }),
              infoCell("UF", String(transp?.veicTransp?.UF || ""), { minHeight: 22 }),
              infoCell("CNPJ / CPF", String(transp?.CNPJ || transp?.CPF || ""), { minHeight: 22 }),
              infoCell("", "", { minHeight: 22 }),
            ],
            [
              infoCell("QUANTIDADE", String(vol?.qVol || ""), { minHeight: 20 }),
              infoCell("ESP\u00c9CIE", String(vol?.esp || ""), { minHeight: 20 }),
              infoCell("MARCA", String(vol?.marca || ""), { minHeight: 20 }),
              infoCell("NUMERO", String(vol?.nVol || ""), { minHeight: 20 }),
              infoCell("PESO BRUTO", String(vol?.pesoB || ""), { minHeight: 20 }),
              infoCell("PESO LIQUIDO", String(vol?.pesoL || ""), { minHeight: 20 }),
              infoCell("", "", { minHeight: 20 }),
            ],
          ],
        },
        layout: boxedLayout,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: ["25%", "25%", "25%", "25%"],
          body: [
            [
              { text: "C\u00c1LCULO DO IMPOSTO", fontSize: 6, bold: true, colSpan: 4 },
              {}, {}, {},
            ],
            [
              taxCalcCell("BASE DE C\u00c1LCULO DO ICMS", formatCurrency(numberString(total.vBC))),
              taxCalcCell("VALOR DO ICMS", formatCurrency(numberString(total.vICMS))),
              taxCalcCell("BASE DE C\u00c1LCULO DO ICMS S.T.", formatCurrency(numberString(total.vBCST))),
              taxCalcCell("VALOR DO ICMS SUBSTITUI\u00c7\u00c3O", formatCurrency(numberString(total.vST))),
            ],
            [
              taxCalcCell("VALOR DO FRETE", formatCurrency(numberString(total.vFrete))),
              taxCalcCell("VALOR DO SEGURO", formatCurrency(numberString(total.vSeg))),
              taxCalcCell("DESCONTO", formatCurrency(numberString(total.vDesc))),
              taxCalcCell("OUTRAS DESPESAS", formatCurrency(numberString(total.vOutro))),
            ],
            [
              taxCalcCell("VALOR TOTAL DO IPI", formatCurrency(numberString(total.vIPI))),
              taxCalcCell("VALOR DO PIS", showTaxes ? formatCurrency(numberString(total.vPIS)) : "Oculto"),
              taxCalcCell("VALOR DA COFINS", showTaxes ? formatCurrency(numberString(total.vCOFINS)) : "Oculto"),
              taxCalcCell("VALOR TOTAL DOS PRODUTOS", formatCurrency(numberString(total.vProd))),
            ],
            [
              taxCalcCell("VALOR TOTAL DA NOTA", formatCurrency(numberString(total.vNF))),
              taxCalcCell("VLR APROX. TRIBUTOS", showTaxes ? formatCurrency(totalTributos) : "Oculto"),
              taxCalcCell("VLR II", formatCurrency(numberString((total as any).vII))),
              taxCalcCell("VLR DESONERA\u00c7\u00c3O", formatCurrency(numberString((total as any).vICMSDeson))),
            ],
          ],
        },
        layout: boxedLayout,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          headerRows: 2,
          widths: [42, "*", 34, 24, 26, 20, 30, 38, 38, 34, 34, 30, 24, 24],
          body: [
            [
              { text: "DADOS DOS PRODUTOS / SERVI\u00c7OS", fontSize: 6, bold: true, colSpan: 14 },
              {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
            ],
            [
              { text: "C\u00d3DIGO PRODUTO", fontSize: 5, bold: true },
              { text: "DESCRI\u00c7\u00c3O DO PRODUTO / SERVI\u00c7O", fontSize: 5, bold: true },
              { text: "NCM/SH", fontSize: 5, bold: true },
              { text: "O/CST", fontSize: 5, bold: true },
              { text: "CFOP", fontSize: 5, bold: true },
              { text: "UN", fontSize: 5, bold: true },
              { text: "QUANT", fontSize: 5, bold: true },
              { text: "VALOR\nUNIT", fontSize: 5, bold: true, alignment: "center" as const },
              { text: "VALOR\nTOTAL", fontSize: 5, bold: true, alignment: "center" as const },
              { text: "B.C\u00c1LC\nICMS", fontSize: 5, bold: true, alignment: "center" as const },
              { text: "VALOR\nICMS", fontSize: 5, bold: true, alignment: "center" as const },
              { text: "VALOR\nIPI", fontSize: 5, bold: true, alignment: "center" as const },
              { text: "ALIQ.\nICMS", fontSize: 5, bold: true, alignment: "center" as const },
              { text: "ALIQ IPI", fontSize: 5, bold: true, alignment: "center" as const },
            ],
            ...itemRows,
          ],
        },
        layout: boxedLayout,
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: ["*"],
          body: [[
            {
              stack: [
                { text: "DADOS ADICIONAIS", fontSize: 6, bold: true },
                { text: wrapTextLines(String((inf as any)?.infAdic?.infCpl || ""), 70, 6), fontSize: 7 },
                ...(footerText ? [{ text: footerText, margin: [0, 6, 0, 0], fontSize: 7 }] : []),
              ],
              minHeight: 60,
            },
          ]],
        },
        layout: boxedLayout,
      },
    ],
    styles: {
      title: {
        fontSize: 12,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 6],
      },
      subtitle: { fontSize: fontSize + 2, bold: true, margin: [0, 0, 0, 6], lineHeight },
      small: { fontSize: Math.max(7, fontSize - 1), margin: [0, 0, 0, 4], lineHeight },
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
  const configuredLineSpacing = String(rawLayout.lineSpacing || "normal");
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
  const lineHeight =
    configuredLineSpacing === "compact"
      ? 1.0
      : configuredLineSpacing === "comfortable"
        ? 1.3
        : 1.15;
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
    defaultStyle: { font: "Roboto", fontSize: baseFont, lineHeight },
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
      title: { fontSize: titleFont, bold: true, alignment: "center", lineHeight },
      subtitle: {
        fontSize: baseFont,
        bold: true,
        alignment: "center",
        margin: [0, 2, 0, 4],
        lineHeight,
      },
      small: { fontSize: smallFont, lineHeight },
    },
  };

  return createPdf(docDefinition);
}

import crypto from "crypto";
import PdfPrinter from "pdfmake";
import vfsFonts from "pdfmake/build/vfs_fonts.js";
import QRCode from "qrcode";
import { parseStringPromise } from "xml2js";

type XmlNode = Record<string, any>;

const robotoVfs = (vfsFonts as any).pdfMake?.vfs ?? {};
const fonts = {
  Roboto: {
    normal: Buffer.from(robotoVfs["Roboto-Regular.ttf"], "base64"),
    bold: Buffer.from(robotoVfs["Roboto-Medium.ttf"], "base64"),
    italics: Buffer.from(robotoVfs["Roboto-Italic.ttf"], "base64"),
    bolditalics: Buffer.from(robotoVfs["Roboto-MediumItalic.ttf"], "base64"),
  },
};

const printer = new PdfPrinter(fonts);

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

async function parseNFe(xmlContent: string) {
  const parsed = await parseStringPromise(xmlContent, { explicitArray: false });
  const inf = (parsed?.NFe ?? parsed?.nfeProc?.NFe)?.infNFe ?? parsed?.infNFe;
  const ide: XmlNode = inf?.ide ?? {};
  const emit: XmlNode = inf?.emit ?? {};
  const dest: XmlNode = inf?.dest ?? {};
  const total: XmlNode = inf?.total?.ICMSTot ?? {};
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
    (parsed?.protNFe?.infProt?.chNFe as string | undefined) ??
    "";

  return { ide, emit, dest, total, det, chave, inf };
}

function createPdf(docDefinition: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = printer.createPdfKitDocument(docDefinition);
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
  opts: { sefazUrl: string; cscId: string; csc: string },
): Promise<Buffer> {
  const { ide, emit, dest, total, det, chave, inf } =
    await parseNFe(xmlContent);
  const totalTributos = numberString(total.vTotTrib);
  const totalsBody = [
    ["Subtotal", formatCurrency(numberString(total.vProd))],
    ["ICMS", formatCurrency(numberString(total.vICMS))],
  ];
  if (totalTributos > 0) {
    totalsBody.push(["Tributos (IBPT)", formatCurrency(totalTributos)]);
  }
  totalsBody.push(["Total", formatCurrency(numberString(total.vNF))]);
  const suplQr = inf?.infNFeSupl?.qrCode;
  const signature = toArray((inf as any)?.Signature).at(0);
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

  const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: "M",
  });

  const docDefinition = {
    pageSize: { width: 227, height: "auto" },
    pageMargins: [10, 10, 10, 10],
    defaultStyle: { font: "Roboto", fontSize: 8 },
    content: [
      { text: emit.xNome ?? "", style: "title" },
      { text: `CNPJ: ${emit.CNPJ ?? ""}`, margin: [0, 2, 0, 2] },
      {
        text: emit.enderEmit?.xLgr
          ? `${emit.enderEmit.xLgr}, ${emit.enderEmit.nro}`
          : "",
      },
      {
        text: `Bairro: ${emit.enderEmit?.xBairro ?? ""} - ${emit.enderEmit?.xMun ?? ""}`,
      },
      {
        text: `UF: ${emit.enderEmit?.UF ?? ""} CEP: ${emit.enderEmit?.CEP ?? ""}`,
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
      {
        text: `Chave de Acesso: ${chave}`,
        style: "small",
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: [15, "*", 40, 35, 45],
          body: [
            ["#", "Descricao", "Qtde", "Vlr Unit", "Vlr Total"],
            ...det.map((item) => [
              item.idx,
              item.desc,
              item.qty,
              formatCurrency(numberString(item.unitPrice)),
              formatCurrency(numberString(item.total)),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 8],
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 100,
            table: {
              widths: ["*", "*"],
              body: totalsBody,
            },
            layout: "lightHorizontalLines",
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        columns: [
          {
            width: "*",
            text: "Consulta via leitor de QR Code",
            alignment: "center",
          },
        ],
        margin: [0, 4, 0, 4],
      },
      {
        columns: [
          {
            width: "*",
            image: qrCodeDataUrl,
            fit: [120, 120],
            alignment: "center",
          },
        ],
        margin: [0, 0, 0, 6],
      },
      { text: qrUrl, style: "small", alignment: "center" },
      {
        text: `Data emissao: ${ide.dhEmi ?? ide.dEmi ?? ""}`,
        margin: [0, 6, 0, 0],
      },
      {
        text: `Consumidor: ${dest.xNome ?? "Nao identificado"}`,
        margin: [0, 2, 0, 0],
      },
    ],
    styles: {
      title: { fontSize: 10, bold: true, alignment: "center" },
      subtitle: {
        fontSize: 8,
        bold: true,
        alignment: "center",
        margin: [0, 2, 0, 4],
      },
      small: { fontSize: 7 },
    },
  };

  return createPdf(docDefinition);
}

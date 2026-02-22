import crypto from "crypto";
import { DOMParser } from "xmldom";
import { XMLSignatureService } from "./xml-signature";

const UF_CODE: Record<string, string> = {
  AC: "12",
  AL: "27",
  AM: "13",
  AP: "16",
  BA: "29",
  CE: "23",
  DF: "53",
  ES: "32",
  GO: "52",
  MA: "21",
  MG: "31",
  MS: "50",
  MT: "51",
  PA: "15",
  PB: "25",
  PE: "26",
  PI: "22",
  PR: "41",
  RJ: "33",
  RN: "24",
  RO: "11",
  RR: "14",
  RS: "43",
  SC: "42",
  SE: "28",
  SP: "35",
  TO: "17",
};

const normalizeText = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();

const sanitizeXml = (value?: string | null) =>
  normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const onlyDigits = (value?: string | null) =>
  String(value ?? "").replace(/\D/g, "");

const normalizeNcm = (value?: string | null) => {
  const digits = onlyDigits(value);
  if (digits.length >= 8) return digits.slice(0, 8);
  return digits.padStart(8, "0") || "00000000";
};

const normalizeCfop = (value?: string | null) => {
  const digits = onlyDigits(value);
  if (digits.length >= 4) return digits.slice(0, 4);
  return digits.padStart(4, "0") || "5102";
};

const normalizeCep = (value?: string | null) => {
  const digits = onlyDigits(value);
  if (digits.length >= 8) return digits.slice(0, 8);
  return digits.padStart(8, "0");
};

const normalizeMunicipioCodigo = (value?: string | null) => {
  const digits = onlyDigits(value);
  if (digits.length >= 7) return digits.slice(0, 7);
  return digits.padStart(7, "0");
};

const toNumber = (value: any) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: number, decimals = 2) => value.toFixed(decimals);

const DEFAULT_NFCE_TIMEZONE =
  process.env.NFCE_TZ || "America/Sao_Paulo";

const getTimeZoneOffsetMinutes = (value: Date, timeZone: string) => {
  if (timeZone === "America/Sao_Paulo") return -180;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tzName = formatter
      .formatToParts(value)
      .find((part) => part.type === "timeZoneName")?.value;
    if (tzName) {
      const match = tzName.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
      if (match) {
        const hours = Number(match[1]);
        const minutes = Number(match[2] || "0");
        return hours * 60 + (hours < 0 ? -minutes : minutes);
      }
    }
  } catch {
    // ignore and fall back
  }
  return -value.getTimezoneOffset();
};

export const formatNfceDateTime = (
  value: Date,
  timeZone: string = DEFAULT_NFCE_TIMEZONE,
) => {
  const pad = (num: number) => String(num).padStart(2, "0");
  const offsetMinutes = getTimeZoneOffsetMinutes(value, timeZone);
  // Convert absolute time to the target offset and read via UTC getters
  const localMillis = value.getTime() + offsetMinutes * 60_000;
  const local = new Date(localMillis);
  const year = local.getUTCFullYear();
  const month = pad(local.getUTCMonth() + 1);
  const day = pad(local.getUTCDate());
  const hours = pad(local.getUTCHours());
  const minutes = pad(local.getUTCMinutes());
  const seconds = pad(local.getUTCSeconds());
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
};

const mod11 = (value: string) => {
  let sum = 0;
  let weight = 2;
  for (let i = value.length - 1; i >= 0; i -= 1) {
    sum += Number(value[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const dv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return dv.toString();
};

export const generateNfceKey = (params: {
  uf: string;
  cnpj: string;
  issueDate: Date;
  serie: number;
  number: number;
  tpEmis: string;
}) => {
  const ufCode = UF_CODE[params.uf] || "35";
  const yy = String(params.issueDate.getFullYear()).slice(2);
  const mm = String(params.issueDate.getMonth() + 1).padStart(2, "0");
  const cnpj = params.cnpj.replace(/\D/g, "").padStart(14, "0");
  const model = "65";
  const serie = String(params.serie).padStart(3, "0");
  const number = String(params.number).padStart(9, "0");
  const cNF = crypto.randomInt(0, 99999999).toString().padStart(8, "0");
  const base =
    ufCode + yy + mm + cnpj + model + serie + number + params.tpEmis + cNF;
  const dv = mod11(base);
  return { key: base + dv, cNF };
};

export const mapPaymentCode = (code?: string | null, type?: string | null) => {
  if (code && code.trim()) return code.trim();
  const normalizedType = normalizeText(type).toLowerCase();
  switch (normalizedType) {
    case "pix":
      return "17";
    case "credito":
    case "cartao credito":
    case "cartao de credito":
      return "03";
    case "debito":
    case "cartao debito":
    case "cartao de debito":
      return "04";
    case "dinheiro":
    case "cash":
      return "01";
    case "boleto":
      return "15";
    default:
      return "99";
  }
};

export const buildNfceXml = (params: {
  key: string;
  cNF: string;
  issueDate: Date;
  environment: "homologacao" | "producao";
  serie: number;
  number: number;
  uf: string;
  municipioCodigo: string;
  tpEmis?: string;
  emitente: {
    cnpj: string;
    ie?: string | null;
    nome: string;
    endereco?: {
      logradouro?: string | null;
      numero?: string | null;
      bairro?: string | null;
      municipio?: string | null;
      uf?: string | null;
      cep?: string | null;
    };
  };
  itens: Array<{
    id: number;
    nome: string;
    ean?: string | null;
    ncm?: string | null;
    cfop?: string | null;
    unidade?: string | null;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
  pagamento: { codigo: string; valor: number };
  crt?: string | null;
  dest?: {
    cpfCnpj?: string | null;
    uf?: string | null;
  } | null;
  respTec?: {
    cnpj: string;
    contato: string;
    email: string;
    fone: string;
  } | null;
}) => {
  const dhEmi = formatNfceDateTime(params.issueDate);
  const cUF = UF_CODE[params.uf] || "35";
  const tpAmb = params.environment === "producao" ? "1" : "2";
  const serie = String(params.serie);
  const nNF = String(params.number);
  const totalProdutos = params.itens.reduce(
    (sum, item) => sum + item.valorTotal,
    0,
  );
  const totalTributos = 0;
  const totalNF = totalProdutos;
  const vTrocoValue =
    params.pagamento.valor < totalNF
      ? Math.max(0, totalNF - params.pagamento.valor)
      : 0;
  const crt = params.crt || "1";
  const isSimples = crt === "1" || crt === "2";
  const emitIe = params.emitente.ie?.trim() ? params.emitente.ie : "ISENTO";
  const enderEmit = params.emitente.endereco;
  const emitUf = enderEmit?.uf || params.uf;
  const emitMunicipio = enderEmit?.municipio || "NAO INFORMADO";
  const emitLogradouro = enderEmit?.logradouro || "NAO INFORMADO";
  const emitNumero = enderEmit?.numero || "SN";
  const emitBairro = enderEmit?.bairro || "CENTRO";
  const emitCep = normalizeCep(enderEmit?.cep);
  const municipioCodigo = normalizeMunicipioCodigo(params.municipioCodigo);
  const paisCodigo = "1058";
  const paisNome = "BRASIL";
  const destDigits = onlyDigits(params.dest?.cpfCnpj);
  const destIsCpf = destDigits.length === 11;
  const destIsCnpj = destDigits.length === 14;
  const destUf = normalizeText(params.dest?.uf);
  const idDest =
    (destIsCpf || destIsCnpj) &&
    destUf &&
    emitUf &&
    destUf.toUpperCase() !== emitUf.toUpperCase()
      ? "2"
      : "1";
  const destXml = destIsCpf
    ? `<dest><CPF>${destDigits}</CPF></dest>`
    : destIsCnpj
      ? `<dest><CNPJ>${destDigits}</CNPJ></dest>`
      : "";
  const respTec = params.respTec;
  const respTecXml =
    respTec &&
    respTec.cnpj &&
    respTec.contato &&
    respTec.email &&
    respTec.fone
      ? `<infRespTec><CNPJ>${onlyDigits(respTec.cnpj).padStart(
          14,
          "0",
        )}</CNPJ><xContato>${sanitizeXml(
          respTec.contato,
        )}</xContato><email>${sanitizeXml(
          respTec.email,
        )}</email><fone>${onlyDigits(respTec.fone)}</fone></infRespTec>`
      : "";

  const itensXml = params.itens
    .map((item, idx) => {
      const cfop = normalizeCfop(item.cfop || "5102");
      const ncm = normalizeNcm(item.ncm || "00000000");
      const uCom = item.unidade || "UN";
      const ean = normalizeText(item.ean || "");
      const eanTag = ean ? sanitizeXml(ean) : "SEM GTIN";
      const vUnCom = formatNumber(item.valorUnitario);
      const vProd = formatNumber(item.valorTotal);
      const icmsXml = isSimples
        ? `<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>`
        : `<ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00>`;
      const pisXml = `<PIS><PISNT><CST>07</CST></PISNT></PIS>`;
      const cofinsXml = `<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>`;
      return `<det nItem="${idx + 1}"><prod><cProd>${item.id}</cProd><cEAN>${eanTag}</cEAN><xProd>${sanitizeXml(
        item.nome,
      )}</xProd><NCM>${ncm}</NCM><CFOP>${cfop}</CFOP><uCom>${uCom}</uCom><qCom>${formatNumber(
        item.quantidade,
        4,
      )}</qCom><vUnCom>${vUnCom}</vUnCom><vProd>${vProd}</vProd><cEANTrib>${eanTag}</cEANTrib><uTrib>${uCom}</uTrib><qTrib>${formatNumber(
        item.quantidade,
        4,
      )}</qTrib><vUnTrib>${vUnCom}</vUnTrib><indTot>1</indTot></prod><imposto><ICMS>${icmsXml}</ICMS>${pisXml}${cofinsXml}</imposto></det>`;
    })
    .join("");

  const tpEmis = params.tpEmis || "1";

  const xPagXml =
    params.pagamento.codigo === "99" ? "<xPag>OUTROS</xPag>" : "";

  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${params.key}" versao="4.00"><ide><cUF>${cUF}</cUF><cNF>${params.cNF}</cNF><natOp>Venda</natOp><mod>65</mod><serie>${serie}</serie><nNF>${nNF}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>${idDest}</idDest><cMunFG>${municipioCodigo}</cMunFG><tpImp>4</tpImp><tpEmis>${tpEmis}</tpEmis><cDV>${params.key.slice(-1)}</cDV><tpAmb>${tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><indIntermed>0</indIntermed><procEmi>0</procEmi><verProc>1.0.0</verProc></ide><emit><CNPJ>${onlyDigits(
    params.emitente.cnpj,
  ).padStart(14, "0")}</CNPJ><xNome>${sanitizeXml(
    params.emitente.nome,
  )}</xNome><enderEmit><xLgr>${sanitizeXml(
    emitLogradouro,
  )}</xLgr><nro>${sanitizeXml(emitNumero)}</nro><xBairro>${sanitizeXml(
    emitBairro,
  )}</xBairro><cMun>${municipioCodigo}</cMun><xMun>${sanitizeXml(
    emitMunicipio,
  )}</xMun><UF>${sanitizeXml(emitUf)}</UF><CEP>${sanitizeXml(
    emitCep,
  )}</CEP><cPais>${paisCodigo}</cPais><xPais>${paisNome}</xPais></enderEmit><IE>${sanitizeXml(
    emitIe,
  )}</IE><CRT>${crt}</CRT></emit>${destXml}${itensXml}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${formatNumber(
    totalProdutos,
  )}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${formatNumber(
    totalNF,
  )}</vNF><vTotTrib>${formatNumber(
    totalTributos,
  )}</vTotTrib></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><tPag>${
    params.pagamento.codigo
  }</tPag>${xPagXml}<vPag>${formatNumber(
    params.pagamento.valor,
  )}</vPag></detPag>${
    vTrocoValue > 0 ? `<vTroco>${formatNumber(vTrocoValue)}</vTroco>` : ""
  }</pag>${respTecXml}</infNFe></NFe>`;
};

const elementChildren = (node: Element) =>
  Array.from(node.childNodes).filter(
    (child) => child.nodeType === 1,
  ) as Element[];

const byLocalName = (node: Element, name: string) =>
  elementChildren(node).find((child) => child.localName === name) || null;

const hasLocalName = (node: Element, name: string) =>
  elementChildren(node).some((child) => child.localName === name);

export const validateNfceXmlStructure = (
  xml: string,
  options?: { requireSignature?: boolean },
) => {
  const requireSignature = options?.requireSignature ?? false;
  const parser = new DOMParser({
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  });
  const doc = parser.parseFromString(xml, "text/xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "NFe") {
    return { ok: false, error: "XML sem raiz <NFe>", details: {} };
  }
  if (root.namespaceURI !== "http://www.portalfiscal.inf.br/nfe") {
    return {
      ok: false,
      error: "Namespace invalido em <NFe>",
      details: { namespace: root.namespaceURI },
    };
  }

  const nfeChildren = elementChildren(root).map((node) => node.localName);
  const infNFeIndex = nfeChildren.indexOf("infNFe");
  if (infNFeIndex === -1) {
    return {
      ok: false,
      error: "XML sem <infNFe>",
      details: { nfeChildren },
    };
  }
  const selfClosingRegex = /<[^>]+\/>/g;
  const infNFeMatch = xml.match(/<infNFe\b[\s\S]*<\/infNFe>/);
  if (infNFeMatch && selfClosingRegex.test(infNFeMatch[0])) {
    return {
      ok: false,
      error: "Tag auto-fechada detectada em <infNFe>",
      details: { snippet: infNFeMatch[0].match(selfClosingRegex)?.[0] },
    };
  }
  const suplMatch = xml.match(/<infNFeSupl\b[\s\S]*<\/infNFeSupl>/);
  if (suplMatch && selfClosingRegex.test(suplMatch[0])) {
    return {
      ok: false,
      error: "Tag auto-fechada detectada em <infNFeSupl>",
      details: { snippet: suplMatch[0].match(selfClosingRegex)?.[0] },
    };
  }
  const suplIndex = nfeChildren.indexOf("infNFeSupl");
  const sigIndex = nfeChildren.indexOf("Signature");
  if (requireSignature && sigIndex === -1) {
    return {
      ok: false,
      error: "<Signature> ausente",
      details: { nfeChildren },
    };
  }
  if (suplIndex !== -1) {
    const expectedSuplIndex = infNFeIndex + 1;
    if (suplIndex !== expectedSuplIndex) {
      return {
        ok: false,
        error: "<infNFeSupl> deve estar imediatamente apos <infNFe>",
        details: { nfeChildren },
      };
    }
  }
  if (sigIndex !== -1) {
    const expectedSigIndex =
      suplIndex !== -1 ? suplIndex + 1 : infNFeIndex + 1;
    if (sigIndex !== expectedSigIndex) {
      return {
        ok: false,
        error:
          suplIndex !== -1
            ? "<Signature> deve vir imediatamente apos <infNFeSupl>"
            : "<Signature> deve vir imediatamente apos <infNFe>",
        details: { nfeChildren },
      };
    }
  }

  const infNFe = elementChildren(root)[infNFeIndex];
  const infChildren = elementChildren(infNFe).map((node) => node.localName);
  const requiredOrder = ["ide", "emit", "det", "total", "transp", "pag"];
  for (const tag of requiredOrder) {
    if (!infChildren.includes(tag)) {
      return {
        ok: false,
        error: `Tag <${tag}> obrigatoria ausente`,
        details: { infNFeChildren: infChildren, requiredOrder },
      };
    }
  }
  const ideIndex = infChildren.indexOf("ide");
  const emitIndex = infChildren.indexOf("emit");
  const destIndex = infChildren.indexOf("dest");
  const detIndex = infChildren.indexOf("det");
  const totalIndex = infChildren.indexOf("total");
  const transpIndex = infChildren.indexOf("transp");
  const pagIndex = infChildren.indexOf("pag");
  const respTecIndex = infChildren.indexOf("infRespTec");
  const destOrderOk =
    destIndex === -1 || (emitIndex < destIndex && destIndex < detIndex);
  const respTecOrderOk =
    respTecIndex === -1 || (pagIndex !== -1 && pagIndex < respTecIndex);
  if (
    !(
      ideIndex < emitIndex &&
      destOrderOk &&
      emitIndex < detIndex &&
      detIndex < totalIndex &&
      totalIndex < transpIndex &&
      transpIndex < pagIndex &&
      respTecOrderOk
    )
  ) {
    return {
      ok: false,
      error: "Ordem incorreta em <infNFe> (ide/emit/det/total/transp/pag)",
      details: { infNFeChildren: infChildren, requiredOrder },
    };
  }

  if (
    ["cobr", "dup", "vol", "retTransp"].some((tag) => infChildren.includes(tag))
  ) {
    return {
      ok: false,
      error: "Tags proibidas na NFC-e dentro de <infNFe>",
      details: { infNFeChildren: infChildren },
    };
  }

  const ide = byLocalName(infNFe, "ide");
  if (ide) {
    const mod = byLocalName(ide, "mod");
    if (!mod || mod.textContent?.trim() !== "65") {
      return {
        ok: false,
        error: "Modelo fiscal invalido (mod != 65)",
        details: { mod: mod?.textContent?.trim() },
      };
    }
  }

  const emit = byLocalName(infNFe, "emit");
  if (emit) {
    const emitChildren = elementChildren(emit).map((node) => node.localName);
    const enderIdx = emitChildren.indexOf("enderEmit");
    const ieIdx = emitChildren.indexOf("IE");
    const crtIdx = emitChildren.indexOf("CRT");
    if (enderIdx === -1 || ieIdx === -1 || crtIdx === -1) {
      return {
        ok: false,
        error: "<emit> sem enderEmit/IE/CRT",
        details: { emitChildren },
      };
    }
    if (!(enderIdx < ieIdx && ieIdx < crtIdx)) {
      return {
        ok: false,
        error: "Ordem incorreta em <emit> (enderEmit -> IE -> CRT)",
        details: { emitChildren },
      };
    }
  }

  if (suplIndex !== -1) {
    const supl = elementChildren(root)[suplIndex];
    if (supl.namespaceURI !== "http://www.portalfiscal.inf.br/nfe") {
      return {
        ok: false,
        error: "Namespace invalido em <infNFeSupl>",
        details: { namespace: supl.namespaceURI },
      };
    }
    const suplChildren = elementChildren(supl).map((node) => node.localName);
    if (suplChildren.join(",") !== "qrCode,urlChave") {
      return {
        ok: false,
        error: "Ordem invalida em <infNFeSupl> (qrCode -> urlChave)",
        details: { suplChildren },
      };
    }
    const qrNode = elementChildren(supl).find(
      (node) => node.localName === "qrCode",
    );
    const qrText = qrNode?.textContent || "";
    if (!qrText.trim()) {
      return {
        ok: false,
        error: "qrCode invalido (vazio)",
        details: { qrCode: qrText },
      };
    }
    if (qrText.trim() !== qrText) {
      return {
        ok: false,
        error: "QR Code contem whitespace externo",
        details: { qrCode: qrText },
      };
    }
    const urlNode = elementChildren(supl).find(
      (node) => node.localName === "urlChave",
    );
    const urlText = urlNode?.textContent || "";
    if (!urlText.trim()) {
      return {
        ok: false,
        error: "urlChave invalido (vazio)",
        details: { urlChave: urlText },
      };
    }
  }

  if (requireSignature && sigIndex !== -1) {
    const sigNode = elementChildren(root)[sigIndex];
    const algoNode = elementChildren(sigNode).find(
      (node) => node.localName === "SignedInfo",
    );
    const sigMethod =
      algoNode &&
      elementChildren(algoNode).find(
        (node) => node.localName === "SignatureMethod",
      );
    const algo = sigMethod?.getAttribute("Algorithm") || "";
    if (algo && !algo.includes("rsa-sha1")) {
      return {
        ok: false,
        error: "Algoritmo de assinatura invalido (esperado SHA1)",
        details: { algorithm: algo },
      };
    }
  }

  return { ok: true, details: { nfeChildren, infNFeChildren: infChildren } };
};

export const signNfceXml = (
  xml: string,
  certificateBase64: string,
  certificatePassword: string,
  key: string,
) => {
  return XMLSignatureService.signXML(
    xml,
    certificateBase64,
    certificatePassword,
    `NFe${key}`,
  );
};

export const buildNfceQrUrl = (params: {
  sefazUrl: string;
  uf?: string;
  chave: string;
  versaoQr: string;
  tpAmb: string;
  tpEmis: string;
  dhEmi?: string;
  vNF?: string;
  digVal?: string;
  cDest?: string;
  cscId: string;
  csc: string;
}) => {
  const cscIdRaw = onlyDigits(params.cscId);
  const cscId = cscIdRaw.replace(/^0+/, "") || "0";
  const cscNormalized = String(params.csc || "").trim().replace(/\s+/g, "");
  const isMg =
    params.uf?.toUpperCase() === "MG" ||
    params.sefazUrl.toLowerCase().includes("fazenda.mg.gov.br");
  if (isMg) {
    const versaoQr = onlyDigits(params.versaoQr || "2") || "2";
    // Schema NFC-e v4.00 (QR v2 online) nao aceita cIdToken com zeros a esquerda
    // no payload p=... (exceto "0"). Ex.: use "1", nao "000001".
    const qrFields = [params.chave, versaoQr, params.tpAmb, cscId];
    const qrConcat = qrFields.join("|");
    const hash = crypto
      .createHash("sha1")
      .update(qrConcat + cscNormalized)
      .digest("hex");
    const payload = [...qrFields, hash].join("|");
    return `${params.sefazUrl.trim()}?p=${payload}`.trim();
  }

  const base = [params.chave, params.versaoQr, params.tpAmb];
  const payload =
    params.tpEmis === "9"
      ? [
          ...base,
          params.dhEmi ? params.dhEmi.slice(8, 10) : "",
          params.vNF ?? "0.00",
          params.digVal ?? "",
          cscId,
        ].join("|")
      : [...base, cscId].join("|");
  const hash = crypto
    .createHash("sha256")
    .update(`${payload}${params.csc}`)
    .digest("hex");
  return `${params.sefazUrl.trim()}?p=${payload}|${hash}`.trim();
};

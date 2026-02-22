import path from "path";
import { createRequire } from "module";
import { getSefazDefaults } from "@shared/sefaz-defaults";

type SefazEnvironment = "homologacao" | "producao";

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));

type NfcePortalUrls = {
  qrCodeBase: string;
  urlChave: string;
};

type NfceWsEndpoints = {
  NFeAutorizacao: string;
  NFeRetAutorizacao: string;
  NFeStatusServico: string;
  NFeRecepcaoEvento: string;
  NFeConsultaProtocolo: string;
  NFeInutilizacao?: string;
};

const NFCE_PORTAL_URLS_BY_UF: Record<
  string,
  Partial<Record<SefazEnvironment, NfcePortalUrls>>
> = {
  MG: {
    homologacao: {
      qrCodeBase: "https://hportalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
      urlChave: "https://hportalsped.fazenda.mg.gov.br/portalnfce",
    },
    producao: {
      qrCodeBase: "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
      urlChave: "https://portalsped.fazenda.mg.gov.br/portalnfce",
    },
  },
};

const NFCE_WS_ENDPOINTS_BY_UF: Record<
  string,
  Partial<Record<SefazEnvironment, NfceWsEndpoints>>
> = {
  MG: {
    homologacao: {
      NFeAutorizacao: "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4",
      NFeRetAutorizacao:
        "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4",
      NFeStatusServico:
        "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4",
      NFeRecepcaoEvento:
        "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4",
      NFeConsultaProtocolo:
        "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4",
      NFeInutilizacao:
        "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeInutilizacao4",
    },
    producao: {
      NFeAutorizacao: "https://nfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4",
      NFeRetAutorizacao:
        "https://nfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4",
      NFeStatusServico:
        "https://nfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4",
      NFeRecepcaoEvento:
        "https://nfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4",
      NFeConsultaProtocolo:
        "https://nfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4",
      NFeInutilizacao:
        "https://nfce.fazenda.mg.gov.br/nfce/services/NFeInutilizacao4",
    },
  },
};

const normalizeUf = (uf?: string | null) => String(uf || "").trim().toUpperCase();

export const resolveNfcePortalUrls = (params: {
  uf: string;
  environment: SefazEnvironment;
  configuredQrCodeBase?: string | null;
}): NfcePortalUrls => {
  const uf = normalizeUf(params.uf);
  const predefined = NFCE_PORTAL_URLS_BY_UF[uf]?.[params.environment];
  if (predefined) return predefined;

  const defaults = getSefazDefaults(uf || "SP");
  const defaultQr =
    params.environment === "producao"
      ? defaults.sefazQrCodeUrlProducao
      : defaults.sefazQrCodeUrlHomologacao;
  const configured = String(params.configuredQrCodeBase || "").trim();
  const qrCodeBase = configured || String(defaultQr || "").trim();

  // Fallback conservador: usa o mesmo endpoint visivel de QR Code como urlChave
  // quando o portal da UF nao estiver mapeado explicitamente.
  return {
    qrCodeBase,
    urlChave: qrCodeBase,
  };
};

export const resolveSefazEventEndpoints = (uf: string, versao: string): any => {
  try {
    const mod = requireFromRoot("node-sped-nfe/dist/utils/eventos.js");
    return typeof mod?.urlEventos === "function"
      ? mod.urlEventos(uf, versao)
      : null;
  } catch {
    try {
      const mod = requireFromRoot("node-sped-nfe/dist/utils/eventos");
      return typeof mod?.urlEventos === "function"
        ? mod.urlEventos(uf, versao)
        : null;
    } catch {
      return null;
    }
  }
};

export const resolveNfceWsEndpoints = (
  uf: string,
  environment: SefazEnvironment,
): NfceWsEndpoints | null => {
  const normalizedUf = normalizeUf(uf);
  return NFCE_WS_ENDPOINTS_BY_UF[normalizedUf]?.[environment] || null;
};

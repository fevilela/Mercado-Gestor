import { storage } from "./storage";
import { getFiscalCertificateStatus } from "./fiscal-certificate";
import { getSefazDefaults } from "@shared/sefaz-defaults";

type ReadinessEnvironment = "homologacao" | "producao";

type ReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  details?: string;
};

export type FiscalReadiness = {
  ready: boolean;
  environment: ReadinessEnvironment;
  checks: ReadinessCheck[];
  missing: string[];
  messages: string[];
};

const hasValue = (value: unknown) => String(value ?? "").trim().length > 0;
const onlyDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export async function getFiscalReadiness(
  companyId: number,
): Promise<FiscalReadiness> {
  const [settings, company, fiscalConfig, certStatus] = await Promise.all([
    storage.getCompanySettings(companyId),
    storage.getCompanyById(companyId),
    storage.getFiscalConfig(companyId),
    getFiscalCertificateStatus(companyId),
  ]);

  const environment: ReadinessEnvironment =
    settings?.fiscalEnvironment === "producao" ? "producao" : "homologacao";
  const uf = String(settings?.sefazUf || company?.state || "").toUpperCase();
  const defaults = getSefazDefaults(uf || "SP");
  const resolvedSefazUrl =
    environment === "producao"
      ? settings?.sefazUrlProducao || defaults.sefazUrlProducao
      : settings?.sefazUrlHomologacao || defaults.sefazUrlHomologacao;
  const resolvedQrCodeUrl =
    environment === "producao"
      ? settings?.sefazQrCodeUrlProducao || defaults.sefazQrCodeUrlProducao
      : settings?.sefazQrCodeUrlHomologacao ||
        defaults.sefazQrCodeUrlHomologacao;
  const cnpj = onlyDigits(company?.cnpj || settings?.cnpj);
  const municipioCodigo = onlyDigits(settings?.sefazMunicipioCodigo);

  const checks: ReadinessCheck[] = [
    {
      key: "fiscalEnabled",
      label: "Emissao fiscal ativa",
      ok: Boolean(settings?.fiscalEnabled),
      details: "Ative em Configuracoes > Fiscal.",
    },
    {
      key: "nfceEnabled",
      label: "NFC-e habilitada",
      ok: Boolean(settings?.nfceEnabled),
      details: "Ative NFC-e para emissao automatica no PDV.",
    },
    {
      key: "cnpj",
      label: "CNPJ da empresa",
      ok: cnpj.length === 14,
      details: "Informe um CNPJ valido da empresa emissora.",
    },
    {
      key: "sefazUf",
      label: "UF SEFAZ",
      ok: uf.length === 2,
      details: "Configure a UF de emissao (ex: MG, SP).",
    },
    {
      key: "sefazMunicipioCodigo",
      label: "Codigo do municipio (IBGE)",
      ok: municipioCodigo.length === 7,
      details: "Configure o codigo IBGE de 7 digitos.",
    },
    {
      key: "cscId",
      label: "ID CSC NFC-e",
      ok: hasValue(settings?.cscId),
      details: "Configure o ID do token CSC.",
    },
    {
      key: "cscToken",
      label: "Token CSC NFC-e",
      ok: hasValue(settings?.cscToken),
      details: "Configure o token CSC da UF.",
    },
    {
      key: "sefazUrl",
      label: "URL SEFAZ",
      ok: hasValue(resolvedSefazUrl),
      details: "Configure URL de autorizacao da SEFAZ.",
    },
    {
      key: "qrCodeUrl",
      label: "URL QR Code",
      ok: hasValue(resolvedQrCodeUrl),
      details: "Configure URL de consulta QR Code da UF.",
    },
    {
      key: "certificate",
      label: "Certificado digital valido",
      ok: certStatus.isValid,
      details: certStatus.message,
    },
  ];

  if (environment === "producao") {
    checks.push(
      {
        key: "respTecCnpj",
        label: "Responsavel tecnico CNPJ",
        ok: onlyDigits(fiscalConfig?.respTecCnpj).length === 14,
        details: "Informe CNPJ do responsavel tecnico.",
      },
      {
        key: "respTecContato",
        label: "Responsavel tecnico contato",
        ok: hasValue(fiscalConfig?.respTecContato),
        details: "Informe nome do contato tecnico.",
      },
      {
        key: "respTecEmail",
        label: "Responsavel tecnico email",
        ok: hasValue(fiscalConfig?.respTecEmail),
        details: "Informe email do contato tecnico.",
      },
      {
        key: "respTecFone",
        label: "Responsavel tecnico telefone",
        ok: onlyDigits(fiscalConfig?.respTecFone).length >= 10,
        details: "Informe telefone com DDD do contato tecnico.",
      },
    );
  }

  const missingChecks = checks.filter((check) => !check.ok);

  return {
    ready: missingChecks.length === 0,
    environment,
    checks,
    missing: missingChecks.map((check) => check.key),
    messages: missingChecks.map(
      (check) => `${check.label}: ${check.details || "Nao configurado."}`,
    ),
  };
}

import fs from "fs";
import https from "https";
import path from "path";

const CACHE_PATH = path.join(
  process.cwd(),
  "server",
  "data",
  "ibge-municipios.json",
);
const CACHE_TTL_DAYS = Number(process.env.IBGE_CACHE_DAYS || "30");
const AUTO_UPDATE = process.env.IBGE_AUTO_UPDATE !== "false";

type IbgeCache = Record<string, Record<string, string>>;

let cache: IbgeCache | null = null;
let cacheLoadedAt = 0;
const lastFetchByUf = new Map<string, number>();

export const normalizeCityName = (value?: string | null) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const isCacheFresh = (mtimeMs: number) => {
  const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - mtimeMs < ttlMs;
};

const readCacheFromDisk = async () => {
  if (!fs.existsSync(CACHE_PATH)) return null;
  const stat = await fs.promises.stat(CACHE_PATH);
  const raw = await fs.promises.readFile(CACHE_PATH, "utf8");
  const parsed = JSON.parse(raw) as IbgeCache;
  return { parsed, mtimeMs: stat.mtimeMs };
};

const writeCacheToDisk = async (data: IbgeCache) => {
  await fs.promises.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.promises.writeFile(
    CACHE_PATH,
    JSON.stringify(data, null, 2),
    "utf8",
  );
};

const fetchJson = async (url: string) =>
  new Promise<any>((resolve, reject) => {
    https
      .get(url, (res) => {
        if (!res.statusCode || res.statusCode >= 400) {
          return reject(new Error(`IBGE HTTP ${res.statusCode}`));
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });

const fetchUfMunicipios = async (uf: string) => {
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`;
  const data = (await fetchJson(url)) as Array<{
    id: number;
    nome: string;
  }>;
  const byCity: Record<string, string> = {};
  for (const item of data) {
    const city = normalizeCityName(item.nome);
    byCity[city] = String(item.id).padStart(7, "0");
  }
  return byCity;
};

const loadCache = async () => {
  if (cache && Date.now() - cacheLoadedAt < 60 * 1000) return cache;
  const disk = await readCacheFromDisk();
  if (disk) {
    cache = disk.parsed;
    cacheLoadedAt = Date.now();
    if (isCacheFresh(disk.mtimeMs) || !AUTO_UPDATE) {
      return cache;
    }
  }
  return cache;
};

export const getIbgeMunicipioCode = async (
  uf: string,
  city: string | null | undefined,
) => {
  const ufKey = String(uf || "").toUpperCase();
  const cityKey = normalizeCityName(city);
  await loadCache();
  if (cache?.[ufKey]?.[cityKey]) return cache[ufKey][cityKey];
  if (!AUTO_UPDATE || !ufKey || !cityKey) return null;
  const lastFetch = lastFetchByUf.get(ufKey) || 0;
  if (Date.now() - lastFetch < 10 * 60 * 1000) {
    return cache?.[ufKey]?.[cityKey] ?? null;
  }
  lastFetchByUf.set(ufKey, Date.now());
  try {
    const byCity = await fetchUfMunicipios(ufKey);
    const next = { ...(cache || {}) };
    next[ufKey] = { ...(next[ufKey] || {}), ...byCity };
    cache = next;
    cacheLoadedAt = Date.now();
    await writeCacheToDisk(next);
    return next[ufKey][cityKey] ?? null;
  } catch {
    return cache?.[ufKey]?.[cityKey] ?? null;
  }
};

const ALL_UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

export const refreshIbgeUf = async (uf: string) => {
  const ufKey = String(uf || "").toUpperCase();
  if (!ufKey) return null;
  const byCity = await fetchUfMunicipios(ufKey);
  const next = { ...(cache || {}) };
  next[ufKey] = { ...(next[ufKey] || {}), ...byCity };
  cache = next;
  cacheLoadedAt = Date.now();
  await writeCacheToDisk(next);
  return Object.keys(byCity).length;
};

export const refreshIbgeAll = async () => {
  let total = 0;
  for (const uf of ALL_UFS) {
    total += (await refreshIbgeUf(uf)) ?? 0;
  }
  return total;
};

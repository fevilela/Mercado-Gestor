import * as fs from "fs";
import * as path from "path";

interface ContingencyNFCe {
  id: string;
  xml: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

type ResendHandler = (item: ContingencyNFCe) => Promise<void>;

const STORE_PATH = path.join(__dirname, "..", "data", "nfce-contingency.json");

function ensureStoreFolder() {
  const folder = path.dirname(STORE_PATH);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

function loadQueue(): ContingencyNFCe[] {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as ContingencyNFCe[];
  } catch (error) {
    console.error("Erro ao carregar fila NFC-e contingencia:", error);
    return [];
  }
}

function saveQueue(queue: ContingencyNFCe[]) {
  ensureStoreFolder();
  fs.writeFileSync(STORE_PATH, JSON.stringify(queue, null, 2), "utf-8");
}

export class NFCeContingencyService {
  private queue: ContingencyNFCe[] = [];
  private resendHandler?: ResendHandler;
  private timer?: NodeJS.Timeout;
  private intervalMs: number;

  constructor(intervalMs: number = 30_000) {
    this.intervalMs = intervalMs;
    this.queue = loadQueue();
  }

  setResendHandler(handler: ResendHandler) {
    this.resendHandler = handler;
  }

  enqueue(xml: string) {
    const item: ContingencyNFCe = {
      id: `nfce-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      xml,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    this.queue.push(item);
    saveQueue(this.queue);
    return item;
  }

  listPending() {
    return this.queue;
  }

  async resendAll() {
    if (!this.resendHandler) return;

    for (const item of [...this.queue]) {
      try {
        await this.resendHandler(item);
        this.queue = this.queue.filter((q) => q.id !== item.id);
        saveQueue(this.queue);
      } catch (error) {
        item.attempts += 1;
        item.lastError =
          error instanceof Error ? error.message : String(error ?? "erro");
        saveQueue(this.queue);
      }
    }
  }

  startAutoResend() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (!this.resendHandler) return;
      this.resendAll().catch((err) =>
        console.error("Auto-resend NFC-e contingencia:", err)
      );
    }, this.intervalMs);
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { toDataURL } from 'qrcode';

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'waiting-for-scan' | 'connected';

/** Baileys is an ES module; the server is CommonJS, so it is loaded with a real dynamic import. */
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importEsm = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

/** Digits only, with India's 91 in front of a 10-digit number: "98765 43210" -> "919876543210". */
export function whatsappDigits(phone: string) {
  const d = phone.replace(/\D/g, '').replace(/^0+/, '');
  return d.length === 10 ? `91${d}` : d;
}

/**
 * Sends WhatsApp messages from KeyGo's own WhatsApp number using Baileys (WhatsApp Web).
 *
 * An Owner or Admin links the number once by scanning a QR code in System → WhatsApp & SMS, like adding a
 * device in WhatsApp → Linked devices. The login is kept in FILE_STORAGE_DIR/whatsapp, so it survives restarts.
 */
@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('WhatsApp');
  private readonly authDir: string;
  private sock: any = null;
  private status: WhatsAppStatus = 'disconnected';
  private qr: string | null = null;
  private phone: string | null = null;
  private lastError: string | null = null;
  private stopping = false;

  constructor(config: ConfigService) {
    this.authDir = join(resolve(config.get<string>('FILE_STORAGE_DIR') || './storage'), 'whatsapp');
  }

  /** Reconnect on start when a number was linked before. */
  async onModuleInit() {
    if (existsSync(join(this.authDir, 'creds.json'))) void this.connect().catch((e) => this.log.warn(`Could not reconnect: ${(e as Error).message}`));
  }

  async onModuleDestroy() {
    this.stopping = true;
    try {
      this.sock?.end?.(undefined);
    } catch {
      // closing anyway
    }
  }

  async state() {
    return {
      status: this.status,
      phone: this.phone,
      qr: this.status === 'waiting-for-scan' && this.qr ? await toDataURL(this.qr, { margin: 1, width: 280 }) : null,
      error: this.lastError,
    };
  }

  /** Starts a session: shows a QR code to scan, or reconnects with the saved login. */
  async connect() {
    if (this.status === 'connected' || this.status === 'connecting' || this.status === 'waiting-for-scan') return this.state();
    this.stopping = false;
    this.status = 'connecting';
    this.lastError = null;
    mkdirSync(this.authDir, { recursive: true });

    const baileys = await importEsm('baileys');
    const makeWASocket = baileys.default ?? baileys.makeWASocket;
    const { state, saveCreds } = await baileys.useMultiFileAuthState(this.authDir);
    let version: number[] | undefined;
    try {
      version = (await baileys.fetchLatestBaileysVersion()).version;
    } catch {
      version = undefined;
    }
    const silent = { level: 'silent', child: () => silent, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} };

    const sock = makeWASocket({
      auth: state,
      version,
      browser: baileys.Browsers.ubuntu('KeyGo'),
      logger: silent,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    this.sock = sock;
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u: { connection?: string; qr?: string; lastDisconnect?: { error?: { output?: { statusCode?: number }; message?: string } } }) => {
      if (u.qr) {
        this.qr = u.qr;
        this.status = 'waiting-for-scan';
      }
      if (u.connection === 'open') {
        this.status = 'connected';
        this.qr = null;
        this.phone = String(sock.user?.id ?? '').split(':')[0].split('@')[0] || null;
        this.log.log(`Linked as ${this.phone}`);
      }
      if (u.connection === 'close') {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === baileys.DisconnectReason.loggedOut;
        this.sock = null;
        this.status = 'disconnected';
        this.qr = null;
        if (loggedOut) {
          // Unlinked from the phone: forget the login so the next connect shows a fresh QR code
          rmSync(this.authDir, { recursive: true, force: true });
          this.phone = null;
          this.lastError = 'WhatsApp was unlinked from the phone. Connect again to scan a new QR code.';
        } else if (!this.stopping) {
          this.lastError = u.lastDisconnect?.error?.message ?? null;
          setTimeout(() => void this.connect().catch(() => undefined), 3000);
        }
      }
    });
    return this.state();
  }

  /** Unlinks KeyGo's WhatsApp number and forgets the login. */
  async disconnect() {
    this.stopping = true;
    try {
      await this.sock?.logout?.();
    } catch {
      // already gone
    }
    this.sock = null;
    this.status = 'disconnected';
    this.qr = null;
    this.phone = null;
    rmSync(this.authDir, { recursive: true, force: true });
    return this.state();
  }

  get connected() {
    return this.status === 'connected' && !!this.sock;
  }

  /** Sends a text message. Throws a clear error when WhatsApp is not linked or the number has no WhatsApp. */
  async sendText(phone: string, text: string) {
    if (!this.connected) throw new ServiceUnavailableException('KeyGo’s WhatsApp is not connected. Connect it in System → WhatsApp & SMS.');
    const digits = whatsappDigits(phone);
    if (digits.length < 10) throw new ServiceUnavailableException('Enter a valid WhatsApp number.');
    const [found] = (await this.sock.onWhatsApp(digits)) ?? [];
    if (!found?.exists) throw new ServiceUnavailableException(`+${digits} is not on WhatsApp.`);
    await this.sock.sendMessage(found.jid, { text });
    return { to: `+${digits}` };
  }
}

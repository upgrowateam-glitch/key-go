import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GpsPosition {
  /** The device identifier as set in Traccar (and on the car as "GPS device ID"). */
  deviceId: string;
  name: string;
  /** online / offline / unknown, as Traccar reports it. */
  status: string;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  /** When the device last reported (ISO time). */
  at: string | null;
  ignition: boolean | null;
}

const KNOTS_TO_KMH = 1.852;

/**
 * Reads live car locations from Traccar (the GPS tracking server KeyGo runs next to the API).
 * Phones with the Traccar Client app and GPS devices send their location to Traccar; KeyGo matches a device to a
 * car through the car's "GPS device ID". Settings: TRACCAR_URL, TRACCAR_EMAIL, TRACCAR_PASSWORD.
 */
@Injectable()
export class TraccarService {
  private readonly log = new Logger('Traccar');
  private readonly url: string;
  private readonly auth: string;
  private cache: { at: number; positions: GpsPosition[] } | null = null;

  constructor(config: ConfigService) {
    this.url = (config.get<string>('TRACCAR_URL') ?? '').replace(/\/$/, '');
    const email = config.get<string>('TRACCAR_EMAIL') ?? '';
    const password = config.get<string>('TRACCAR_PASSWORD') ?? '';
    this.auth = email && password ? `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}` : '';
  }

  get configured() {
    return !!this.url && !!this.auth;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.url}${path}`, { headers: { Authorization: this.auth, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (res.status === 401) throw new Error('Traccar refused the sign-in. Check TRACCAR_EMAIL and TRACCAR_PASSWORD.');
    if (!res.ok) throw new Error(`Traccar answered ${res.status}.`);
    return (await res.json()) as T;
  }

  /** Latest position of every device, cached for 10 seconds so many screens do not flood Traccar. */
  async positions(): Promise<GpsPosition[]> {
    if (!this.configured) return [];
    if (this.cache && Date.now() - this.cache.at < 10_000) return this.cache.positions;
    try {
      const [devices, fixes] = await Promise.all([
        this.get<{ id: number; uniqueId: string; name: string; status: string; positionId?: number; lastUpdate?: string }[]>('/api/devices'),
        this.get<{ deviceId: number; latitude: number; longitude: number; speed: number; fixTime: string; attributes?: Record<string, unknown> }[]>('/api/positions'),
      ]);
      const byDevice = new Map(fixes.map((p) => [p.deviceId, p]));
      const positions = devices.map((d) => {
        const p = byDevice.get(d.id);
        return {
          deviceId: d.uniqueId,
          name: d.name,
          status: d.status ?? 'unknown',
          lat: p?.latitude ?? null,
          lng: p?.longitude ?? null,
          speedKmh: p ? Math.round(p.speed * KNOTS_TO_KMH) : null,
          at: p?.fixTime ?? d.lastUpdate ?? null,
          ignition: typeof p?.attributes?.ignition === 'boolean' ? (p.attributes.ignition as boolean) : null,
        };
      });
      this.cache = { at: Date.now(), positions };
      return positions;
    } catch (e) {
      this.log.warn(`Could not read positions: ${(e as Error).message}`);
      throw e;
    }
  }
}

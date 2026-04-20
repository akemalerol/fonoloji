import { execSync } from 'node:child_process';
import os from 'node:os';
import { statSync } from 'node:fs';
import { getDb } from '../db/index.js';

// Sunucu sağlık metrikleri — Admin > Analitik > Sistem kartları için.
// Ağır iş yok, senkron OS çağrıları (~1 ms).

interface DiskInfo {
  totalGb: number;
  usedGb: number;
  availGb: number;
  percent: number;
}

function getDiskInfo(path = '/'): DiskInfo | null {
  try {
    // df -P: POSIX çıktı, tutarlı parse
    const out = execSync(`df -Pk "${path}"`, { encoding: 'utf-8', timeout: 2000 });
    const lines = out.trim().split('\n');
    const row = lines[lines.length - 1];
    if (!row) return null;
    // Filesystem 1024-blocks Used Available Capacity Mounted on
    const cols = row.trim().split(/\s+/);
    const totalKb = Number(cols[1]);
    const usedKb = Number(cols[2]);
    const availKb = Number(cols[3]);
    if (!Number.isFinite(totalKb) || !Number.isFinite(usedKb)) return null;
    return {
      totalGb: Math.round((totalKb / 1024 / 1024) * 10) / 10,
      usedGb: Math.round((usedKb / 1024 / 1024) * 10) / 10,
      availGb: Math.round((availKb / 1024 / 1024) * 10) / 10,
      percent: Math.round((usedKb / totalKb) * 100),
    };
  } catch {
    return null;
  }
}

function cpuUsagePercent(): number {
  // Load average 1m'yi çekirdek sayısına böl → yaklaşık instant CPU kullanımı.
  // Tam anlık değil ama 1 dk ortalaması gösterir. /proc/stat parse ederek gerçek instant
  // alınabilirdi ama iki snapshot arasında interval gerekir. Load-avg pragmatic.
  const load1m = os.loadavg()[0] ?? 0;
  const cores = os.cpus().length || 1;
  return Math.min(100, Math.round((load1m / cores) * 100));
}

function getDbStats(): { sizeMb: number; ok: boolean; ms: number } {
  const start = Date.now();
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    const ms = Date.now() - start;
    let sizeMb = 0;
    try {
      const dbPath = (db.name as string) || '';
      if (dbPath) {
        const stat = statSync(dbPath);
        sizeMb = Math.round((stat.size / 1024 / 1024) * 10) / 10;
      }
    } catch {
      /* ignore */
    }
    return { ok: true, ms, sizeMb };
  } catch {
    return { ok: false, ms: Date.now() - start, sizeMb: 0 };
  }
}

function getVpnStatus(): { connected: boolean; endpoint?: string } {
  try {
    const out = execSync('ipsec status 2>/dev/null', { encoding: 'utf-8', timeout: 1500 });
    const connected = /ESTABLISHED/.test(out);
    const endpoint = out.match(/\]\.\.\.([\w.\-]+)/)?.[1] ?? undefined;
    return { connected, endpoint };
  } catch {
    return { connected: false };
  }
}

function getPublicIp(): string | null {
  // Sunucu bağlantı IP'si — public egress IP. Eager cache'li.
  if (cachedPublicIp && Date.now() - cachedPublicIpAt < 5 * 60_000) return cachedPublicIp;
  try {
    const ip = execSync('curl -s --max-time 3 https://ipinfo.io/ip', { encoding: 'utf-8' }).trim();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      cachedPublicIp = ip;
      cachedPublicIpAt = Date.now();
      return ip;
    }
  } catch {
    /* ignore */
  }
  return cachedPublicIp;
}
let cachedPublicIp: string | null = null;
let cachedPublicIpAt = 0;

export function getSystemHealth() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();
  const disk = getDiskInfo('/');
  const db = getDbStats();
  const vpn = getVpnStatus();
  const publicIp = getPublicIp();

  return {
    ok: true,
    now: Date.now(),
    node: process.version,
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    hostname: os.hostname(),
    uptimeSeconds: Math.round(os.uptime()),
    processUptimeSeconds: Math.round(process.uptime()),
    publicIp,
    cpu: {
      model: os.cpus()[0]?.model ?? 'unknown',
      cores: os.cpus().length,
      usagePercent: cpuUsagePercent(),
      loadAvg: { '1m': +loadAvg[0]!.toFixed(2), '5m': +loadAvg[1]!.toFixed(2), '15m': +loadAvg[2]!.toFixed(2) },
    },
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024),
      usedMb: Math.round(usedMem / 1024 / 1024),
      freeMb: Math.round(freeMem / 1024 / 1024),
      percent: Math.round((usedMem / totalMem) * 100),
      processRssMb: Math.round(mem.rss / 1024 / 1024),
      processHeapMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    disk,
    db,
    vpn,
  };
}

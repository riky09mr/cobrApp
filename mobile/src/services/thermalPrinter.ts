import { Alert, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { Buffer } from 'buffer';

const PRINTER_KEY = 'cobrapp_printer_address';

type BondedDevice = {
  name?: string;
  address: string;
};

type CobroTicketPayload = {
  cliente: string;
  monto: number;
  medioPago: string;
  nroComprobante?: string;
  cobrador?: string;
  visitaId?: number;
  fechaHora?: string;
};

function line(text = ''): Buffer {
  return Buffer.from(`${text}\n`, 'utf-8');
}

function bytes(values: number[]): Buffer {
  return Buffer.from(values);
}

async function requestAndroidBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const sdk = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);

  const perms: string[] = [];

  if (sdk >= 31) {
    perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
  }

  perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

  const result = await PermissionsAndroid.requestMultiple(perms);

  return perms.every((perm) => result[perm] === PermissionsAndroid.RESULTS.GRANTED);
}

export async function ensureBluetoothReady(): Promise<void> {
  const granted = await requestAndroidBluetoothPermissions();
  if (!granted) {
    throw new Error('No se otorgaron permisos de Bluetooth');
  }

  const available = await RNBluetoothClassic.isBluetoothAvailable();
  if (!available) {
    throw new Error('Este dispositivo no soporta Bluetooth');
  }

  const enabled = await RNBluetoothClassic.isBluetoothEnabled();
  if (!enabled) {
    const userEnabled = await RNBluetoothClassic.requestBluetoothEnabled();
    if (!userEnabled) {
      throw new Error('Bluetooth desactivado');
    }
  }
}

export async function getBondedPrinters(): Promise<BondedDevice[]> {
  await ensureBluetoothReady();
  const devices = await RNBluetoothClassic.getBondedDevices();

  return devices
    .map((d) => ({ name: d.name, address: d.address }))
    .filter((d) => Boolean(d.address));
}

export async function setPreferredPrinter(address: string): Promise<void> {
  await AsyncStorage.setItem(PRINTER_KEY, address);
}

export async function getPreferredPrinter(): Promise<string | null> {
  return AsyncStorage.getItem(PRINTER_KEY);
}

async function resolvePrinterAddress(): Promise<string> {
  const preferred = await getPreferredPrinter();
  if (preferred) return preferred;

  const bonded = await getBondedPrinters();
  if (bonded.length === 0) {
    throw new Error('No hay impresoras Bluetooth emparejadas');
  }

  const first = bonded[0].address;
  await setPreferredPrinter(first);
  return first;
}

async function writeEscPos(address: string, chunks: Buffer[]): Promise<void> {
  const connected = await RNBluetoothClassic.isDeviceConnected(address);
  if (!connected) {
    await RNBluetoothClassic.connectToDevice(address, {
      connectorType: 'rfcomm',
      secureSocket: false,
      delimiter: '\n',
      charset: 'utf-8',
    });
  }

  for (const chunk of chunks) {
    await RNBluetoothClassic.writeToDevice(address, chunk);
  }
}

function formatGs(value: number): string {
  return `Gs. ${Number(value).toLocaleString('es-PY')}`;
}

// ── Ticket 58mm (FTX TDR058BT) ───────────────────────────────
// La FTX TDR058BT imprime 32 caracteres por línea en fuente
// normal (12×24). Ancho máximo de línea: 32 caracteres.
const TICKET_WIDTH = 32;

function truncateLine(text: string, width = TICKET_WIDTH): string {
  return text.length > width ? text.slice(0, width) : text;
}

function centerLine(text: string, width = TICKET_WIDTH): string {
  const t = truncateLine(text, width);
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return ' '.repeat(pad) + t;
}

function separatorLine(char = '-'): string {
  return char.repeat(TICKET_WIDTH);
}

function wrapText(text: string, width = TICKET_WIDTH): string[] {
  if (text.length <= width) return [truncateLine(text, width)];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.map((l) => truncateLine(l, width));
}

function nowText(): string {
  return new Date().toLocaleString('es-PY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function printCobroTicket(payload: CobroTicketPayload): Promise<void> {
  const address = await resolvePrinterAddress();

  const fecha = payload.fechaHora
    ? new Date(payload.fechaHora).toLocaleString('es-PY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : nowText();

  const chunks: Buffer[] = [
    bytes([0x1b, 0x40]),
    line(centerLine('COBRAPP')),
    line(centerLine('TICKET DE COBRO')),
    line(separatorLine()),
    ...wrapText(`Fecha: ${fecha}`).map((l) => line(l)),
    ...wrapText(`Cliente: ${payload.cliente}`).map((l) => line(l)),
    ...wrapText(`Monto: ${formatGs(payload.monto)}`).map((l) => line(l)),
    ...wrapText(`Medio: ${payload.medioPago}`).map((l) => line(l)),
  ];

  if (payload.nroComprobante) {
    chunks.push(...wrapText(`Comprobante: ${payload.nroComprobante}`).map((l) => line(l)));
  }

  if (payload.cobrador) {
    chunks.push(...wrapText(`Cobrador: ${payload.cobrador}`).map((l) => line(l)));
  }

  if (payload.visitaId) {
    chunks.push(line(truncateLine(`Operacion: #${payload.visitaId}`)));
  }

  chunks.push(
    line(separatorLine()),
    line(centerLine('Gracias por su pago.')),
    line(''),
    line(''),
    line(''),
    bytes([0x1d, 0x56, 0x00])
  );

  await writeEscPos(address, chunks);
}

export async function printTestTicket(): Promise<void> {
  const address = await resolvePrinterAddress();

  const chunks: Buffer[] = [
    bytes([0x1b, 0x40]),
    line(centerLine('COBRAPP')),
    line(centerLine('TEST IMPRESORA')),
    line(separatorLine()),
    ...wrapText(`Fecha: ${nowText()}`).map((l) => line(l)),
    ...wrapText('Modelo: FTX TDR058BT (58mm)').map((l) => line(l)),
    line(centerLine('Impresion Bluetooth OK')),
    line(''),
    line(''),
    bytes([0x1d, 0x56, 0x00])
  ];

  await writeEscPos(address, chunks);
}

export function showPrinterHintIfNeeded(err: unknown): void {
  const message = err instanceof Error ? err.message : 'No se pudo imprimir';
  Alert.alert('Impresion', message);
}

export type ConsoleStatus = 'available' | 'occupied' | 'service'
export type SessionStatus = 'active' | 'completed' | 'cancelled'
export type PaymentMethod = 'cash' | 'transfer'
export interface GameConsole { id: string; name: string; type: string; category?: 'PlayStation'|'XBOX'|'Nintendo'; hourlyRate: number; status: ConsoleStatus; active: boolean; sortOrder?: number }
export interface GameSession { id: string; consoleId: string; startedAt: number; endedAt?: number; durationMinutes?: number; initialDurationMinutes?: number; rate: number; mode: 'prepaid' | 'open'; amount: number; status: SessionStatus; paidAmount: number; paymentMethod?: PaymentMethod; cancelReason?: string; transferStartedAt?: number }
export interface SessionExtension { id: string; sessionId: string; minutes: number; amount: number; createdAt: number; additionalCharge?: number }
export interface Payment { id: string; sessionId: string; consoleId: string; createdAt: number; paidAt?: number; concept: string; amount: number; method: PaymentMethod; status: 'paid' | 'pending' | 'void' }
export interface Expense { id: string; concept: string; category: 'Renta'|'Electricidad'|'Internet'|'Mantenimiento'|'Controles y accesorios'|'Videojuegos'|'Suscripciones'|'Limpieza'|'Otros'; amount: number; date: string; type: 'fixed'|'variable'; notes?: string }
export interface SnackProduct { id: string; name: string; price: number; stock: number; active: boolean; createdAt: number }
export interface SnackSaleItem { productId: string; name: string; quantity: number; unitPrice: number }
export interface SnackSale { id: string; soldAt: number; items: SnackSaleItem[]; total: number; method: PaymentMethod }
export interface TariffPlan { id: string; label: string; minutes: number; ps2Price: number; xboxPrice: number }
export interface Setting { key: string; value: string | number | boolean }
export interface UserAction { id: string; timestamp: number; action: string; entity: string; entityId?: string; summary: string; details?: string }
export interface FileHandleRecord { id: string; handle: FileSystemFileHandle }
export const initialConsoles: GameConsole[] = [
  { id: 'ps2-1', name: 'PlayStation 2', category: 'PlayStation', type: 'PS2', hourlyRate: 10, status: 'available', active: true, sortOrder: 0 },
  { id: 'xbox-s-1', name: 'Xbox Series S', category: 'XBOX', type: 'Xbox Series S', hourlyRate: 15, status: 'available', active: true, sortOrder: 1 },
  { id: 'xbox-s-2', name: 'Xbox Series S', category: 'XBOX', type: 'Xbox Series S', hourlyRate: 15, status: 'available', active: true, sortOrder: 2 },
  { id: 'xbox-x-1', name: 'Xbox Series X', category: 'XBOX', type: 'Xbox Series X', hourlyRate: 15, status: 'available', active: true, sortOrder: 3 },
]
export const consoleCatalog = [
  { category: 'PlayStation' as const, models: ['PS1','PS2','PS3','PS4','PS5'] },
  { category: 'XBOX' as const, models: ['XBOX 1 gen','XBOX 360','XBOX ONE','XBOX S','XBOX X'] },
  { category: 'Nintendo' as const, models: ['Switch 1','Switch 2'] },
]
export const initialTariffs: TariffPlan[] = [
  { id: '30', label: '30 minutos', minutes: 30, ps2Price: 5, xboxPrice: 10 },
  { id: '60', label: '1 hora', minutes: 60, ps2Price: 10, xboxPrice: 15 },
  { id: '120', label: '2 horas', minutes: 120, ps2Price: 20, xboxPrice: 30 },
  { id: '180', label: '3 horas', minutes: 180, ps2Price: 25, xboxPrice: 40 },
]
export const formatMoney = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(value)
export const elapsed = (startedAt: number, now = Date.now()) => Math.max(0, Math.floor((now - startedAt) / 1000))
export const formatTime = (seconds: number) => {
  const wholeSeconds = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0))
  return `${String(Math.floor(wholeSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(wholeSeconds % 3600 / 60)).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`
}
export const prepaidAmount = (rate: number, minutes: number) => Math.round(rate * minutes / 60 * 100) / 100
export const openSessionAmount = (rate: number, startedAt: number, endedAt: number, rounding: 'minute' | '15' | '30' | 'hour' = 'minute') => {
  const mins = Math.max(0, (endedAt - startedAt) / 60000)
  const block = rounding === 'minute' ? 1 : rounding === '15' ? 15 : rounding === '30' ? 30 : 60
  return Math.round(rate * Math.ceil(mins / block) * block / 60 * 100) / 100
}

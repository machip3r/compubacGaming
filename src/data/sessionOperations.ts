import { db } from '../db'
import type { GameConsole, GameSession, PaymentMethod } from '../domain'
import { formatMoney, openSessionAmount } from '../domain'
import { recordUserAction } from './audit'

export class SessionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionConflictError'
  }
}

export async function startSession(input: {
  consoleInfo: GameConsole
  durationMinutes: number
  mode: GameSession['mode']
  amount: number
  paid: boolean
  method: PaymentMethod
}) {
  const startedAt = Date.now()
  const { consoleInfo, durationMinutes, mode, amount, paid, method } = input
  const session: GameSession = {
    id: crypto.randomUUID(), consoleId: consoleInfo.id, startedAt,
    durationMinutes: mode === 'prepaid' ? durationMinutes : undefined,
    rate: consoleInfo.hourlyRate, mode, amount, status: 'active',
    paidAmount: paid && mode === 'prepaid' ? amount : 0, paymentMethod: method,
  }

  await db.transaction('rw', db.sessions, db.consoles, db.payments, db.userActions, async () => {
    const currentConsole = await db.consoles.get(consoleInfo.id)
    const activeSession = await db.sessions.where('consoleId').equals(consoleInfo.id).filter(session => session.status === 'active').first()
    if (!currentConsole?.active || currentConsole.status !== 'available' || activeSession) {
      throw new SessionConflictError('Esta consola ya no está disponible. Actualiza la pantalla e inténtalo de nuevo.')
    }
    await db.sessions.add(session)
    await db.consoles.update(consoleInfo.id, { status: 'occupied' })
    if (paid && amount > 0) {
      await db.payments.add({ id: crypto.randomUUID(), sessionId: session.id, consoleId: consoleInfo.id, createdAt: startedAt, paidAt: startedAt, concept: `Prepago · ${durationMinutes} min`, amount, method, status: 'paid' })
    }
    await recordUserAction({ action: 'session.started', entity: 'session', entityId: session.id, summary: `Inició sesión en ${currentConsole.name}.`, details: JSON.stringify({ mode, durationMinutes: mode === 'prepaid' ? durationMinutes : null, amount, paid, method }) })
  })
  return session
}

export async function finishSession(input: {
  session: GameSession
  paid: boolean
  method: PaymentMethod
}) {
  const endedAt = Date.now()
  let total = 0
  await db.transaction('rw', db.sessions, db.consoles, db.payments, db.userActions, async () => {
    const current = await db.sessions.get(input.session.id)
    if (!current || current.status !== 'active') {
      throw new SessionConflictError('La sesión ya cambió de estado. Actualiza la pantalla antes de continuar.')
    }
    const currentConsole = await db.consoles.get(current.consoleId)
    if (!currentConsole) throw new SessionConflictError('No se encontró la consola asociada a esta sesión.')
    total = current.mode === 'prepaid' ? current.amount : openSessionAmount(current.rate, current.startedAt, endedAt)
    const due = Math.max(0, total - current.paidAmount)
    await db.sessions.update(current.id, { endedAt, amount: total, status: 'completed' })
    await db.consoles.update(currentConsole.id, { status: 'available' })
    if (due > 0) {
      await db.payments.add({ id: crypto.randomUUID(), sessionId: current.id, consoleId: currentConsole.id, createdAt: endedAt, ...(input.paid ? { paidAt: endedAt } : {}), concept: `Cobro de sesión · ${currentConsole.name}`, amount: due, method: input.method, status: input.paid ? 'paid' : 'pending' })
    }
    await recordUserAction({ action: 'session.completed', entity: 'session', entityId: current.id, summary: `Finalizó sesión en ${currentConsole.name}.`, details: JSON.stringify({ amount: total, paidAmount: current.paidAmount, due, paid: input.paid, method: input.method }) })
  })
  return total
}

export async function cancelSession(sessionId: string, reason: string) {
  await db.transaction('rw', db.sessions, db.consoles, db.payments, db.userActions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session || session.status !== 'active') throw new SessionConflictError('La sesión ya cambió de estado. Actualiza la pantalla antes de continuar.')
    await db.sessions.update(session.id, { status: 'cancelled', endedAt: Date.now(), cancelReason: reason })
    await db.consoles.update(session.consoleId, { status: 'available' })
    await db.payments.where('sessionId').equals(session.id).modify({ status: 'void' })
    await recordUserAction({ action: 'session.cancelled', entity: 'session', entityId: session.id, summary: 'Canceló una sesión.', details: JSON.stringify({ reason }) })
  })
}

export async function extendSession(session: GameSession, amount: number, method: PaymentMethod) {
  const createdAt = Date.now()
  await db.transaction('rw', db.sessions, db.sessionExtensions, db.payments, db.userActions, async () => {
    const current = await db.sessions.get(session.id)
    if (!current || current.status !== 'active') throw new SessionConflictError('La sesión ya no está activa. Actualiza la pantalla antes de extenderla.')
    await db.sessions.update(current.id, { durationMinutes: (current.durationMinutes ?? 0) + 30, amount: current.amount + amount, paidAmount: current.paidAmount + amount })
    await db.sessionExtensions.add({ id: crypto.randomUUID(), sessionId: current.id, minutes: 30, amount, createdAt })
    await db.payments.add({ id: crypto.randomUUID(), sessionId: current.id, consoleId: current.consoleId, createdAt, paidAt: createdAt, concept: 'Extensión · 30 min', amount, method, status: 'paid' })
    await recordUserAction({ action: 'session.extended', entity: 'session', entityId: current.id, summary: 'Extendió una sesión 30 minutos.', details: JSON.stringify({ amount, method }) })
  })
}

export async function markPaymentPaid(paymentId: string) {
  await db.transaction('rw', db.payments, db.sessions, db.userActions, async () => {
    const payment = await db.payments.get(paymentId)
    if (!payment || payment.status !== 'pending') return
    const session = await db.sessions.get(payment.sessionId)
    if (!session) throw new SessionConflictError('No se encontró la sesión asociada al pago.')
    await db.payments.update(payment.id, { status: 'paid', paidAt: Date.now() })
    await db.sessions.update(session.id, { paidAmount: session.paidAmount + payment.amount })
    await recordUserAction({ action: 'payment.collected', entity: 'payment', entityId: payment.id, summary: `Marcó como cobrado: ${payment.concept}.`, details: JSON.stringify({ amount: payment.amount, method: payment.method, sessionId: payment.sessionId }) })
  })
}

export async function updateCompletedSession(input: {
  session: GameSession
  consoleId: string
  startedAt: number
  endedAt: number
  rate: number
  amount: number
  amountChanged: boolean
}) {
  await db.transaction('rw', db.sessions, db.payments, db.consoles, db.userActions, async () => {
    const current = await db.sessions.get(input.session.id)
    if (!current || current.status !== 'completed') throw new SessionConflictError('La sesión ya no está disponible para editar. Actualiza el historial e inténtalo de nuevo.')
    const targetConsole = await db.consoles.get(input.consoleId)
    if (!targetConsole) throw new SessionConflictError('No se encontró la consola seleccionada.')
    const payments = await db.payments.where('sessionId').equals(input.session.id).toArray()
    const paidTotal = payments.filter(payment => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0)
    if (input.amount < paidTotal) throw new SessionConflictError(`El total debe ser al menos ${formatMoney(paidTotal)}.`)
    await db.sessions.update(current.id, { consoleId: input.consoleId, startedAt: input.startedAt, endedAt: input.endedAt, rate: input.rate, amount: input.amount, paidAmount: paidTotal })
    await db.payments.where('sessionId').equals(current.id).modify({ consoleId: input.consoleId })
    if (input.amountChanged) {
      await db.payments.where({ sessionId: current.id, status: 'pending' }).modify({ status: 'void' })
      const due = Math.max(0, input.amount - paidTotal)
      if (due > 0) await db.payments.add({ id: crypto.randomUUID(), sessionId: current.id, consoleId: input.consoleId, createdAt: Date.now(), concept: 'Saldo ajustado al editar sesión', amount: due, method: input.session.paymentMethod ?? 'cash', status: 'pending' })
    }
    await recordUserAction({ action: 'session.edited', entity: 'session', entityId: current.id, summary: 'Editó una sesión del historial.', details: JSON.stringify({ consoleId: input.consoleId, startedAt: input.startedAt, endedAt: input.endedAt, rate: input.rate, amount: input.amount }) })
  })
}

export async function getSessionRelatedCounts(sessionId: string) {
  const [payments, extensions] = await Promise.all([
    db.payments.where('sessionId').equals(sessionId).count(),
    db.sessionExtensions.where('sessionId').equals(sessionId).count(),
  ])
  return { payments, extensions }
}

export async function deleteSessionRecords(sessionId: string) {
  await db.transaction('rw', db.sessions, db.payments, db.sessionExtensions, db.consoles, db.userActions, async () => {
    const current = await db.sessions.get(sessionId)
    if (!current) return
    await db.payments.where('sessionId').equals(sessionId).delete()
    await db.sessionExtensions.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
    if (current.status === 'active') await db.consoles.update(current.consoleId, { status: 'available' })
    await recordUserAction({ action: 'session.deleted', entity: 'session', entityId: sessionId, summary: 'Eliminó una sesión y sus movimientos relacionados.', details: JSON.stringify({ consoleId: current.consoleId }) })
  })
}

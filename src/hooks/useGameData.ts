import { useCallback, useEffect, useState } from 'react'
import { db, initializeDatabase } from '../db'
import type { Expense, GameConsole, GameSession, Payment, SnackProduct, SnackSale, TariffPlan } from '../domain'
import { syncAuditCsv, type AuditFileStatus } from '../data/auditCsv'
import { recordUserAction } from '../data/audit'

export function useGameData() {
  const [consoles, setConsoles] = useState<GameConsole[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tariffs, setTariffs] = useState<TariffPlan[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [snackProducts, setSnackProducts] = useState<SnackProduct[]>([])
  const [snackSales, setSnackSales] = useState<SnackSale[]>([])
  const [now, setNow] = useState(Date.now())
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [auditStatus, setAuditStatus] = useState<AuditFileStatus>({ kind: 'unlinked' })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

  const refresh = useCallback(async () => {
    const [consoleRows, sessionRows, paymentRows, tariffRows, expenseRows, snackProductRows, snackSaleRows] = await Promise.all([
      db.consoles.toArray(), db.sessions.toArray(), db.payments.toArray(), db.tariffPlans.toArray(), db.expenses.toArray(), db.snackProducts.toArray(), db.snackSales.toArray(),
    ])
    setConsoles(consoleRows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
    setSessions(sessionRows)
    setPayments(paymentRows)
    setTariffs(tariffRows)
    setExpenses(expenseRows)
    setSnackProducts(snackProductRows.sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setSnackSales(snackSaleRows.sort((a, b) => b.soldAt - a.soldAt))
    try { setAuditStatus(await syncAuditCsv()) }
    catch (error) { setAuditStatus({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo sincronizar el CSV de acciones.' }) }
  }, [])

  const loadApplication = useCallback(async () => {
    setLoaded(false)
    setLoadError('')
    try {
      await initializeDatabase()
      const savedTheme = await db.settings.get('uiTheme')
      if (savedTheme?.value === 'dark' || savedTheme?.value === 'light') setTheme(savedTheme.value)
      await refresh()
    } catch {
      setLoadError('No se pudieron abrir los datos guardados en este navegador. Intenta cargar de nuevo; tus registros no se modificaron.')
    } finally {
      setLoaded(true)
    }
  }, [refresh])

  useEffect(() => {
    void loadApplication()
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [loadApplication])

  const toggleTheme = useCallback(async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    await db.transaction('rw', db.settings, db.userActions, async () => {
      await db.settings.put({ key: 'uiTheme', value: nextTheme })
      await recordUserAction({ action: 'settings.theme.updated', entity: 'settings', summary: `Cambió el tema a ${nextTheme}.` })
    })
    try { setAuditStatus(await syncAuditCsv()) }
    catch (error) { setAuditStatus({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo sincronizar el CSV de acciones.' }) }
  }, [theme])

  return { consoles, sessions, payments, tariffs, expenses, snackProducts, snackSales, now, loaded, loadError, theme, setTheme, refresh, loadApplication, toggleTheme, auditStatus, setAuditStatus }
}

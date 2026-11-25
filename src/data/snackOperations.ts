import { db } from '../db'
import type { PaymentMethod, SnackProduct, SnackSale, SnackSaleItem } from '../domain'
import { recordUserAction } from './audit'

export class SnackOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SnackOperationError'
  }
}

export async function saveSnackProduct(input: { id?: string; name: string; price: number; stock: number; active: boolean }) {
  const name = input.name.trim()
  if (!name) throw new SnackOperationError('Escribe el nombre del producto.')
  if (!Number.isFinite(input.price) || input.price <= 0) throw new SnackOperationError('El precio debe ser mayor que cero.')
  if (!Number.isInteger(input.stock) || input.stock < 0) throw new SnackOperationError('La existencia debe ser un número entero igual o mayor que cero.')
  const createdAt = Date.now()
  const product: SnackProduct = { id: input.id ?? crypto.randomUUID(), name, price: input.price, stock: input.stock, active: input.active, createdAt }
  await db.transaction('rw', db.snackProducts, db.userActions, async () => {
    const current = input.id ? await db.snackProducts.get(input.id) : undefined
    if (input.id && !current) throw new SnackOperationError('El producto ya no existe. Actualiza la página e inténtalo de nuevo.')
    if (current) await db.snackProducts.put({ ...product, createdAt: current.createdAt })
    else await db.snackProducts.add(product)
    await recordUserAction({ action: current ? 'snack.product.updated' : 'snack.product.created', entity: 'snackProduct', entityId: product.id, summary: `${current ? 'Actualizó' : 'Agregó'} el producto ${name}.`, details: JSON.stringify({ price: product.price, stock: product.stock, active: product.active }) })
  })
  return product
}

export async function createSnackSale(input: { items: Array<{ productId: string; quantity: number }>; method: PaymentMethod }) {
  if (!input.items.length) throw new SnackOperationError('Agrega al menos un producto a la venta.')
  if (input.items.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0)) throw new SnackOperationError('Las cantidades deben ser números enteros mayores que cero.')
  const soldAt = Date.now()
  let sale: SnackSale | undefined
  await db.transaction('rw', db.snackProducts, db.snackSales, db.userActions, async () => {
    const items: SnackSaleItem[] = []
    for (const item of input.items) {
      const product = await db.snackProducts.get(item.productId)
      if (!product || !product.active) throw new SnackOperationError('Uno de los productos ya no está disponible. Actualiza la lista e inténtalo de nuevo.')
      if (product.stock < item.quantity) throw new SnackOperationError(`No hay suficientes unidades de ${product.name}. Quedan ${product.stock}.`)
      items.push({ productId: product.id, name: product.name, quantity: item.quantity, unitPrice: product.price })
      await db.snackProducts.update(product.id, { stock: product.stock - item.quantity })
    }
    const total = Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100
    sale = { id: crypto.randomUUID(), soldAt, items, total, method: input.method }
    await db.snackSales.add(sale)
    await recordUserAction({ action: 'snack.sale.created', entity: 'snackSale', entityId: sale.id, summary: `Registró una venta de snacks por $${total.toFixed(2)}.`, details: JSON.stringify({ total, method: input.method, items }) })
  })
  return sale!
}

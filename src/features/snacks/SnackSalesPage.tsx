import { useMemo, useState } from 'react'
import { Check, Minus, PackagePlus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import type { PaymentMethod, SnackProduct, SnackSale } from '../../domain'
import { formatMoney } from '../../domain'
import { Stat } from '../../shared/Stat'

interface SnackSalesPageProps {
  products: SnackProduct[]
  sales: SnackSale[]
  now: number
  onSaveProduct: (input: { id?: string; name: string; price: number; stock: number; active: boolean }) => Promise<boolean>
  onRegisterSale: (items: Array<{ productId: string; quantity: number }>, method: PaymentMethod) => Promise<boolean>
}

export function SnackSalesPage({ products, sales, now, onSaveProduct, onRegisterSale }: SnackSalesPageProps) {
  const [editingProduct, setEditingProduct] = useState<SnackProduct | null | undefined>(undefined)
  const [showInactive, setShowInactive] = useState(false)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todaySales = sales.filter(sale => sale.soldAt >= todayStart.getTime())
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0)
  const activeProducts = products.filter(product => product.active)
  const visibleProducts = products.filter(product => showInactive ? !product.active : product.active)
  const cartItems = useMemo(() => Object.entries(cart).map(([productId, quantity]) => {
    const product = products.find(item => item.id === productId)
    return product ? { product, quantity } : null
  }).filter((item): item is { product: SnackProduct; quantity: number } => item !== null), [cart, products])
  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const cartUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  const addToCart = (product: SnackProduct) => {
    setCart(current => ({ ...current, [product.id]: Math.min(product.stock, (current[product.id] ?? 0) + 1) }))
  }
  const changeQuantity = (product: SnackProduct, quantity: number) => {
    setCart(current => {
      const next = { ...current }
      if (quantity <= 0) delete next[product.id]
      else next[product.id] = Math.min(product.stock, quantity)
      return next
    })
  }
  const submitSale = async () => {
    const saved = await onRegisterSale(cartItems.map(item => ({ productId: item.product.id, quantity: item.quantity })), method)
    if (saved) setCart({})
  }

  return <>
    <section className="stats-grid">
      <Stat icon={<ShoppingBag />} label="Ventas de hoy" value={formatMoney(todayTotal)} note={`${todaySales.length} operaciones`} accent="green" />
      <Stat icon={<PackagePlus />} label="Productos activos" value={String(activeProducts.length)} note="Disponibles para venta" accent="blue" />
      <Stat icon={<PackagePlus />} label="Unidades en inventario" value={String(activeProducts.reduce((sum, product) => sum + product.stock, 0))} note="Existencias disponibles" accent="violet" />
      <Stat icon={<ShoppingBag />} label="Productos por reponer" value={String(activeProducts.filter(product => product.stock <= 5).length)} note="Con 5 unidades o menos" accent="amber" />
    </section>

    <section className="snack-workspace">
      <div className="panel snack-inventory">
        <div className="panel-heading"><div><h2>Inventario</h2><p>{showInactive ? 'Productos fuera de venta' : 'Elige productos para agregarlos a la cuenta'}</p></div><button className="button backup-primary" onClick={() => setEditingProduct(null)}><Plus size={16}/> Agregar producto</button></div>
        <div className="snack-toolbar"><div className="snack-filter" role="group" aria-label="Filtrar productos"><button className={!showInactive ? 'selected' : ''} aria-pressed={!showInactive} onClick={() => setShowInactive(false)}>En venta</button><button className={showInactive ? 'selected' : ''} aria-pressed={showInactive} onClick={() => setShowInactive(true)}>Inactivos</button></div><span>{visibleProducts.length} {visibleProducts.length === 1 ? 'producto' : 'productos'}</span></div>
        {visibleProducts.length ? <div className="snack-product-list">{visibleProducts.map(product => <article className={`snack-product-row ${!product.active ? 'is-inactive' : ''}`} key={product.id}>
          <div className="snack-product-mark"><ShoppingBag size={18}/></div><div className="snack-product-info"><b>{product.name}</b><span>{product.stock} {product.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}</span></div><strong className="snack-price">{formatMoney(product.price)}</strong>
          <div className="snack-product-actions"><button className="button secondary" onClick={() => setEditingProduct(product)}>Editar</button>{product.active && <button className="button backup-primary" disabled={!product.stock} onClick={() => addToCart(product)}><Plus size={15}/> Agregar</button>}</div>
        </article>)}</div> : <div className="snack-empty"><PackagePlus size={24}/><b>{showInactive ? 'No hay productos inactivos' : 'Aún no hay productos'}</b><span>{showInactive ? 'Los productos que desactives aparecerán aquí.' : 'Agrega bebidas, botanas y otros productos para registrar ventas.'}</span></div>}
      </div>

      <aside className="panel snack-cart">
        <div className="panel-heading"><div><h2>Cuenta</h2><p>{cartUnits ? `${cartUnits} ${cartUnits === 1 ? 'unidad' : 'unidades'}` : 'Productos de esta venta'}</p></div><ShoppingBag size={19}/></div>
        {cartItems.length ? <div className="snack-cart-list">{cartItems.map(({ product, quantity }) => <div className="snack-cart-item" key={product.id}>
          <div className="snack-cart-description"><b>{product.name}</b><span>{formatMoney(product.price)} c/u</span></div><div className="snack-quantity"><button aria-label={`Quitar una unidad de ${product.name}`} onClick={() => changeQuantity(product, quantity - 1)}><Minus size={14}/></button><span>{quantity}</span><button aria-label={`Agregar una unidad de ${product.name}`} disabled={quantity >= product.stock} onClick={() => changeQuantity(product, quantity + 1)}><Plus size={14}/></button></div><strong>{formatMoney(product.price * quantity)}</strong><button className="snack-remove" aria-label={`Quitar ${product.name} de la cuenta`} onClick={() => changeQuantity(product, 0)}><Trash2 size={15}/></button>
        </div>)}</div> : <div className="snack-cart-empty">Agrega productos del inventario para comenzar la venta.</div>}
        {cartItems.length > 0 && <>
          <div className="snack-method"><span className="field-label">Método de pago</span><div className="pay-choice"><button type="button" className={method === 'cash' ? 'chosen' : ''} aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>Efectivo</button><button type="button" className={method === 'transfer' ? 'chosen' : ''} aria-pressed={method === 'transfer'} onClick={() => setMethod('transfer')}>Transferencia</button></div></div>
          <div className="snack-total"><span>Total</span><strong>{formatMoney(cartTotal)}</strong></div>
          <button className="button backup-primary snack-checkout" onClick={() => void submitSale()}><Check size={16}/> Registrar venta</button>
        </>}
      </aside>
    </section>

    <section className="panel snack-history"><div className="panel-heading"><div><h2>Ventas recientes</h2><p>Los productos vendidos conservan el nombre y precio de la venta</p></div></div>
      {sales.length ? <div className="activity-list">{sales.slice(0, 12).map(sale => <div className="activity-row snack-sale-row" key={sale.id}><div className="activity-icon"><ShoppingBag size={16}/></div><div className="activity-main"><b>{sale.items.map(item => `${item.quantity} × ${item.name}`).join(' · ')}</b><span>{new Date(sale.soldAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} · {sale.method === 'cash' ? 'Efectivo' : 'Transferencia'}</span></div><div className="activity-amount">{formatMoney(sale.total)}</div></div>)}</div> : <div className="empty-activity">Las ventas registradas aparecerán aquí.</div>}
    </section>

    {editingProduct !== undefined && <SnackProductDialog product={editingProduct} onClose={() => setEditingProduct(undefined)} onSave={onSaveProduct}/>}
  </>
}

function SnackProductDialog({ product, onClose, onSave }: { product: SnackProduct | null; onClose: () => void; onSave: SnackSalesPageProps['onSaveProduct'] }) {
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [stock, setStock] = useState(product ? String(product.stock) : '0')
  const [active, setActive] = useState(product?.active ?? true)
  const [error, setError] = useState('')
  const submit = async () => {
    const parsedPrice = Number(price), parsedStock = Number(stock)
    if (!name.trim()) { setError('Escribe el nombre del producto.'); return }
    if (!price.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) { setError('El precio debe ser mayor que cero.'); return }
    if (!stock.trim() || !Number.isInteger(parsedStock) || parsedStock < 0) { setError('La existencia debe ser un número entero igual o mayor que cero.'); return }
    setError('')
    if (await onSave({ ...(product ? { id: product.id } : {}), name: name.trim(), price: parsedPrice, stock: parsedStock, active })) onClose()
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal snack-product-modal" role="dialog" aria-modal="true" aria-labelledby="snack-product-title">
      <div className="modal-top"><div><span className="eyebrow">INVENTARIO</span><h2 id="snack-product-title">{product ? 'Editar producto' : 'Agregar producto'}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar diálogo"><X size={18}/></button></div>
      <label className="field-label" htmlFor="snack-name">Nombre</label><input id="snack-name" className="edit-input" maxLength={70} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Agua natural" autoFocus />
      <label className="field-label" htmlFor="snack-price">Precio</label><div className="money-input"><span>$</span><input id="snack-price" className="edit-input" type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)}/><span>MXN</span></div>
      <label className="field-label" htmlFor="snack-stock">Existencias</label><input id="snack-stock" className="edit-input" type="number" min="0" step="1" value={stock} onChange={event => setStock(event.target.value)}/>
      {product && <label className="snack-active-toggle"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)}/><span>Disponible para venta</span></label>}
      {error && <p className="extension-error" role="alert">{error}</p>}
      <div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button backup-primary" onClick={() => void submit()}><Check size={16}/>{product ? 'Guardar cambios' : 'Agregar producto'}</button></div>
    </section>
  </div>
}

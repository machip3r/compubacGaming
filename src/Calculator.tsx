import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, CircleDollarSign, Gauge, Save, TrendingUp } from 'lucide-react'
import { db } from './db'
import { formatMoney, type Expense, type GameConsole, type GameSession, type Payment } from './domain'

type Assumptions = { rent:number; electricity:number; internet:number; otherFixed:number; variableCosts:number; daysOpen:number; hoursPerDay:number; consoleCount:number; occupancy:number; desiredProfit:number; targetMargin:number }
const defaultAssumptions=(count:number):Assumptions=>({rent:0,electricity:0,internet:0,otherFixed:0,variableCosts:0,daysOpen:26,hoursPerDay:8,consoleCount:count,occupancy:50,desiredProfit:0,targetMargin:20})
const monthStart=()=>{const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return d.getTime()}
const expenseTime=(value:unknown)=>{if(typeof value==='number')return value;if(typeof value!=='string')return NaN;const dateOnly=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);return dateOnly?new Date(Number(dateOnly[1]),Number(dateOnly[2])-1,Number(dateOnly[3])).getTime():new Date(value).getTime()}

export default function Calculator({consoles,sessions,payments,expenses,onApply}:{consoles:GameConsole[];sessions:GameSession[];payments:Payment[];expenses:Expense[];onApply:(price:number)=>void}) {
  const activeCount=consoles.filter(c=>c.active).length
  const [inputs,setInputs]=useState<Assumptions>(()=>defaultAssumptions(activeCount))
  const [saved,setSaved]=useState(false)
  useEffect(()=>{void db.settings.get('profitabilityInputs').then(setting=>{if(typeof setting?.value==='string'){try{const stored=JSON.parse(setting.value) as Partial<Assumptions>;setInputs({...defaultAssumptions(activeCount),...stored})}catch{setInputs(defaultAssumptions(activeCount))}}})},[activeCount])
  const update=(key:keyof Assumptions,value:number)=>{const max=key==='occupancy'||key==='targetMargin'?100:Number.POSITIVE_INFINITY;setSaved(false);setInputs(current=>({...current,[key]:Math.min(max,Math.max(0,value))}))}
  const save=async()=>{await db.settings.put({key:'profitabilityInputs',value:JSON.stringify(inputs)});setSaved(true);window.setTimeout(()=>setSaved(false),2200)}
  const result=useMemo(()=>{
    const fixed=inputs.rent+inputs.electricity+inputs.internet+inputs.otherFixed
    const capacity=Math.max(0,inputs.consoleCount*inputs.daysOpen*inputs.hoursPerDay)
    const soldHours=capacity*Math.min(100,Math.max(0,inputs.occupancy))/100
    const totalCosts=fixed+inputs.variableCosts
    const fixedPerHour=soldHours>0?fixed/soldHours:null
    const variablePerHour=soldHours>0?inputs.variableCosts/soldHours:null
    const breakEvenPrice=fixedPerHour!==null&&variablePerHour!==null?fixedPerHour+variablePerHour:null
    const targetPrice=soldHours>0?(totalCosts+inputs.desiredProfit)/soldHours:null
    const marginPrice=soldHours>0&&inputs.targetMargin<100?totalCosts/soldHours/(1-Math.max(0,inputs.targetMargin)/100):null
    const estimatedRevenue=targetPrice===null?null:targetPrice*soldHours
    const month=monthStart()
    const completed=sessions.filter(s=>s.status==='completed'&&(s.endedAt??0)>=month)
    const actualRevenue=completed.reduce((sum,s)=>sum+s.amount,0)
    const actualHours=completed.reduce((sum,s)=>sum+(s.endedAt!-s.startedAt)/3600000,0)
    const activeHours=sessions.filter(s=>s.status==='active'&&s.startedAt>=month).reduce((sum,s)=>sum+(Date.now()-s.startedAt)/3600000,0)
    const collected=payments.filter(p=>p.status==='paid'&&(p.paidAt??p.createdAt)>=month).reduce((sum,p)=>sum+p.amount,0)
    const realExpenses=expenses.filter(e=>expenseTime(e.date)>=month).reduce((sum,e)=>sum+(Number(e.amount)||0),0)
    const actualCapacity=activeCount*new Date().getDate()*inputs.hoursPerDay
    const averagePrice=actualHours>0?actualRevenue/actualHours:null
    const cashResult=collected-realExpenses
    const realMargin=collected>0?cashResult/collected*100:null
    const referencePrice=averagePrice??targetPrice
    const breakEvenHours=referencePrice&&referencePrice>0?totalCosts/referencePrice:null
    const realOccupancy=actualCapacity>0?(actualHours+activeHours)/actualCapacity*100:null
    return {fixed,capacity,soldHours,totalCosts,fixedPerHour,variablePerHour,breakEvenPrice,targetPrice,marginPrice,estimatedRevenue,actualRevenue,actualHours,collected,realExpenses,cashResult,realMargin,averagePrice,breakEvenHours,realOccupancy}
  },[inputs,sessions,payments,expenses,activeCount])
  const formatHours=(value:number|null)=>value===null||!Number.isFinite(value)?'—':`${value.toFixed(1)} h`
  const fields:[keyof Assumptions,string,number,number,string][]=[
    ['rent','Renta mensual',0,100,'MXN'],['electricity','Electricidad',0,100,'MXN'],['internet','Internet',0,100,'MXN'],['otherFixed','Otros costos fijos',0,100,'MXN'],['variableCosts','Costos variables estimados',0,100,'MXN'],['daysOpen','Días de apertura',1,1,'días'],['hoursPerDay','Horas disponibles por consola',1,.5,'h / día'],['consoleCount','Consolas consideradas',0,1,'consolas'],['occupancy','Ocupación estimada',0,1,'%'],['desiredProfit','Ganancia mensual deseada',0,100,'MXN'],['targetMargin','Margen objetivo',0,1,'%'],
  ]
  return <div className="calculator-page">
    <section className="calculator-layout">
      <div className="panel assumptions-panel"><div className="panel-heading"><div><h2>Supuestos</h2><p>Valores mensuales en pesos mexicanos.</p></div><button className="button secondary calc-save" onClick={save}><Save size={16}/>{saved?'Guardado':'Guardar'}</button></div><div className="assumptions-grid">{fields.map(([key,label,min,step,unit])=><label className="assumption-field" key={key}><span className="assumption-label">{label}</span><div className="assumption-control"><input type="number" min={min} max={key==='occupancy'||key==='targetMargin'?100:undefined} step={step} value={inputs[key]} onChange={e=>update(key,Math.max(0,Number(e.target.value)||0))}/><span>{unit}</span></div></label>)}</div><p className="calc-hint">El número de consolas es un supuesto de cálculo; no agrega ni elimina estaciones.</p></div>
      <div className="results-column"><section className="panel target-panel"><div className="target-top"><div><span className="result-label">PRECIO OBJETIVO POR HORA</span><strong>{result.targetPrice===null?'—':formatMoney(result.targetPrice)}</strong><span className="target-caption">Para cubrir costos y alcanzar la ganancia deseada</span></div><div className="target-icon"><TrendingUp size={22}/></div></div><div className="target-details"><div><span>Horas vendidas estimadas</span><b>{formatHours(result.soldHours)}</b></div><div><span>Ingreso mensual estimado</span><b>{result.estimatedRevenue===null?'—':formatMoney(result.estimatedRevenue)}</b></div><div><span>Precio de equilibrio</span><b>{result.breakEvenPrice===null?'Sin horas estimadas':formatMoney(result.breakEvenPrice)}</b></div><div><span>Precio con margen objetivo</span><b>{result.marginPrice===null?'—':formatMoney(result.marginPrice)}</b></div><div><span>Costo fijo por hora vendida</span><b>{result.fixedPerHour===null?'Sin horas estimadas':formatMoney(result.fixedPerHour)}</b></div><div><span>Costo variable por hora</span><b>{result.variablePerHour===null?'Sin horas estimadas':formatMoney(result.variablePerHour)}</b></div><div><span>Horas para punto de equilibrio</span><b>{formatHours(result.breakEvenHours)}</b></div></div>{result.soldHours===0&&<p className="zero-hours">Aumenta la ocupación, las horas disponibles o las consolas para calcular precios por hora.</p>}{result.targetPrice!==null&&<button className="button calc-apply" onClick={()=>onApply(Math.round(result.targetPrice!*100)/100)}><Check size={16}/> Aplicar precio a las consolas activas</button>}</section>
        <section className="panel actual-panel"><div className="panel-heading"><div><h2>Resultado real del mes</h2><p>Ingresos cobrados y gastos registrados.</p></div><div className="actual-icon"><CircleDollarSign size={18}/></div></div><div className="actual-grid"><Metric label="Ingresos de sesiones" value={formatMoney(result.actualRevenue)}/><Metric label="Dinero cobrado" value={formatMoney(result.collected)}/><Metric label="Gastos del mes" value={formatMoney(result.realExpenses)}/><Metric label="Resultado en caja" value={formatMoney(result.cashResult)}/><Metric label="Promedio real por hora" value={result.averagePrice===null?'—':formatMoney(result.averagePrice)}/><Metric label="Margen real de caja" value={result.realMargin===null?'—':`${result.realMargin.toFixed(1)}%`}/><Metric label="Horas vendidas" value={formatHours(result.actualHours)}/><Metric label="Ocupación real" value={result.realOccupancy===null?'—':`${result.realOccupancy.toFixed(1)}%`}/></div></section></div>
    </section>
    <section className="panel scenario-panel"><div className="panel-heading"><div><h2>Escenarios de tarifa y ocupación</h2><p>Ingresos estimados y resultado después de los costos indicados.</p></div><div className="scenario-icon"><Gauge size={18}/></div></div><div className="table-wrap scenario-table"><table><thead><tr><th>OCUPACIÓN</th>{[10,15,20].map(price=><th colSpan={2} key={price}>TARIFA {formatMoney(price)}/H</th>)}</tr><tr><th>HORAS ESTIMADAS</th>{[10,15,20].map(price=><Fragment key={price}><th>INGRESO</th><th>RESULTADO</th></Fragment>)}</tr></thead><tbody>{[25,50,75,100].map(occupancy=>{const hours=result.capacity*occupancy/100;return <tr key={occupancy}><td><b>{occupancy}%</b></td><td>{formatMoney(hours*10)}</td><td>{formatMoney(hours*10-result.totalCosts)}</td><td>{formatMoney(hours*15)}</td><td>{formatMoney(hours*15-result.totalCosts)}</td><td>{formatMoney(hours*20)}</td><td>{formatMoney(hours*20-result.totalCosts)}</td></tr>})}</tbody></table></div><p className="scenario-note">Capacidad mensual calculada: {result.capacity.toFixed(0)} horas · Costos mensuales estimados: {formatMoney(result.totalCosts)}.</p></section>
  </div>
}
function Metric({label,value}:{label:string;value:string}){return <div className="actual-metric"><span>{label}</span><b>{value}</b></div>}

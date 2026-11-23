import { prepaidAmount, type GameConsole, type TariffPlan } from '../domain'

export function tariffPrice(consoleInfo: GameConsole, minutes: number, tariffs: TariffPlan[]) {
  const plan = tariffs.find(item => item.minutes === minutes)
  if (!plan) return prepaidAmount(consoleInfo.hourlyRate, minutes)
  const category = consoleInfo.category ?? (consoleInfo.type === 'PS2' ? 'PlayStation' : consoleInfo.type.toLowerCase().startsWith('xbox') ? 'XBOX' : undefined)
  if (category === 'PlayStation' && consoleInfo.type === 'PS2') return plan.ps2Price
  if (category === 'XBOX') return plan.xboxPrice
  return prepaidAmount(consoleInfo.hourlyRate, minutes)
}

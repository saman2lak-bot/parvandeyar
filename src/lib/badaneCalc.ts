// @ts-nocheck
// منطق محاسبه خسارت بدنه — خالص و مستقل از UI

export const toNumber = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (!v) return 0
  const normalized = String(v)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[,٬\s]/g, '')
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}

const round0 = (n) => Math.round(n)
const clampPercent = (n) => Math.min(100, Math.max(0, n))

// تعرفه ایاب و ذهاب (نرخ روزانه به ریال) — فرانشیز: تا N روز اول پولی نمی‌دهیم
export const TRAVEL_TYPES = {
  none: { label: 'ندارد', rate: 0, franchise: 0 },
  savari: { label: 'سواری', rate: 200000, franchise: 2 },
  bar2ton: { label: 'بارکش تا ۲ تن', rate: 1000000, franchise: 2 },
  bar5ton: { label: 'بارکش تا ۵ تن', rate: 1200000, franchise: 3 },
  bar5tonUp: { label: 'بارکش ۵ تن به بالا', rate: 2500000, franchise: 3 },
}

// حداقل فرانشیز اصلی بر اساس درصد — وقتی درصد صفر است فرانشیز کاملاً صفر می‌شود
export const MIN_FRANCHISE = { 0: 0, 2.5: 0, 5: 0, 10: 500000, 20: 1000000, 30: 1500000 }

export function computeResult(form) {
  const labor = toNumber(form.labor)
  const parts = toNumber(form.parts)
  const battery = toNumber(form.battery)
  const tire = toNumber(form.tire)
  const glass = toNumber(form.glass)
  const salvage = toNumber(form.salvage)
  const depRate = clampPercent(toNumber(form.depRate))
  const mainFranchiseRate = clampPercent(toNumber(form.mainFranchise))
  // فرانشیز گواهینامه: چک‌باکس — روشن = ۱۰٪ ثابت، خاموش = ۰٪
  const licenseFranchiseRate = form.licenseFranchise === true ? 10 : 0
  const thirdPartyParts = toNumber(form.thirdPartyParts)
  const thirdPartyLabor = toNumber(form.thirdPartyLabor)
  const travelDays = Math.max(0, toNumber(form.travelDays))
  const travelTypeKey = form.travelType in TRAVEL_TYPES ? form.travelType : 'none'
  const travelRate = TRAVEL_TYPES[travelTypeKey].rate
  const travelFranchise = TRAVEL_TYPES[travelTypeKey].franchise
  const travelPayableDays = Math.max(0, travelDays - travelFranchise)
  const travel = travelPayableDays * travelRate
  const rescue = toNumber(form.rescue)
  const insuredValue = toNumber(form.insuredValue)
  const carValue = toNumber(form.carValue)
  const fluctuation = Math.max(0, toNumber(form.fluctuation))

  const batteryTire = battery + tire
  const totalParts = parts + batteryTire + glass
  const totalDamage = labor + totalParts

  // استهلاک باتری و لاستیک همیشه نصف مبلغ آنهاست؛ سایر لوازم طبق درصد استهلاک
  // شیشه هیچ‌وقت استهلاک نمی‌خورد
  const depBatteryTire = round0(batteryTire / 2)
  const depOtherBase = parts - thirdPartyParts
  const depOther = round0((depOtherBase * depRate) / 100)
  const depreciation = depBatteryTire + depOther

  // پایه فرانشیز اصلی طبق فرمول:
  // اجرت + (لوازم − باتری و لاستیک) + (باتری و لاستیک)/۲ − بازیافت − استهلاک − خسارت ثالث
  const franchiseBase = round0(
    labor + glass + parts + (batteryTire / 2) - salvage - depreciation - (thirdPartyParts + thirdPartyLabor),
  )
  // فرانشیز اصلی = حداکثر(فرانشیز محاسبه‌ای، حداقل فرانشیز) — مگر درصد صفر که کامل صفر می‌شود
  const mainFranchisePercent = round0((Math.max(0, franchiseBase) * mainFranchiseRate) / 100)
  const mainFranchise =
    mainFranchiseRate === 0 ? 0 : Math.max(mainFranchisePercent, MIN_FRANCHISE[mainFranchiseRate])
  const licenseFranchise = round0((totalDamage * licenseFranchiseRate) / 100)

  const beforeProportional = round0(
    totalDamage - salvage - depreciation - mainFranchise - licenseFranchise - thirdPartyParts - thirdPartyLabor,
  )

  // قاعده نسبی: درصد نوسان به‌عنوان درصد به ارزش بیمه‌نامه اضافه می‌شود
  // ارزش بیمه مؤثر = ارزش بیمه × (۱ + نوسان/۱۰۰) → نسبت = ارزش بیمه مؤثر ÷ ارزش روز
  const adjustedInsuredValue = round0(insuredValue * (1 + fluctuation / 100))
  // نسبت بیمه حداکثر ۱۰۰٪ است تا کم‌بیمگی هرگز منفی نشود
  const ratioRaw = carValue > 0 && insuredValue > 0 ? adjustedInsuredValue / carValue : null
  const ratio = ratioRaw === null ? null : Math.min(1, ratioRaw)
  const underinsurance = round0(beforeProportional * (1 - ratio))
  const payable = beforeProportional
  // مبلغ پرداختی نهایی (فرمول نمایش رسید) هرگز منفی نمی‌شود
  const finalPayable = Math.max(0, payable * (ratio ?? 0) + rescue + travel)

  return {
    labor, parts, battery, tire, glass, salvage,
    batteryTire, totalParts, totalDamage,
    depRate, depBatteryTire, depOtherBase, depOther, depreciation,
    franchiseBase, mainFranchiseRate, mainFranchise, mainFranchisePercent,
    licenseFranchiseRate, licenseFranchise,
    thirdPartyParts, thirdPartyLabor, travel, travelDays, travelPayableDays, travelRate, travelTypeKey, rescue,
    beforeProportional, ratio, ratioRaw, fluctuation, adjustedInsuredValue, underinsurance, payable, finalPayable,
  }
}

export const faMoney = (n) => Math.round(n).toLocaleString('fa-IR')

export const faNumber = (n) =>
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(n)

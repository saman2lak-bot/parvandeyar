// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { computeResult, faMoney, faNumber, TRAVEL_TYPES } from "../lib/badaneCalc";

const FORM_KEY = "badanecalc.form.v1";
const HISTORY_KEY = "badanecalc.history.v1";
const HISTORY_LIMIT = 50;

const EMPTY_FORM = {
  labor: "",
  parts: "",
  battery: "",
  tire: "",
  glass: "",
  salvage: "",
  depRate: "0",
  mainFranchise: "0",
  licenseFranchise: false,
  thirdPartyParts: "",
  thirdPartyLabor: "",
  travelDays: "",
  travelType: "none",
  rescue: "",
  insuredValue: "",
  carValue: "",
  fluctuation: "0",
};

const FLUCTUATION_OPTIONS = [
  { value: "0", label: "نوسان ندارد" },
  { value: "25", label: "۲۵٪" },
  { value: "50", label: "۵۰٪" },
  { value: "75", label: "۷۵٪" },
  { value: "100", label: "۱۰۰٪" },
];

const MAIN_FRANCHISE_OPTIONS = [
  { value: "0", label: "۰٪" },
  { value: "2.5", label: "۲٫۵٪" },
  { value: "5", label: "۵٪" },
  { value: "10", label: "۱۰٪" },
  { value: "20", label: "۲۰٪" },
  { value: "30", label: "۳۰٪" },
];

const DEP_RATE_OPTIONS = [
  { value: "0", label: "۰٪" },
  { value: "5", label: "۵٪" },
  { value: "10", label: "۱۰٪" },
  { value: "15", label: "۱۵٪" },
  { value: "20", label: "۲۰٪" },
  { value: "25", label: "۲۵٪" },
];

// فرم‌های ذخیره‌شده قدیمی ممکن است مقدار خارج از گزینه‌های رادیو/چک‌باکس داشته باشند
function normalizeForm(f) {
  const normalized = { ...f };
  //نوسان
  if (!FLUCTUATION_OPTIONS.some((o) => o.value === normalized.fluctuation)) {
    normalized.fluctuation = EMPTY_FORM.fluctuation;
  }
  //فرانشیز اصلی
  if (
    !MAIN_FRANCHISE_OPTIONS.some((o) => o.value === normalized.mainFranchise)
  ) {
    normalized.mainFranchise = EMPTY_FORM.mainFranchise;
  }
  //استهلاک
  if (!DEP_RATE_OPTIONS.some((o) => o.value === normalized.depRate)) {
    normalized.depRate = EMPTY_FORM.depRate;
  }
  normalized.licenseFranchise = normalized.licenseFranchise === false;

  return normalized;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeDigits(s) {
  return String(s)
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

function formatAmount(raw) {
  const digits = normalizeDigits(raw).replace(/[^\d]/g, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
}

const fmtDate = (iso) =>
  new Date(iso).toLocaleString("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  });

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="badane-card-header flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="badane-card-icon text-lg">{icon}</span>
        <div className="badane-card-heading">
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </header>
      <div className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  suffix,
  inputMode = "numeric",
  value,
  onChange,
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        {hint && (
          <span className="text-[10px] leading-tight text-slate-400">
            {hint}
          </span>
        )}
      </span>
      <span className="relative block">
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          placeholder="۰"
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[11px] text-slate-400">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function AmountField({ label, hint, value, onChange }) {
  return (
    <Field
      label={label}
      hint={hint}
      suffix="ریال"
      value={value}
      onChange={(v) => onChange(formatAmount(v))}
    />
  );
}

function Row({ label, hint, value, tone = "default", strong = false }) {
  const tones = {
    default: "text-slate-800",
    minus: "text-rose-600",
    plus: "text-emerald-600",
  };
  const sign = tone === "minus" ? "−" : tone === "plus" ? "+" : "";
  return (
    <div
      className={`flex items-start justify-between gap-3 py-1.5 ${strong ? "border-t border-slate-200 pt-2" : ""}`}
    >
      <span className="text-xs leading-tight text-slate-600">
        {strong ? <strong className="text-slate-800">{label}</strong> : label}
        {hint && (
          <span className="mt-0.5 block text-[10px] text-slate-400">
            {hint}
          </span>
        )}
      </span>
      <span
        className={`shrink-0 text-sm tabular-nums ${tones[tone]} ${strong ? "font-bold" : "font-medium"}`}
      >
        {sign && <span className="opacity-60">{sign} </span>}
        {value}
      </span>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState(() =>
    normalizeForm({ ...EMPTY_FORM, ...loadJSON(FORM_KEY, {}) }),
  );
  const [history, setHistory] = useState(() => loadJSON(HISTORY_KEY, []));
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    localStorage.setItem(FORM_KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const r = useMemo(() => computeResult(form), [form]);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const saveToHistory = () => {
    setHistory((h) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: new Date().toISOString(),
          form,
          payable: r.finalPayable,
        },
        ...h,
      ].slice(0, HISTORY_LIMIT),
    );
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const restore = (item) => {
    setForm(normalizeForm({ ...EMPTY_FORM, ...item.form }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const ratioText = r.ratio === null ? "—" : `${faNumber(r.ratio * 100)}٪`;

  return (
    <div className="badane-calculator-app min-h-screen pb-12 font-sans">
      {/* <header className="bg-gradient-to-l from-teal-700 via-emerald-600 to-teal-600 text-white shadow">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-xl font-extrabold sm:text-2xl">
            🚗 محاسبه‌گر خسارت بدنه
          </h1>
          <p className="mt-1 text-xs text-emerald-50/90 sm:text-sm">
            محاسبه مبلغ پرداختی به زیان‌دیده بر اساس استهلاک، فرانشیز و قاعده
            نسبی — مبالغ به «ریال»
          </p>
          <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[10px] sm:text-[11px]">
            مقادیر فرم به‌صورت خودکار در همین مرورگر ذخیره می‌شود (localStorage)
          </p>
        </div>
      </header> */}

      <main className="mx-auto grid max-w-6xl items-start gap-5 px-4 py-6 lg:grid-cols-[1fr_400px]">
        {/* ستون فرم */}
        <div className="grid gap-5 print:hidden">
          <SectionCard
            icon="🔧"
            title="اجرت و لوازم"
            subtitle="دستمزد تعمیرگاه و قیمت قطعات یدکی"
          >
            <AmountField
              label="اجرت تعمیرات"
              value={form.labor}
              onChange={setField("labor")}
            />
            <AmountField
              label="لوازم (سایر قطعات)"
              hint="بدون باتری، لاستیک و شیشه"
              value={form.parts}
              onChange={setField("parts")}
            />
            <AmountField
              label="قیمت باتری"
              value={form.battery}
              onChange={setField("battery")}
            />
            <AmountField
              label="قیمت لاستیک"
              value={form.tire}
              onChange={setField("tire")}
            />
            <AmountField
              label="قیمت شیشه"
              value={form.glass}
              onChange={setField("glass")}
            />
            <AmountField
              label="بازیافت"
              hint="مبلغ قطعات معیوب فروش رفته"
              value={form.salvage}
              onChange={setField("salvage")}
            />
          </SectionCard>

          <SectionCard icon="📊" title="کسورات" subtitle="استهلاک و فرانشیزها">
            <div className="col-span-full">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                درصد استهلاک
              </span>
              <div className="flex flex-wrap gap-2">
                {DEP_RATE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition ${
                      form.depRate === opt.value
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-400"
                        : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="depRate"
                      className="h-3.5 w-3.5 accent-emerald-600"
                      checked={form.depRate === opt.value}
                      onChange={() => setField("depRate")(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <span className="mt-1 block text-[10px] text-slate-400">
                صفر = فقط باتری و لاستیک نصف می‌شود — شیشه هیچ‌وقت استهلاک
                نمی‌خورد
              </span>
            </div>
            <div className="col-span-full">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                درصد فرانشیز اصلی
              </span>
              <div className="flex flex-wrap gap-2">
                {MAIN_FRANCHISE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition ${
                      form.mainFranchise === opt.value
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-400"
                        : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mainFranchise"
                      className="h-3.5 w-3.5 accent-emerald-600"
                      checked={form.mainFranchise === opt.value}
                      onChange={() => setField("mainFranchise")(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <span className="mt-1 block text-[10px] text-slate-400">
                حداقل فرانشیز: ۱۰٪ ← ۵۰۰٬۰۰۰ — ۲۰٪ ← ۱٬۰۰۰٬۰۰۰ — ۳۰٪ ← ۱٬۵۰۰٬۰۰۰
                ریال (۰٪ = بدون فرانشیز)
              </span>
            </div>
            <label className="col-span-full flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <span>
                <span className="block text-xs font-semibold text-slate-700">
                  فرانشیز گواهینامه
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-400">
                  روشن = ۱۰٪ از (اجرت + لوازم) — خاموش = بدون فرانشیز
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-emerald-600"
                checked={form.licenseFranchise}
                onChange={(e) => setField("licenseFranchise")(e.target.checked)}
              />
            </label>
          </SectionCard>

          <SectionCard
            icon="🚙"
            title="کسورات"
            subtitle="ارزش خودرو و قاعده نسبی"
          >
            <AmountField
              label="ارزش خودرو در بیمه‌نامه"
              value={form.insuredValue}
              onChange={setField("insuredValue")}
            />
            <AmountField
              label="ارزش روز خودرو در زمان حادثه"
              value={form.carValue}
              onChange={setField("carValue")}
            />
            <div className="col-span-full">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                درصد نوسان
              </span>
              <div className="flex flex-wrap gap-2">
                {FLUCTUATION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition ${
                      form.fluctuation === opt.value
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-400"
                        : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="fluctuation"
                      className="h-3.5 w-3.5 accent-emerald-600"
                      checked={form.fluctuation === opt.value}
                      onChange={() => setField("fluctuation")(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <span className="mt-1 block text-[10px] text-slate-400">
                به‌عنوان درصد به ارزش بیمه‌نامه اضافه و در نسبت بیمه اعمال
                می‌شود (نسبت حداکثر ۱۰۰٪)
              </span>
            </div>
          </SectionCard>

          <SectionCard
            icon="🧾"
            title="سایر اقلام"
            subtitle="ثالث، ایاب و ذهاب، حمل و نجات"
          >
            <AmountField
              label="خسارت ثالث — لوازم"
              hint="سهم قطعات از خسارت ثالث"
              value={form.thirdPartyParts}
              onChange={setField("thirdPartyParts")}
            />
            <AmountField
              label="خسارت ثالث — اجرت"
              hint="سهم دستمزد از خسارت ثالث"
              value={form.thirdPartyLabor}
              onChange={setField("thirdPartyLabor")}
            />
            <div className="col-span-full flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
              <span className="text-xs font-semibold text-emerald-800">
                خسارت در بیمه ثالث
              </span>
              <span className="text-sm font-bold tabular-nums text-emerald-700">
                {faMoney(r.thirdPartyParts + r.thirdPartyLabor)}
                <span className="mr-1 text-[10px] font-medium text-emerald-600">
                  ریال
                </span>
              </span>
            </div>
            <Field
              label="تعداد روز توقف خودرو"
              hint="مثلاً ۳ یعنی سه روز"
              inputMode="numeric"
              suffix="روز"
              value={form.travelDays}
              onChange={(v) => setField("travelDays")(formatAmount(v))}
            />
            <div className="col-span-full">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                نوع ایاب و ذهاب
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TRAVEL_TYPES).map(([key, t]) => (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition ${
                      form.travelType === key
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-400"
                        : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="travelType"
                      className="h-3.5 w-3.5 accent-emerald-600"
                      checked={form.travelType === key}
                      onChange={() => setField("travelType")(key)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
              <span className="mt-1 block text-[10px] text-slate-400">
                تا روزهای فرانشیز پرداختی نداریم؛ مابقی روزها ضربدر نرخ روزانه
                محاسبه می‌شود
              </span>
            </div>
            <div className="col-span-full flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
              <span className="text-xs font-semibold text-emerald-800">
                ایاب و ذهاب
              </span>
              <span className="text-sm font-bold tabular-nums text-emerald-700">
                {faMoney(r.travel)}
                <span className="mr-1 text-[10px] font-medium text-emerald-600">
                  ریال
                </span>
              </span>
            </div>
            <AmountField
              label="حمل و نجات"
              value={form.rescue}
              onChange={setField("rescue")}
            />
          </SectionCard>
        </div>

        {/* ستون نتیجه */}
        <div className="lg:sticky lg:top-5">
          <section className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
            <header className="flex items-center gap-2 bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
              <span className="text-lg">💰</span>
              <h2 className="text-sm font-bold text-slate-800">رسید محاسبه</h2>
            </header>

            <div className="divide-y divide-slate-100 px-4 py-2">
              <Row label="اجرت تعمیرات" value={faMoney(r.labor)} />
              <Row label="لوازم (سایر قطعات)" value={faMoney(r.parts)} />
              <Row
                label="باتری، لاستیک و شیشه"
                value={faMoney(r.batteryTire + r.glass)}
              />
              <Row
                label="خسارت کل (اجرت + کل لوازم)"
                value={faMoney(r.totalDamage)}
                strong
              />
              <Row label="بازیافت" tone="minus" value={faMoney(r.salvage)} />
              <Row
                label="استهلاک"
                tone="minus"
                value={faMoney(r.depreciation)}
                hint={`باتری و لاستیک (۵۰٪): ${faMoney(r.depBatteryTire)} — سایر لوازم (${faNumber(r.depRate)}٪ از ${faMoney(r.depOtherBase)}): ${faMoney(r.depOther)}`}
              />
              <Row
                label={`فرانشیز اصلی (${faNumber(r.mainFranchiseRate)}٪)`}
                tone="minus"
                value={faMoney(r.mainFranchise)}
                hint={
                  "پایه: اجرت + (لوازم − باتری و لاستیک) − نصف باتری و لاستیک − بازیافت − استهلاک − خسارت ثالث" +
                  (r.mainFranchiseRate === 0
                    ? " — بدون فرانشیز"
                    : r.mainFranchise > r.mainFranchisePercent
                      ? ` — حداقل فرانشیز (${faMoney(r.mainFranchise)}) به‌جای ${faMoney(r.mainFranchisePercent)}`
                      : "")
                }
              />
              <Row
                label={`فرانشیز گواهینامه (${faNumber(r.licenseFranchiseRate)}٪ از اجرت + لوازم)`}
                tone="minus"
                value={faMoney(r.licenseFranchise)}
              />
              <Row
                label="خسارت در بیمه ثالث"
                tone="minus"
                value={faMoney(r.thirdPartyParts + r.thirdPartyLabor)}
                hint={`لوازم: ${faMoney(r.thirdPartyParts)} + اجرت: ${faMoney(r.thirdPartyLabor)}`}
              />
              <Row
                label="ایاب و ذهاب"
                tone="plus"
                value={faMoney(r.travel)}
                hint={
                  r.travelTypeKey === "none"
                    ? "ایاب و ذهاب ندارد"
                    : `${faNumber(r.travelPayableDays)} روز مشمول پس از فرانشیز × ${faMoney(r.travelRate)} ریال`
                }
              />
              <Row label="حمل و نجات" tone="plus" value={faMoney(r.rescue)} />
              <Row
                label="خسارت تا قبل از قاعده نسبی"
                value={faMoney(r.beforeProportional)}
                strong
              />
              <Row
                label="نسبت بیمه (ارزش بیمه با نوسان ÷ ارزش روز)"
                value={ratioText}
                hint={
                  r.ratio === null
                    ? "برای محاسبه، ارزش خودرو در بیمه‌نامه و ارزش روز را وارد کنید"
                    : `(${faMoney(r.insuredValue)} + ${faNumber(r.fluctuation)}٪ نوسان = ${faMoney(r.adjustedInsuredValue)}) ÷ ${faMoney(r.carValue)}${r.ratioRaw > 1 ? " — به سقف ۱۰۰٪ محدود شد" : ""}`
                }
              />
              <Row
                label="کم‌بیمگی (قاعده نسبی)"
                tone="minus"
                value={faMoney(r.underinsurance)}
                hint="خسارت قبل از قاعده نسبی × (۱ − نسبت بیمه)"
              />
            </div>

            <div className="border-t-2 border-emerald-600 bg-emerald-50 px-4 py-4 text-center">
              <p className="text-xs font-semibold text-emerald-800">
                مبلغ پرداختی به زیان‌دیده
              </p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-700">
                {faMoney(r.finalPayable)}
                <span className="mr-2 text-sm font-medium text-emerald-600">
                  ریال
                </span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3 print:hidden">
              <button
                type="button"
                onClick={saveToHistory}
                className={`rounded-xl px-2 py-2 text-xs font-bold text-white transition ${
                  savedFlash
                    ? "bg-emerald-500"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {savedFlash ? "✓ ذخیره شد" : "ذخیره در تاریخچه"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-slate-100 px-2 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200"
              >
                چاپ رسید
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-rose-50 px-2 py-2 text-xs font-bold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100"
              >
                پاک کردن فرم
              </button>
            </div>
          </section>

          <details className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200 print:hidden">
            <summary className="cursor-pointer font-bold text-slate-700">
              فرمول محاسبه
            </summary>
            <ul className="mt-2 list-disc space-y-1.5 pr-4 leading-relaxed">
              <li>
                پرداختی = (اجرت + کل لوازم) − بازیافت − استهلاک − فرانشیز اصلی −
                فرانشیز گواهینامه − خسارت ثالث − کم‌بیمگی + ایاب و ذهاب + حمل و
                نجات
              </li>
              <li>
                استهلاک = (باتری + لاستیک) ÷ ۲ + (لوازم به‌جز باتری و لاستیک ×
                درصد استهلاک)
              </li>
              <li>
                فرانشیز اصلی = (خسارت کل − بازیافت − استهلاک − خسارت ثالث) ×
                درصد فرانشیز
              </li>
              <li>
                فرانشیز گواهینامه = (اجرت + کل لوازم) × ۱۰٪ — فقط وقتی چک‌باکس
                روشن باشد
              </li>
              <li>
                خسارت در بیمه ثالث = خسارت ثالث (لوازم) + خسارت ثالث (اجرت)
              </li>
              <li>
                کم‌بیمگی = خسارت قبل از قاعده نسبی × (۱ − نسبت بیمه) — نسبت بیمه
                = (ارزش بیمه × (۱ + درصد نوسان)) ÷ ارزش روز
              </li>
            </ul>
          </details>
        </div>
      </main>

      {/* تاریخچه */}
      <section className="mx-auto mt-2 max-w-6xl rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 print:hidden">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗂</span>
            <h2 className="text-sm font-bold text-slate-800">
              تاریخچه محاسبات
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {faNumber(history.length)} مورد
            </span>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-[11px] font-bold text-rose-600 hover:underline"
            >
              پاک کردن همه
            </button>
          )}
        </header>

        {history.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            هنوز محاسبه‌ای ذخیره نشده — با دکمه «ذخیره در تاریخچه» می‌توانید
            نتیجه را نگه دارید.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 px-4 py-2.5"
              >
                <span className="text-[11px] text-slate-400">
                  {fmtDate(item.date)}
                </span>
                <span className="mr-auto text-sm font-bold tabular-nums text-emerald-700">
                  {faMoney(item.payable)} ریال
                </span>
                <button
                  type="button"
                  onClick={() => restore(item)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-200"
                >
                  بازیابی
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setHistory((h) => h.filter((x) => x.id !== item.id))
                  }
                  className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

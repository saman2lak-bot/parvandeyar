export type Deficiency = { id: string | number; title: string; resolved: boolean; note?: string };
export type Case = { id: string | number; number: string; name: string; phone: string; expert: string; expertColor: string; status: string; updated: string; description?: string; deficiencies: Deficiency[]; completion: number };

export const experts = ['سارا محمدی', 'امیرحسین رضایی', 'نگار احمدی', '— بدون کارشناس —'];
export const initialCases: Case[] = [
 { id: 1, number: '۱۴۰۵-۰۰۱۲۳', name: 'محمد رضایی', phone: '۰۹۱۲ ۴۸۳ ۲۷۱۹', expert: 'سارا محمدی', expertColor: 'mint', status: 'در حال بررسی', updated: 'امروز، ۱۰:۴۲', completion: 66, deficiencies: [{id:1,title:'تصویر کارت خودرو',resolved:true},{id:2,title:'تصویر گواهینامه',resolved:true},{id:3,title:'تکمیل فرم اعلام خسارت',resolved:false}] },
 { id: 2, number: '۱۴۰۵-۰۰۱۲۲', name: 'الهام کریمی', phone: '۰۹۳۵ ۷۲۱ ۸۹۰۱', expert: 'امیرحسین رضایی', expertColor: 'peach', status: 'تکمیل شده', updated: 'امروز، ۰۹:۱۸', completion: 100, deficiencies: [{id:1,title:'تصویر کارت خودرو',resolved:true},{id:2,title:'امضای بیمه‌گذار',resolved:true}] },
 { id: 3, number: '۱۴۰۵-۰۰۱۲۱', name: 'علی اکبری', phone: '۰۹۱۰ ۱۱۲ ۶۴۰۸', expert: 'نگار احمدی', expertColor: 'lavender', status: 'نیازمند پیگیری', updated: 'دیروز، ۱۶:۳۰', completion: 33, deficiencies: [{id:1,title:'تصویر کارت خودرو',resolved:false},{id:2,title:'ارسال مدارک تکمیلی',resolved:false},{id:3,title:'امضای بیمه‌گذار',resolved:true}] },
 { id: 4, number: '۱۴۰۵-۰۰۱۲۰', name: 'پریسا نادری', phone: '۰۹۱۹ ۵۶۲ ۳۰۴۲', expert: '— بدون کارشناس —', expertColor: 'gray', status: 'بدون کارشناس', updated: '۲۷ اردیبهشت، ۱۲:۰۵', completion: 0, deficiencies: [{id:1,title:'تصویر گواهینامه',resolved:false}] },
 { id: 5, number: '۱۴۰۵-۰۰۱۱۹', name: 'رضا نوروزی', phone: '۰۹۱۷ ۳۳۱ ۵۷۹۴', expert: 'سارا محمدی', expertColor: 'mint', status: 'در حال بررسی', updated: '۲۶ اردیبهشت، ۱۷:۴۴', completion: 50, deficiencies: [{id:1,title:'تصویر کارت خودرو',resolved:true},{id:2,title:'تکمیل فرم اعلام خسارت',resolved:false}] },
];

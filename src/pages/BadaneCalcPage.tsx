import { useState } from 'react';
import { ArrowRight, Calculator, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BadaneCalculator from '../components/BadaneCalculator';
import { isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserRole, type UserRole } from '../services/auth';

export default function BadaneCalcPage() {
  const demo = !isSupabaseConfigured;
  const [dark, setDark] = useState(() => localStorage.getItem('parvandeyar-theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(demo ? 'admin' : 'user');

  useState(() => {
    if (!isSupabaseConfigured) return;
    void getCurrentUserRole().then(setRole).catch(() => setRole('user'));
  });

  return (
    <div className={dark ? 'app dark badane-calc-shell' : 'app badane-calc-shell'} dir="rtl">
      <Sidebar
        dark={dark}
        onToggleTheme={() => setDark(value => {
          const next = !value;
          localStorage.setItem('parvandeyar-theme', next ? 'dark' : 'light');
          return next;
        })}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        role={role}
      />
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <main className="badane-calc-main">
        <header className="badane-calc-header">
          <button type="button" className="mobile" onClick={() => setMenuOpen(value => !value)} aria-label="باز کردن منو"><Menu /></button>
          <span>خانه　/　<b>محاسبه بدنه</b></span>
          <Link className="badane-calc-back" to="/"><ArrowRight size={15} /> بازگشت به داشبورد</Link>
        </header>
        <section className="badane-calc-frame-wrap" aria-label="محاسبه‌گر خسارت بدنه">
          {/* <div className="badane-calc-title">
            <div className="badane-calc-title-icon"><Calculator size={20} /></div>
            <div>
              <h1>محاسبه بدنه</h1>
              <p>محاسبه سریع خسارت بدنه خودرو و مشاهده تاریخچه محاسبات</p>
            </div>
          </div> */}
          <BadaneCalculator />
        </section>
      </main>
    </div>
  );
}

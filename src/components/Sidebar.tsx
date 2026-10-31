import { NavLink, useNavigate } from 'react-router-dom';
import { ClipboardCheck, Files, LayoutDashboard, LogOut, Moon, PanelRight, Settings, Sun, UsersRound, Zap } from 'lucide-react';
import { signOut, type UserRole } from '../services/auth';

const mainItems = [
  { label: 'داشبورد', to: '/', icon: LayoutDashboard, end: true },
  { label: 'پرونده‌ها', to: '/cases', icon: Files, end: false },
  { label: 'کارشناسان', to: '/experts', icon: UsersRound, end: false },
  { label: 'سوابق فعالیت', to: '/activity', icon: ClipboardCheck, end: false },
];

export default function Sidebar({ dark, onToggleTheme, open, onClose, role }: { dark: boolean; onToggleTheme: () => void; open: boolean; onClose: () => void; role: UserRole }) {
  const navigate = useNavigate();
  const logout = async () => { await signOut(); navigate('/login', { replace: true }); };
  return (
    <aside className={open ? 'open' : 'closed'}>
      <div className="brand">
        <Zap />
        <b>پرونده‌یار<small>مدیریت هوشمند پرونده</small></b>
        <button type="button" onClick={onClose} aria-label="بستن منو"><PanelRight /></button>
      </div>
      {/* <div className="workspace">▣　شرکت اطمینان نوین</div> */}
      <label>منوی اصلی</label>
      {mainItems.map(({ label, to, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => isActive ? 'nav active' : 'nav'}>
          <Icon /> {label}
        </NavLink>
      ))}
      <label>سایر</label>
      <button type="button" className="nav" onClick={onToggleTheme}>{dark ? <Sun /> : <Moon />} حالت {dark ? 'روشن' : 'تاریک'}</button>
      <NavLink to="/settings" onClick={onClose} className={({ isActive }) => isActive ? 'nav active' : 'nav'}><Settings /> تنظیمات</NavLink>
      <button type="button" className="nav" onClick={logout}><LogOut /> خروج از حساب</button>
      {/* <div className="help">✦<b>نیاز به راهنمایی دارید؟</b><small>با پشتیبانی در ارتباط باشید</small></div> */}
      {/* <div className="profile">　{role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی'}<small>نقش: {role === 'admin' ? 'مدیر' : 'کاربر'}</small></div> */}
    </aside>
  );
}

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LockKeyhole, Mail, ShieldCheck, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSession } from '../services/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const loginPageRef = useRef<HTMLDivElement>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const pointerTargetRef = useRef({ x: 50, y: 35 });
  const pointerCurrentRef = useRef({ x: 50, y: 35 });
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  function paintPointerLight() {
    const page = loginPageRef.current;
    if (!page) return;
    page.style.setProperty('--mouse-x', `${pointerCurrentRef.current.x.toFixed(2)}%`);
    page.style.setProperty('--mouse-y', `${pointerCurrentRef.current.y.toFixed(2)}%`);
  }

  function stepPointerLight() {
    const current = pointerCurrentRef.current;
    const target = pointerTargetRef.current;
    current.x += (target.x - current.x) * 0.16;
    current.y += (target.y - current.y) * 0.16;
    paintPointerLight();
    if (Math.abs(target.x - current.x) < 0.08 && Math.abs(target.y - current.y) < 0.08) {
      current.x = target.x; current.y = target.y;
      paintPointerLight();
      pointerFrameRef.current = null;
      return;
    }
    pointerFrameRef.current = requestAnimationFrame(stepPointerLight);
  }

  function updatePointerLight(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return;
    pointerTargetRef.current = {
      x: (event.clientX / Math.max(window.innerWidth, 1)) * 100,
      y: (event.clientY / Math.max(window.innerHeight, 1)) * 100,
    };
    loginPageRef.current?.style.setProperty('--mouse-light-opacity', '1');
    if (reduceMotionRef.current) {
      pointerCurrentRef.current = { ...pointerTargetRef.current };
      paintPointerLight();
      return;
    }
    if (pointerFrameRef.current !== null) return;
    pointerFrameRef.current = requestAnimationFrame(stepPointerLight);
  }

  function hidePointerLight() {
    if (pointerFrameRef.current !== null) {
      cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    loginPageRef.current?.style.setProperty('--mouse-light-opacity', '0');
  }

  useEffect(() => () => {
    if (pointerFrameRef.current !== null) cancelAnimationFrame(pointerFrameRef.current);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    getSession().then(session => { if (session) navigate(from, { replace: true }); });
  }, [from, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError('');
    if (!supabase) { navigate(from, { replace: true }); setLoading(false); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError('ایمیل یا رمز عبور صحیح نیست.');
    else navigate(from, { replace: true });
    setLoading(false);
  }
  return <div ref={loginPageRef} className="login-page" dir="rtl" onPointerMove={updatePointerLight} onPointerLeave={hidePointerLight}><div className="login-art"><div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/><div className="login-art-copy"><div className="login-logo"><Zap size={21} fill="currentColor"/></div><h1>پرونده‌یار</h1><p>همه پرونده‌ها، یک نگاه روشن.</p><span><ShieldCheck size={16}/> فضای امن مدیریت پرونده‌های بیمه</span></div></div><main className="login-card"><div className="login-card-head"><div className="mobile-login-logo"><Zap size={18}/></div><span>خوش آمدید</span><h2>ورود به حساب کاربری</h2><p>برای ادامه، اطلاعات حساب خود را وارد کنید.</p></div><form onSubmit={submit}><label>ایمیل سازمانی<div className="login-input"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.ir" required/></div></label><label>رمز عبور<div className="login-input"><LockKeyhole size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="رمز عبور خود را وارد کنید" required/></div></label><div className="login-options"><label className="remember"><input type="checkbox"/> مرا به خاطر بسپار</label><button type="button">فراموشی رمز عبور؟</button></div>{!supabase && <div className="login-demo">حالت نمایشی فعال است؛ با هر ایمیل و رمزی وارد داشبورد می‌شوید.</div>}
        {error&&<div className="form-error">{error}</div>}<button className="login-submit" disabled={loading}>{loading?<><Loader2 className="spin" size={14}/> در حال ورود...</>:'ورود به پرونده‌یار'}</button></form><small className="login-note">با ورود، قوانین استفاده و حریم خصوصی سازمان را می‌پذیرید.</small></main></div>;
}

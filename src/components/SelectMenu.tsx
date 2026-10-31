import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: string;
};

type Props<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  icon?: ReactNode;
};

export default function SelectMenu<T extends string>({ value, options, onChange, label, icon }: Props<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(Math.max(0, options.findIndex(item => item.value === value)));
  const [style, setStyle] = useState<CSSProperties>();
  const selected = options.find(item => item.value === value) ?? options[0];

  const positionMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(208, rect.width);
    const menuHeight = menuRef.current?.offsetHeight ?? options.length * 40 + 12;
    const top = window.innerHeight - rect.bottom >= menuHeight + 10
      ? rect.bottom + 8
      : Math.max(12, rect.top - menuHeight - 8);
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    setStyle({ top, left, width });
  };

  useEffect(() => {
    if (!open) return;
    positionMenu();
    const update = () => positionMenu();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("mousedown", outside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
      if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => (index + 1) % options.length); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => (index - 1 + options.length) % options.length); }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const option = options[active];
        if (option) { onChange(option.value); setOpen(false); triggerRef.current?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, onChange, open, options]);

  const menuHost = triggerRef.current?.closest(".app");
  return (
    <div className="select-field">
      <button
        ref={triggerRef}
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        onClick={() => { setActive(Math.max(0, options.findIndex(item => item.value === value))); setOpen(current => !current); }}
      >
        {icon && <span className="select-trigger-icon" aria-hidden="true">{icon}</span>}
        <span className="select-trigger-label">{selected?.label}</span>
        <ChevronDown className={`select-chevron${open ? " is-open" : ""}`} size={14} aria-hidden="true" />
      </button>
      {open && menuHost && createPortal(
        <div ref={menuRef} className="select-menu" role="listbox" aria-label={label} style={style}>
          <div className="select-menu-heading">انتخاب وضعیت</div>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`select-option${option.value === value ? " is-selected" : ""}${index === active ? " is-active" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus(); }}
            >
              {option.icon && <span className="select-option-icon" aria-hidden="true">{option.icon}</span>}
              <span className="select-option-label">{option.label}</span>
              {option.count && <span className="select-option-count">{option.count}</span>}
              <Check className="select-option-check" size={14} aria-hidden="true" />
            </button>
          ))}
        </div>,
        menuHost,
      )}
    </div>
  );
}

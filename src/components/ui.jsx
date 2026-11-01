import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Pila degli overlay: il tasto "indietro" di Android chiude quello in cima
// ---------------------------------------------------------------------------

const overlayStack = [];

export function closeTopOverlay() {
  const top = overlayStack[overlayStack.length - 1];
  if (top) {
    top.current();
    return true;
  }
  return false;
}

function useOverlayRegistration(open, onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    overlayStack.push(ref);
    return () => {
      const idx = overlayStack.lastIndexOf(ref);
      if (idx !== -1) overlayStack.splice(idx, 1);
    };
  }, [open]);
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTopOverlay();
  });
}

// ---------------------------------------------------------------------------
// Bottom sheet
// ---------------------------------------------------------------------------

export function Sheet({ open, onClose, title, subtitle, children, footer, size = 'auto', className = '' }) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);

  useOverlayRegistration(open, onClose);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      setDragY(0);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 220);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const onPointerDown = (e) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (dragY > 110) onClose();
    else setDragY(0);
  };

  return createPortal(
    <div className={`sheet-root ${closing ? 'closing' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        className={`sheet sheet-${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="sheet-grabber"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span />
        </div>
        {title && (
          <div className="sheet-header">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
              <X size={22} />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Snackbar + dialogo di conferma
// ---------------------------------------------------------------------------

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, options = {}) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, ...options });
    timer.current = setTimeout(() => setToast(t => (t?.id === id ? null : t)), options.duration || (options.action ? 5000 : 2600));
  }, []);

  const confirm = useCallback((options) => new Promise(resolve => {
    setDialog({ ...options, resolve });
  }), []);

  const closeDialog = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  useOverlayRegistration(Boolean(dialog), () => closeDialog(false));

  return (
    <UIContext.Provider value={{ showToast, confirm }}>
      {children}
      {toast && (
        <div className="toast" key={toast.id} role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action.onClick();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
      {dialog && createPortal(
        <div className="dialog-root">
          <div className="sheet-backdrop" onClick={() => closeDialog(false)} />
          <div className="dialog" role="alertdialog" aria-modal="true">
            {dialog.icon && <div className={`dialog-icon ${dialog.danger ? 'danger' : ''}`}>{dialog.icon}</div>}
            <h2>{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => closeDialog(false)}>
                {dialog.cancelLabel || 'Annulla'}
              </button>
              <button className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => closeDialog(true)} autoFocus>
                {dialog.confirmLabel || 'Conferma'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}

// ---------------------------------------------------------------------------
// Piccoli componenti riutilizzabili
// ---------------------------------------------------------------------------

export function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, icon }) {
  return (
    <label className="row-setting">
      {icon && <span className="row-icon">{icon}</span>}
      <span className="row-text">
        <span className="row-title">{label}</span>
        {description && <span className="row-desc">{description}</span>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}

export function EmptyState({ icon, title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

/** Menu a comparsa (in alto a destra) */
export function Menu({ open, onClose, items }) {
  useOverlayRegistration(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="menu-root">
      <div className="menu-backdrop" onClick={onClose} />
      <div className="menu" role="menu">
        {items.filter(Boolean).map((item, i) =>
          item === 'divider' ? <div key={i} className="menu-divider" /> : (
            <button
              key={item.label}
              role="menuitem"
              className={`menu-item ${item.danger ? 'danger' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                onClose();
                item.onClick();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          )
        )}
      </div>
    </div>,
    document.body
  );
}

export function TopBar({ title, subtitle, left, actions, children }) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        {left}
        <div className="topbar-titles">
          <h1>{title}</h1>
          {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
        </div>
        <div className="topbar-actions">{actions}</div>
      </div>
      {children}
    </header>
  );
}

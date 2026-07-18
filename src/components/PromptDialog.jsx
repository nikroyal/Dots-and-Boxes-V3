import { useEffect, useRef, useState, useCallback } from 'react';

export function PromptDialog({ open, title, defaultValue = '', confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue);

  const prevFocus = useRef(null);
  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      prevFocus.current = document.activeElement;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    } else if (prevFocus.current && typeof prevFocus.current.focus === 'function') {
      prevFocus.current.focus();
      prevFocus.current = null;
    }
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm?.(value);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel, onConfirm, value]);

  // Trap focus
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         role="presentation"
         onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div ref={dialogRef}
           role="dialog"
           aria-modal="true"
           aria-labelledby="prompt-dialog-title"
           className="card fade-in max-w-sm w-full"
           style={{ background: 'var(--paper-tint)', boxShadow: 'var(--shadow)' }}>
        <h2 id="prompt-dialog-title" className="font-display text-xl mb-4">{title}</h2>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring mb-6"
          aria-labelledby="prompt-dialog-title"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-ghost">{cancelLabel}</button>
          <button onClick={() => onConfirm(value)} className="btn-primary">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function usePrompt() {
  const [state, setState] = useState(null); // { resolve, options }
  const prompt = useCallback((options) => {
    return new Promise((resolve) => {
      setState({ resolve, options });
    });
  }, []);
  const close = (result) => {
    if (state) state.resolve(result);
    setState(null);
  };
  const dialog = (
    <PromptDialog
      open={!!state}
      title={state?.options?.title}
      defaultValue={state?.options?.defaultValue}
      confirmLabel={state?.options?.confirmLabel}
      cancelLabel={state?.options?.cancelLabel}
      onConfirm={(val) => close(val)}
      onCancel={() => close(null)}
    />
  );
  return { prompt, dialog };
}

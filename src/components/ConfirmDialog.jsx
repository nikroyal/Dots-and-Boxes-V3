import React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

// Themed confirmation dialog. Replaces the browser-native confirm() calls
// throughout the app (which (a) ignore the theme, (b) are blocked by some
// privacy extensions, (c) are inconsistent with the rest of the UI).
//
// Usage pattern:
//   const { confirm, dialog } = useConfirm();
//   const handleResign = () => confirm({
//     title: 'Resign this match?',
//     body: 'Your opponent will win.',
//     danger: true,
//     confirmLabel: 'Resign',
//   }).then(ok => { if (ok) doResign(); });
//   // ... render the result of `dialog` somewhere in your tree.
//
// Or use the standalone component directly if you want to manage state
// yourself.

export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const confirmBtnRef = useRef(null);

  // Focus the confirm button on open so keyboard users can act immediately.
  // Track the previously-focused element to restore focus on close.
  const prevFocus = useRef(null);
  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement;
      // Defer to the next frame so the dialog is in the DOM.
      requestAnimationFrame(() => {
        confirmBtnRef.current?.focus();
      });
    } else if (prevFocus.current && typeof prevFocus.current.focus === 'function') {
      prevFocus.current.focus();
      prevFocus.current = null;
    }
  }, [open]);

  // Escape key cancels.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  // Trap focus inside the dialog while open.
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
           role="alertdialog"
           aria-modal="true"
           aria-labelledby="confirm-dialog-title"
           aria-describedby="confirm-dialog-body"
           className="card fade-in max-w-sm w-full"
           style={{ background: 'var(--paper-tint)', boxShadow: 'var(--shadow)' }}>
        <div className="flex items-start gap-3 mb-4">
          {danger && (
            <AlertTriangle size={18} style={{ color: 'var(--crimson)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          )}
          <div>
            <h2 id="confirm-dialog-title" className="font-display text-xl mb-2">{title}</h2>
            {body && (
              <p id="confirm-dialog-body" className="font-display text-sm opacity-75 leading-relaxed">
                {body}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-ghost">{cancelLabel}</button>
          <button ref={confirmBtnRef} onClick={onConfirm}
                  className={danger ? 'btn-danger' : 'btn-primary'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Promise-style hook: call confirm({...}) to get back a boolean.
export function useConfirm() {
  const [state, setState] = useState(null); // { resolve, options }
  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({ resolve, options });
    });
  }, []);
  const close = (result) => {
    if (state) state.resolve(result);
    setState(null);
  };
  const dialog = (
    <ConfirmDialog
      open={!!state}
      title={state?.options.title}
      body={state?.options.body}
      confirmLabel={state?.options.confirmLabel}
      cancelLabel={state?.options.cancelLabel}
      danger={state?.options.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
  return { confirm, dialog };
}

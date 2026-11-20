import { useEffect, useRef } from 'react';

// A "are you sure?" box using the browser's own <dialog>. showModal() gives us
// for free: focus moves inside, Tab stays inside, Escape closes it, and the
// page behind cannot be clicked. Focus starts on Cancel, the safe choice.
export default function ConfirmDialog({ title, children, confirmLabel, busy = false, onConfirm, onCancel }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog ref={ref} className="confirm" aria-labelledby="confirm-title" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}>
      <h2 id="confirm-title">{title}</h2>
      {children}
      <div className="confirm-actions">
        <button type="button" ref={cancelRef} onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

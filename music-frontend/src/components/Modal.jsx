import { useEffect } from "react";
import { X } from "lucide-react";
import "./Modal.css";

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-panel__header">
          <h3>{title}</h3>
          <button className="modal-panel__close" onClick={onClose} aria-label="Close dialog">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

import { useEffect, useId, useRef } from "react";
import { useTranslation } from "../i18n/I18nProvider";

type Props = {
  open: boolean;
  name: string;
  onNameChange: (name: string) => void;
  willOverwrite: boolean;
  onSave: () => void;
  onClose: () => void;
};

export function SavePresetModal({
  open,
  name,
  onNameChange,
  willOverwrite,
  onSave,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="modal-title">
          {t("bases.saveModalTitle")}
        </h3>
        <p className="muted small">{t("bases.saveModalHint")}</p>
        <label className="modal-label">
          {t("bases.saveModalName")}
          <input
            ref={inputRef}
            type="text"
            className="bases-field"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onSave();
            }}
          />
        </label>
        {willOverwrite && name.trim() && (
          <p className="modal-warn" role="status">
            {t("bases.saveModalOverwrite", { name: name.trim() })}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t("bases.saveModalCancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!name.trim()}
            onClick={onSave}
          >
            {t("bases.saveModalSave")}
          </button>
        </div>
      </div>
    </div>
  );
}

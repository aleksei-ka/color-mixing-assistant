import { useTranslation, type Lang } from "../i18n/I18nProvider";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useTranslation();

  return (
    <label className="lang-switch">
      <span className="muted small">{t("app.langLabel")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t("app.langLabel")}
      >
        <option value="ru">Русский</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}

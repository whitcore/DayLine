import { useLocale } from "./i18n.jsx";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import { Toggle } from "./motion.jsx";
import ThemeSettings from "./ThemeSettings.jsx";
import MotionSettings from "./MotionSettings.jsx";
import { ChoiceSelect } from "./DatePicker.jsx";
import { FocusPreferences } from "./FocusPanel.jsx";
import "./settings.css";

const api = window.dayline;
const scoreModes = [
  { value: "share", label: "Доля полезного времени" },
  { value: "goal", label: "Цель по работе" },
];
const neutralWeights = [0, 25, 50, 75, 100].map((value) => ({
  value,
  label: value + "%",
}));
const idleThresholds = [1, 3, 5, 10, 15, 30, 0];

export default function Settings({ data, onSettings, notify, onPrograms }) {
  const { t, errorText } = useLocale();
  const { settings } = data;
  const setting = async (patch) => {
    try {
      await onSettings(patch);
      notify(t("Настройки сохранены"));
    } catch (error) {
      notify(errorText(error, "Не удалось сохранить настройки"));
    }
  };

  return (
    <div className="settings-stack">
      <ThemeSettings notify={notify} />
      <MotionSettings />
      <section className="settings-group focus-settings" aria-labelledby="focus-settings-heading">
        <h2 id="focus-settings-heading">{t("Фокус")}</h2>
        <div className="setting-row">
          <div>
            <strong>{t("Показывать таймер фокуса")}</strong>
            <p>{t("Скрытие таймера поставит текущую сессию на паузу.")}</p>
          </div>
          <Toggle label={t("Показывать таймер фокуса")} checked={settings.showFocusTimer !== false}
            onChange={() => setting({ showFocusTimer: settings.showFocusTimer === false })} />
        </div>
        <details className="settings-details">
          <summary className="setting-row">
            <strong>{t("Работа и перерыв")}</strong>
            <span className="settings-disclosure-value">
              {settings.focusWorkMinutes} / {settings.focusBreakMinutes}{" "}{t("мин")}<ChevronDown size={15} aria-hidden="true" />
            </span>
          </summary>
          <div className="settings-details-content">
            <FocusPreferences settings={settings} onChange={onSettings} />
            <p className="settings-footnote">{t("Таймер работает в трее и останавливается при блокировке или сне.")}</p>
          </div>
        </details>
        <div className="setting-row">
          <strong>{t("Рейтинг фокуса")}</strong>
          <ChoiceSelect
            label={t("Расчёт фокуса")}
            value={settings.focusScoreMode}
            options={scoreModes.map(({ value, label }) => ({ value, label: t(label) }))}
            onChange={(value) => setting({ focusScoreMode: value })}
          />
        </div>
        <details className="settings-details">
          <summary className="setting-row">
            <strong>{t("Параметры рейтинга")}</strong>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="settings-details-content">
            {settings.focusScoreMode === "goal" ? (
              <label className="setting-row goal-setting">
                <span>
                  <strong>{t("Цель работы за день")}</strong>
                  <small>{t("От 15 минут до 12 часов")}</small>
                </span>
                <span className="goal-input">
                  <input
                    type="number"
                    aria-label={t("Цель работы за день")}
                    min="15"
                    max="720"
                    step="15"
                    defaultValue={settings.focusDailyGoalMinutes}
                    key={settings.focusDailyGoalMinutes}
                    onBlur={(event) => {
                      const minutes = Number(event.target.value);
                      if (Number.isInteger(minutes) && minutes >= 15 && minutes <= 720)
                        setting({ focusDailyGoalMinutes: minutes });
                      else event.target.value = settings.focusDailyGoalMinutes;
                    }}
                  />
                  <span>{t("мин")}</span>
                </span>
              </label>
            ) : (
              <div className="setting-row">
                <div>
                  <strong>{t("Учитывать отдых в общем времени")}</strong>
                  <p>{t("Если выключить, рейтинг учитывает только работу и нейтральные программы.")}</p>
                </div>
                <Toggle
                  label={t("Учитывать отдых в рейтинге")}
                  checked={settings.focusIncludeRest}
                  onChange={() => setting({ focusIncludeRest: !settings.focusIncludeRest })}
                />
              </div>
            )}
            <div className="setting-row">
              <div>
                <strong>{t("Польза нейтральных программ")}</strong>
                <p>{t("Доля нейтрального времени, которую рейтинг засчитывает как полезную.")}</p>
              </div>
              <ChoiceSelect
                label={t("Польза нейтральных программ")}
                value={settings.focusNeutralWeight}
                options={neutralWeights}
                onChange={(value) => setting({ focusNeutralWeight: value })}
              />
            </div>
            <p className="settings-footnote">
              {settings.focusScoreMode === "goal"
                ? t("Полезные минуты ÷ дневная цель × 100")
                : t("Полезное время ÷ учитываемое время × 100")}{t(". Полезное время — работа и выбранная доля нейтрального времени. Максимум — 100 баллов. Таймер сам по себе рабочих минут не добавляет.")}</p>
            <button type="button" className="text-button" onClick={onPrograms}>{t("Категории и доли программ")}<ArrowUpRight size={13} aria-hidden="true" />
            </button>
          </div>
        </details>
      </section>
      <section className="settings-group tracking-settings" aria-labelledby="tracking-settings-heading">
        <h2 id="tracking-settings-heading">{t("Учёт времени")}</h2>
        <div className="setting-row">
          <strong>{t("Пауза без движения")}</strong>
          <ChoiceSelect
            label={t("Порог бездействия")}
            value={settings.idleMinutes}
            options={idleThresholds.map((value) => ({
              value,
              label: value ? t("{0} мин", value) : t("Не выключать"),
            }))}
            onChange={(value) => setting({ idleMinutes: value })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>{t("Учёт сайтов")}</strong>
            <p>{t("Домены Chrome и Firefox. По умолчанию выключено.")}</p>
          </div>
          <Toggle
            label={t("Учёт сайтов")}
            checked={settings.trackBrowserSites}
            onChange={() => setting({ trackBrowserSites: !settings.trackBrowserSites })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>{t("Скрывать короткие программы")}</strong>
            <p>{t("Меньше минуты. Их время остаётся в статистике.")}</p>
          </div>
          <Toggle
            label={t("Скрывать короткие программы")}
            checked={settings.hideShort}
            onChange={() => setting({ hideShort: !settings.hideShort })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>{t("Запускать вместе с Windows")}</strong>
            <p>{data.packaged ? t("Запуск в трее, без открытия окна.") : t("Доступно после установки.")}</p>
          </div>
          <Toggle
            label={t("Запускать вместе с Windows")}
            checked={settings.launchAtLogin}
            disabled={!data.packaged}
            onChange={() => setting({ launchAtLogin: !settings.launchAtLogin })}
          />
        </div>
      </section>
      <section className="settings-group privacy-panel" aria-labelledby="data-settings-heading">
        <h2 id="data-settings-heading">{t("Данные")}</h2>
        <div className="backup-actions">
          <button
            type="button"
            className="button"
            onClick={async () => {
              try {
                if (await api.exportData()) notify(t("Резервная копия сохранена"));
              } catch {
                notify(t("Не удалось сохранить копию"));
              }
            }}
          >
            <ArrowDownToLine size={17} aria-hidden="true" />{t("Сохранить копию")}</button>
          <button
            type="button"
            className="button"
            onClick={async () => {
              try {
                if (await api.importData()) notify(t("Данные восстановлены"));
              } catch {
                notify(t("Файл не подходит для Dayline"));
              }
            }}
          >
            <ArrowUpFromLine size={17} aria-hidden="true" />{t("Восстановить")}</button>
          <button type="button" className="text-button" onClick={() => api.openFolder()}>
            <FolderOpen size={16} aria-hidden="true" />{t("Папка данных")}</button>
        </div>
        <p className="settings-footnote">{t("История активности и дневник хранятся на этом компьютере.")}</p>
      </section>
    </div>
  );
}

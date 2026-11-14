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
const idleThresholds = [1, 3, 5, 10, 15, 30, 0].map((value) => ({
  value,
  label: value ? value + " мин" : "Не выключать",
}));

export default function Settings({ data, onSettings, notify, onPrograms }) {
  const { settings } = data;
  const setting = async (patch) => {
    try {
      await onSettings(patch);
      notify("Настройки сохранены");
    } catch (error) {
      notify(error.message || "Не удалось сохранить настройки");
    }
  };

  return (
    <div className="settings-stack">
      <ThemeSettings />
      <MotionSettings />
      <section className="settings-group focus-settings" aria-labelledby="focus-settings-heading">
        <h2 id="focus-settings-heading">Фокус</h2>
        <details className="settings-details">
          <summary className="setting-row">
            <strong>Работа и перерыв</strong>
            <span className="settings-disclosure-value">
              {settings.focusWorkMinutes} / {settings.focusBreakMinutes} мин
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </summary>
          <div className="settings-details-content">
            <FocusPreferences settings={settings} onChange={onSettings} />
            <p className="settings-footnote">Таймер работает в трее и останавливается при блокировке или сне.</p>
          </div>
        </details>
        <div className="setting-row">
          <strong>Рейтинг фокуса</strong>
          <ChoiceSelect
            label="Расчёт фокуса"
            value={settings.focusScoreMode}
            options={scoreModes}
            onChange={(value) => setting({ focusScoreMode: value })}
          />
        </div>
        <details className="settings-details">
          <summary className="setting-row">
            <strong>Параметры рейтинга</strong>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="settings-details-content">
            {settings.focusScoreMode === "goal" ? (
              <label className="setting-row goal-setting">
                <span>
                  <strong>Цель работы за день</strong>
                  <small>От 15 минут до 12 часов</small>
                </span>
                <span className="goal-input">
                  <input
                    type="number"
                    aria-label="Цель работы за день"
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
                  <span>мин</span>
                </span>
              </label>
            ) : (
              <div className="setting-row">
                <div>
                  <strong>Учитывать отдых в общем времени</strong>
                  <p>Если выключить, рейтинг учитывает только работу и нейтральные программы.</p>
                </div>
                <Toggle
                  label="Учитывать отдых в рейтинге"
                  checked={settings.focusIncludeRest}
                  onChange={() => setting({ focusIncludeRest: !settings.focusIncludeRest })}
                />
              </div>
            )}
            <div className="setting-row">
              <div>
                <strong>Польза нейтральных программ</strong>
                <p>Доля нейтрального времени, которую рейтинг засчитывает как полезную.</p>
              </div>
              <ChoiceSelect
                label="Польза нейтральных программ"
                value={settings.focusNeutralWeight}
                options={neutralWeights}
                onChange={(value) => setting({ focusNeutralWeight: value })}
              />
            </div>
            <p className="settings-footnote">
              {settings.focusScoreMode === "goal"
                ? "Полезные минуты ÷ дневная цель × 100"
                : "Полезное время ÷ учитываемое время × 100"}.
              Полезное время — работа и выбранная доля нейтрального времени.
              Максимум — 100 баллов. Таймер сам по себе рабочих минут не добавляет.
            </p>
            <button type="button" className="text-button" onClick={onPrograms}>
              Категории и доли программ
              <ArrowUpRight size={13} aria-hidden="true" />
            </button>
          </div>
        </details>
      </section>
      <section className="settings-group tracking-settings" aria-labelledby="tracking-settings-heading">
        <h2 id="tracking-settings-heading">Учёт времени</h2>
        <div className="setting-row">
          <strong>Пауза без движения</strong>
          <ChoiceSelect
            label="Порог бездействия"
            value={settings.idleMinutes}
            options={idleThresholds}
            onChange={(value) => setting({ idleMinutes: value })}
          />
        </div>
        <div className="setting-row">
          <strong>Сайты в Firefox</strong>
          <Toggle
            label="Учитывать сайты Firefox"
            checked={settings.trackSites}
            onChange={() => setting({ trackSites: !settings.trackSites })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Скрывать короткие программы</strong>
            <p>Меньше минуты. Их время остаётся в статистике.</p>
          </div>
          <Toggle
            label="Скрывать короткие программы"
            checked={settings.hideShort}
            onChange={() => setting({ hideShort: !settings.hideShort })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Запускать вместе с Windows</strong>
            <p>{data.packaged ? "Запуск в трее, без открытия окна." : "Доступно после установки."}</p>
          </div>
          <Toggle
            label="Запускать вместе с Windows"
            checked={settings.launchAtLogin}
            disabled={!data.packaged}
            onChange={() => setting({ launchAtLogin: !settings.launchAtLogin })}
          />
        </div>
      </section>
      <section className="settings-group privacy-panel" aria-labelledby="data-settings-heading">
        <h2 id="data-settings-heading">Данные</h2>
        <div className="backup-actions">
          <button
            type="button"
            className="button"
            onClick={async () => {
              try {
                if (await api.exportData()) notify("Резервная копия сохранена");
              } catch {
                notify("Не удалось сохранить копию");
              }
            }}
          >
            <ArrowDownToLine size={17} aria-hidden="true" />
            Сохранить копию
          </button>
          <button
            type="button"
            className="button"
            onClick={async () => {
              try {
                if (await api.importData()) notify("Данные восстановлены");
              } catch {
                notify("Файл не подходит для Dayline");
              }
            }}
          >
            <ArrowUpFromLine size={17} aria-hidden="true" />
            Восстановить
          </button>
          <button type="button" className="text-button" onClick={() => api.openFolder()}>
            <FolderOpen size={16} aria-hidden="true" />
            Папка данных
          </button>
        </div>
        <p className="settings-footnote">История активности и дневник хранятся на этом компьютере.</p>
      </section>
    </div>
  );
}

import {
  Timer,
  Target,
  ShieldCheck,
  Layers3,
  FolderOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
} from "lucide-react";
import { Panel, Toggle } from "./motion.jsx";
import ThemeSettings from "./ThemeSettings.jsx";
import MotionSettings from "./MotionSettings.jsx";
import { ChoiceSelect } from "./DatePicker.jsx";
import { FocusPreferences } from "./FocusPanel.jsx";
import "./settings.css";
const api = window.dayline;
export default function Settings({ data, onSettings, notify, onPrograms }) {
  const set = async (patch) => {
    await onSettings({ ...data.settings, ...patch });
  };
  const setting = async (patch) => {
    try {
      await set(patch);
      notify("Настройки сохранены");
    } catch (e) {
      notify(e.message || "Не удалось сохранить настройки");
    }
  };
  return (
    <div className="settings-columns">
      <div className="settings-column">
        <ThemeSettings />
        <Panel className="focus-settings">
          <div className="section-heading">
            <h2>
              <span className="heading-icon lime">
                <Target />
              </span>
              Фокус и ритм
            </h2>
          </div>
          <div className="settings-subsection">
            <FocusPreferences settings={data.settings} onChange={set} />
            <p>
              Таймер продолжает работать в трее. При блокировке и сне он встаёт
              на паузу.
            </p>
          </div>
          <div className="settings-subsection">
            <h3>Рейтинг «Фокус дня»</h3>
            <p>
              Рейтинг рассчитывается по экранному времени программ. Таймер сам
              по себе не добавляет рабочие минуты.
            </p>
            <div className="setting-row">
              <div>
                <strong>Как считать рейтинг</strong>
              </div>
              <ChoiceSelect
                label="Расчёт фокуса"
                value={data.settings.focusScoreMode}
                options={[
                  { value: "share", label: "Доля полезного времени" },
                  { value: "goal", label: "Цель по работе" },
                ]}
                onChange={(v) => setting({ focusScoreMode: v })}
              />
            </div>
            {data.settings.focusScoreMode === "goal" ? (
              <label className="goal-setting">
                <span>
                  Цель работы за день <small>От 15 минут до 12 часов</small>
                </span>
                <input
                  type="number"
                  aria-label="Цель работы за день"
                  min="15"
                  max="720"
                  step="15"
                  defaultValue={data.settings.focusDailyGoalMinutes}
                  key={data.settings.focusDailyGoalMinutes}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 15 && n <= 720)
                      setting({ focusDailyGoalMinutes: n });
                    else e.target.value = data.settings.focusDailyGoalMinutes;
                  }}
                />
                <small>мин</small>
              </label>
            ) : (
              <div className="setting-row">
                <div>
                  <strong>Учитывать отдых в общем времени</strong>
                  <p>
                    Если выключить, рейтинг сравнивает только работу и
                    нейтральные программы.
                  </p>
                </div>
                <Toggle
                  label="Учитывать отдых в рейтинге"
                  checked={data.settings.focusIncludeRest}
                  onChange={() =>
                    setting({
                      focusIncludeRest: !data.settings.focusIncludeRest,
                    })
                  }
                />
              </div>
            )}
            <div className="setting-row">
              <div>
                <strong>Польза нейтральных программ</strong>
                <p>Какую часть нейтрального времени считать полезной.</p>
              </div>
              <ChoiceSelect
                label="Польза нейтральных программ"
                value={data.settings.focusNeutralWeight}
                options={[0, 25, 50, 75, 100].map((value) => ({
                  value,
                  label: value + "%",
                }))}
                onChange={(v) => setting({ focusNeutralWeight: v })}
              />
            </div>
            <div className="score-formula">
              {data.settings.focusScoreMode === "goal"
                ? "Полезные минуты ÷ дневная цель × 100"
                : "Полезное время ÷ учитываемое время × 100"}
              <small>
                Полезное время = работа + выбранная доля нейтрального времени.
                Максимум — 100.
              </small>
            </div>
          </div>
          <button className="text-button" onClick={onPrograms}>
            <Layers3 size={14} />
            Категории и доли программ
            <ArrowUpRight size={13} />
          </button>
        </Panel>
      </div>
      <div className="settings-column">
        <MotionSettings />
        <Panel className="tracking-settings">
          <div className="section-heading">
            <h2>
              <span className="heading-icon yellow">
                <Timer />
              </span>
              Учёт времени
            </h2>
          </div>
          <div className="setting-row">
            <div>
              <strong>Пауза без движения</strong>
              <p>
                Время без мыши и клавиатуры исключается после выбранного
                интервала.
              </p>
            </div>
            <ChoiceSelect
              label="Порог бездействия"
              value={data.settings.idleMinutes}
              options={[1, 3, 5, 10, 15, 30, 0].map((value) => ({
                value,
                label: value ? value + " мин" : "Не выключать",
              }))}
              onChange={(v) => setting({ idleMinutes: v })}
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Скрывать короткие программы</strong>
              <p>Меньше минуты. Их время остаётся в статистике.</p>
            </div>
            <Toggle
              label="Скрывать короткие программы"
              checked={data.settings.hideShort}
              onChange={() => setting({ hideShort: !data.settings.hideShort })}
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Сайты в Firefox</strong>
              <p>Только домены активной вкладки, локально.</p>
            </div>
            <Toggle
              label="Учитывать сайты Firefox"
              checked={data.settings.trackSites}
              onChange={() =>
                setting({ trackSites: !data.settings.trackSites })
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Запускать вместе с Windows</strong>
              <p>
                {data.packaged
                  ? "Запуск в трее, без открытия окна."
                  : "Доступно после установки."}
              </p>
            </div>
            <Toggle
              label="Запускать вместе с Windows"
              checked={data.settings.launchAtLogin}
              disabled={!data.packaged}
              onChange={() =>
                setting({ launchAtLogin: !data.settings.launchAtLogin })
              }
            />
          </div>
          <p className="settings-footnote">
            При закрытии окна Dayline остаётся в трее. Завершить программу можно
            через меню значка.
          </p>
        </Panel>
        <Panel className="privacy-panel">
          <div className="section-heading">
            <h2>
              <span className="heading-icon cyan">
                <ShieldCheck />
              </span>
              Данные на этом компьютере
            </h2>
          </div>
          <p className="settings-footnote">
            Программы, домены Firefox, время и дневник хранятся локально.
            Интернет для работы не нужен.
          </p>
          <div className="backup-actions">
            <button
              className="button"
              onClick={async () => {
                try {
                  if (await api.exportData())
                    notify("Резервная копия сохранена");
                } catch {
                  notify("Не удалось сохранить копию");
                }
              }}
            >
              <ArrowDownToLine size={16} />
              Сохранить копию
            </button>
            <button
              className="button subtle-button"
              onClick={async () => {
                try {
                  if (await api.importData()) notify("Данные восстановлены");
                } catch {
                  notify("Файл не подходит для Dayline");
                }
              }}
            >
              <ArrowUpFromLine size={16} />
              Восстановить
            </button>
            <button className="text-button" onClick={() => api.openFolder()}>
              <FolderOpen size={15} />
              Папка данных
              <ArrowUpRight size={13} />
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

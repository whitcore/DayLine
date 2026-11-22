# DayLine

**See where your day went.** DayLine is a Windows app that tracks time in the active window and puts it beside a focus timer and a daily journal.

[Download DayLine for Windows x64](https://github.com/whitcore/DayLine/releases/latest) · [Changelog](CHANGELOG.md)

![DayLine in Graphite with the Today dashboard and an expanded Firefox activity list](docs/screenshots/dayline-cover.png)

## What actually counted

Firefox might be open from breakfast to dinner. DayLine measures the time you spend in its foreground window while tracking is active. The daily timeline shows the stretches you spent coding, reading or chatting, with gaps for time away. Tracking pauses when Windows locks or reaches your chosen idle threshold. You can also pause from the system tray.

![The Today dashboard showing 5 hours and 21 minutes of active time, the daily focus score and the activity timeline](docs/screenshots/today.png)

The screenshots use a demonstration profile.

## A closer look at Firefox

Expand Firefox in the app list to see time by hostname. In the example, GitHub took 28 minutes, the MDN docs took 19 and YouTube took another 19. The saved browser detail is the hostname. The Firefox setting in DayLine controls whether those details are collected. Other browsers are tracked at app level.

![Firefox expanded to show time and categories for GitHub, MDN and YouTube](docs/screenshots/firefox.png)

Give a site its own category or let it inherit the browser’s category. Apps can use one category or split their time by percentage. The daily focus score can show a share of active time or progress toward a time goal you set.

## See the shape of a week

Open Statistics to review seven days, pick your own date range or see all recorded time. Filter the chart by category to see when your study time landed, then open a day for its timeline. The app list below the chart shows how time broke down during the selected period.

![The same sample history viewed as a custom date range and as all time](docs/screenshots/statistics.png)

## Make room for the next stretch

Start a work interval from Today. The focus timer defaults to 25 minutes of work and a five-minute break, with both durations adjustable. When the day winds down, use the journal to mark your mood, write down what you got done or leave yourself a note for tomorrow.

![The DayLine journal with a date list, mood selector and an example note](docs/screenshots/journal.png)

DayLine includes English and Russian, five themes and configurable motion. Graphite keeps the focus on the screen-time total, while the vivid and soft themes change the palette.

![Screen-time summaries in Graphite, Vivid dark and Soft light](docs/screenshots/themes.png)

## Install and update

1. Download **Dayline-Setup-1.5.2.exe** from [GitHub Releases](https://github.com/whitcore/DayLine/releases/latest).
2. Run the installer on Windows 10 or 11 x64. It installs for the current user. The installer is unsigned and Windows SmartScreen may show a warning.
3. For an update, save a backup in Settings and exit DayLine from the tray before running the installer.

The installer includes the runtime. Activity and journal entries stay on your computer in `%APPDATA%\Dayline`. Settings lets you open that folder, export a backup or restore one. Recorded history starts with your first run.

## Build and verify

On Windows x64 with Node.js 24 and npm:

```powershell
npm.cmd ci
npm.cmd start
npm.cmd test
npm.cmd run test:desktop
npm.cmd run package
```

The package command produces the NSIS installer in `release/1.5.2`. The desktop check launches Electron with a separate test profile. For implementation details, see the [architecture notes](docs/ARCHITECTURE.md).

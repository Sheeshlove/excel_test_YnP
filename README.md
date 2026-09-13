# Excel Trainer — preparation for the Yakov & Partners test

A macOS app that takes you from "what is a cell reference" to building a pivot
table and decomposing revenue growth on a consulting case.

Tasks are solved **in a real spreadsheet inside the app** — with its own formula
engine, recalculation, sorting, filtering, pivot tables and Excel's keyboard
shortcuts. What gets marked is the value you produced, not a multiple-choice tick.

<img src="docs/screenshot-task.png" alt="A solved task with the explanation panel" width="100%">

---

## Built to the published test format

The firm describes the test as follows, and the app mirrors it:

| The firm says | In the app |
|---|---|
| 20 questions of mixed difficulty | Level 12 is a 20-question mock test |
| 60 minutes | A 60-minute countdown, marking at the end |
| Working with tables, formulas and **pivot tables** | Levels 7 and 8 are entirely sorting/filtering and pivot tables |
| Basic and advanced formulas: SUM, AVERAGE, COUNT; IF, IFS, SUMIF; VLOOKUP, INDEX/MATCH | Levels 1–6 |
| Sorting by criteria and filtering | Level 7, with a working autofilter and SUBTOTAL |
| Pivot tables: grouping, filters, calculated fields | Level 8, with a real pivot builder |
| Every question mirrors a real consulting case | Every data set is a deal book, a P&L or a business case |
| VBA and Power Query are **not** required | Not taught, not needed |

---

## Quick start

```bash
git clone <repository url>
cd excel_test_YnP
./build_app.sh          # builds ExcelTrainer.app next to the script
open ExcelTrainer.app   # or double-click it in Finder
```

The app is self-contained and can be dragged into `/Applications`.

If you would rather not build the bundle:

```bash
./run.sh                # starts a local server and opens the trainer
```

Last resort: open `app/index.html` in Google Chrome. Safari will not save
progress that way, because it blocks storage for local files.

### What `build_app.sh` does

| Step | If the tool is present | If it is not |
|---|---|---|
| `swiftc` (Xcode CLT) | builds a native WKWebView window — the app opens with no browser | the app opens as a tab-less, address-bar-less Chrome/Edge/Brave window |
| `python3` | runs a local server on 127.0.0.1, so progress is always saved | the page opens as a file; Chrome still saves progress, Safari does not |
| `sips` + `iconutil` | builds a proper `.icns` icon | the icon is copied as a PNG |

For the best of all three:

```bash
xcode-select --install
```

The bundle is built on your own machine, so Gatekeeper does not block it —
locally created files carry no quarantine attribute.

---

## The programme

Twelve levels, 83 tasks, 2,195 points. A level opens once the previous one
reaches 60% of its points.

| # | Level | What it covers |
|---|---|---|
| 1 | References and arithmetic | addresses, operators, `$A$1` versus `A1`, mixed references |
| 2 | Rounding, growth and averages | `ROUND`, growth rates, CAGR, weighted averages, median versus mean |
| 3 | Logic: the IF family | `IF`, nesting, `AND`/`OR`, `IFERROR`, discount ladders |
| 4 | Conditional aggregates | `SUMIFS`, `COUNTIFS`, a cross-tab from a single formula, wildcards |
| 5 | Looking data up | `VLOOKUP` exact and approximate, `INDEX`+`MATCH`, two-way lookup, `XLOOKUP` |
| 6 | Text and dates | cleaning exports, splitting names, composite keys, quarters, `EOMONTH`, `DATEDIF` |
| 7 | **Tables, sorting and filtering** | autofilter, multi-value filters, sorting, `SUBTOTAL`, concentration curves |
| 8 | **Pivot tables** | rows/columns/values/filters, aggregations, % of total, calculated fields |
| 9 | Financial calculations | discounting, `NPV`, `IRR`, `PMT`, unit economics, break-even |
| 10 | Data analysis | `SUMPRODUCT` conditions, sensitivity tables, cohorts, scorecards, variance |
| 11 | Consulting cases | market sizing both ways, price-volume-mix, the EBITDA bridge, capacity, pricing |
| 12 | **Mock test** | 20 questions, 60 minutes, no hints, 70% to pass |

Alongside the levels:

* **Shortcut dojo** — rapid-fire drills on 37 macOS Excel shortcuts, on which
  function solves which problem, and on what each error code means. Answer with
  the number keys; never touch the mouse.
* **Reference** — shortcuts side by side for macOS and Windows, functions with
  their typical use, and the meaning of `#N/A`, `#VALUE!`, `#REF!` and the rest.
* **Progress** — XP, daily streak, dojo accuracy, mock test history, and a list
  of tasks worth revisiting.

---

## Every task is explained afterwards

Solving a task opens a walkthrough with four parts:

1. **The idea** — the mental model in one paragraph.
2. **The walkthrough** — what happened, step by step, with the actual numbers.
3. **Your own formula, taken apart** — the app parses *what you typed*, evaluates
   every sub-expression separately and shows the intermediate values:

   ```
   SUMIFS($F$2:$F$21, $B$2:$B$21, $I3, $E$2:$E$21, "Won")   = 20,300
     SUMIFS — adds up only the rows that meet every condition
     ! Excel walked through all 20 rows, kept the 3 rows where the value
       equals "Moscow" AND the value equals "Won", and worked only on those.
       range to add:  $F$2:$F$21  = 20 cells [4,200, 2,800, 9,500, …]
       range to test: $B$2:$B$21  = 20 cells ["Moscow", "St Petersburg", …]
       condition:     $I3         = "Moscow"
   ```

   This works on any formula, not just the reference answer — so a formula that
   is wrong gets explained too, which is usually when you need it most.
4. **What people get wrong** and **on a real project** — the mistakes that cost
   marks, and where the technique shows up in actual consulting work.

---

## Nothing you do can cost you progress

This is deliberate, and the app says so on the home screen:

* A wrong answer costs **nothing**. Only your best attempt at a task is ever
  recorded; a score can go up, never down.
* **Clear my work** clears the current task only. Points, other tasks and the
  mock test history are untouched.
* A level opens at **60%** of the previous level's points, so one task you
  cannot crack today never blocks you — skip it and come back.
* A failed mock test changes nothing except adding a row to your history. Sit it
  as often as you like.
* Work in progress is kept while the app is open, so clicking away from a
  half-finished task and coming back does not throw it away.
* The only thing that erases progress is the **Erase everything** button on the
  Progress page, behind a confirmation.

---

## Shortcuts inside the trainer

They behave exactly as in Excel for macOS.

| Shortcut | What it does |
|---|---|
| `⌘D` / `⌘R` | fill down / right, shifting relative references |
| `⌘T` or `F4` | cycle `A1` → `$A$1` → `A$1` → `$A1` while typing |
| `⌘⇧F` | turn the autofilter on, then use the ▾ arrows to sort and filter |
| `⌘↓` `⌘→` | jump to the edge of the data |
| `⌘⇧↓` | select to the edge of the data |
| `F2` | edit the cell |
| `⌘C` / `⌘V` / `⌘X` / `⌘Z` | copy, paste (references shift), cut, undo |
| `Delete` | clear the selection |
| `Tab` / `Enter` | move right / down |

While typing a formula, clicking a cell inserts its address, just like Excel.
The status bar shows the sum, average and count of the selection.

> If your browser steals `⌘T` to open a new tab, use `F4`. In the native window
> built by `swiftc`, `⌘T` is free and works properly.

---

## Formulas: English and Russian

The engine understands both languages and both argument separators:

```
=SUMIFS($F$2:$F$21, $B$2:$B$21, $I3, $C$2:$C$21, J$2)
=СУММЕСЛИМН($F$2:$F$21; $B$2:$B$21; $I3; $C$2:$C$21; J$2)
```

The Russian decimal comma works the way it does in a Russian Excel:
`ОКРУГЛ(2,5;0)` is 3, while `SUM(1,2)` in English notation is two arguments.

About 130 functions are implemented: maths and statistics, logic, conditional
aggregates, lookup (`XLOOKUP`, `OFFSET`, `INDIRECT` included), text, dates,
finance (`NPV`, `IRR`, `XNPV`, `XIRR`, `PMT`, `PV`, `FV`, `NPER`, `RATE`),
`SUBTOTAL` that respects filters, information functions, and array expressions
such as `SUMPRODUCT((B2:B21="Moscow")*F2:F21)`. Excel's error values propagate
through formulas the way they do in Excel.

---

## Development

```bash
npm install        # only needed for the browser tests (playwright)
npm test           # runs everything
```

| Suite | What it checks |
|---|---|
| `tests/formula.test.js` | 122 checks on the engine, every expected value verified against Excel's behaviour |
| `tests/curriculum.test.js` | 3,466 checks: every task's reference answer solves it, raises no Excel error, and an untouched sheet fails; every address named in a task exists; every task has an explanation; the mock test matches the published 20-question / 60-minute format |
| `tests/ui.test.js` | 65 checks in a real Chromium: typing formulas, `⌘D`, `⌘T`, `⌘Z`, sorting, filtering with `SUBTOTAL`, building and marking pivot tables, the explanation panel, the timed mock test, the guarantee that a failed retry never lowers a score, and all 83 tasks opening cleanly |

### Layout

```
app/                 the application (also opens as a plain web page)
  js/formula.js      tokenizer, parser and interpreter for formulas
  js/engine.js       the sheet model: cells, recalculation, sorting, filters
  js/pivot.js        the pivot table engine
  js/explain.js      takes a formula apart and explains it in plain English
  js/grader.js       marking, including sorting, filters and pivot layouts
  js/curriculum.js   12 levels and 83 tasks, each with its explanation
  js/drills.js       the dojo: shortcuts, functions, errors
  js/grid.js         the interactive sheet with Excel's keyboard
  js/pivotui.js      the pivot builder
  js/app.js          screens and navigation
  js/storage.js      progress
packaging/           server, launcher, native Swift window, icon
build_app.sh         builds ExcelTrainer.app
run.sh               runs it without building a bundle
tests/               the checks
```

### Adding a task

In `app/js/curriculum.js`, add an object to the level you want:

```js
{
  id: '4.7', title: 'Title', points: 25,
  brief: 'What the learner has to do',
  hint: 'A hint, which costs 30% of the points',
  sheet: { cells: { A1: 'Header', A2: 100 }, styles: { 'A1:B1': H } },
  table: 'A1:G21',                          // enables the autofilter
  target: ['C2:C6'],                        // the cells the learner fills
  solution: { 'C2:C6': '=A2*B2' },          // the reference answer, and the source of truth
  expect: {                                 // optional, for non-formula work
    sortedBy: { col: 'F', asc: false },
    filtered: { col: 'B', values: ['Moscow'] },
    pivot: { rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }] }
  },
  check: { '*': { mustUse: ['SUMIFS'] } },
  explain: { idea: '…', walk: ['…'], mistakes: ['…'], onTheJob: '…' }
}
```

A reference formula given for a range is written into its first cell and
stretched over the rest, shifting references exactly as `⌘D` would. Run
`npm run test:curriculum` afterwards: it verifies the task is solvable, that the
reference answer raises no error, that an untouched sheet fails, and that every
cell address mentioned in the wording actually exists.

---

## Your data

Progress is stored in the app's own browser storage and never leaves your
machine. The Progress page can export it to a file and load it back, for
instance to move it to another computer.

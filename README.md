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
| 20 questions of mixed difficulty | Level 12 holds **50 mock tests**, 20 questions each |
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

### Where your progress is kept

```
~/Library/Application Support/ExcelTrainer/progress.json
```

A real file, written after every answer and again as the app quits. It is
written by whichever of these the app has:

| | |
|---|---|
| the native window (`swiftc` present) | writes the file itself, so progress is kept even with no Python and no browser storage at all |
| the local server (`python3` present) | the page saves through `/api/progress`, and the server writes the same file |
| neither | the browser's own storage, which Chrome keeps and Safari does not |

Because the file is what matters, progress no longer depends on which port the
local server happened to get, which browser the launcher found, or whether the
page was opened as a file. The **Progress** page names the exact file it is
using, and can export it and load it back to move to another machine.

### What `build_app.sh` does

| Step | If the tool is present | If it is not |
|---|---|---|
| `swiftc` (Xcode CLT) | builds a native WKWebView window — the app opens with no browser | the app opens as a tab-less, address-bar-less Chrome/Edge/Brave window |
| `python3` | runs a local server on a fixed port on 127.0.0.1, which holds the progress file | the page opens as a file; the native window still saves, a browser only if it is Chrome |
| `sips` + `iconutil` | builds a proper `.icns` icon | the icon is copied as a PNG |

For the best of all three:

```bash
xcode-select --install
```

The bundle is built on your own machine, so Gatekeeper does not block it —
locally created files carry no quarantine attribute.

---

## The programme

Twelve levels, 83 tasks, 2,195 points — plus 50 mock tests of 20 questions each.
**Everything is open from the first launch**: no level has to be unlocked, and
any of the fifty papers can be sat on day one. The order below is a
recommendation, not a gate.

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
| 12 | **Mock tests** | 50 papers, each 20 questions in 60 minutes, no hints, 70% to pass |

Alongside the levels:

* **Shortcut dojo** — rapid-fire drills on 37 macOS Excel shortcuts, on which
  function solves which problem, and on what each error code means. Answer with
  the number keys; never touch the mouse.
* **Reference** — shortcuts side by side for macOS and Windows, functions with
  their typical use, and the meaning of `#N/A`, `#VALUE!`, `#REF!` and the rest.
* **Progress** — XP, daily streak, dojo accuracy, which of the fifty papers you
  have sat and passed, every sitting with its score and time, and a list of
  tasks worth revisiting.

---

## Fifty mock tests

Level 12 is not one paper but fifty, and all of them are available immediately.

Paper 1 is written out by hand, question by question, with a full walk-through
of every answer. Papers 2 to 50 are built by `app/js/mocktests.js`: each one gets
its own transaction book — its own regions, products, managers, dates, prices and
volumes — and draws twenty questions from a bank of question types under fixed
quotas:

| Area | Questions per paper |
|---|---|
| Basic aggregates — `SUM`, `AVERAGE`, `COUNT`, `MEDIAN`, `LARGE` | 2 |
| Conditional aggregates — `SUMIFS`, `COUNTIFS`, `AVERAGEIFS`, wildcards, `SUMPRODUCT`, the region × product cross-tab | 4 |
| Logic — `IF`, nesting, `AND`/`OR` | 2 |
| Lookups — `VLOOKUP` exact and approximate, `INDEX`+`MATCH`, two-way lookup, `IFERROR` | 3 |
| Text and dates — composite keys, `MONTH` and quarters, `EOMONTH`, date arithmetic | 2 |
| Analysis — shares of total, weighted averages, concentration, CAGR, `NPV`/`IRR`, break-even | 3 |
| Sorting | 1 |
| Filtering with `SUBTOTAL` | 1 |
| Pivot tables — rows, columns, report filters, % of total, calculated fields | 2 |

So every paper covers everything the firm says it assesses, and no two papers
ask the same question of the same numbers.

Each paper is derived from its own number by a seeded generator, so **paper 7 is
the same paper 7 on every machine and after every relaunch** — a score today is
comparable with your score on it last week. Nothing is stored as an answer: as
everywhere else in the app, each question carries the formula that solves it and
the marking works the expected value out by running that formula.

The mock test page shows all fifty as a grid, marked green where you passed and
amber where you have sat one without passing, and offers you the first one you
have not yet taken. Sitting a paper never costs you anything: a poor run adds a
row to your history and nothing else.

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
* Every level and every mock test is **open from the start**, so one task you
  cannot crack today never blocks you — skip it and come back.
* A failed mock test changes nothing except adding a row to your history. Sit any
  paper as often as you like.
* The only thing that erases progress is the **Erase everything** button on the
  Progress page, behind a confirmation.

What is *not* kept is the sheet itself — see below.

---

## Every attempt starts from a clean sheet

Open a task and it is blank, every time. What you typed on a previous visit is
never carried over: leave a half-finished task, come back, and you get the
question as it was first posed. The same goes for a mock test — opening a paper
again is a new attempt on empty sheets with a fresh hour on the clock, so a
score means the same thing every time you sit it.

The one exception is a mock test that is **under way**: moving between its
twenty questions keeps your answers, because the published format says you may
work through them in any order. That lasts exactly as long as the sitting does.
Walk out of the paper and the sitting is over — the app asks first if you have
answered anything, and says so afterwards.

None of this touches your points. Sheets are cleared; XP, best scores, the
review list and the mock test history are not, and a cleared sheet can only ever
let a score go up.

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
| `tests/curriculum.test.js` | 37,136 checks over the 83 tasks **and all 1,000 mock test questions**: every reference answer solves its task, raises no Excel error, and an untouched sheet fails; every address named in a task exists; every task has an explanation; every one of the 50 papers matches the published 20-question / 60-minute format and is reproducible from its number |
| `tests/ui.test.js` | 81 checks in a real Chromium: typing formulas, `⌘D`, `⌘T`, `⌘Z`, sorting, filtering with `SUBTOTAL`, building and marking pivot tables, the explanation panel, the timed mock test, the guarantee that a failed retry never lowers a score, that every level and all 50 papers are open on a fresh install, that progress written to the file store survives the browser's own storage being wiped, and 133 tasks opening cleanly |

### Layout

```
app/                 the application (also opens as a plain web page)
  js/formula.js      tokenizer, parser and interpreter for formulas
  js/engine.js       the sheet model: cells, recalculation, sorting, filters
  js/pivot.js        the pivot table engine
  js/explain.js      takes a formula apart and explains it in plain English
  js/grader.js       marking, including sorting, filters and pivot layouts
  js/curriculum.js   12 levels and 83 tasks, each with its explanation
  js/mocktests.js    the bank: 50 mock papers of 20 questions, generated
  js/drills.js       the dojo: shortcuts, functions, errors
  js/grid.js         the interactive sheet with Excel's keyboard
  js/pivotui.js      the pivot builder
  js/app.js          screens and navigation
  js/storage.js      progress
packaging/           server and progress store, launcher, native Swift window, icon
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

### Adding a mock test question type

In `app/js/mocktests.js`, call `question(id, group, points, make)`. `make`
receives the paper's data and returns the same object as above, minus the `id`
and `points`, which the paper assigns:

```js
question('share-of-revenue', 'analysis', 25, function (d) {
  var region = d.commonest('region');           // never an empty answer
  return {
    title: 'Share of one region',
    brief: 'J2 — the share of total revenue booked in ' + region + '.',
    hint: 'SUMIF over the Region column, divided by SUM of the whole column.',
    sheet: sheetFor(d, metricBlock([region + ' share of revenue'])),
    table: TABLE,
    target: ['J2'],
    solution: { J2: '=SUMIF($B$2:$B$16,"' + region + '",$G$2:$G$16)/SUM($G$2:$G$16)' },
    check: { J2: { mustUseAny: ['SUMIF', 'SUMIFS'] } },
    explain: { idea: '…', walk: ['…'], mistakes: ['…'], onTheJob: '…' }
  };
});
```

The `group` must be one of the quota groups above, and adding one to a group
changes what all fifty papers can draw. Derive the parameters from the data
(`d.commonest`, `d.byRevenue`, `d.sumWhere`) rather than hard-coding them, so the
question is answerable whatever numbers the paper happened to get. Then run
`npm run test:curriculum`: it puts the new type through all fifty papers.

---

## Your data

Progress lives in one file on your own machine —
`~/Library/Application Support/ExcelTrainer/progress.json` — and never leaves
it. The Progress page names the file it is using, can export it and load it
back, for instance to move to another computer, and **Erase everything** is the
only thing that removes it.

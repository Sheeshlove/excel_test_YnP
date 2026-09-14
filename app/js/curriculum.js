/* =============================================================================
 * curriculum.js — training programme for the Yakov & Partners Excel test
 *
 * The official brief for the test is:
 *   · 20 questions of mixed difficulty, 60 minutes
 *   · what is assessed: working with tables, formulas and PIVOT TABLES
 *   · every question mirrors a real case a consultant meets on a project
 *   · VBA and Power Query are NOT required
 *
 * The right answer to every task is computed from the reference formula rather
 * than stored as a constant, so the wording and the answer cannot drift apart.
 * ========================================================================== */
(function (root, factory) {
  var isNode = (typeof module === 'object' && module.exports);
  var MOCKS = isNode ? require('./mocktests.js') : root.XLMockTests;
  var mod = factory(MOCKS);
  if (isNode) module.exports = mod;
  else root.XLCurriculum = mod;
})(typeof self !== 'undefined' ? self : this, function (MOCKS) {
  'use strict';

  var H = { header: true };          // header styling
  var LEVELS = [];
  var COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  /* ------------------- shared deal book (levels 4, 7, 8, 10) --------------- */
  var DEAL_HEAD = ['Deal', 'Region', 'Industry', 'Manager', 'Stage', 'Revenue', 'Margin'];
  var DEALS = [
    ['D-001', 'Moscow', 'Retail', 'Ivanov', 'Won', 4200, 0.34],
    ['D-002', 'St Petersburg', 'Financials', 'Petrova', 'Won', 2800, 0.41],
    ['D-003', 'Moscow', 'Energy', 'Sidorov', 'In progress', 9500, 0.22],
    ['D-004', 'Urals', 'Manufacturing', 'Kuznetsov', 'Won', 3100, 0.28],
    ['D-005', 'Moscow', 'Retail', 'Petrova', 'Lost', 1800, 0.31],
    ['D-006', 'Volga', 'Public sector', 'Volkova', 'Won', 2450, 0.19],
    ['D-007', 'St Petersburg', 'Retail', 'Ivanov', 'In progress', 5600, 0.36],
    ['D-008', 'Siberia', 'Energy', 'Kuznetsov', 'Won', 12400, 0.24],
    ['D-009', 'Moscow', 'Financials', 'Ivanov', 'Won', 7300, 0.45],
    ['D-010', 'Urals', 'Manufacturing', 'Sidorov', 'Lost', 2900, 0.26],
    ['D-011', 'St Petersburg', 'Public sector', 'Volkova', 'In progress', 1650, 0.17],
    ['D-012', 'Volga', 'Retail', 'Petrova', 'Won', 3400, 0.33],
    ['D-013', 'Siberia', 'Manufacturing', 'Kuznetsov', 'Won', 5100, 0.29],
    ['D-014', 'Moscow', 'Public sector', 'Sidorov', 'Won', 8800, 0.21],
    ['D-015', 'Urals', 'Energy', 'Volkova', 'In progress', 6700, 0.23],
    ['D-016', 'St Petersburg', 'Financials', 'Petrova', 'Won', 4950, 0.47],
    ['D-017', 'Volga', 'Manufacturing', 'Ivanov', 'Lost', 2100, 0.25],
    ['D-018', 'Siberia', 'Retail', 'Volkova', 'Won', 3750, 0.38],
    ['D-019', 'Moscow', 'Manufacturing', 'Kuznetsov', 'In progress', 10200, 0.27],
    ['D-020', 'Urals', 'Financials', 'Sidorov', 'Won', 3900, 0.43]
  ];

  function dealCells(extra) {
    var cells = {};
    DEAL_HEAD.forEach(function (h, i) { cells[COLS[i] + '1'] = h; });
    DEALS.forEach(function (row, r) {
      row.forEach(function (v, i) { cells[COLS[i] + (r + 2)] = v; });
    });
    Object.keys(extra || {}).forEach(function (k) { cells[k] = extra[k]; });
    return cells;
  }
  var DEAL_BASE = {
    rows: 24, cols: 14,
    colWidths: { A: 80, B: 130, C: 130, D: 100, E: 110, F: 100, G: 80 },
    styles: { 'A1:G1': H },
    formats: { 'G2:G21': '0%' }
  };
  function dealSheet(extra, opts) {
    var sp = Object.assign({}, DEAL_BASE, opts || {});
    sp.styles = Object.assign({}, DEAL_BASE.styles, (opts && opts.styles) || {});
    sp.formats = Object.assign({}, DEAL_BASE.formats, (opts && opts.formats) || {});
    sp.colWidths = Object.assign({}, DEAL_BASE.colWidths, (opts && opts.colWidths) || {});
    sp.cells = dealCells(extra);
    return sp;
  }

  /* ========================================================== LEVEL 1 ===== */
  LEVELS.push({
    id: 1,
    title: 'References and arithmetic',
    subtitle: 'How a sheet actually works: addresses, operators, the dollar sign',
    goal: 'Do the arithmetic in the cells instead of in your head, and understand the difference between A1, $A1 and $A$1.',
    theory: [
      { h: 'Every formula starts with =', p: 'Type =B2-C2 and Excel works out the difference and recalculates it the moment the inputs change. A number typed in by hand is a review failure in consulting: the model stops being alive.' },
      { h: 'Relative and absolute references', p: 'B2 becomes B3 when you copy the formula down. $B$2 never moves. $B2 locks the column, B$2 locks the row. ⌘T on a Mac (F4 on Windows) cycles through the four combinations while you type.' },
      { h: 'Order of operations', p: '^ first, then * and /, then + and -. Brackets decide everything: =(A1+A2)*B1 is not the same as =A1+A2*B1.' },
      { h: 'The consultant’s rule', p: 'One cell, one meaning. Never write =4200*0.35 — put 0.35 in its own labelled cell so the assumption can be changed in one place and checked by a reviewer.' }
    ],
    tasks: [
      {
        id: '1.1', title: 'Gross profit', points: 10,
        brief: 'Work out the gross profit of every line of business: revenue minus cost of sales. Fill D2:D6.',
        hint: 'Put =B2-C2 in D2 and pull it down (⌘D, or double-click the fill handle).',
        sheet: {
          rows: 8, cols: 5,
          colWidths: { A: 160, B: 110, C: 130, D: 130 },
          styles: { 'A1:D1': H },
          cells: {
            A1: 'Line of business', B1: 'Revenue', C1: 'Cost of sales', D1: 'Gross profit',
            A2: 'Consulting', B2: 4200, C2: 2500,
            A3: 'Training', B3: 1350, C3: 700,
            A4: 'Software', B4: 2800, C4: 1200,
            A5: 'Support', B5: 900, C5: 620,
            A6: 'Licences', B6: 1600, C6: 400
          }
        },
        target: ['D2:D6'],
        solution: { 'D2:D6': '=B2-C2' },
        explain: {
          idea: 'A formula is a recipe, not a result. =B2-C2 does not mean "1700" — it means "whatever sits in B2 minus whatever sits in C2". Change B2 and the answer follows on its own.',
          walk: [
            'You typed the formula once, in D2. Excel read it as "take the cell two to my left, subtract the cell one to my left".',
            'When you pulled it down to D3, Excel did NOT copy the text "=B2-C2". It copied the meaning — two to my left, one to my left — which in row 3 reads =B3-C3. That is what a relative reference is.',
            'So one formula, written once, filled five rows. On a real data dump that is 50,000 rows and the same single keystroke.'
          ],
          mistakes: [
            'Typing 1700 straight into the cell. It matches the right answer today and is wrong tomorrow, and any reviewer will spot it by pressing ⌃` to reveal the formulas.',
            'Writing =4200-2500. Same problem: the numbers are frozen into the formula instead of being read from the sheet.'
          ],
          onTheJob: 'Every P&L you will ever build is this one line repeated: revenue, minus a cost, equals a margin. Getting the habit right here is what makes a 40-tab model auditable later.'
        }
      },
      {
        id: '1.2', title: 'Gross margin as a percentage', points: 10,
        brief: 'In column E work out the gross margin: gross profit divided by revenue. Fill E2:E6.',
        hint: 'Margin is =D2/B2. The result is a share of 1; the percentage format is already applied for you.',
        sheet: {
          rows: 8, cols: 6,
          colWidths: { A: 160, B: 110, C: 130, D: 130, E: 140 },
          styles: { 'A1:E1': H },
          formats: { 'E2:E6': '0.0%' },
          cells: {
            A1: 'Line of business', B1: 'Revenue', C1: 'Cost of sales', D1: 'Gross profit', E1: 'Gross margin',
            A2: 'Consulting', B2: 4200, C2: 2500, D2: 1700,
            A3: 'Training', B3: 1350, C3: 700, D3: 650,
            A4: 'Software', B4: 2800, C4: 1200, D4: 1600,
            A5: 'Support', B5: 900, C5: 620, D5: 280,
            A6: 'Licences', B6: 1600, C6: 400, D6: 1200
          }
        },
        target: ['E2:E6'],
        solution: { 'E2:E6': '=D2/B2' },
        explain: {
          idea: 'A percentage in Excel is just the number 0.4047 wearing a costume. The cell stores the share; the percentage format multiplies it by 100 on screen and adds the % sign.',
          walk: [
            '=D2/B2 gives 1700/4200 = 0.4047…',
            'The cell has a 0.0% format applied, so it is displayed as 40.5%. The stored value is still 0.4047 — click the cell and look at the formula bar.',
            'This matters: if you later multiply by that cell you get the right answer, because you are multiplying by 0.4047, not by 40.5.'
          ],
          mistakes: [
            'Writing =D2/B2*100 and then also applying a percentage format. You end up with 4047% — the classic double-counting slip.',
            'Dividing by the wrong base. Margin is always profit ÷ revenue. Profit ÷ cost is a mark-up, a different number, and mixing the two is a real-life pricing error.'
          ],
          onTheJob: 'Margin by product is the first cut of any profitability diagnostic. The answer here already tells a story: Support earns 31% of the revenue Consulting does but only 16% of the margin.'
        }
      },
      {
        id: '1.3', title: 'Portfolio totals', points: 15,
        brief: 'Fill the summary block B9:B13 for revenue: total, average, minimum, maximum and the number of business lines.',
        hint: 'SUM, AVERAGE, MIN, MAX, COUNT. The range is the same every time: B2:B6.',
        sheet: {
          rows: 15, cols: 4,
          colWidths: { A: 200, B: 120 },
          styles: { 'A1:B1': H, 'A9:A13': { label: true } },
          cells: {
            A1: 'Line of business', B1: 'Revenue',
            A2: 'Consulting', B2: 4200, A3: 'Training', B3: 1350, A4: 'Software', B4: 2800,
            A5: 'Support', B5: 900, A6: 'Licences', B6: 1600,
            A9: 'Total revenue', A10: 'Average revenue', A11: 'Minimum', A12: 'Maximum', A13: 'Number of lines'
          }
        },
        target: ['B9', 'B10', 'B11', 'B12', 'B13'],
        solution: { B9: '=SUM(B2:B6)', B10: '=AVERAGE(B2:B6)', B11: '=MIN(B2:B6)', B12: '=MAX(B2:B6)', B13: '=COUNT(B2:B6)' },
        check: {
          B9: { mustUse: ['SUM'] }, B10: { mustUse: ['AVERAGE'] }, B11: { mustUse: ['MIN'] },
          B12: { mustUse: ['MAX'] }, B13: { mustUse: ['COUNT'] }
        },
        explain: {
          idea: 'B2:B6 is one argument, not five. The colon means "everything from here to there", and every aggregate function accepts it.',
          walk: [
            'SUM(B2:B6) adds 4200 + 1350 + 2800 + 900 + 1600 = 10,850.',
            'AVERAGE is that total divided by how many NUMBERS there were, so 10,850 / 5 = 2,170.',
            'COUNT returned 5 because all five cells hold numbers. If one held the text "n/a", COUNT would say 4 — COUNT only counts numbers. COUNTA would say 5, because it counts anything non-empty.'
          ],
          mistakes: [
            'Using COUNT where you meant COUNTA. On a text column COUNT returns 0 and people conclude the data is empty.',
            'Writing =B2+B3+B4+B5+B6. It works for five rows and silently breaks the day someone inserts a sixth.',
            'Including the header or the total row inside the range — the classic way to double-count your own total.'
          ],
          onTheJob: 'These five cells are the sanity block that belongs on top of every data sheet. Before you analyse anything, you check the count matches what you were promised and the min/max are not absurd.'
        }
      },
      {
        id: '1.4', title: 'Share of revenue: what the $ is for', points: 20,
        brief: 'Work out each line’s share of total revenue in C2:C6. The formula has to survive being pulled down — so lock the reference to the total.',
        hint: 'C2 = B2/$B$8. Without the dollars, pulling down moves the reference to the total one row lower each time and you end up dividing by an empty cell.',
        sheet: {
          rows: 10, cols: 4,
          colWidths: { A: 160, B: 120, C: 130 },
          styles: { 'A1:C1': H },
          formats: { 'C2:C6': '0.0%' },
          cells: {
            A1: 'Line of business', B1: 'Revenue', C1: 'Share',
            A2: 'Consulting', B2: 4200, A3: 'Training', B3: 1350, A4: 'Software', B4: 2800,
            A5: 'Support', B5: 900, A6: 'Licences', B6: 1600,
            A8: 'Total', B8: '=SUM(B2:B6)'
          }
        },
        target: ['C2:C6'],
        solution: { 'C2:C6': '=B2/$B$8' },
        check: { '*': { mustContain: ['$B$8'], containHint: 'lock the total as $B$8 — otherwise the formula breaks as soon as you pull it down' } },
        explain: {
          idea: 'A dollar sign is a pin. $B$8 is pinned to the total; B2 is free to move. Copying a formula moves everything that is not pinned.',
          walk: [
            'In C2 the formula reads =B2/$B$8 → 4200 / 10,850 = 38.7%.',
            'Pull it down to C3. The free part B2 moves to B3 — which is what you want. The pinned part $B$8 stays on the total — which is also what you want.',
            'Try it without the dollars and look at C6: it becomes =B6/B12. B12 is empty, an empty cell counts as zero, and dividing by zero gives #DIV/0!. That error IS the lesson.',
            'Your five shares should add up to exactly 100%. If they do not, you pinned the wrong thing.'
          ],
          mistakes: [
            'Pinning both parts ($B$2/$B$8). Then every row shows the same 38.7%, because nothing moves any more.',
            'Typing 10850 instead of $B$8. It gives the right answer and rots the moment a line of business is added.'
          ],
          onTheJob: 'Share-of-total is the single most copied formula in consulting: share of revenue, share of cost, share of market. Always against a pinned denominator.'
        }
      },
      {
        id: '1.5', title: 'Mixed references: a price × volume grid', points: 25,
        brief: 'Build a revenue grid: the price from column A multiplied by the volume in row 1. Fill the whole of B2:F6 with ONE formula pulled right and down.',
        hint: 'B2 needs =$A2*B$1: the price column is pinned ($A), the volume row is pinned ($1). This exact idea is asked about on almost every Excel test.',
        sheet: {
          rows: 8, cols: 7,
          colWidths: { A: 130, B: 100, C: 100, D: 100, E: 100, F: 100 },
          styles: { 'B1:F1': H, 'A2:A6': H },
          cells: {
            A1: 'Price \\ Volume', B1: 10, C1: 25, D1: 50, E1: 100, F1: 250,
            A2: 1200, A3: 1150, A4: 1100, A5: 1000, A6: 950
          }
        },
        target: ['B2:F6'],
        solution: { 'B2:F6': '=$A2*B$1' },
        check: { '*': { mustContain: ['$'], containHint: 'you need mixed references with $ — one formula for the entire grid' } },
        explain: {
          idea: 'Half-pinning. $A2 says "always column A, but follow me down the rows". B$1 says "always row 1, but follow me across the columns". Together they let one formula cover a whole rectangle.',
          walk: [
            'Start in B2: =$A2*B$1 → 1200 × 10 = 12,000.',
            'Move right to C2. The $A2 half cannot move sideways, so it still reads the price 1200. The B$1 half moves to C$1 and picks up the volume 25. Result 30,000. Correct.',
            'Move down to B3. B$1 cannot move down, so it still reads volume 10. $A2 becomes $A3 and picks up price 1150. Result 11,500. Correct.',
            'That is why the grid needs exactly one formula instead of twenty-five.'
          ],
          mistakes: [
            'Using full pins ($A$2*$B$1): every cell in the grid shows 12,000.',
            'Using no pins at all (A2*B1): the references crawl diagonally and most of the grid ends up multiplying blanks.',
            'Pinning the wrong halves (A$2*$B1): the grid fills, the numbers look plausible, and every single one is wrong. Always spot-check a corner cell by hand.'
          ],
          onTheJob: 'Sensitivity tables, price ladders, FX conversion matrices — all built on this. On the test, a grid you can fill with one formula is worth about 30 seconds; filling it cell by cell costs five minutes you do not have.'
        }
      }
    ]
  });

  /* ========================================================== LEVEL 2 ===== */
  LEVELS.push({
    id: 2,
    title: 'Rounding, growth and averages',
    subtitle: 'Number hygiene and rates of change',
    goal: 'Compute growth, CAGR and weighted averages — the basic vocabulary of every slide you will ever write.',
    theory: [
      { h: 'Rounding', p: 'ROUND(x,2) keeps two decimals, ROUND(x,-3) rounds to the nearest thousand. ROUNDUP and ROUNDDOWN always go one way: use them for shifts, trucks and people, where 0.4 of a person does not exist.' },
      { h: 'Growth', p: 'Growth = (new − old) / old. Index = new / old. "Grew by 20%" means ×1.2; "grew to 120%" means the same thing; "grew 20 times" does not.' },
      { h: 'CAGR', p: 'Compound annual growth rate = (End/Start)^(1/years) − 1. Years means intervals, not data points: 2020 to 2024 is 4 years, not 5. Off-by-one here is the most common numerical error on case interviews.' },
      { h: 'Weighted average', p: 'The average price of a portfolio is not the average of the prices. It is SUMPRODUCT(prices, volumes)/SUM(volumes). The naive average is a classic trap question.' }
    ],
    tasks: [
      {
        id: '2.1', title: 'Rounding for a slide', points: 15,
        brief: 'C2:C6 — round revenue to millions with one decimal. D2:D6 — round revenue to the nearest thousand. E2:E6 — how many trucks are needed if one truck carries 40 tonnes (always round up).',
        hint: 'C: =ROUND(B2/1000000,1). D: =ROUND(B2,-3). E: =ROUNDUP(F2/40,0).',
        sheet: {
          rows: 8, cols: 7,
          colWidths: { A: 140, B: 150, C: 130, D: 140, E: 110, F: 100 },
          styles: { 'A1:F1': H },
          cells: {
            A1: 'Branch', B1: 'Revenue', C1: 'Revenue, m', D1: 'To nearest 1,000', E1: 'Trucks', F1: 'Tonnes',
            A2: 'Moscow', B2: 128473215, F2: 137,
            A3: 'St Petersburg', B3: 84129877, F3: 92,
            A4: 'Kazan', B4: 31284561, F4: 45,
            A5: 'Novosibirsk', B5: 22947103, F5: 81,
            A6: 'Yekaterinburg', B6: 41065992, F6: 120
          }
        },
        target: ['C2:C6', 'D2:D6', 'E2:E6'],
        solution: { 'C2:C6': '=ROUND(B2/1000000,1)', 'D2:D6': '=ROUND(B2,-3)', 'E2:E6': '=ROUNDUP(F2/40,0)' },
        explain: {
          idea: 'The second argument of ROUND is a position, not a quantity. Positive numbers move right of the decimal point, negative numbers move left of it.',
          walk: [
            'ROUND(128473215/1000000, 1): first the division gives 128.473215, then rounding to 1 decimal gives 128.5.',
            'ROUND(128473215, -3) keeps thousands: 128,473,000. Minus three means "three digits to the LEFT of the point become zeros".',
            'Trucks: 137/40 = 3.425. ROUND would say 3 and leave 17 tonnes standing on the dock. ROUNDUP says 4. Whenever the unit is indivisible, ROUNDUP is the honest function.'
          ],
          mistakes: [
            'Using number formatting instead of ROUND and then summing. The screen shows rounded numbers, the sum uses the unrounded ones, and your total does not match your own column — the single most common "my slide does not foot" bug.',
            'Rounding too early. Round at the point of presentation, not in the middle of a calculation chain.'
          ],
          onTheJob: 'Partners read slides, not cells. A table of 128.5 / 84.1 / 31.3 is read instantly; 128473215 is not. But the model underneath must keep the full precision.'
        }
      },
      {
        id: '2.2', title: 'Year-on-year growth', points: 15,
        brief: 'In C2:C6 work out the growth of 2024 revenue over 2023, as a percentage.',
        hint: '=(B2-A2)/A2, or the shorter =B2/A2-1. Both are correct.',
        sheet: {
          rows: 8, cols: 5,
          colWidths: { A: 110, B: 110, C: 130, D: 150 },
          styles: { 'A1:C1': H },
          formats: { 'C2:C6': '0.0%' },
          cells: {
            D1: 'Branch', A1: '2023', B1: '2024', C1: 'Growth',
            D2: 'Moscow', A2: 112000, B2: 128473,
            D3: 'St Petersburg', A3: 79500, B3: 84130,
            D4: 'Kazan', A4: 35100, B4: 31285,
            D5: 'Novosibirsk', A5: 18900, B5: 22947,
            D6: 'Yekaterinburg', A6: 40200, B6: 41066
          }
        },
        target: ['C2:C6'],
        solution: { 'C2:C6': '=B2/A2-1' },
        explain: {
          idea: 'Growth always divides by where you started. The denominator is the OLD number, never the new one.',
          walk: [
            'Moscow: 128,473 / 112,000 = 1.147. Subtract 1 and you have 0.147, shown as +14.7%.',
            'Kazan: 31,285 / 35,100 = 0.891, minus 1 = −0.109, shown as −10.9%. A negative sign appears by itself; you never need an IF for it.',
            '=B2/A2-1 and =(B2-A2)/A2 are algebraically identical. The first is faster to type and harder to get wrong with brackets.'
          ],
          mistakes: [
            'Dividing by the new year. That answers a different question and understates every decline.',
            'Forgetting the brackets in (B2-A2)/A2 and writing =B2-A2/A2, which Excel reads as B2 − (A2/A2) = B2 − 1.',
            'Reporting a growth rate on a tiny base. Going from 2 to 4 units is "+100%" and usually means nothing.'
          ],
          onTheJob: 'Every performance page starts here. Note that Kazan is shrinking while the total grows — that contrast is the actual insight, and it only shows once you compute per branch.'
        }
      },
      {
        id: '2.3', title: 'Four-year CAGR', points: 20,
        brief: 'Work out the compound annual growth rate of revenue from 2020 to 2024 for each segment in F2:F5. Take the number of years from cell $F$8.',
        hint: 'CAGR = (E2/A2)^(1/$F$8)-1. From 2020 to 2024 is 4 years — already filled in for you in F8.',
        sheet: {
          rows: 10, cols: 7,
          colWidths: { A: 90, B: 90, C: 90, D: 90, E: 90, F: 110, G: 150 },
          styles: { 'A1:F1': H },
          formats: { 'F2:F5': '0.0%' },
          cells: {
            G1: 'Segment', A1: 2020, B1: 2021, C1: 2022, D1: 2023, E1: 2024, F1: 'CAGR',
            G2: 'Retail', A2: 850, B2: 910, C2: 1020, D2: 1180, E2: 1340,
            G3: 'Manufacturing', A3: 1200, B3: 1150, C3: 1310, D3: 1420, E3: 1505,
            G4: 'Financials', A4: 640, B4: 720, C4: 880, D4: 1010, E4: 1290,
            G5: 'Public sector', A5: 430, B5: 445, C5: 470, D5: 505, E5: 520,
            A8: 'Number of years', F8: 4
          }
        },
        target: ['F2:F5'],
        solution: { 'F2:F5': '=(E2/A2)^(1/$F$8)-1' },
        check: { '*': { mustContain: ['$F$8'], containHint: 'read the number of years from $F$8 instead of typing 4 into the formula' } },
        explain: {
          idea: 'CAGR is the single constant growth rate that would have taken you from the first number to the last one. It is a geometric average, which is why there is a root in it rather than a division.',
          walk: [
            'Retail: 1340 / 850 = 1.576. Over the whole period the business grew by 57.6%.',
            'That 57.6% happened over 4 intervals, so we need the 4th root: 1.576^(1/4) = 1.1209. The ^(1/n) is how you write "n-th root" in Excel.',
            'Subtract 1 and you get 12.1% per year. Check it: 850 × 1.1209^4 = 1340. It closes.',
            'The years live in $F$8 and are pinned, so the same formula works for all four segments and the assumption can be changed in one place.'
          ],
          mistakes: [
            'Counting points instead of intervals: using 5 years instead of 4. That understates CAGR by roughly a fifth and is the most frequent mistake on this exact question.',
            'Averaging the yearly growth rates instead. The arithmetic average of growth rates is always higher than the true CAGR and is simply the wrong statistic.',
            'Writing ^1/4 without brackets: Excel reads that as (x^1)/4.'
          ],
          onTheJob: 'CAGR is how growth gets compared across businesses of different sizes and periods. "Financials at 19% versus Public sector at 5%" is a sentence that decides where the client puts money.'
        }
      },
      {
        id: '2.4', title: 'Average selling price across a portfolio', points: 20,
        brief: 'In B9 work out the volume-weighted average selling price, and in B10 the plain average of the prices. The gap between them is the cost of the mistake.',
        hint: 'B9: =SUMPRODUCT(B2:B6,C2:C6)/SUM(C2:C6). B10: =AVERAGE(B2:B6).',
        sheet: {
          rows: 12, cols: 4,
          colWidths: { A: 170, B: 150, C: 130 },
          styles: { 'A1:C1': H, 'A9:A10': { label: true } },
          cells: {
            A1: 'SKU', B1: 'Price', C1: 'Units sold',
            A2: 'Basic', B2: 1200, C2: 12500,
            A3: 'Standard', B3: 1850, C3: 4300,
            A4: 'Premium', B4: 4200, C4: 620,
            A5: 'Promo', B5: 890, C5: 21000,
            A6: 'Corporate', B6: 3100, C6: 1450,
            A9: 'Weighted average price', A10: 'Plain average of prices'
          }
        },
        target: ['B9', 'B10'],
        solution: { B9: '=SUMPRODUCT(B2:B6,C2:C6)/SUM(C2:C6)', B10: '=AVERAGE(B2:B6)' },
        check: { B9: { mustUse: ['SUMPRODUCT'] }, B10: { mustUse: ['AVERAGE'] } },
        explain: {
          idea: 'An average answers "per what?". Per SKU, the five prices average 2,248. Per unit sold, the average price customers actually paid is about 1,180. Both are arithmetically correct; only one is the answer to the business question.',
          walk: [
            'SUMPRODUCT(B2:B6, C2:C6) walks the two columns side by side: 1200×12500 + 1850×4300 + 4200×620 + 890×21000 + 3100×1450, giving total revenue.',
            'SUM(C2:C6) gives total units.',
            'Revenue ÷ units = the price of the average unit sold. Promo is cheap and sells in huge volume, so it drags the weighted average far below the plain one.',
            'The plain AVERAGE treats Premium — 620 units — as equal in importance to Promo — 21,000 units. That is why it is almost double.'
          ],
          mistakes: [
            'Reporting the plain average as "our average price". It flatters the number by roughly 90% here and will be the first thing a partner challenges.',
            'Building a helper column of price×volume when SUMPRODUCT does it in one cell. Not wrong, just slow — and on a 60-minute test, speed is the grade.'
          ],
          onTheJob: 'Weighted averages are everywhere: blended margin, average rate card, weighted cost of capital. Whenever you average something, say out loud what the weights are.'
        }
      },
      {
        id: '2.5', title: 'One outlier: average versus median', points: 20,
        brief: 'B10 — the average deal size, B11 — the median, B12 — the biggest deal, B13 — the second biggest, B14 — the rank of client Gamma by deal size (1 = largest).',
        hint: 'MEDIAN, MAX, LARGE(range,2), RANK(B4,B2:B8).',
        sheet: {
          rows: 16, cols: 4,
          colWidths: { A: 160, B: 140 },
          styles: { 'A1:B1': H, 'A10:A14': { label: true } },
          cells: {
            A1: 'Client', B1: 'Deal size, k',
            A2: 'Alpha', B2: 320, A3: 'Beta', B3: 410, A4: 'Gamma', B4: 380,
            A5: 'Delta', B5: 295, A6: 'Epsilon', B6: 5400, A7: 'Zeta', B7: 350, A8: 'Eta', B8: 275,
            A10: 'Average', A11: 'Median', A12: 'Maximum', A13: 'Second largest', A14: 'Rank of Gamma'
          }
        },
        target: ['B10', 'B11', 'B12', 'B13', 'B14'],
        solution: {
          B10: '=AVERAGE(B2:B8)', B11: '=MEDIAN(B2:B8)', B12: '=MAX(B2:B8)',
          B13: '=LARGE(B2:B8,2)', B14: '=RANK(B4,B2:B8)'
        },
        check: { B11: { mustUse: ['MEDIAN'] }, B13: { mustUse: ['LARGE'] }, B14: { mustUse: ['RANK'] } },
        explain: {
          idea: 'The average is pulled around by extremes; the median is not. When they disagree badly, the distribution — not the centre — is the story.',
          walk: [
            'The average is 1,061k. Six of the seven clients are nowhere near that number: it is an average no actual client resembles.',
            'The median lines the seven values up in order and takes the middle one: 350k. That does describe a typical client.',
            'Epsilon at 5,400k is the reason for the gap. One client is 15 times the median.',
            'LARGE(range, 2) returns the second biggest, 410. MAX is simply LARGE(range, 1).',
            'RANK(B4, B2:B8) sorts mentally from largest down and reports where Gamma lands: 3rd.'
          ],
          mistakes: [
            'Quoting the average without checking the median. If a partner asks "is that typical?" and you have not looked, you have no answer.',
            'Assuming RANK defaults to smallest-first. It defaults to largest-first; the optional third argument flips it.',
            'Deleting the outlier because it is inconvenient. Epsilon is 72% of the revenue in this list — it is the most important client, not noise.'
          ],
          onTheJob: 'Concentration risk lives here. "Average client pays us 1.1m" and "half our clients pay under 350k" describe the same seven rows and lead to completely different strategies.'
        }
      }
    ]
  });

  /* ========================================================== LEVEL 3 ===== */
  LEVELS.push({
    id: 3,
    title: 'Logic: the IF family',
    subtitle: 'Conditions, nesting, and not showing errors to a client',
    goal: 'Write classification rules that do not fall apart on the boundary values.',
    theory: [
      { h: 'IF(condition, value if true, value if false)', p: 'The condition is anything that evaluates to TRUE or FALSE. Text inside a formula always goes in quotes: IF(B2>=100,"met","missed").' },
      { h: 'Nesting', p: 'Test thresholds from the top down: IF(x>=1000,"A",IF(x>=500,"B","C")). Start from the smallest threshold instead and everything lands in the first bucket — the single most common logic bug on tests.' },
      { h: 'AND / OR', p: 'AND(a,b) needs every condition; OR(a,b) needs at least one. They go inside IF: =IF(AND(B2>1000,C2>0.3),"bonus","none").' },
      { h: 'IFERROR', p: 'A model that shows #DIV/0! does not get presented. Wrap risky divisions: =IFERROR(A2/B2,0). But never wrap blindly — find out why the error appeared first, because IFERROR hides real broken references just as happily.' }
    ],
    tasks: [
      {
        id: '3.1', title: 'Target met or missed', points: 15,
        brief: 'In D2:D8 write "met" when the actual is not below target, and "missed" otherwise.',
        hint: '=IF(C2>=B2,"met","missed"). Note "not below" — that is >=, not >.',
        sheet: {
          rows: 10, cols: 5,
          colWidths: { A: 140, B: 110, C: 110, D: 130 },
          styles: { 'A1:D1': H },
          cells: {
            A1: 'Manager', B1: 'Target', C1: 'Actual', D1: 'Status',
            A2: 'Ivanov', B2: 1000, C2: 1240,
            A3: 'Petrova', B3: 1500, C3: 1500,
            A4: 'Sidorov', B4: 900, C4: 640,
            A5: 'Kuznetsova', B5: 2000, C5: 2310,
            A6: 'Smirnov', B6: 1200, C6: 1199,
            A7: 'Volkova', B7: 800, C7: 950,
            A8: 'Orlov', B8: 1400, C8: 1400
          }
        },
        target: ['D2:D8'],
        solution: { 'D2:D8': '=IF(C2>=B2,"met","missed")' },
        check: { '*': { mustUse: ['IF'] } },
        explain: {
          idea: 'IF has exactly three parts separated by commas: the question, the answer when yes, the answer when no. Miss one and Excel fills it with FALSE.',
          walk: [
            'Row 2: is 1240 >= 1000? Yes → "met".',
            'Row 3: is 1500 >= 1500? Yes, because >= includes equality. This row is the whole point of the task.',
            'Row 6: is 1199 >= 1200? No → "missed". One unit short is still short; the formula does not care about your sympathy.',
            'The quotes around "met" tell Excel it is text. Without them Excel looks for a named range called met and returns #NAME?.'
          ],
          mistakes: [
            'Using > instead of >=. Rows 3 and 8 then read "missed" although the target was hit exactly — a real dispute in a real bonus calculation.',
            'Putting the numbers in quotes: "1000" is text, and text compares differently from numbers.',
            'Writing =IF(C2>=B2,"met") with no third part. Missed targets then show FALSE instead of "missed".'
          ],
          onTheJob: 'Boundary conditions are where bonus schemes and contract penalties get argued about. Read the wording — "at least", "more than", "no later than" — and translate it exactly.'
        }
      },
      {
        id: '3.2', title: 'ABC customer tiers', points: 20,
        brief: 'Assign a tier by revenue in C2:C9: A from 3000 upwards, B from 1000 to 3000, C below 1000. The thresholds live in $F$2 and $F$3.',
        hint: '=IF(B2>=$F$2,"A",IF(B2>=$F$3,"B","C")). Test the thresholds from the largest down.',
        sheet: {
          rows: 11, cols: 7,
          colWidths: { A: 140, B: 120, C: 120, E: 150, F: 100 },
          styles: { 'A1:C1': H, 'E1:F1': H },
          cells: {
            A1: 'Client', B1: 'Revenue', C1: 'Tier',
            E1: 'Assumption', F1: 'Value', E2: 'Tier A from', F2: 3000, E3: 'Tier B from', F3: 1000,
            A2: 'Alpha', B2: 4200, A3: 'Beta', B3: 2999, A4: 'Gamma', B4: 3000,
            A5: 'Delta', B5: 999, A6: 'Epsilon', B6: 1000, A7: 'Zeta', B7: 12400,
            A8: 'Eta', B8: 640, A9: 'Theta', B9: 1850
          }
        },
        target: ['C2:C9'],
        solution: { 'C2:C9': '=IF(B2>=$F$2,"A",IF(B2>=$F$3,"B","C"))' },
        check: { '*': { mustUse: ['IF'], mustContain: ['$F$'], containHint: 'read the thresholds from $F$2 and $F$3 so the model can be re-tuned without rewriting formulas' } },
        explain: {
          idea: 'Nested IFs are a waterfall. Each test only sees what fell through the test above it, which is why the order matters more than the tests themselves.',
          walk: [
            'First question: is revenue >= 3000? If yes, we are done — "A". Nothing else is evaluated.',
            'Only values that failed that test reach the second IF. So when we ask "is it >= 1000?" we already know it is under 3000. We do not need to write B2<3000 anywhere — the waterfall handles it.',
            'Anything that fails both tests is "C". That final "C" is the third argument of the INNER IF.',
            'Zeta at 12,400 is "A", and Gamma at exactly 3,000 is also "A" thanks to >=.'
          ],
          mistakes: [
            'Ordering the tests upwards: IF(B2>=1000,"B",IF(B2>=3000,"A","C")). Now Zeta at 12,400 passes the first test and is labelled "B". Tier A never appears and the formula looks perfectly reasonable.',
            'Writing IF(AND(B2>=1000,B2<3000),"B",…) — correct, but twice the typing and twice the chance of a typo.',
            'Hard-coding 3000 and 1000. When the client redefines the tiers you have to reopen every formula instead of two cells.'
          ],
          onTheJob: 'Segmentation rules — ABC, tiers, risk bands — are always nested IFs over thresholds that the client will change at least three times during the project. Keep them in cells.'
        }
      },
      {
        id: '3.3', title: 'Bonus on two conditions', points: 20,
        brief: 'In E2:E8 write "yes" when revenue is above 1500 AND margin is at least 30%, otherwise "no".',
        hint: '=IF(AND(B2>1500,C2>=0.3),"yes","no"). The margins in column C are already shares, not percentages.',
        sheet: {
          rows: 10, cols: 6,
          colWidths: { A: 140, B: 110, C: 130, D: 140, E: 110 },
          styles: { 'A1:E1': H },
          formats: { 'C2:C8': '0.0%' },
          cells: {
            A1: 'Deal', B1: 'Revenue', C1: 'Margin', D1: 'Region', E1: 'Bonus',
            A2: 'S-101', B2: 2400, C2: 0.42, D2: 'Moscow',
            A3: 'S-102', B3: 1600, C3: 0.28, D3: 'St Petersburg',
            A4: 'S-103', B4: 1501, C4: 0.3, D4: 'Kazan',
            A5: 'S-104', B5: 1500, C5: 0.55, D5: 'Moscow',
            A6: 'S-105', B6: 3100, C6: 0.31, D6: 'Urals',
            A7: 'S-106', B7: 980, C7: 0.62, D7: 'St Petersburg',
            A8: 'S-107', B8: 5200, C8: 0.29, D8: 'Moscow'
          }
        },
        target: ['E2:E8'],
        solution: { 'E2:E8': '=IF(AND(B2>1500,C2>=0.3),"yes","no")' },
        check: { '*': { mustUse: ['IF', 'AND'] } },
        explain: {
          idea: 'AND collapses several TRUE/FALSE answers into one. IF then has a single question to answer, exactly as before.',
          walk: [
            'Row 3 (S-102): revenue 1600 passes, margin 28% fails → AND is FALSE → "no". One failure is enough.',
            'Row 5 (S-104): margin is a glorious 55%, but revenue is exactly 1500 and the rule says ABOVE 1500 → FALSE → "no".',
            'Row 4 (S-103): 1501 and exactly 30% → both pass → "yes". Rows 4 and 5 exist purely to punish sloppy comparison operators.',
            'Row 8 (S-107): the biggest deal in the list at 5,200 but margin 29% → "no". Size alone does not earn the bonus.'
          ],
          mistakes: [
            'Writing C2>=30 instead of C2>=0.3. The cell holds 0.42 and only looks like 42% — no margin will ever be above 30, so every row reads "no".',
            'Using OR when the brief says AND. Suddenly five of seven deals qualify and the bonus pool triples.',
            'Nesting two IFs where one AND would do. It works, but it is longer and harder to check.'
          ],
          onTheJob: 'Eligibility rules — bonus schemes, discount approvals, credit criteria — are almost always several conditions joined by AND. Write them so a non-modeller can read them out loud.'
        }
      },
      {
        id: '3.4', title: 'Guarding against divide-by-zero', points: 20,
        brief: 'In D2:D8 work out revenue per client (revenue divided by number of clients). Where there are no clients the formula must return 0 rather than an error.',
        hint: '=IFERROR(B2/C2,0).',
        sheet: {
          rows: 10, cols: 5,
          colWidths: { A: 140, B: 120, C: 130, D: 160 },
          styles: { 'A1:D1': H },
          cells: {
            A1: 'Branch', B1: 'Revenue', C1: 'Clients', D1: 'Revenue per client',
            A2: 'Moscow', B2: 12400, C2: 62,
            A3: 'St Petersburg', B3: 8100, C3: 45,
            A4: 'Kazan', B4: 0, C4: 0,
            A5: 'Samara', B5: 3200, C5: 18,
            A6: 'Perm', B6: 1500, C6: 0,
            A7: 'Ufa', B7: 2700, C7: 12,
            A8: 'Omsk', B8: 900, C8: 6
          }
        },
        target: ['D2:D8'],
        solution: { 'D2:D8': '=IFERROR(B2/C2,0)' },
        check: { '*': { mustUseAny: ['IFERROR', 'IF'] } },
        explain: {
          idea: 'IFERROR is a safety net with two arguments: try this; if it blows up, use that instead. The first argument is the whole normal formula, not part of it.',
          walk: [
            'Row 4 (Kazan): 0/0 is undefined, so Excel raises #DIV/0!. IFERROR catches it and puts 0 in the cell.',
            'Row 6 (Perm): 1500/0. Also #DIV/0! — and this one is more interesting, because there IS revenue but no clients recorded. The zero on screen hides a data quality problem.',
            'Every other row passes straight through IFERROR untouched: it only acts when something fails.',
            'The alternative =IF(C2=0,0,B2/C2) is equally valid and arguably better here, because it names the specific thing that can go wrong.'
          ],
          mistakes: [
            'Wrapping IFERROR around everything as a reflex. It silences #REF! from a deleted column and #N/A from a failed lookup just as happily, and then your model is quietly wrong instead of loudly broken.',
            'Returning "" instead of 0 when the column is later summed. Text in a numeric column is how a SUM ends up short.',
            'Putting the division in the second argument by mistake: =IFERROR(0,B2/C2) always returns 0.'
          ],
          onTheJob: 'Rule of thumb: debug first, wrap second. Look at every error once, understand it, and only then decide whether it deserves to be hidden.'
        }
      },
      {
        id: '3.5', title: 'Volume discount ladder', points: 25,
        brief: 'In C2:C9 work out the discount rate: from 10,000 units it is 15%, from 5,000 it is 10%, from 1,000 it is 5%, otherwise 0%. In D2:D9 work out the discounted price (list price is in $G$2).',
        hint: 'C: nested IFs from the largest threshold down. D: =$G$2*(1-C2).',
        sheet: {
          rows: 11, cols: 8,
          colWidths: { A: 120, B: 130, C: 110, D: 150, F: 130, G: 100 },
          styles: { 'A1:D1': H, 'F1:G1': H },
          formats: { 'C2:C9': '0%' },
          cells: {
            A1: 'Order', B1: 'Units', C1: 'Discount', D1: 'Discounted price',
            F1: 'Assumption', G1: 'Value', F2: 'List price', G2: 1200,
            A2: 'Z-01', B2: 12000, A3: 'Z-02', B3: 9999, A4: 'Z-03', B4: 5000,
            A5: 'Z-04', B5: 4999, A6: 'Z-05', B6: 1000, A7: 'Z-06', B7: 999,
            A8: 'Z-07', B8: 250, A9: 'Z-08', B9: 31000
          }
        },
        target: ['C2:C9', 'D2:D9'],
        solution: {
          'C2:C9': '=IF(B2>=10000,0.15,IF(B2>=5000,0.1,IF(B2>=1000,0.05,0)))',
          'D2:D9': '=$G$2*(1-C2)'
        },
        check: { 'D2': { mustContain: ['$G$2'] } },
        explain: {
          idea: 'A discount ladder is a staircase: three nested IFs, tested from the top step down, with a flat 0 at the bottom for everything that did not reach the first step.',
          walk: [
            'Z-02 has 9,999 units — one unit short of the top tier — so it falls through to the 5,000 test and gets 10%. Z-01 with 12,000 gets 15%. That one unit is worth 5 percentage points.',
            'Z-08 with 31,000 units also gets 15%: the ladder has no step above that, and a bigger number does not invent one.',
            'The price line multiplies by (1 − discount). A 15% discount means you keep 85%, so 1200 × 0.85 = 1,020.',
            '$G$2 is pinned because every row uses the same list price. If it were not pinned, row 3 would read G3, which is empty, and every price would come out as 0.'
          ],
          mistakes: [
            'Writing =$G$2-C2. That subtracts 0.15 roubles from the price instead of 15%.',
            'Building the ladder bottom-up, so every large order gets the smallest discount.',
            'Forgetting the final 0 and leaving small orders showing FALSE, which then poisons the price column with #VALUE!.'
          ],
          onTheJob: 'Price ladders, commission grids, rebate schedules — all the same shape. Later you will replace nested IFs here with an approximate VLOOKUP against a rate table, which is what level 5 is for.'
        }
      }
    ]
  });

  /* ========================================================== LEVEL 4 ===== */
  LEVELS.push({
    id: 4,
    title: 'Conditional aggregates',
    subtitle: 'SUMIFS, COUNTIFS and a summary without a pivot table',
    goal: 'Slice data with formulas so the answer recalculates itself and a reviewer can trace it.',
    theory: [
      { h: 'SUMIF versus SUMIFS', p: 'SUMIF(range to test, condition, range to add) — "where to look, what to look for, what to add". SUMIFS reverses it: SUMIFS(range to add, range to test, condition, …). That swap is asked about on almost every Excel test.' },
      { h: 'Conditions are text', p: 'A condition with an operator goes in quotes: ">1000", "<>Moscow". To point at a cell, glue it on: ">"&$H$1. Wildcards: "*ov" ends with ov, "Mos*" starts with Mos.' },
      { h: 'A summary grid', p: 'A region × industry summary is one formula with careful dollars: the row condition comes from $I2 (column pinned), the column condition from J$2 (row pinned). Then it stretches over the whole rectangle.' },
      { h: 'Always add a check', p: 'The grid must add up to the same total as the raw data. If it does not, some category is falling through the cracks. A model without a check row is not a model, it is a hope.' }
    ],
    tasks: [
      {
        id: '4.1', title: 'Revenue by region', points: 15,
        brief: 'In J2:J6 work out total revenue for each region listed in I2:I6.',
        hint: '=SUMIF($B$2:$B$21,I2,$F$2:$F$21). Pin the ranges so the formula can be pulled down.',
        sheet: dealSheet({ I1: 'Region', J1: 'Revenue', I2: 'Moscow', I3: 'St Petersburg', I4: 'Urals', I5: 'Volga', I6: 'Siberia' },
          { styles: { 'I1:J1': H }, colWidths: { I: 140, J: 120 } }),
        table: 'A1:G21',
        target: ['J2:J6'],
        solution: { 'J2:J6': '=SUMIF($B$2:$B$21,I2,$F$2:$F$21)' },
        check: { '*': { mustUseAny: ['SUMIF', 'SUMIFS'] } },
        explain: {
          idea: 'SUMIF walks down the test column, and every time the value matches the condition it adds the cell that sits in the same row of the sum column. It is a loop written in one line.',
          walk: [
            'Row by row Excel asks: does column B equal "Moscow"? For rows 2, 4, 6, 10, 15 and 20 the answer is yes.',
            'For each of those rows it grabs the number from the same row of column F and adds it: 4200 + 9500 + 1800 + 7300 + 8800 + 10200 = 41,800.',
            'The three ranges are pinned with dollars ($B$2:$B$21, $F$2:$F$21) so that pulling the formula down keeps pointing at the same data. Only I2 is free to move, becoming I3, I4 and so on.',
            'Your five results should add up to 102,600 — the total of column F. If they do not, a region is misspelled somewhere.'
          ],
          mistakes: [
            'Forgetting the dollars. Pulled down, the data ranges slide to B3:B22 and F3:F22 and every answer is quietly wrong.',
            'Getting the argument order backwards. SUMIF wants the test range FIRST; SUMIFS wants the sum range first. Mixing them up returns 0 or #VALUE!.',
            'Typing "Moscow" into the formula instead of pointing at I2. It works for one row and then gives you the same answer five times.'
          ],
          onTheJob: 'This is the workhorse of data work: any "revenue by X" table on any slide is this formula. The pivot table in level 8 does the same job faster, but SUMIFS is what you use when the answer must sit in a specific cell of a model.'
        }
      },
      {
        id: '4.2', title: 'Won revenue by region', points: 20,
        brief: 'In J2:J6 work out revenue from won deals only (Stage = "Won") for each region.',
        hint: '=SUMIFS($F$2:$F$21,$B$2:$B$21,I2,$E$2:$E$21,"Won"). With SUMIFS the range you are adding comes first.',
        sheet: dealSheet({ I1: 'Region', J1: 'Won revenue', I2: 'Moscow', I3: 'St Petersburg', I4: 'Urals', I5: 'Volga', I6: 'Siberia' },
          { styles: { 'I1:J1': H }, colWidths: { I: 140, J: 130 } }),
        table: 'A1:G21',
        target: ['J2:J6'],
        solution: { 'J2:J6': '=SUMIFS($F$2:$F$21,$B$2:$B$21,I2,$E$2:$E$21,"Won")' },
        check: { '*': { mustUse: ['SUMIFS'] } },
        explain: {
          idea: 'SUMIFS takes the sum range once, then as many (range, condition) pairs as you like. A row is added only when EVERY pair agrees.',
          walk: [
            'Argument 1 is $F$2:$F$21 — the numbers we want to add. It never repeats.',
            'Then pairs: ($B$2:$B$21, I2) says the region must match, and ($E$2:$E$21, "Won") says the stage must be Won.',
            'Moscow has six deals but only four were won (D-003 is in progress, D-005 was lost and D-019 is in progress), so the answer, 20,300, is much smaller than the 41,800 from the previous task.',
            'The comparison between the two tasks is the insight: Moscow has the biggest pipeline and the lowest conversion.'
          ],
          mistakes: [
            'Using SUMIF with two conditions. SUMIF only takes one; you need the S.',
            'Writing "won" in the wrong case is fine — Excel ignores case — but writing "Win" is not. The condition is matched literally.',
            'Leaving a trailing space in the data ("Won ") — then nothing matches and you get 0. TRIM is the fix, and it is in level 6.'
          ],
          onTheJob: 'Pipeline analysis is exactly this: total pipeline versus weighted pipeline versus closed. The difference between the three is where every sales conversation starts.'
        }
      },
      {
        id: '4.3', title: 'Manager funnel', points: 20,
        brief: 'For every manager in I2:I6 work out: J — the number of deals in progress, K — the number won, L — the revenue of the won deals.',
        hint: 'J and K are COUNTIFS on manager and stage; L is a SUMIFS.',
        sheet: dealSheet({
          I1: 'Manager', J1: 'In progress', K1: 'Won, count', L1: 'Won, revenue',
          I2: 'Ivanov', I3: 'Petrova', I4: 'Sidorov', I5: 'Kuznetsov', I6: 'Volkova'
        }, { styles: { 'I1:L1': H }, colWidths: { I: 120, J: 120, K: 120, L: 130 } }),
        table: 'A1:G21',
        target: ['J2:J6', 'K2:K6', 'L2:L6'],
        solution: {
          'J2:J6': '=COUNTIFS($D$2:$D$21,$I2,$E$2:$E$21,"In progress")',
          'K2:K6': '=COUNTIFS($D$2:$D$21,$I2,$E$2:$E$21,"Won")',
          'L2:L6': '=SUMIFS($F$2:$F$21,$D$2:$D$21,$I2,$E$2:$E$21,"Won")'
        },
        check: { '*': { mustUseAny: ['COUNTIFS', 'SUMIFS'] } },
        explain: {
          idea: 'COUNTIFS and SUMIFS are the same machine with a different last step: one counts the matching rows, the other adds a number from them. COUNTIFS therefore has no "range to add" argument at all.',
          walk: [
            'COUNTIFS($D$2:$D$21,$I2,$E$2:$E$21,"Won") reads: among all rows, how many have this manager AND stage Won.',
            'Note $I2 — the column is pinned, the row is free. That is deliberate: when you pull the formula RIGHT into column K the manager reference must not slide to J2, and when you pull it DOWN it must move to $I3.',
            'That single choice of dollar is what lets you write one formula and fill a 5 × 3 block.',
            'Kuznetsov: 4 won deals worth 20,600 — the best conversion in the team. Volkova: 2 won out of 4, worth 6,200.'
          ],
          mistakes: [
            'Pinning the manager fully as $I$2. Pulled down, every row then reports Ivanov’s numbers.',
            'Not pinning it at all. Pulled right, I2 becomes J2 and K2, which hold your own results — a circular mess.',
            'Passing a sum range to COUNTIFS. It expects only (range, condition) pairs.'
          ],
          onTheJob: 'This is a sales funnel in three columns. The ratio K/(J+K) per manager is conversion, and that is the number that goes on the slide.'
        }
      },
      {
        id: '4.4', title: 'Large and profitable', points: 25,
        brief: 'J2 — the average revenue of won deals whose margin is at least the threshold in $J$5. J3 — how many such deals there are. J4 — their share of the revenue of all deals.',
        hint: 'AVERAGEIFS and COUNTIFS with the condition ">="&$J$5 — the operator is glued to the cell reference with &. For the share, divide a SUMIFS by SUM($F$2:$F$21).',
        sheet: dealSheet({
          I1: 'Metric', J1: 'Value',
          I2: 'Average revenue', I3: 'Number of deals', I4: 'Share of total revenue',
          I5: 'Margin threshold', J5: 0.3
        }, { styles: { 'I1:J1': H }, colWidths: { I: 190, J: 140 }, formats: { J4: '0.0%', J5: '0%' } }),
        table: 'A1:G21',
        target: ['J2', 'J3', 'J4'],
        solution: {
          J2: '=AVERAGEIFS($F$2:$F$21,$E$2:$E$21,"Won",$G$2:$G$21,">="&$J$5)',
          J3: '=COUNTIFS($E$2:$E$21,"Won",$G$2:$G$21,">="&$J$5)',
          J4: '=SUMIFS($F$2:$F$21,$E$2:$E$21,"Won",$G$2:$G$21,">="&$J$5)/SUM($F$2:$F$21)'
        },
        check: {
          J2: { mustUse: ['AVERAGEIFS'], mustContain: ['$J$5'], containHint: 'take the threshold from cell $J$5 using ">="&$J$5' },
          J3: { mustUse: ['COUNTIFS'], mustContain: ['$J$5'] },
          J4: { mustContain: ['$J$5'] }
        },
        explain: {
          idea: 'A condition is a piece of text. ">=0.3" is text. To build that text out of a cell you glue the operator to the value with the & sign: ">="&$J$5.',
          walk: [
            'Excel first evaluates ">="&$J$5. $J$5 holds 0.3, so the glue produces the text ">=0.3".',
            'That text is then handed to AVERAGEIFS as the condition, exactly as if you had typed ">=0.3" yourself.',
            'The point of doing it the long way: change J5 to 0.35 and all three answers update. Type ">=0.3" directly and you have to hunt through three formulas.',
            'J4 divides the conditional total by the unconditional one, which is why SUM has no conditions on it at all.'
          ],
          mistakes: [
            'Writing ">=$J$5" inside quotes. Then the condition is the literal text "$J$5" and nothing ever matches — the answer comes back 0 with no error to warn you.',
            'Writing >=&$J$5 without quotes around the operator. That is a syntax error.',
            'Dividing by a conditional sum in J4 when the brief says share of ALL revenue. Read the denominator carefully.'
          ],
          onTheJob: 'Every threshold in a model belongs in a labelled cell, and every formula should reach it with & rather than repeating the number. That is the difference between a model you can run sensitivities on and one you have to rebuild.'
        }
      },
      {
        id: '4.5', title: 'Region × industry summary grid', points: 35,
        brief: 'Build a revenue summary: regions down the side (I3:I7), industries across the top (J2:N2). Fill J3:N7 with ONE formula stretched over the whole grid. In J9 put a check total for the grid and in J10 the overall revenue — they must agree.',
        hint: 'In J3: =SUMIFS($F$2:$F$21,$B$2:$B$21,$I3,$C$2:$C$21,J$2). Pin the column on the region ($I3) and the row on the industry (J$2).',
        sheet: dealSheet({
          I2: 'Region \\ Industry', J2: 'Retail', K2: 'Manufacturing', L2: 'Financials', M2: 'Energy', N2: 'Public sector',
          I3: 'Moscow', I4: 'St Petersburg', I5: 'Urals', I6: 'Volga', I7: 'Siberia',
          I9: 'Sum of the grid', I10: 'Total from the data'
        }, {
          cols: 16, styles: { 'I2:N2': H, 'I3:I7': H },
          colWidths: { I: 150, J: 110, K: 140, L: 110, M: 100, N: 130 }
        }),
        table: 'A1:G21',
        target: ['J3:N7', 'J9', 'J10'],
        solution: {
          'J3:N7': '=SUMIFS($F$2:$F$21,$B$2:$B$21,$I3,$C$2:$C$21,J$2)',
          J9: '=SUM(J3:N7)', J10: '=SUM(F2:F21)'
        },
        check: {
          '*': { mustUseAny: ['SUMIFS', 'SUM'] },
          J3: { mustUse: ['SUMIFS'], mustContain: ['$I3', 'J$2'], containHint: 'you need the mixed references $I3 and J$2 — one formula for the whole grid' }
        },
        explain: {
          idea: 'This is level 1’s mixed-reference trick applied to conditions instead of numbers. The row label and the column label are both read from the sheet, each pinned along one axis only.',
          walk: [
            'In J3 the two conditions are $I3 (Moscow) and J$2 (Retail). The answer, 6,000, is the sum of the Moscow retail deals D-001 (4,200) and D-005 (1,800).',
            'Pull right to K3. $I3 cannot move sideways, so the region stays Moscow. J$2 becomes K$2 and the industry becomes Manufacturing.',
            'Pull down to J4. J$2 cannot move down, so the industry stays Retail. $I3 becomes $I4 and the region becomes St Petersburg.',
            'Empty intersections show 0 — Volga simply has no energy deals. That is information, not a bug.',
            'The check in J9 adds the 25 grid cells and must equal J10, the raw total: both are 102,600. If they differed, some region or industry spelling in the labels would not match the data.'
          ],
          mistakes: [
            'Pinning both labels fully. The whole grid then repeats one number.',
            'Pinning the wrong axis ($J2 and I$3). The grid fills, the numbers look sensible, and the entire table is transposed nonsense. The check row is what catches this.',
            'Skipping the check row. Without it a misspelled label silently drops a whole category from the analysis.'
          ],
          onTheJob: 'This is the classic "build me the matrix" question and it appears on Excel tests constantly. A pivot table gives the same answer in ten seconds, but the formula version is what you use when the grid must live inside a model and update automatically.'
        }
      },
      {
        id: '4.6', title: 'Operators and wildcards in conditions', points: 25,
        brief: 'J2 — how many deals are bigger than 5,000. J3 — total revenue of everything outside Moscow. J4 — how many deals belong to managers whose surname ends in "ov" (pattern "*ov"). J5 — revenue of industries whose name starts with the letter M.',
        hint: 'Conditions go in quotes: ">5000", "<>Moscow", "*ov", "M*".',
        sheet: dealSheet({
          I1: 'Metric', J1: 'Value',
          I2: 'Deals over 5,000', I3: 'Revenue outside Moscow', I4: 'Deals by surnames ending in "ov"', I5: 'Revenue of industries starting with M'
        }, { styles: { 'I1:J1': H }, colWidths: { I: 260, J: 130 } }),
        table: 'A1:G21',
        target: ['J2', 'J3', 'J4', 'J5'],
        solution: {
          J2: '=COUNTIF($F$2:$F$21,">5000")',
          J3: '=SUMIF($B$2:$B$21,"<>Moscow",$F$2:$F$21)',
          J4: '=COUNTIF($D$2:$D$21,"*ov")',
          J5: '=SUMIF($C$2:$C$21,"M*",$F$2:$F$21)'
        },
        explain: {
          idea: 'A condition can be a value, a comparison, or a pattern. The star * means "any number of any characters", the question mark ? means "exactly one character".',
          walk: [
            '">5000" is a comparison — five deals clear that bar.',
            '"<>Moscow" means "not equal to Moscow". Revenue outside Moscow is 60,800, which is 102,600 minus Moscow’s 41,800. Always sanity-check a "not" condition against the complement like this.',
            '"*ov" matches Ivanov, Sidorov and Kuznetsov but not Petrova or Volkova — those end in "ova". Patterns are matched against the whole cell, so "*ov" means "ends with ov".',
            '"M*" matches Manufacturing. It does NOT match Retail or Energy, and it would also have matched a hypothetical "Mining".'
          ],
          mistakes: [
            'Forgetting the quotes: >5000 without quotes is a comparison against a cell, not a condition, and Excel complains.',
            'Expecting "*ov" to find "ov" anywhere in the text. For that you need "*ov*" with a star on both sides.',
            'Using wildcards on numbers. They only work on text; for numbers use comparison operators.'
          ],
          onTheJob: 'Dumps from client systems are full of "Moscow branch 1", "Moscow branch 2". A "Moscow*" pattern consolidates them in one formula instead of a clean-up project.'
        }
      }
    ]
  });

  /* ========================================================== LEVEL 5 ===== */
  var CLIENTS = {
    A1: 'Code', B1: 'Client', C1: 'Region', D1: 'Segment', E1: 'Manager', F1: 'Revenue',
    A2: 1014, B2: 'Northern Steel Trade', C2: 'St Petersburg', D2: 'Large', E2: 'Petrova', F2: 12400,
    A3: 1027, B3: 'Mosenergo Service', C3: 'Moscow', D3: 'Large', E3: 'Ivanov', F3: 9800,
    A4: 1043, B4: 'Uralchem Logistics', C4: 'Urals', D4: 'Mid', E4: 'Sidorov', F4: 4300,
    A5: 1056, B5: 'Volga Retail', C5: 'Volga', D5: 'Mid', E5: 'Volkova', F5: 3750,
    A6: 1071, B6: 'Siberia Telecom', C6: 'Siberia', D6: 'Large', E6: 'Kuznetsov', F6: 8100,
    A7: 1088, B7: 'Petro Construction', C7: 'St Petersburg', D7: 'Small', E7: 'Petrova', F7: 1250,
    A8: 1095, B8: 'AgroDon', C8: 'Volga', D8: 'Small', E8: 'Volkova', F8: 890
  };
  LEVELS.push({
    id: 5,
    title: 'Looking data up',
    subtitle: 'VLOOKUP, INDEX + MATCH, XLOOKUP',
    goal: 'Pull data out of a reference table in any direction, and stop being afraid of #N/A.',
    theory: [
      { h: 'VLOOKUP', p: 'VLOOKUP(what to find, table, column number, 0). The final 0 means exact match. Leave it out and Excel does an approximate match and lies to you quietly. The key MUST be in the first column of the table.' },
      { h: 'Approximate match', p: 'VLOOKUP with a final 1 (TRUE) finds the largest value not exceeding your key, and requires the table to be sorted ascending. That is the right tool for a ladder: grades, discounts, tax bands.' },
      { h: 'INDEX + MATCH', p: 'INDEX(what to return, MATCH(what to find, where to look, 0)). Works leftwards, survives column insertions, and calculates faster. In an interview it is the answer that shows one more level of skill than VLOOKUP.' },
      { h: 'Two-way lookup', p: 'INDEX(matrix, MATCH(row,…,0), MATCH(column,…,0)) reads the cell where a row and a column meet. That is how a rate is pulled out of a "segment × term" table.' },
      { h: '#N/A is not a bug', p: '#N/A means "not found". Hide it with IFERROR only after you have checked why: nine times out of ten it is a trailing space or a number stored as text.' }
    ],
    tasks: [
      {
        id: '5.1', title: 'VLOOKUP by client code', points: 20,
        brief: 'In I2:I5 pull the client name for the codes in H2:H5, and in J2:J5 their revenue.',
        hint: '=VLOOKUP($H2,$A$2:$F$8,2,0). For revenue change the column number to 6. The final 0 is not optional.',
        sheet: {
          rows: 12, cols: 12,
          colWidths: { A: 70, B: 190, C: 130, D: 90, E: 100, F: 100, H: 80, I: 190, J: 100 },
          styles: { 'A1:F1': H, 'H1:J1': H },
          cells: Object.assign({}, CLIENTS, {
            H1: 'Code', I1: 'Client', J1: 'Revenue',
            H2: 1043, H3: 1071, H4: 1014, H5: 1095
          })
        },
        target: ['I2:I5', 'J2:J5'],
        solution: { 'I2:I5': '=VLOOKUP($H2,$A$2:$F$8,2,0)', 'J2:J5': '=VLOOKUP($H2,$A$2:$F$8,6,0)' },
        check: { '*': { mustUseAny: ['VLOOKUP', 'INDEX', 'XLOOKUP'] } },
        explain: {
          idea: 'VLOOKUP scans DOWN the first column of the table you gave it, and when it finds the key it walks RIGHT by the number of columns you asked for. V stands for vertical.',
          walk: [
            'Code 1043: Excel reads down column A, finds 1043 in row 4, then counts columns from the left edge of the table. Column 1 is A (the code), column 2 is B — the name. Answer: Uralchem Logistics.',
            'For revenue the count is 6: A=1, B=2, C=3, D=4, E=5, F=6. Note the count starts at the left edge of the TABLE, not at column A of the sheet.',
            '$H2 has the column pinned and the row free, so the same formula works when pulled right into column J and down through the rows.',
            'The table $A$2:$F$8 is fully pinned because it must never move.'
          ],
          mistakes: [
            'Leaving out the final 0. With codes sorted ascending it happens to still work here, which is worse: you learn a habit that breaks silently on the next data set.',
            'Counting the column from column A of the worksheet rather than from the start of the table. If the table began at column C, the name would still be column 2.',
            'Including the header row in the table range and then being one row out. Here the table starts at row 2 deliberately.'
          ],
          onTheJob: 'Joining a transaction list to a client master file is the most common single operation in consulting data work. In a database you would call it a JOIN; in Excel it is this.'
        }
      },
      {
        id: '5.2', title: 'Discount ladder: approximate match', points: 25,
        brief: 'In D2:D9 work out the discount rate for each order using the ladder in F2:G6. The ladder is sorted ascending, which is exactly the case approximate VLOOKUP is built for.',
        hint: '=VLOOKUP(C2,$F$2:$G$6,2,1) — the final 1 (TRUE) means "largest value not exceeding". This replaces the nested IFs from level 3.',
        sheet: {
          rows: 12, cols: 9,
          colWidths: { A: 90, B: 140, C: 120, D: 100, F: 130, G: 100 },
          styles: { 'A1:D1': H, 'F1:G1': H },
          formats: { 'D2:D9': '0%', 'G2:G6': '0%' },
          cells: {
            A1: 'Order', B1: 'Client', C1: 'Units', D1: 'Discount',
            F1: 'From units', G1: 'Discount',
            F2: 0, G2: 0, F3: 1000, G3: 0.05, F4: 5000, G4: 0.1, F5: 10000, G5: 0.15, F6: 50000, G6: 0.2,
            A2: 'Z-01', B2: 'Alpha', C2: 12000, A3: 'Z-02', B3: 'Beta', C3: 800,
            A4: 'Z-03', B4: 'Gamma', C4: 5000, A5: 'Z-04', B5: 'Delta', C5: 49999,
            A6: 'Z-05', B6: 'Epsilon', C6: 50000, A7: 'Z-06', B7: 'Zeta', C7: 1000,
            A8: 'Z-07', B8: 'Eta', C8: 999, A9: 'Z-08', B9: 'Theta', C9: 260000
          }
        },
        target: ['D2:D9'],
        solution: { 'D2:D9': '=VLOOKUP(C2,$F$2:$G$6,2,1)' },
        check: { '*': { mustUseAny: ['VLOOKUP', 'LOOKUP', 'XLOOKUP', 'INDEX'] } },
        explain: {
          idea: 'Approximate match does not look for your number. It looks for the last row whose key is still below or equal to your number — the step of the staircase you are standing on.',
          walk: [
            'Order Z-02 has 800 units. The ladder starts at 0, then 1000. 800 is past 0 but not yet 1000, so Excel stops on the 0 row and returns 0%.',
            'Order Z-03 has exactly 5,000. There is a 5,000 row, so it lands on it exactly: 10%.',
            'Order Z-04 has 49,999 — one unit short of the top step, so it stays on 10,000 and gets 15%.',
            'Order Z-08 has 260,000, far past the last step. Approximate match happily stays on the last row and returns 20%. There is no "too big" error, which is usually what you want for a ladder.',
            'This is the same answer as three nested IFs in level 3, in a quarter of the characters — and the client can edit the ladder without touching a formula.'
          ],
          mistakes: [
            'Forgetting to sort the ladder ascending. Approximate match walks down and stops at the first row that is too big; on unsorted data it stops in the wrong place and returns nonsense with no error.',
            'Starting the ladder at 1,000 instead of 0. Then small orders return #N/A because there is nothing below them to land on.',
            'Using 0 (exact) here. Only orders of exactly 1,000 or 5,000 would find a match; everything else would be #N/A.'
          ],
          onTheJob: 'Tax bands, commission grids, shipping rates, credit-rating scales — anything with "from X" in it — is an approximate lookup. Recognising the shape is worth minutes on a timed test.'
        }
      },
      {
        id: '5.3', title: 'Looking left: INDEX + MATCH', points: 30,
        brief: 'For the client names in H2:H5 return their code in I2:I5. The code sits to the LEFT of the name, so VLOOKUP is helpless here — use INDEX and MATCH.',
        hint: '=INDEX($A$2:$A$8,MATCH($H2,$B$2:$B$8,0)). INDEX answers "what to return", MATCH answers "from which row".',
        sheet: {
          rows: 12, cols: 12,
          colWidths: { A: 70, B: 190, C: 130, D: 90, E: 100, F: 100, H: 190, I: 90 },
          styles: { 'A1:F1': H, 'H1:I1': H },
          cells: Object.assign({}, CLIENTS, {
            H1: 'Client', I1: 'Code',
            H2: 'Volga Retail', H3: 'Mosenergo Service', H4: 'AgroDon', H5: 'Siberia Telecom'
          })
        },
        target: ['I2:I5'],
        solution: { 'I2:I5': '=INDEX($A$2:$A$8,MATCH($H2,$B$2:$B$8,0))' },
        check: { '*': { mustUse: ['INDEX', 'MATCH'], forbid: ['VLOOKUP'] } },
        explain: {
          idea: 'Split the job in two. MATCH is the finder: it returns a position number. INDEX is the fetcher: give it a range and a position and it hands back the value. Neither cares which side of the sheet the other is on.',
          walk: [
            'MATCH("Volga Retail", $B$2:$B$8, 0) scans the seven names and finds it in 4th place. It returns the number 4 — not the name, not the code, just 4.',
            'INDEX($A$2:$A$8, 4) then reads the 4th cell of the code range and returns 1056.',
            'The two ranges are separate arguments, which is exactly why this works leftwards: nothing forces the answer column to sit to the right of the key column.',
            'The 0 in MATCH means exact match, the same idea as the 0 in VLOOKUP.',
            'Position 4 is counted inside the range you gave, not on the sheet: row 5 of the sheet is position 4 of $B$2:$B$8.'
          ],
          mistakes: [
            'Giving INDEX and MATCH ranges of different heights. $A$2:$A$8 is seven cells and $B$2:$B$8 is seven cells — if one were $B$2:$B$9 the positions would drift by one and every answer would be off by a row. That bug produces plausible wrong answers, which is the worst kind.',
            'Forgetting the 0 in MATCH: it then defaults to approximate and needs sorted data.',
            'Swapping the arguments — INDEX(MATCH(…)) has to be in that order, the finder inside the fetcher.'
          ],
          onTheJob: 'INDEX+MATCH is the professional default. It does not break when someone inserts a column into the source table, which is what always happens two weeks into a project.'
        }
      },
      {
        id: '5.4', title: 'Two-way rate lookup', points: 30,
        brief: 'In C10:C13 pull the monthly rate that sits where the segment (A10:A13) meets the contract term (B10:B13) in the matrix B2:E6.',
        hint: '=INDEX($B$3:$E$6,MATCH($A10,$A$3:$A$6,0),MATCH($B10,$B$2:$E$2,0)). Two MATCHes: one down the rows, one across the columns.',
        sheet: {
          rows: 16, cols: 7,
          colWidths: { A: 140, B: 130, C: 120, D: 110, E: 110 },
          styles: { 'A2:E2': H, 'A3:A6': H, 'A9:C9': H },
          cells: {
            A1: 'Rate card, per month',
            A2: 'Segment \\ Term', B2: '3 months', C2: '6 months', D2: '12 months', E2: '24 months',
            A3: 'Small', B3: 45000, C3: 42000, D3: 38000, E3: 35000,
            A4: 'Mid', B4: 120000, C4: 112000, D4: 98000, E4: 90000,
            A5: 'Large', B5: 310000, C5: 290000, D5: 260000, E5: 240000,
            A6: 'Enterprise', B6: 780000, C6: 720000, D6: 650000, E6: 590000,
            A9: 'Segment', B9: 'Term', C9: 'Rate',
            A10: 'Mid', B10: '12 months', A11: 'Large', B11: '3 months',
            A12: 'Enterprise', B12: '24 months', A13: 'Small', B13: '6 months'
          }
        },
        target: ['C10:C13'],
        solution: { 'C10:C13': '=INDEX($B$3:$E$6,MATCH($A10,$A$3:$A$6,0),MATCH($B10,$B$2:$E$2,0))' },
        check: { '*': { mustUse: ['INDEX', 'MATCH'] } },
        explain: {
          idea: 'INDEX can take two coordinates: a row number and a column number. Supply each from its own MATCH and you have read a cell at the crossing of two labels.',
          walk: [
            'Row 10 asks for Mid × 12 months.',
            'MATCH("Mid", $A$3:$A$6, 0) looks down the segment labels and returns 2.',
            'MATCH("12 months", $B$2:$E$2, 0) looks along the term labels and returns 3.',
            'INDEX($B$3:$E$6, 2, 3) reads the 2nd row and 3rd column of the rate block — 98,000.',
            'Look carefully at the three ranges: the INDEX block $B$3:$E$6 contains ONLY the numbers, the row labels $A$3:$A$6 sit beside it and the column labels $B$2:$E$2 sit above it. They line up but do not overlap. Getting that alignment right is the entire task.'
          ],
          mistakes: [
            'Including the label row or column inside the INDEX block. Every answer then lands one row or one column away — and still looks like a plausible price.',
            'Matching the term against the wrong strip, for example $A$2:$A$6, which mixes labels from two different axes.',
            'Typing the term as "12 month" or "12 months " with a trailing space: MATCH is literal and returns #N/A.'
          ],
          onTheJob: 'Rate cards, freight matrices, discount grids by channel and volume — the two-way lookup is how any priced matrix is read into a model.'
        }
      },
      {
        id: '5.5', title: 'What to do about #N/A', points: 25,
        brief: 'In I2:I6 pull the client’s region by code. Some codes are missing from the master file — those should read "not in database" instead of an error.',
        hint: '=IFERROR(VLOOKUP($H2,$A$2:$F$8,3,0),"not in database"). XLOOKUP can do it with its own fourth argument.',
        sheet: {
          rows: 12, cols: 12,
          colWidths: { A: 70, B: 190, C: 130, D: 90, E: 100, F: 100, H: 80, I: 160 },
          styles: { 'A1:F1': H, 'H1:I1': H },
          cells: Object.assign({}, CLIENTS, {
            H1: 'Code', I1: 'Region',
            H2: 1027, H3: 9999, H4: 1088, H5: 1200, H6: 1056
          })
        },
        target: ['I2:I6'],
        solution: { 'I2:I6': '=IFERROR(VLOOKUP($H2,$A$2:$F$8,3,0),"not in database")' },
        check: { '*': { mustUseAny: ['IFERROR', 'IFNA', 'XLOOKUP'] } },
        explain: {
          idea: '#N/A is a finding, not a failure. It tells you the key is genuinely absent. Wrapping it in IFERROR converts a technical symbol into a sentence a client can read.',
          walk: [
            'Codes 9999 and 1200 do not exist in the master file, so VLOOKUP raises #N/A.',
            'IFERROR intercepts it and substitutes your text. The other three rows pass straight through untouched.',
            'IFNA would be a slightly better choice here: it catches only #N/A and would still let a #REF! from a deleted column shout at you.',
            'Before hiding an #N/A, always check the usual suspects: a trailing space, a number stored as text, or a key that was trimmed differently in the two files.'
          ],
          mistakes: [
            'Blanket-wrapping every lookup in IFERROR at the start. Two hundred rows then read "not in database" and nobody notices the source table lost half its rows.',
            'Returning 0 instead of a label when the column will later be summed — you have just invented revenue of zero for a client that does not exist.',
            'Not counting how many rows failed. If it is 2 out of 5 you have a data problem worth raising, not a formatting problem.'
          ],
          onTheJob: 'The number of unmatched keys is itself a deliverable. "8% of transactions have no client record" is the sort of sentence that changes what a project does next.'
        }
      },
      {
        id: '5.6', title: 'XLOOKUP, the grown-up tool', points: 25,
        brief: 'In I2:I5 return the manager for each client name using XLOOKUP, and in J2:J5 their revenue. Where the client is unknown return a dash.',
        hint: '=XLOOKUP($H2,$B$2:$B$8,$E$2:$E$8,"—"). Third argument is what to return, fourth is what to do when nothing is found.',
        sheet: {
          rows: 12, cols: 12,
          colWidths: { A: 70, B: 190, C: 130, D: 90, E: 100, F: 100, H: 190, I: 120, J: 110 },
          styles: { 'A1:F1': H, 'H1:J1': H },
          cells: Object.assign({}, CLIENTS, {
            H1: 'Client', I1: 'Manager', J1: 'Revenue',
            H2: 'Petro Construction', H3: 'Unknown Company Ltd', H4: 'Uralchem Logistics', H5: 'AgroDon'
          })
        },
        target: ['I2:I5', 'J2:J5'],
        solution: {
          'I2:I5': '=XLOOKUP($H2,$B$2:$B$8,$E$2:$E$8,"—")',
          'J2:J5': '=XLOOKUP($H2,$B$2:$B$8,$F$2:$F$8,"—")'
        },
        check: { '*': { mustUse: ['XLOOKUP'] } },
        explain: {
          idea: 'XLOOKUP takes the two ranges separately, like INDEX+MATCH, but reads like VLOOKUP. It also defaults to an exact match and has a built-in slot for "not found".',
          walk: [
            'Argument 1 is the key, argument 2 is where to search, argument 3 is what to return. Search and return ranges are independent, so direction stops mattering.',
            'Argument 4 is the fallback: "Unknown Company Ltd" is not in the list, so the cell shows a dash instead of #N/A — no IFERROR needed.',
            'There is no column number to count, which removes the most common VLOOKUP bug entirely.',
            'To return revenue instead of the manager you only swap the third range from $E$ to $F$. With VLOOKUP you would recount columns.'
          ],
          mistakes: [
            'Assuming XLOOKUP exists everywhere. It needs Microsoft 365 or Excel 2021 — on an older test machine you must fall back to INDEX+MATCH, so know both.',
            'Making the search and return ranges different heights: the answers silently shift.',
            'Forgetting that its default IS exact match — adding a 0 as the fifth argument does something else entirely (it is the match mode, and 0 there is still exact, but 1 and −1 are not).'
          ],
          onTheJob: 'If the test machine has it, XLOOKUP is faster to write and safer. If it does not, the INDEX+MATCH you learned two tasks ago does everything it does.'
        }
      }
    ]
  });

  /* ========================================================== LEVEL 6 ===== */
  LEVELS.push({
    id: 6,
    title: 'Text and dates',
    subtitle: 'Cleaning up an export and working with the calendar',
    goal: 'Turn a messy system export into data you can actually analyse — roughly a third of real analyst work.',
    theory: [
      { h: 'Numbers stored as text', p: 'An export of "1 250 USD" is text and SUM cannot see it. The cure is always the same: SUBSTITUTE strips the rubbish, VALUE turns what is left into a number. The tell-tale sign is numbers sitting on the LEFT of the cell instead of the right.' },
      { h: 'Cutting strings up', p: 'LEFT, RIGHT and MID slice; FIND reports where the separator sits. MID(A2,FIND(" ",A2)+1,1) pulls out the first letter of the second word.' },
      { h: 'Building a key', p: 'When no single column is unique, glue two together with &: =B2&"|"&C2. VLOOKUP then works off that combined key.' },
      { h: 'Dates are numbers', p: 'A date is a count of days since 1900, which is why you can subtract dates to get days and add numbers to get later dates. YEAR, MONTH and DAY take a date apart; EOMONTH and EDATE move it around the calendar.' },
      { h: 'Quarter from a date', p: 'Quarter = ROUNDUP(MONTH(date)/3,0). Months 1-3 give 1, months 4-6 give 2, and so on. It is the standard trick for grouping sales by quarter.' }
    ],
    tasks: [
      {
        id: '6.1', title: 'Cleaning an export', points: 25,
        brief: 'Turn the text amounts in A2:A8 into real numbers in column B, and total them in B10.',
        hint: '=VALUE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(A2," ",""),"USD",""),"$","")). Check your work: the numbers should jump to the right-hand side of the cell.',
        sheet: {
          rows: 12, cols: 4,
          colWidths: { A: 170, B: 140 },
          styles: { 'A1:B1': H },
          cells: {
            A1: 'Export', B1: 'Number',
            A2: '1 250 USD', A3: '890USD', A4: '2 400 USD', A5: ' 3 100 USD ',
            A6: '12 750USD', A7: '640 USD', A8: '9 999 USD',
            A10: 'Total'
          }
        },
        target: ['B2:B8', 'B10'],
        solution: {
          'B2:B8': '=VALUE(SUBSTITUTE(SUBSTITUTE(A2," ",""),"USD",""))',
          B10: '=SUM(B2:B8)'
        },
        check: { '*': { mustUseAny: ['VALUE', 'SUBSTITUTE', 'SUM'] } },
        explain: {
          idea: 'Excel refuses to add text, and it is right to. The job is to remove everything that is not a digit, then explicitly declare the result to be a number.',
          walk: [
            'Work from the inside out. SUBSTITUTE(A2," ","") takes "1 250 USD" and deletes every space, leaving "1250USD".',
            'The outer SUBSTITUTE then deletes "USD", leaving "1250". That is still text — it just looks like a number.',
            'VALUE("1250") finally converts it to the number 1250. Now SUM can see it.',
            'Row 5 has spaces at both ends as well as inside. Deleting all spaces handles that too, so no separate TRIM is needed here.',
            'The proof it worked: before, the entries hugged the left edge of the cell; after, they sit on the right, because Excel right-aligns numbers by default.'
          ],
          mistakes: [
            'Trying SUM(A2:A8) on the raw column. You get 0 and no error at all — SUM simply ignores text, which is why this bug survives so long.',
            'Using TRIM alone. TRIM removes edge and doubled spaces but leaves the single space inside "1 250" and the "USD".',
            'Retyping the numbers by hand. Fine for seven rows, impossible for seven thousand, and it destroys the audit trail from the source file.'
          ],
          onTheJob: 'Nearly every client export arrives like this — currency symbols, thousands separators, stray non-breaking spaces. Being fast at this is a large part of being useful in the first week of a project.'
        }
      },
      {
        id: '6.2', title: 'Splitting a full name', points: 25,
        brief: 'From the full names in A2:A7 produce: B — the surname, C — initials in the form "I.I.", D — the length of the surname in characters.',
        hint: 'B: =LEFT(A2,FIND(" ",A2)-1). C: use MID and FIND, with the second FIND starting after the first space. D: =LEN(B2).',
        sheet: {
          rows: 10, cols: 5,
          colWidths: { A: 230, B: 150, C: 110, D: 140 },
          styles: { 'A1:D1': H },
          cells: {
            A1: 'Full name', B1: 'Surname', C1: 'Initials', D1: 'Surname length',
            A2: 'Ivanov Ivan Ivanovich', A3: 'Petrova Maria Sergeevna',
            A4: 'Kuznetsov Dmitry Olegovich', A5: 'Volkova Anna Pavlovna',
            A6: 'Sidorov Peter Nikolaevich', A7: 'Smirnova Olga Viktorovna'
          }
        },
        target: ['B2:B7', 'C2:C7', 'D2:D7'],
        solution: {
          'B2:B7': '=LEFT(A2,FIND(" ",A2)-1)',
          'C2:C7': '=MID(A2,FIND(" ",A2)+1,1)&"."&MID(A2,FIND(" ",A2,FIND(" ",A2)+1)+1,1)&"."',
          'D2:D7': '=LEN(B2)'
        },
        explain: {
          idea: 'FIND gives you a position; LEFT, RIGHT and MID cut at positions. Every string task is a combination of "where is the landmark" and "cut here".',
          walk: [
            'FIND(" ", A2) on "Ivanov Ivan Ivanovich" returns 7 — the space is the 7th character.',
            'The surname is everything BEFORE that space, so we take 7−1 = 6 characters: LEFT(A2,6) gives "Ivanov". The −1 is the whole reason this works.',
            'For the initials we want the character just after the first space: MID(A2, 7+1, 1) = "I".',
            'The second space is found by telling FIND where to start looking: FIND(" ", A2, FIND(" ",A2)+1) starts the search after the first space and returns 12. One character later sits the second initial.',
            'The pieces are glued with & and full stops: "I" & "." & "I" & "." = "I.I."'
          ],
          mistakes: [
            'Forgetting the −1 and capturing the trailing space, giving "Ivanov " which then fails every lookup that compares it to "Ivanov".',
            'Assuming every name has exactly three parts. Real data has "van der Berg" and single-word names, and FIND returns #VALUE! when there is no space at all.',
            'Using SEARCH and FIND interchangeably. FIND is case sensitive, SEARCH is not, and SEARCH understands wildcards.'
          ],
          onTheJob: 'Client lists always arrive as one "name" column that has to be split, or as three columns that have to be joined. This and the reverse operation cover most of it.'
        }
      },
      {
        id: '6.3', title: 'A composite key for VLOOKUP', points: 25,
        brief: 'Price depends on the pair "region + product". Build the key in C2:C7 and use it to pull the price from the rate table F2:G7 into D2:D7.',
        hint: 'C2: =A2&"|"&B2. D2: =VLOOKUP(C2,$F$2:$G$7,2,0). This is how you fake a two-column VLOOKUP.',
        sheet: {
          rows: 10, cols: 8,
          colWidths: { A: 120, B: 110, C: 190, D: 100, F: 210, G: 100 },
          styles: { 'A1:D1': H, 'F1:G1': H },
          cells: {
            A1: 'Region', B1: 'Product', C1: 'Key', D1: 'Price',
            F1: 'Rate table key', G1: 'Price',
            F2: 'Moscow|Software', G2: 1200, F3: 'Moscow|Services', G3: 2400,
            F4: 'St Petersburg|Software', G4: 1100, F5: 'St Petersburg|Services', G5: 2150,
            F6: 'Urals|Software', G6: 980, F7: 'Urals|Services', G7: 1900,
            A2: 'St Petersburg', B2: 'Services', A3: 'Moscow', B3: 'Software',
            A4: 'Urals', B4: 'Services', A5: 'Moscow', B5: 'Services',
            A6: 'Urals', B6: 'Software', A7: 'St Petersburg', B7: 'Software'
          }
        },
        target: ['C2:C7', 'D2:D7'],
        solution: { 'C2:C7': '=A2&"|"&B2', 'D2:D7': '=VLOOKUP(C2,$F$2:$G$7,2,0)' },
        check: { D2: { mustUseAny: ['VLOOKUP', 'INDEX', 'XLOOKUP'] } },
        explain: {
          idea: 'VLOOKUP only searches one column. When uniqueness needs two columns, you manufacture a single column that contains both — that is all a composite key is.',
          walk: [
            '=A2&"|"&B2 glues "St Petersburg" + "|" + "Services" into "St Petersburg|Services".',
            'The rate table has been built with keys in the same shape, so an ordinary exact VLOOKUP now finds the row.',
            'The separator is not decoration. Without it "Moscow" + "Software" and "Mosco" + "wSoftware" would produce the same key. A character that never appears in the data — | is the usual pick — keeps keys unambiguous.',
            'Both sides must be built identically: same order, same separator, same spelling.'
          ],
          mistakes: [
            'Building the key as B2&"|"&A2 on one side and A2&"|"&B2 on the other. Every lookup returns #N/A and the reason is invisible until you widen the column.',
            'Gluing without a separator.',
            'Building the key with a space that exists in one file and not the other. TRIM both sides first if the data came from different systems.'
          ],
          onTheJob: 'Any join on more than one field — product × month, country × channel, customer × contract — is done this way in Excel. A database does it natively; Excel needs the helper column.'
        }
      },
      {
        id: '6.4', title: 'Year, quarter, month', points: 25,
        brief: 'From the deal dates in A2:A9 work out: B — the year, C — the quarter number, D — a label such as "2024 Q1", E — how many days passed from the deal date to the reporting date in $H$2.',
        hint: 'C: =ROUNDUP(MONTH(A2)/3,0). D: =YEAR(A2)&" Q"&C2. E: =$H$2-A2 — dates simply subtract.',
        sheet: {
          rows: 12, cols: 9,
          colWidths: { A: 130, B: 90, C: 110, D: 130, E: 130, G: 140, H: 130 },
          styles: { 'A1:E1': H, 'G1:H1': H },
          formats: { 'A2:A9': 'dd/mm/yyyy', H2: 'dd/mm/yyyy' },
          cells: {
            A1: 'Deal date', B1: 'Year', C1: 'Quarter', D1: 'Label', E1: 'Days elapsed',
            G1: 'Assumption', H1: 'Value', G2: 'Reporting date', H2: '31/12/2024',
            A2: '15/01/2024', A3: '28/03/2024', A4: '02/04/2024', A5: '30/06/2024',
            A6: '01/07/2024', A7: '19/09/2024', A8: '05/10/2024', A9: '24/12/2024'
          }
        },
        target: ['B2:B9', 'C2:C9', 'D2:D9', 'E2:E9'],
        solution: {
          'B2:B9': '=YEAR(A2)', 'C2:C9': '=ROUNDUP(MONTH(A2)/3,0)',
          'D2:D9': '=YEAR(A2)&" Q"&C2', 'E2:E9': '=$H$2-A2'
        },
        check: { B2: { mustUse: ['YEAR'] }, C2: { mustUse: ['MONTH'] }, E2: { mustContain: ['$H$2'] } },
        explain: {
          idea: 'Excel stores a date as a plain number — 15 January 2024 is 45,306 days after the start of 1900. Everything else is formatting. That is why arithmetic on dates just works.',
          walk: [
            'MONTH(A2) turns the date into a month number, 1 to 12.',
            'Divide by 3: January gives 0.33, February 0.67, March exactly 1. ROUNDUP pushes all three to 1 — quarter one. April/May/June give 1.33/1.67/2, all rounding up to 2.',
            'Rows 5 and 6 are the interesting pair: 30 June is Q2 and 1 July is Q3, one day apart and in different halves of the year.',
            'The label glues a number and text: YEAR gives 2024, & " Q" adds the separator, & C2 adds the quarter. Excel converts the numbers to text automatically when gluing.',
            'E is simply 31/12/2024 minus the deal date. Because both are day counts, the difference is a number of days — no special function required.'
          ],
          mistakes: [
            'Using ROUND instead of ROUNDUP. February would then be quarter 1 (0.67 → 1, fine) but May would be 1.67 → 2 and April 1.33 → 1. April in Q1 is wrong.',
            'Typing the reporting date into each row instead of pinning $H$2.',
            'Dates arriving as text. If E shows #VALUE!, the "dates" are strings and need DATEVALUE or a re-import — check the alignment first.'
          ],
          onTheJob: 'Everything gets reported by quarter. Adding a quarter column to a raw transaction table is usually the first thing you do before any pivot.'
        }
      },
      {
        id: '6.5', title: 'A payment schedule', points: 30,
        brief: 'From the shipment dates in A2:A8 work out: B — the payment date after the credit terms in $F$2 days, C — the end of the shipment month, D — the end of the following month, E — "overdue" when payment falls after the reporting date in $F$3.',
        hint: 'B: =A2+$F$2. C: =EOMONTH(A2,0). D: =EOMONTH(A2,1). E: =IF(B2>$F$3,"overdue","on time").',
        sheet: {
          rows: 11, cols: 8,
          colWidths: { A: 120, B: 120, C: 140, D: 160, E: 120, F: 120, G: 140 },
          styles: { 'A1:E1': H },
          formats: { 'A2:A8': 'dd/mm/yyyy', 'B2:B8': 'dd/mm/yyyy', 'C2:C8': 'dd/mm/yyyy', 'D2:D8': 'dd/mm/yyyy', F3: 'dd/mm/yyyy' },
          cells: {
            A1: 'Shipment', B1: 'Payment due', C1: 'End of month', D1: 'End of next month', E1: 'Status',
            G2: 'Credit terms, days', F2: 45, G3: 'Reporting date', F3: '30/11/2024',
            A2: '15/01/2024', A3: '29/02/2024', A4: '31/03/2024', A5: '18/07/2024',
            A6: '30/09/2024', A7: '15/10/2024', A8: '20/11/2024'
          }
        },
        target: ['B2:B8', 'C2:C8', 'D2:D8', 'E2:E8'],
        solution: {
          'B2:B8': '=A2+$F$2', 'C2:C8': '=EOMONTH(A2,0)', 'D2:D8': '=EOMONTH(A2,1)',
          'E2:E8': '=IF(B2>$F$3,"overdue","on time")'
        },
        check: { C2: { mustUse: ['EOMONTH'] }, D2: { mustUse: ['EOMONTH'] }, E2: { mustUse: ['IF'] } },
        explain: {
          idea: 'Adding a number to a date adds days. Moving by whole months is different, because months have different lengths — that is what EOMONTH is for.',
          walk: [
            'B: 15 January + 45 days = 29 February 2024. Excel knows 2024 is a leap year; you do not have to.',
            'C: EOMONTH(A2,0) means "the last day of the month this date is in". For January it returns the 31st.',
            'D: EOMONTH(A2,1) shifts one month forward first, then takes the last day — 29 February for a January date, and 31 March for a February date. The second argument is a number of months, and it can be negative to go back.',
            'Row 3 is the trap: the shipment is 29 February, and EOMONTH(29/02/2024, 1) is 31 March, not 29 March. End of month means end of month.',
            'E compares two dates with a plain > because they are just numbers.'
          ],
          mistakes: [
            'Using EDATE where EOMONTH is meant. EDATE(31/01, 1) gives 29 February — the same day number, clipped — while EOMONTH gives the month end. Both are right for different questions.',
            'Adding 30 to approximate a month. Over a year that drifts by five days and your cash-flow model quietly slips a period.',
            'Comparing a real date with a text date. If the status column looks random, check that F3 is a date and not a string.'
          ],
          onTheJob: 'Receivables ageing, covenant dates, revenue recognition cut-offs — all of it is EOMONTH plus a comparison. The difference between "45 days" and "end of the month plus 45 days" is a real dispute in real contracts.'
        }
      },
      {
        id: '6.6', title: 'Length of the relationship', points: 25,
        brief: 'From the first-contract dates in B2:B8, as at the reporting date $F$2, work out: C — whole years, D — the extra months beyond those years, E — a label such as "3y 4m".',
        hint: 'C: =DATEDIF(B2,$F$2,"y"). D: =DATEDIF(B2,$F$2,"ym"). E: =C2&"y "&D2&"m".',
        sheet: {
          rows: 11, cols: 8,
          colWidths: { A: 190, B: 140, C: 110, D: 140, E: 150, F: 120, G: 140 },
          styles: { 'A1:E1': H },
          formats: { 'B2:B8': 'dd/mm/yyyy', F2: 'dd/mm/yyyy' },
          cells: {
            A1: 'Client', B1: 'First contract', C1: 'Whole years', D1: 'Extra months', E1: 'Tenure',
            G2: 'Reporting date', F2: '31/12/2024',
            A2: 'Northern Steel Trade', B2: '12/03/2019',
            A3: 'Mosenergo Service', B3: '01/01/2021',
            A4: 'Uralchem Logistics', B4: '28/02/2022',
            A5: 'Volga Retail', B5: '15/11/2023',
            A6: 'Siberia Telecom', B6: '30/06/2017',
            A7: 'Petro Construction', B7: '05/09/2024',
            A8: 'AgroDon', B8: '20/12/2020'
          }
        },
        target: ['C2:C8', 'D2:D8', 'E2:E8'],
        solution: {
          'C2:C8': '=DATEDIF(B2,$F$2,"y")', 'D2:D8': '=DATEDIF(B2,$F$2,"ym")',
          'E2:E8': '=C2&"y "&D2&"m"'
        },
        check: { C2: { mustUse: ['DATEDIF'] }, D2: { mustUse: ['DATEDIF'] } },
        explain: {
          idea: 'DATEDIF answers "how far apart" in whole units, and the unit is chosen by a piece of text: "y" whole years, "m" whole months in total, "ym" the months left over after the whole years.',
          walk: [
            'Northern Steel Trade, 12 March 2019 to 31 December 2024: five full years have passed (the 2024 anniversary was in March), so "y" gives 5.',
            'From 12 March 2024 to 31 December 2024 is nine more whole months, so "ym" gives 9. The label reads "5y 9m".',
            'Petro Construction started in September 2024, so "y" gives 0 and "ym" gives 3 — "0y 3m". Zero years is a perfectly good answer.',
            'DATEDIF is the odd one out in Excel: it is a leftover from Lotus 1-2-3, it does not appear in the function autocomplete list, and it still works everywhere. Type it in full.'
          ],
          mistakes: [
            'Using YEAR(end)−YEAR(start). That says a client who signed in December 2023 has been with you for "1 year" on 1 January 2024.',
            'Using "m" when you wanted "ym". "m" returns the TOTAL months, 69 here, which makes the label read "5y 69m".',
            'Putting the later date first. DATEDIF returns #NUM! rather than a negative number.'
          ],
          onTheJob: 'Tenure drives cohort analysis, churn curves and loyalty pricing. It is also how you check whether a "long-standing client" story survives contact with the contract dates.'
        }
      }
    ]
  });

  /* ========================================================== LEVEL 7 ===== */
  LEVELS.push({
    id: 7,
    title: 'Tables, sorting and filtering',
    subtitle: 'Getting a raw data dump under control',
    goal: 'Sort and filter a table the way the test expects, and understand why SUBTOTAL exists.',
    theory: [
      { h: 'Turn on the filter first', p: 'Select the table, press ⌘⇧F (Ctrl+Shift+L on Windows) and every header gets an arrow. This is the first thing you do to any new data set, before you write a single formula.' },
      { h: 'Sorting moves rows, not cells', p: 'Sorting rearranges whole rows so the record stays intact. Sorting one column on its own would scramble the data — which is why you sort a table, never a selected column.' },
      { h: 'A filter hides rows, it does not delete them', p: 'Filtered-out rows are still there and SUM still counts them. That surprises people constantly and it is exactly what the next point is about.' },
      { h: 'SUBTOTAL sees only what you see', p: 'SUBTOTAL(9, range) sums the VISIBLE rows; SUM(range) sums all of them. Function number 9 is SUM, 1 is AVERAGE, 2 is COUNT, 3 is COUNTA, 4 is MAX, 5 is MIN. Whenever you filter and then want a total, you want SUBTOTAL.' },
      { h: 'Never put a summary beside a filtered table', p: 'A filter hides the ENTIRE sheet row, including cells outside the table. A total parked in column J next to row 5 disappears the moment row 5 is filtered out. Totals belong below the table or above it — which is exactly where the tasks on this level put them.' },
      { h: 'Filtering is not analysis', p: 'A filter answers one question at a time and leaves no trace of what you did. When the answer has to survive on a slide, put it in a formula or a pivot instead.' }
    ],
    tasks: [
      {
        id: '7.1', title: 'Sort by size and read off the top', points: 25,
        brief: 'Sort the deal book by Revenue from largest to smallest. Then in J2 report the code of the biggest deal, and in J3 the share of total revenue that the top five deals make up.',
        hint: 'Click the arrow on the Revenue header and choose "Sort Z → A". After sorting, the biggest deal sits in row 2, so J2 is simply =A2 and J3 is =SUM(F2:F6)/SUM(F2:F21).',
        sheet: dealSheet({
          I1: 'Metric', J1: 'Value',
          I2: 'Largest deal', I3: 'Share of top 5'
        }, { styles: { 'I1:J1': H }, colWidths: { I: 160, J: 130 }, formats: { J3: '0.0%' } }),
        table: 'A1:G21',
        target: ['J2', 'J3'],
        solution: { J2: '=A2', J3: '=SUM(F2:F6)/SUM(F2:F21)' },
        expect: { sortedBy: { col: 'F', asc: false } },
        check: { J2: { noHardcode: true }, J3: { mustUse: ['SUM'] } },
        explain: {
          idea: 'Sorting changes which record sits in which row. Formulas that point at row positions — "the first row", "the top five" — only mean anything once the table is in the right order.',
          walk: [
            'Sorting on Revenue descending moves D-008 (12,400) to row 2 and D-011 (1,650) to the bottom.',
            'Every other column travelled with it: row 2 now reads D-008, Siberia, Energy, Kuznetsov, Won, 12,400, 24%. The record stayed whole, which is what sorting a TABLE means.',
            'J2 = A2 now returns D-008. Before the sort the same formula returned D-001. The formula did not change; the data under it did.',
            'J3 adds the first five revenue cells and divides by the total of all twenty: 48,200 / 102,600 = 47.0%. Five deals out of twenty carry nearly half the revenue.',
            'That is only true because the rows are sorted. On unsorted data the same formula adds five arbitrary deals and means nothing.'
          ],
          mistakes: [
            'Sorting only the Revenue column and leaving the rest in place. Every row would then be a mix of different deals — the fastest way to destroy a data set.',
            'Sorting ascending when the question says largest first. J2 would return the smallest deal and look perfectly plausible.',
            'Typing "D-008" into J2. It is right until the next sort.'
          ],
          onTheJob: 'Sort-then-read-the-top is how you spend the first two minutes with any new data set: biggest customers, worst-performing stores, longest-overdue invoices.'
        }
      },
      {
        id: '7.2', title: 'Filter, and why SUM lies', points: 30,
        brief: 'Filter the deal book down to the Moscow region. The summary block sits BELOW the table, because a filter hides whole rows and anything beside the table would vanish with them. Fill B24 with the revenue of the VISIBLE rows, B25 with how many rows are visible, and B26 with a plain SUM over the same range so you can see the difference.',
        hint: 'B24: =SUBTOTAL(9,F2:F21). B25: =SUBTOTAL(3,A2:A21). B26: =SUM(F2:F21). Compare B24 and B26 once the filter is on.',
        sheet: dealSheet({
          A23: 'Summary (kept below the table on purpose)',
          A24: 'Visible revenue (SUBTOTAL)', A25: 'Visible rows', A26: 'Plain SUM of the same range'
        }, { rows: 28, styles: { 'A23': H }, colWidths: { A: 250 } }),
        table: 'A1:G21',
        target: ['B24', 'B25', 'B26'],
        solution: { B24: '=SUBTOTAL(9,F2:F21)', B25: '=SUBTOTAL(3,A2:A21)', B26: '=SUM(F2:F21)' },
        expect: { filtered: { col: 'B', values: ['Moscow'] } },
        check: {
          B24: { mustUse: ['SUBTOTAL'] },
          B25: { mustUse: ['SUBTOTAL'] },
          B26: { mustUse: ['SUM'], forbid: ['SUBTOTAL'] }
        },
        explain: {
          idea: 'A filter is a pair of sunglasses, not a delete key. The rows are still in the sheet; only your view of them changed. SUM looks at the sheet. SUBTOTAL looks at the view.',
          walk: [
            'With the Moscow filter on, six rows remain visible: D-001, D-003, D-005, D-009, D-014, D-019.',
            'SUBTOTAL(9, F2:F21) adds only those six: 41,800. The 9 is the code for SUM.',
            'SUBTOTAL(3, A2:A21) counts visible non-empty cells in the Deal column: 6. Code 3 is COUNTA, which is the right choice for a text column — code 2 (COUNT) would return 0 because deal codes are text.',
            'SUM(F2:F21) in B26 returns 102,600 — the whole table, filter or no filter. Nothing is wrong with the formula; it simply answers a different question.',
            'Turn the filter off and on again while watching B24 and B26. Only B24 moves. That single experiment is the entire lesson.'
          ],
          mistakes: [
            'Filtering the screen and then reading a SUM total off the bottom of the sheet. The number on the slide then covers rows the client cannot see, and nobody can reconcile it later.',
            'Using SUBTOTAL(2, …) on a text column and reporting zero rows.',
            'Forgetting that Excel also shows a live count in the status bar. Useful for a quick look, useless for a deliverable, because it is not in a cell.'
          ],
          onTheJob: 'Any total that sits under a filtered table must be a SUBTOTAL. This is one of the most common things reviewers check, precisely because the failure is invisible on screen.'
        }
      },
      {
        id: '7.3', title: 'Live pipeline only', points: 30,
        brief: 'Filter the Stage column to show only deals that are still live — "Won" and "In progress", but not "Lost". Then report in B24 the visible revenue, in B25 the visible deal count, and in B26 the average visible deal size.',
        hint: 'A filter dropdown lets you tick more than one value. B26 is =SUBTOTAL(1,F2:F21) — function number 1 is AVERAGE.',
        sheet: dealSheet({
          A23: 'Summary',
          A24: 'Live pipeline revenue', A25: 'Live deals', A26: 'Average live deal'
        }, { rows: 28, styles: { 'A23': H }, colWidths: { A: 230 } }),
        table: 'A1:G21',
        target: ['B24', 'B25', 'B26'],
        solution: { B24: '=SUBTOTAL(9,F2:F21)', B25: '=SUBTOTAL(3,A2:A21)', B26: '=SUBTOTAL(1,F2:F21)' },
        expect: { filtered: { col: 'E', values: ['Won', 'In progress'] } },
        check: { '*': { mustUse: ['SUBTOTAL'] } },
        explain: {
          idea: 'One filter dropdown, several ticks. The rule is OR inside a column (Won OR In progress) and AND across columns (this stage AND that region).',
          walk: [
            'Untick "Lost" and leave the other two ticked. Sixteen of the twenty rows stay visible; the four lost deals disappear.',
            'SUBTOTAL(9, …) gives 95,800 — the live pipeline. The four lost deals were worth 6,800.',
            'SUBTOTAL(1, …) is the average of the visible revenue cells: 95,800 / 16 = 5,988.',
            'Notice B26 is not B24/B25 by accident — it is genuinely the same thing, and computing it both ways is a fair self-check.'
          ],
          mistakes: [
            'Ticking values in two different columns and expecting OR. Across columns Excel always uses AND, so "Moscow" plus "Lost" shows only lost Moscow deals.',
            'Using SUBTOTAL(101, …) instead of 1 without knowing the difference: the 100-series also ignores rows you hid by hand, while the 1-series only ignores filtered rows. For filters they behave identically.',
            'Leaving a filter on and forgetting about it. Every later number on that sheet is then silently scoped to whatever was ticked — one of the great sources of embarrassment in client meetings.'
          ],
          onTheJob: 'Pipeline reviews live on this: total pipeline, live pipeline, weighted pipeline. Say which one you are quoting, every time.'
        }
      },
      {
        id: '7.4', title: 'Sort and filter together', points: 30,
        brief: 'Show only the Energy industry, and sort what remains by Margin from largest to smallest. Then report in B24 the visible revenue, in B25 the highest visible margin and in B26 the number of visible deals.',
        hint: 'Filter on Industry, then sort on Margin descending. B25 is =SUBTOTAL(4,G2:G21) — function number 4 is MAX.',
        sheet: dealSheet({
          A23: 'Summary',
          A24: 'Energy revenue', A25: 'Best margin', A26: 'Number of deals'
        }, { rows: 28, styles: { 'A23': H }, colWidths: { A: 210 }, formats: { B25: '0%' } }),
        table: 'A1:G21',
        target: ['B24', 'B25', 'B26'],
        solution: { B24: '=SUBTOTAL(9,F2:F21)', B25: '=SUBTOTAL(4,G2:G21)', B26: '=SUBTOTAL(3,A2:A21)' },
        expect: { filtered: { col: 'C', values: ['Energy'] }, sortedBy: { col: 'G', asc: false } },
        check: { '*': { mustUse: ['SUBTOTAL'] } },
        explain: {
          idea: 'Sorting and filtering stack. The filter decides which rows exist for you; the sort decides what order they appear in. SUBTOTAL then works on whatever survived.',
          walk: [
            'Filtering Industry to Energy leaves three deals: D-003 (9,500 at 22%), D-008 (12,400 at 24%) and D-015 (6,700 at 23%).',
            'Sorting by Margin descending puts D-008 first, D-015 second, D-003 third — and it re-orders the WHOLE table, including the rows the filter is hiding. That is fine and invisible.',
            'SUBTOTAL(9, F2:F21) = 28,600 across the three visible rows.',
            'SUBTOTAL(4, G2:G21) takes the maximum of the visible margins: 24%. A plain MAX would have returned 47% from a financials deal that is not even on screen.',
            'Energy is the biggest industry by revenue and the worst by margin. Seeing both facts at once is why you sorted rather than just filtered.'
          ],
          mistakes: [
            'Sorting before filtering and assuming the order is lost. It is not — the two are independent.',
            'Using MAX instead of SUBTOTAL(4, …) and quoting a margin that belongs to a different industry entirely.',
            'Reading the answer off the screen instead of putting it in a cell. The moment you change the filter, a typed number is wrong and a SUBTOTAL is still right.'
          ],
          onTheJob: 'Filter to a segment, sort by the metric that matters, read the top and the bottom. That is the standard opening move of any diagnostic, and it takes about twenty seconds when you know the shortcuts.'
        }
      },
      {
        id: '7.5', title: 'How many distinct clients', points: 30,
        brief: 'In C2:C13 put a 1 against the first time each client appears and 0 against every repeat. In F2 count the distinct clients, and in F3 the average revenue per distinct client.',
        hint: 'C2: =IF(COUNTIF($B$2:B2,B2)=1,1,0). The range $B$2:B2 grows as you pull the formula down — that is the whole trick.',
        sheet: {
          rows: 16, cols: 7,
          colWidths: { A: 90, B: 190, C: 150, D: 110, E: 220, F: 120 },
          styles: { 'A1:D1': H, 'E1:F1': H },
          cells: {
            A1: 'Deal', B1: 'Client', C1: 'First appearance', D1: 'Revenue',
            E1: 'Metric', F1: 'Value', E2: 'Distinct clients', E3: 'Revenue per client',
            A2: 'D-1', B2: 'Alpha', D2: 1200, A3: 'D-2', B3: 'Beta', D3: 800,
            A4: 'D-3', B4: 'Alpha', D4: 450, A5: 'D-4', B5: 'Gamma', D5: 2300,
            A6: 'D-5', B6: 'Beta', D6: 640, A7: 'D-6', B7: 'Delta', D7: 1900,
            A8: 'D-7', B8: 'Alpha', D8: 780, A9: 'D-8', B9: 'Epsilon', D9: 3100,
            A10: 'D-9', B10: 'Gamma', D10: 1150, A11: 'D-10', B11: 'Zeta', D11: 520,
            A12: 'D-11', B12: 'Delta', D12: 2050, A13: 'D-12', B13: 'Alpha', D13: 990
          }
        },
        target: ['C2:C13', 'F2', 'F3'],
        solution: {
          'C2:C13': '=IF(COUNTIF($B$2:B2,B2)=1,1,0)',
          F2: '=SUM(C2:C13)',
          F3: '=SUM(D2:D13)/F2'
        },
        check: { C2: { mustUse: ['COUNTIF'], mustContain: ['$B$2:B2'], containHint: 'you need the growing range $B$2:B2 — first cell pinned, last cell free' } },
        explain: {
          idea: 'An expanding range. $B$2 is pinned, B2 is not. Pull the formula down and the range grows: $B$2:B2, then $B$2:B3, then $B$2:B4. Each row therefore looks only at itself and everything ABOVE it.',
          walk: [
            'Row 2 (Alpha): the range is just B2, so COUNTIF finds Alpha once. 1 = 1, so the answer is 1 — first appearance.',
            'Row 4 (Alpha again): the range is now $B$2:B4 and contains Alpha twice. 2 is not 1, so the answer is 0 — a repeat.',
            'Because only the FIRST occurrence of each name ever scores a 1, adding up the column counts each client exactly once: six distinct clients out of twelve deals.',
            'F3 divides total revenue by that count. Note the denominator is distinct clients, not deals — that is the difference between revenue per client and average deal size.'
          ],
          mistakes: [
            'Pinning both ends as $B$2:$B$13. Every row then sees the whole column, Alpha counts 4 everywhere, and the column is all zeros.',
            'Pinning neither end. The window slides instead of growing and the answer is nonsense.',
            'Counting deals when the question asks about clients. Twelve versus six is a factor of two on any per-client metric.'
          ],
          onTheJob: 'Excel has a Remove Duplicates button, but it destroys data. The helper-column approach keeps every row and adds the fact you needed — which is what you want when the count has to be auditable.'
        }
      },
      {
        id: '7.6', title: 'Concentration of the deal book', points: 35,
        brief: 'Sort the book by Revenue, largest first. Then build a running share in H2:H21 — the share of total revenue accounted for by this deal and everything above it. Finally, in J2 report how many of the largest deals it takes to pass 50% of revenue.',
        hint: 'H2: =SUM($F$2:F2)/SUM($F$2:$F$21) — another expanding range. J2: =MATCH(0.5,$H$2:$H$21,1)+1, because MATCH with a final 1 finds the last value that has not yet reached 50%.',
        sheet: dealSheet({
          H1: 'Running share',
          I1: 'Metric', J1: 'Value', I2: 'Deals to reach 50%'
        }, {
          cols: 12, styles: { 'H1': H, 'I1:J1': H },
          colWidths: { H: 140, I: 190, J: 120 }, formats: { 'H2:H21': '0.0%' }
        }),
        table: 'A1:G21',
        target: ['H2:H21', 'J2'],
        solution: {
          'H2:H21': '=SUM($F$2:F2)/SUM($F$2:$F$21)',
          J2: '=MATCH(0.5,$H$2:$H$21,1)+1'
        },
        expect: { sortedBy: { col: 'F', asc: false } },
        check: {
          H2: { mustContain: ['$F$2:F2'], containHint: 'the running total needs the expanding range $F$2:F2' },
          J2: { mustUseAny: ['MATCH', 'COUNTIF'] }
        },
        explain: {
          idea: 'A concentration curve. Sort from biggest to smallest, accumulate, and read off where the line crosses a threshold. It is the standard answer to "how dependent are we on a handful of customers?".',
          walk: [
            'After sorting, H2 covers just the largest deal: 12,400 / 102,600 = 12.1%.',
            'H3 covers the top two: (12,400 + 10,200) / 102,600 = 22.0%. The numerator grows one row at a time because $F$2:F2 expands; the denominator is fully pinned and never moves.',
            'By H6 the running share is 47.0% and by H7 it is 53.5%. So the crossing happens on the sixth deal.',
            'MATCH(0.5, $H$2:$H$21, 1) with the final 1 means "find the last value that is still below or equal to 0.5". That is position 5 (47.0%). Add 1 and you get 6 — the deal that tips it over.',
            'Six deals out of twenty, 30% of the book, carry more than half the revenue.'
          ],
          mistakes: [
            'Forgetting to sort first. The running total is then meaningless — it just accumulates in whatever order the rows happen to sit.',
            'Using MATCH with a final 0 (exact). No cell holds exactly 0.5, so you get #N/A.',
            'Forgetting the +1 and reporting five deals. Five gets you to 47%, not past 50%.'
          ],
          onTheJob: 'This is a Pareto chart in two columns. "Six clients are half our revenue" is a risk statement that changes account plans, pricing and how nervous the CFO is.'
        }
      }
    ]
  });

  /* ========================================================== LEVEL 8 ===== */
  LEVELS.push({
    id: 8,
    title: 'Pivot tables',
    subtitle: 'Grouping, filtering and calculated fields',
    goal: 'Answer "revenue by X and Y" in fifteen seconds instead of writing twenty-five formulas — the skill the test names explicitly.',
    theory: [
      { h: 'Four areas, and that is the whole idea', p: 'ROWS are what you group down the side. COLUMNS are what you group across the top. VALUES is the number being aggregated. FILTERS scope the entire report. Every pivot table ever built is a choice about which field goes in which of those four boxes.' },
      { h: 'Values need an aggregation', p: 'A field in the Values area is always summarised somehow: Sum, Count, Average, Max, Min. If Excel picks Count when you wanted Sum, it is telling you the column contains text — a data quality warning, not a formatting nuisance.' },
      { h: '"Show values as"', p: 'The same number can be displayed as a percentage of the grand total, of its row or of its column. That is one dropdown, and it replaces a whole column of division formulas.' },
      { h: 'Calculated fields', p: 'A calculated field is a formula written over field names — Revenue * Margin, or Revenue - Cost — that the pivot computes for every group. It is the thing that turns a pivot from a counting tool into an analysis tool.' },
      { h: 'When NOT to use a pivot', p: 'A pivot is a view, not a model. If the number has to live in a specific cell and feed something else, use SUMIFS. If you need to look at the data six ways in two minutes, use a pivot.' }
    ],
    tasks: [
      {
        id: '8.1', title: 'Your first pivot', points: 25,
        mode: 'pivot',
        brief: 'Build a pivot table that shows total revenue by region: put Region into ROWS and Revenue into VALUES as a Sum.',
        hint: 'Click Region in the field list to send it to Rows, then click Revenue and make sure the aggregation reads Sum.',
        sheet: dealSheet({}, {}),
        table: 'A1:G21',
        target: [],
        solution: {},
        expect: { pivot: { source: 'A1:G21', rows: ['Region'], cols: [], values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
        explain: {
          idea: 'A pivot table asks you one question: what do you want down the side, and what number do you want to see? Region down the side, revenue in the middle.',
          walk: [
            'Region went into ROWS, so the pivot found every distinct value in that column — Moscow, St Petersburg, Urals, Volga, Siberia — and made one row out of each. You did not tell it the region names; it read them from the data.',
            'Revenue went into VALUES with Sum, so for each of those groups it added up the revenue of every matching record.',
            'Moscow comes out at 41,800 — exactly the number you computed with SUMIF in level 4, task 1. Same answer, no formula, about ten seconds.',
            'The Grand Total row, 102,600, is added automatically. It is the first thing to check: it must equal the total of the source column.',
            'Change any number in the source data and the pivot does NOT update by itself — a pivot works off a snapshot and needs refreshing. That is the one way it is less alive than a formula.'
          ],
          mistakes: [
            'Dropping Revenue into ROWS by accident. You then get one row per distinct revenue amount — twenty rows of nothing. If your pivot suddenly has hundreds of rows, you put a number where a category belongs.',
            'Leaving the aggregation on Count when you wanted Sum. Count of Revenue gives 20; Sum gives 102,600. Check the caption above the numbers, it always says which one you are looking at.',
            'Including blank rows below the data in the source range. They become a "(blank)" group and look like a bug in the client’s data.'
          ],
          onTheJob: 'This is the single most-used feature in consulting Excel. The brief for this test names pivot tables explicitly, which means at least one question will be exactly this shape.'
        }
      },
      {
        id: '8.2', title: 'Two dimensions at once', points: 30,
        mode: 'pivot',
        brief: 'Rebuild the region × industry grid from level 4 — but as a pivot table. Region in ROWS, Industry in COLUMNS, Sum of Revenue in VALUES.',
        hint: 'Same as before, but also send Industry to the Columns area.',
        sheet: dealSheet({}, {}),
        table: 'A1:G21',
        target: [],
        solution: {},
        expect: { pivot: { source: 'A1:G21', rows: ['Region'], cols: ['Industry'], values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
        explain: {
          idea: 'Adding a field to COLUMNS splits every row group sideways. Rows × columns gives you a matrix, and the matrix is the same one you built by hand with mixed references.',
          walk: [
            'Region in Rows makes five groups going down. Industry in Columns makes five groups going across. The pivot fills all twenty-five intersections.',
            'Moscow × Retail shows 6,000 — identical to the SUMIFS answer in level 4. The pivot is doing the same arithmetic; it just writes the formulas for you.',
            'Empty intersections are left blank rather than showing 0. Volga genuinely has no energy deals.',
            'Both a Grand Total row and a Grand Total column appear, and the corner cell is 102,600. In level 4 you had to build that check by hand; here it is free.',
            'Compare the effort: twenty-five SUMIFS with carefully placed dollars versus two clicks. That is why the test asks about pivots.'
          ],
          mistakes: [
            'Putting both fields in Rows. You get a nested list — Moscow, then its industries indented underneath — which is a perfectly good report but not a matrix. Know which one you were asked for.',
            'Swapping the areas. Industry down the side and Region across the top is the transpose of the answer: the same numbers arranged the other way. On a test, that counts as wrong.',
            'Being surprised that the columns are in alphabetical order. Pivots sort labels automatically unless you tell them otherwise.'
          ],
          onTheJob: 'Two-dimensional cuts — region × product, channel × month, segment × tenure — are the backbone of any diagnostic pack. The pivot is how you explore them before deciding which one goes on a slide.'
        }
      },
      {
        id: '8.3', title: 'Scope the whole report with a filter', points: 30,
        mode: 'pivot',
        brief: 'Show revenue by manager for won deals only: Manager in ROWS, Sum of Revenue in VALUES, and Stage in FILTERS set to "Won".',
        hint: 'Send Stage to the Filters area and tick only "Won". The whole report then covers won deals and nothing else.',
        sheet: dealSheet({}, {}),
        table: 'A1:G21',
        target: [],
        solution: {},
        expect: {
          pivot: {
            source: 'A1:G21', rows: ['Manager'], cols: [],
            values: [{ field: 'Revenue', agg: 'sum' }],
            filters: [{ field: 'Stage', values: ['Won'] }]
          }
        },
        explain: {
          idea: 'A report filter sits above everything and decides which records the pivot is allowed to see at all. It is the pivot version of the autofilter you used in level 7.',
          walk: [
            'Stage in the Filters area with only "Won" ticked removes the lost and in-progress deals from every calculation in the report.',
            'Kuznetsov comes out top with 20,600 across four won deals. Sidorov is second on 12,700.',
            'Take the filter off and Sidorov jumps ahead, because he carries the 9,500 Energy deal that is still in progress. Same data, opposite conclusion — which is exactly why the filter has to be stated on the slide.',
            'The Grand Total is now 62,150 rather than 102,600: it always reflects what the filter left behind.',
            'A field can only live in one area at a time. Stage is in Filters, so it cannot also appear as a row.'
          ],
          mistakes: [
            'Putting the field in Rows and then hiding rows by hand. It looks similar and breaks the moment the data refreshes.',
            'Leaving a filter on from a previous question. Every later number is then scoped to something you have forgotten — always glance at the filter box before reading a pivot.',
            'Filtering to a value that does not exist because of a typo or a trailing space, and concluding the client has no won deals.'
          ],
          onTheJob: '"Revenue by manager" and "won revenue by manager" are different slides with different implications for who gets promoted. The filter is the entire difference, so label it.'
        }
      },
      {
        id: '8.4', title: 'Show the numbers as percentages', points: 30,
        mode: 'pivot',
        brief: 'Show how revenue splits across regions in relative terms: Region in ROWS, Revenue in VALUES, and change "Show values as" to % of grand total.',
        hint: 'Add Revenue to Values as a Sum, then switch its display mode to "% of grand total".',
        sheet: dealSheet({}, {}),
        table: 'A1:G21',
        target: [],
        solution: {},
        expect: {
          pivot: {
            source: 'A1:G21', rows: ['Region'], cols: [],
            values: [{ field: 'Revenue', agg: 'sum', show: 'pctTotal' }], filters: []
          }
        },
        explain: {
          idea: '"Show values as" changes the presentation, not the calculation. The pivot still sums revenue; it just divides each result by a total before showing it to you.',
          walk: [
            'Moscow is 41,800 out of 102,600, which the pivot now displays as 40.7%.',
            'The shares add to exactly 100% by construction, so there is no rounding argument to have.',
            '% of grand total divides by the corner cell. % of row total divides by the total at the end of each row, and % of column total by the total at the foot of each column — in a two-dimensional pivot those three answer genuinely different questions.',
            'Doing this with formulas would mean a second column of =B2/$B$7 next to the first. The dropdown replaces it.',
            'Switch back to "No calculation" and the absolute numbers return. Nothing was lost — the underlying aggregation never changed.'
          ],
          mistakes: [
            'Reporting percentages without the absolute numbers anywhere. "Moscow is 41%" of what? Always show the base somewhere on the page.',
            'Choosing % of row total in a pivot that has no column field. Every row is then 100% of itself, which is a very confident way of saying nothing.',
            'Building the percentages by hand next to the pivot. They break the moment the pivot grows a row.'
          ],
          onTheJob: 'Mix analysis is all percentages: share of revenue, share of volume, share of margin. Being able to flip between absolute and relative in one click is what lets you answer a partner’s follow-up question in the meeting rather than after it.'
        }
      },
      {
        id: '8.5', title: 'Count and average in one report', points: 30,
        mode: 'pivot',
        brief: 'Build a manager scorecard: Manager in ROWS, and two fields in VALUES — Count of Deal and Average of Revenue.',
        hint: 'Add Deal to Values and set the aggregation to Count, then add Revenue to Values and set it to Average. Two entries in the Values area.',
        sheet: dealSheet({}, {}),
        table: 'A1:G21',
        target: [],
        solution: {},
        expect: {
          pivot: {
            source: 'A1:G21', rows: ['Manager'], cols: [],
            values: [{ field: 'Deal', agg: 'count' }, { field: 'Revenue', agg: 'average' }], filters: []
          }
        },
        explain: {
          idea: 'The Values area holds a list, not a single field. Add two and the pivot puts two columns side by side for every row group.',
          walk: [
            'Count of Deal counts records: each manager has four deals. Counting a text field is the normal way to count rows.',
            'Average of Revenue divides each manager’s revenue by their number of deals. Kuznetsov averages 7,700 per deal, Volkova 3,638.',
            'Both columns describe the same four deals from different angles. Volume is identical across the team; deal size is not — and that is the finding.',
            'Notice what the pair prevents: a manager with one enormous deal would look excellent on a Sum and average would expose it. Count plus Average is the standard two-column sanity check.',
            'Sum of the averages is meaningless, which is why the pivot shows the average of everything in the Grand Total row rather than adding the column up.'
          ],
          mistakes: [
            'Trying to Count a numeric field and being surprised. Count works on any column, but Sum on a text column silently returns 0 — check which way round you have it.',
            'Averaging an average. The grand total average is computed from the raw records, not from the five numbers above it; if you rebuild it by hand you will get a different answer.',
            'Reading Count of Revenue as "total revenue". Read the caption.'
          ],
          onTheJob: 'Any performance table needs both a volume measure and a size measure. One without the other is how people end up rewarding the wrong behaviour.'
        }
      },
      {
        id: '8.6', title: 'A calculated field', points: 35,
        mode: 'pivot',
        brief: 'Gross profit is not a column in the data — it is Revenue multiplied by Margin. Build a pivot with Region in ROWS and a CALCULATED FIELD "Revenue * Margin" in VALUES.',
        hint: 'In the Values area use "Add calculated field" and type the formula over field names: Revenue * Margin.',
        sheet: dealSheet({}, {}),
        table: 'A1:G21',
        target: [],
        solution: {},
        expect: {
          pivot: {
            source: 'A1:G21', rows: ['Region'], cols: [],
            values: [{ calc: 'Revenue * Margin', name: 'Gross profit' }], filters: []
          }
        },
        explain: {
          idea: 'A calculated field lets the pivot compute something the source table does not contain. You write a formula using field NAMES instead of cell addresses, and the pivot applies it to every group.',
          walk: [
            'Revenue * Margin is evaluated on the aggregated numbers of each group: for Moscow it is the total Moscow revenue times the total Moscow margin figure the pivot holds.',
            'Moscow comes out around 75,240 of gross profit, Volga around 6,122 — a twelvefold gap on a fivefold revenue gap, so Moscow is not just bigger, it is richer.',
            'The alternative would be adding a helper column to the source data and then pivoting that. Both are valid; the calculated field keeps the source table untouched, which matters when the source is a client extract you must not alter.',
            'Field names are typed exactly as they appear in the header row. "revenue * margin" in the wrong case, or "Revenues", will not resolve.',
            'One warning worth knowing: a calculated field works on the TOTALS of each group, not row by row. For sums and differences that is identical; for products and ratios it is not always what you want, and on a real project you would check a couple of groups by hand.'
          ],
          mistakes: [
            'Expecting the calculated field to behave like a formula filled down the source table. It is applied after aggregation, not before.',
            'Misspelling a field name — the field then evaluates as zero and the whole column comes out empty or wrong.',
            'Building the calculation outside the pivot in an adjacent column. It looks the same until the pivot changes shape, and then the columns no longer line up.'
          ],
          onTheJob: 'Margin, profit per unit, cost per order, revenue per head — derived metrics are what the client actually asks about, and they are almost never a column in the raw extract.'
        }
      }
    ]
  });

  /* ========================================================== LEVEL 9 ===== */
  LEVELS.push({
    id: 9,
    title: 'Financial calculations',
    subtitle: 'Discounting, NPV, IRR, loans, unit economics',
    goal: 'Put a number on money that arrives at different times, and be able to defend it to a partner.',
    theory: [
      { h: 'Money has a time stamp', p: 'A pound today is worth more than a pound next year. Discount factor = 1/(1+r)^t, present value = cash flow × discount factor. Year 0 is not discounted at all, because it is already today.' },
      { h: 'NPV does not do what you think', p: 'The NPV function discounts the FIRST value you hand it by one full period. So the NPV of a project with an investment in year 0 is: year-0 flow + NPV(rate, years 1..n). Getting this wrong is the single most common finance error in Excel, on tests and in real models.' },
      { h: 'IRR', p: 'IRR is the rate at which NPV equals zero. A project clears the bar when IRR exceeds the cost of capital. It ignores scale and misbehaves when cash flows change sign more than once, which is why it is always shown next to NPV, never instead of it.' },
      { h: 'Annuities', p: 'PMT(rate per period, number of periods, amount) gives the level payment on a loan. Divide an annual rate by 12 and multiply the years by 12. The sign of the answer is opposite to the sign of the amount — that is cash-flow convention, not an error.' },
      { h: 'Unit economics', p: 'Contribution per unit = price − variable cost. Break-even volume = fixed costs ÷ contribution per unit. Every business case in the world is an elaboration of those two lines.' }
    ],
    tasks: [
      {
        id: '9.1', title: 'Discounting by hand', points: 25,
        brief: 'The discount rate is in $B$1. For each year work out C — the discount factor, and D — the present value of the cash flow. In D10 add them up: that is the project NPV.',
        hint: 'C4: =1/(1+$B$1)^A4. D: =B4*C4. Year 0 will produce a factor of exactly 1 on its own.',
        sheet: {
          rows: 12, cols: 6,
          colWidths: { A: 90, B: 150, C: 190, D: 170 },
          styles: { 'A3:D3': H },
          formats: { B1: '0%' },
          cells: {
            A1: 'Discount rate', B1: 0.12,
            A3: 'Year', B3: 'Cash flow', C3: 'Discount factor', D3: 'Present value',
            A4: 0, B4: -5000, A5: 1, B5: 1200, A6: 2, B6: 1800,
            A7: 3, B7: 2400, A8: 4, B8: 2600,
            A10: 'NPV'
          }
        },
        target: ['C4:C8', 'D4:D8', 'D10'],
        solution: { 'C4:C8': '=1/(1+$B$1)^A4', 'D4:D8': '=B4*C4', D10: '=SUM(D4:D8)' },
        check: { C4: { mustContain: ['$B$1'] } },
        explain: {
          idea: 'Discounting is division by (1+r) once for every year of waiting. Building the factor column by hand makes the mechanics visible before you let a function hide them.',
          walk: [
            'Year 0: 1/(1.12)^0 = 1/1 = 1. Money you spend today is not discounted, so the factor must be exactly 1. If it is not, your exponent is wrong.',
            'Year 1: 1/1.12 = 0.893. A pound arriving in a year is worth 89 pence today.',
            'Year 4: 1/1.12^4 = 0.636. Four years of waiting costs you a third of the value.',
            'Multiply each cash flow by its factor and add up: the NPV comes to about 867. Positive, so at a 12% cost of capital the project creates value.',
            'The rate lives in $B$1 and is pinned, so you can change one cell and watch the whole column — and the verdict — move.'
          ],
          mistakes: [
            'Discounting year 0 by one period. That is the same error the NPV function makes by default, and here it would cost you 536 of value out of 867.',
            'Using (1+r)^t as a multiplier instead of a divisor. That compounds forward instead of discounting back, which is the right operation for a savings balance and the wrong one here.',
            'Typing 0.12 into every row. Change the rate and half your model updates.'
          ],
          onTheJob: 'Every investment case, every valuation, every make-or-buy decision is this column. Build it visibly once and you will never misuse the NPV function again.'
        }
      },
      {
        id: '9.2', title: 'NPV with the function', points: 30,
        brief: 'B10 — the project NPV using the NPV function (remember year 0 is not discounted). B11 — the plain sum of the cash flows with no discounting. B12 — "accept" when NPV is above zero, otherwise "reject".',
        hint: 'B10: =B4+NPV($B$1,B5:B8). Exactly that shape: the year-0 flow is added on OUTSIDE the function.',
        sheet: {
          rows: 14, cols: 5,
          colWidths: { A: 200, B: 160 },
          styles: { 'A3:B3': H, 'A10:A12': { label: true } },
          formats: { B1: '0%' },
          cells: {
            A1: 'Discount rate', B1: 0.12,
            A3: 'Year', B3: 'Cash flow',
            A4: 0, B4: -5000, A5: 1, B5: 1200, A6: 2, B6: 1800,
            A7: 3, B7: 2400, A8: 4, B8: 2600,
            A10: 'NPV (function)', A11: 'Undiscounted sum', A12: 'Decision'
          }
        },
        target: ['B10', 'B11', 'B12'],
        solution: { B10: '=B4+NPV($B$1,B5:B8)', B11: '=SUM(B4:B8)', B12: '=IF(B10>0,"accept","reject")' },
        check: {
          B10: { mustUse: ['NPV'], containHint: 'use NPV and do not forget the year-0 flow' },
          B12: { mustUse: ['IF'] }
        },
        explain: {
          idea: 'Excel’s NPV function assumes the first number you give it arrives one period from now. It is really a "present value of a future stream" function, so anything happening today must be handled separately.',
          walk: [
            'NPV($B$1, B5:B8) takes the four future flows and discounts them by 1, 2, 3 and 4 years respectively, giving about 5,867.',
            'B4 — the 5,000 outflow — is added afterwards, undiscounted, because it happens today. 5,867 − 5,000 = 867.',
            'That 867 matches the hand-built column in the previous task exactly. Two methods, one answer: that is how you know both are right.',
            'Try the wrong version, =NPV($B$1,B4:B8), and you get about 774. It is not wildly different, which is precisely what makes the mistake so dangerous — it survives the smell test.',
            'B11 shows the undiscounted total of 3,000 for contrast. The gap between 3,000 and 867 is the cost of waiting.'
          ],
          mistakes: [
            'Passing the whole range including year 0 to NPV. Costs you roughly one period of discounting on every flow.',
            'Using a rate of 12 instead of 0.12.',
            'Mixing periods: annual flows with a monthly rate. Rate and period must always describe the same length of time.'
          ],
          onTheJob: 'If you learn one thing about Excel finance, learn this one. Interviewers ask about it because it separates people who have built a model from people who have watched one.'
        }
      },
      {
        id: '9.3', title: 'IRR against the hurdle rate', points: 30,
        brief: 'B10 — the internal rate of return of the project. B11 — how many percentage points it clears the cost of capital in $B$1 by. B12 — "yes" when IRR beats the cost of capital.',
        hint: 'B10: =IRR(B4:B8) — the whole series including the negative year-0 flow. B11: =B10-$B$1.',
        sheet: {
          rows: 14, cols: 5,
          colWidths: { A: 210, B: 160 },
          styles: { 'A3:B3': H, 'A10:A12': { label: true } },
          formats: { B1: '0%', B10: '0.0%', B11: '0.0%' },
          cells: {
            A1: 'Cost of capital', B1: 0.12,
            A3: 'Year', B3: 'Cash flow',
            A4: 0, B4: -5000, A5: 1, B5: 1200, A6: 2, B6: 1800,
            A7: 3, B7: 2400, A8: 4, B8: 2600,
            A10: 'IRR', A11: 'Headroom, p.p.', A12: 'Clears the hurdle?'
          }
        },
        target: ['B10', 'B11', 'B12'],
        solution: { B10: '=IRR(B4:B8)', B11: '=B10-$B$1', B12: '=IF(B10>$B$1,"yes","no")' },
        check: { B10: { mustUse: ['IRR'] }, B11: { mustContain: ['$B$1'] } },
        explain: {
          idea: 'IRR is the discount rate that would make the NPV exactly zero. It is the project’s own rate of return, expressed in a way you can compare against the cost of borrowing.',
          walk: [
            'IRR(B4:B8) works on the full series, negative flow included. Without a negative flow there is nothing to earn a return ON and Excel returns an error.',
            'The answer is 19.0%. At a 19% discount rate the NPV of this project would be zero.',
            'The cost of capital is 12%, so there are 7.0 percentage points of headroom. Say "percentage points", not "percent" — 19% is not "7% more" than 12%.',
            'This is consistent with the previous task: NPV at 12% was positive, so the break-even rate had to be above 12%. The two results always agree in that direction.',
            'IRR is solved by trial and error internally, which is why it needs at least one sign change and can occasionally fail to converge.'
          ],
          mistakes: [
            'Feeding IRR only the positive flows. No sign change, no solution, #NUM!.',
            'Comparing IRRs of projects of wildly different sizes. A 40% return on 10,000 is worth less than a 20% return on a million; that is what NPV is for.',
            'Trusting IRR on flows that swing negative again later — a project with a big clean-up cost at the end can have two mathematically valid IRRs.'
          ],
          onTheJob: 'Investment committees speak IRR. Analysts should think NPV. Present both, and know which one answers the question being asked.'
        }
      },
      {
        id: '9.4', title: 'A loan for equipment', points: 30,
        brief: 'Work out B5 — the monthly payment as a positive number, B6 — the total number of payments, B7 — everything paid over the life of the loan, B8 — the interest paid on top of the principal.',
        hint: 'B5: =-PMT(B2/12,B3*12,B1). The leading minus makes the payment positive. B7: =B5*B6.',
        sheet: {
          rows: 12, cols: 5,
          colWidths: { A: 250, B: 160 },
          styles: { 'A1:B1': H, 'A5:A8': { label: true } },
          formats: { B2: '0.0%' },
          cells: {
            A1: 'Amount borrowed', B1: 12000000,
            A2: 'Annual interest rate', B2: 0.185,
            A3: 'Term, years', B3: 5,
            A5: 'Monthly payment', A6: 'Number of payments', A7: 'Total paid', A8: 'Interest paid'
          }
        },
        target: ['B5', 'B6', 'B7', 'B8'],
        solution: { B5: '=-PMT(B2/12,B3*12,B1)', B6: '=B3*12', B7: '=B5*B6', B8: '=B7-B1' },
        check: { B5: { mustUse: ['PMT'] } },
        explain: {
          idea: 'PMT solves for the constant payment that pays off a loan exactly over its term. Everything it needs is rate, periods and amount — expressed in the same unit of time.',
          walk: [
            'The rate is annual, so divide by 12 to get a monthly rate. The term is in years, so multiply by 12 to get months. Rate and periods must match or the answer is meaningless.',
            'PMT returns a negative number because money is leaving you. The minus sign in front flips it for presentation — that is convention, not a correction.',
            'The payment comes to about 308,000 per month, 60 payments, roughly 18.5m paid in total.',
            'Interest paid is 18.5m − 12m ≈ 6.5m: over five years at 18.5% you pay back more than half again what you borrowed. Seeing that number is usually the point of the exercise.'
          ],
          mistakes: [
            'Passing the annual rate with monthly periods. The payment comes out absurdly high and people accept it because the formula "worked".',
            'Forgetting the minus and putting a negative payment on a slide.',
            'Assuming total interest is amount × rate × years. That ignores the fact that the principal is shrinking, and overstates the cost.'
          ],
          onTheJob: 'Lease-versus-buy, capex financing, working capital lines — all built on PMT. And the same function in reverse, RATE, tells you what a "no interest, just a fee" offer really costs.'
        }
      },
      {
        id: '9.5', title: 'Unit economics and break-even', points: 35,
        brief: 'Work out B7 — contribution per unit, B8 — contribution margin as a percentage, B9 — break-even volume in units (round up to a whole unit), B10 — profit at the planned volume in $B$5, B11 — the safety margin, meaning how far the plan sits above break-even in percentage terms.',
        hint: 'B7: =B1-B2. B9: =ROUNDUP(B4/B7,0). B10: =B7*B5-B4. B11: =B5/B9-1.',
        sheet: {
          rows: 14, cols: 5,
          colWidths: { A: 280, B: 160 },
          styles: { 'A1:B1': H, 'A7:A11': { label: true } },
          formats: { B8: '0.0%', B11: '0.0%' },
          cells: {
            A1: 'Price per unit', B1: 4500,
            A2: 'Variable cost per unit', B2: 2700,
            A4: 'Fixed costs per month', B4: 3600000,
            A5: 'Planned volume, units per month', B5: 2800,
            A7: 'Contribution per unit', A8: 'Contribution margin', A9: 'Break-even volume, units',
            A10: 'Profit at plan', A11: 'Safety margin'
          }
        },
        target: ['B7', 'B8', 'B9', 'B10', 'B11'],
        solution: {
          B7: '=B1-B2', B8: '=B7/B1', B9: '=ROUNDUP(B4/B7,0)',
          B10: '=B7*B5-B4', B11: '=B5/B9-1'
        },
        check: { B9: { mustUseAny: ['ROUNDUP', 'ROUND'] } },
        explain: {
          idea: 'Every unit you sell contributes price minus variable cost towards the fixed costs. Once the fixed costs are covered, every further contribution is profit. Break-even is simply the point where the running total catches up.',
          walk: [
            'Contribution per unit: 4,500 − 2,700 = 1,800. Note that fixed costs play no part in this line — they are not caused by the unit.',
            'Contribution margin: 1,800 / 4,500 = 40%. Forty pence of every pound of revenue is available to cover overheads.',
            'Break-even: 3,600,000 / 1,800 = 2,000 units exactly. ROUNDUP is there for the general case, where the answer lands on 1,999.4 and you cannot sell 0.4 of a unit.',
            'Profit at the planned 2,800 units: 1,800 × 2,800 − 3,600,000 = 1,440,000.',
            'Safety margin: 2,800 / 2,000 − 1 = 40%. Volume could fall by 40% before the business stops making money — that is the sentence a CFO actually wants.'
          ],
          mistakes: [
            'Subtracting fixed costs inside the contribution line. Fixed costs are covered by total contribution, not by each unit.',
            'Using ROUND instead of ROUNDUP for break-even. Rounding down means reporting a volume at which the business still loses money.',
            'Computing the safety margin against the plan rather than against break-even. The base is break-even, because that is the thing you must not fall below.'
          ],
          onTheJob: 'This block is the first page of any business case. If a founder cannot tell you their contribution per unit, the rest of their forecast is decoration.'
        }
      },
      {
        id: '9.6', title: 'The reverse question: what growth is needed', points: 30,
        brief: 'The company wants to grow from the revenue in $B$1 to the target in $B$2 within $B$3 years. B5 — the CAGR that requires. B6 — the revenue after two years at that rate. B7 — how many times bigger the business becomes. B8 — "realistic" if the required CAGR is no higher than the market growth in $B$4, otherwise "aggressive".',
        hint: 'B5: =(B2/B1)^(1/B3)-1. B6: =B1*(1+B5)^2. B7: =B2/B1.',
        sheet: {
          rows: 12, cols: 5,
          colWidths: { A: 270, B: 160 },
          styles: { 'A1:B1': H, 'A5:A8': { label: true } },
          formats: { B4: '0.0%', B5: '0.0%' },
          cells: {
            A1: 'Current revenue, m', B1: 1340,
            A2: 'Target in N years, m', B2: 3000,
            A3: 'Horizon, years', B3: 5,
            A4: 'Market growth', B4: 0.14,
            A5: 'Required CAGR', A6: 'Revenue after 2 years', A7: 'Growth multiple', A8: 'Verdict'
          }
        },
        target: ['B5', 'B6', 'B7', 'B8'],
        solution: {
          B5: '=(B2/B1)^(1/B3)-1', B6: '=B1*(1+B5)^2', B7: '=B2/B1',
          B8: '=IF(B5<=B4,"realistic","aggressive")'
        },
        check: { B8: { mustUse: ['IF'] } },
        explain: {
          idea: 'The same CAGR formula read backwards. Instead of measuring the growth that happened, you solve for the growth that must happen — and then check it against something in the real world.',
          walk: [
            'The business must grow 3000/1340 = 2.24 times in five years.',
            'The fifth root of 2.24 is 1.176, so the required CAGR is 17.6% a year, every year, for five years.',
            'Sanity check it forwards: 1340 × 1.176^5 ≈ 3,000. It closes.',
            'After two years at that rate the business would need to be at 1340 × 1.176² ≈ 1,853m. That intermediate milestone is what makes the target testable rather than aspirational.',
            'The market grows at 14%. The plan needs 17.6%, which means taking share every single year — possible, but it is now a share-gain plan, not a growth plan, and it needs a reason.'
          ],
          mistakes: [
            'Dividing the total growth by the number of years: 124% / 5 ≈ 25%. That ignores compounding and overstates the requirement badly.',
            'Comparing the required CAGR to last year’s growth instead of to the market. One good year is not a trend.',
            'Producing the number and stopping. The verdict cell is the deliverable; the CAGR is just arithmetic.'
          ],
          onTheJob: 'Every strategy plan implies a required CAGR. Computing it and holding it against market growth is the quickest way to find out whether the plan is a plan or a wish.'
        }
      }
    ]
  });

  /* ========================================================= LEVEL 10 ===== */
  LEVELS.push({
    id: 10,
    title: 'Data analysis',
    subtitle: 'SUMPRODUCT, sensitivity tables, cohorts, scorecards',
    goal: 'Answer "what if" and "because of what" — which is what a client is actually paying for.',
    theory: [
      { h: 'SUMPRODUCT as a conditional sum', p: 'SUMPRODUCT((region="Moscow")*(revenue)) adds Moscow revenue. The comparison produces an array of TRUE/FALSE, multiplying turns it into 1/0, and the non-matching rows contribute zero. It goes where SUMIFS cannot: comparing two columns with each other, OR conditions, or maths inside the criterion.' },
      { h: 'Sensitivity tables', p: 'A grid of one output against two assumptions is a standard slide. Built with one formula and mixed references: $A8 for the value from the row, B$7 for the value from the column.' },
      { h: 'Cohorts', p: 'Retention is measured against the cohort’s own starting size: each month divided by month 0 of the SAME row. Pin only the column — $B2 — and one formula fills the whole triangle.' },
      { h: 'Weighted scorecards', p: 'Options scored on several criteria with different weights: SUMPRODUCT(scores, weights) divided by the sum of weights. Make sure the weights add to 1, or say so explicitly.' }
    ],
    tasks: [
      {
        id: '10.1', title: 'SUMPRODUCT where SUMIFS cannot go', points: 30,
        brief: 'Working over the deal book: J2 — Moscow revenue using SUMPRODUCT. J3 — revenue of deals whose margin is above the average margin of all deals. J4 — the count of won deals in Moscow and St Petersburg together. J5 — total gross profit (revenue × margin) of won deals.',
        hint: 'J2: =SUMPRODUCT(($B$2:$B$21="Moscow")*$F$2:$F$21). J3: compare $G$2:$G$21 with AVERAGE($G$2:$G$21). J4: add two conditions together with + — that is a logical OR.',
        sheet: dealSheet({
          I1: 'Metric', J1: 'Value',
          I2: 'Moscow revenue', I3: 'Revenue where margin beats the average',
          I4: 'Won deals in Moscow and St Petersburg', I5: 'Gross profit of won deals'
        }, { styles: { 'I1:J1': H }, colWidths: { I: 300, J: 140 } }),
        table: 'A1:G21',
        target: ['J2', 'J3', 'J4', 'J5'],
        solution: {
          J2: '=SUMPRODUCT(($B$2:$B$21="Moscow")*$F$2:$F$21)',
          J3: '=SUMPRODUCT(($G$2:$G$21>AVERAGE($G$2:$G$21))*$F$2:$F$21)',
          J4: '=SUMPRODUCT((($B$2:$B$21="Moscow")+($B$2:$B$21="St Petersburg"))*($E$2:$E$21="Won"))',
          J5: '=SUMPRODUCT(($E$2:$E$21="Won")*$F$2:$F$21*$G$2:$G$21)'
        },
        check: { '*': { mustUse: ['SUMPRODUCT'] } },
        explain: {
          idea: 'Every comparison in Excel produces TRUE or FALSE. Multiply by TRUE and the number survives; multiply by FALSE and it becomes zero. SUMPRODUCT then adds what is left. That is the whole mechanism.',
          walk: [
            'J2: ($B$2:$B$21="Moscow") produces twenty TRUE/FALSE answers. Multiplying by the revenue column turns them into either the revenue or zero. The sum is 41,800 — the same answer SUMIF gave in level 4.',
            'J3 is where SUMIFS gives up. The criterion is "greater than the average", and the average has to be computed from the same column. SUMIFS accepts only fixed criteria; SUMPRODUCT accepts a whole expression.',
            'J4 uses + between two conditions. Multiplication is AND, addition is OR. A deal in Moscow scores 1+0, a deal in St Petersburg 0+1, anything else 0+0 — then multiplied by the "Won" test.',
            'J5 multiplies three arrays: the condition, the revenue and the margin. Three-way products like this are how you compute a derived metric without adding a helper column.'
          ],
          mistakes: [
            'Ranges of different lengths. $F$2:$F$21 against $B$2:$B$20 gives #VALUE!, and this is the most common SUMPRODUCT error by a distance.',
            'Using + when you mean AND. A row satisfying both conditions then scores 2 and gets counted twice.',
            'Reaching for SUMPRODUCT when SUMIFS would do. It is slower on large data and harder to read; use it when SUMIFS genuinely cannot express the condition.'
          ],
          onTheJob: 'The moment a client asks "how much revenue comes from deals above our average margin", SUMIFS is out and SUMPRODUCT is in. Recognising that boundary quickly is a real skill.'
        }
      },
      {
        id: '10.2', title: 'Two-way sensitivity table', points: 35,
        brief: 'Build a table of EBITDA at different prices (rows A8:A12) and volumes (columns B7:F7). Fill B8:F12 with one formula. In B14 work out the lowest price in the table that still gives positive EBITDA at a volume of 3,000 units.',
        hint: 'B8: =($A8-$B$3)*B$7-$B$4. For B14, INDEX plus MATCH over column D, looking for the first value above zero.',
        sheet: {
          rows: 16, cols: 8,
          colWidths: { A: 250, B: 120, C: 120, D: 120, E: 120, F: 120 },
          styles: { 'A7:F7': H, 'A8:A12': H },
          cells: {
            A1: 'Assumptions',
            A2: 'Base price', B2: 4500,
            A3: 'Variable cost per unit', B3: 2700,
            A4: 'Fixed costs per month', B4: 3600000,
            A6: 'EBITDA: price (rows) × volume (columns)',
            A7: 'Price \\ Volume', B7: 2000, C7: 2500, D7: 3000, E7: 3500, F7: 4000,
            A8: 4000, A9: 4250, A10: 4500, A11: 4750, A12: 5000,
            A14: 'Lowest price with positive EBITDA at 3,000 units'
          }
        },
        target: ['B8:F12', 'B14'],
        solution: {
          'B8:F12': '=($A8-$B$3)*B$7-$B$4',
          B14: '=INDEX($A$8:$A$12,MATCH(TRUE,INDEX($D$8:$D$12>0,0),0))'
        },
        check: {
          B8: { mustContain: ['$A8', 'B$7'], containHint: 'you need the mixed references $A8 and B$7 — one formula for the whole table' }
        },
        explain: {
          idea: 'A sensitivity table is the mixed-reference grid from level 1 with a real model inside it. The row supplies one assumption, the column supplies another, and the pinned cells supply everything that does not vary.',
          walk: [
            'The model is (price − variable cost) × volume − fixed costs. Only price and volume move; the other two are pinned with full dollars.',
            '$A8 reads the price from the row and cannot drift sideways. B$7 reads the volume from the column and cannot drift downwards.',
            'The top-left cell, 4,000 at 2,000 units, gives (4000−2700)×2000 − 3,600,000 = −1,000,000. The business loses money there.',
            'Move right along the row and EBITDA climbs with volume; move down the column and it climbs with price. The zero line cuts diagonally across the table — that line is the answer to "what do we need to survive".',
            'B14 walks the 3,000-unit column looking for the first positive value. Break-even price at that volume is 3,900, so the lowest price in the table that works is 4,000.'
          ],
          mistakes: [
            'Forgetting to pin the cost assumptions. They then slide and the grid fills with plausible nonsense.',
            'Building the table with one formula per cell. Twenty-five chances to make a typo, and no way to check them all.',
            'Presenting the grid without marking the zero line. The client cannot see where the cliff is unless you point at it.'
          ],
          onTheJob: 'Every business case gets a sensitivity table, because every set of assumptions is wrong. The question a partner asks is never "what is the answer" but "how wrong do we have to be before the answer changes".'
        }
      },
      {
        id: '10.3', title: 'Cohort retention', points: 35,
        brief: 'In the block I3:N6 work out retention: the share of each cohort still active in each month of its life, measured against the cohort’s own starting size in column B.',
        hint: 'I3: =B3/$B3. Pin the column only, and one formula fills the whole block.',
        sheet: {
          rows: 10, cols: 15,
          colWidths: { A: 120, B: 80, C: 80, D: 80, E: 80, F: 80, G: 80, H: 30, I: 80, J: 80, K: 80, L: 80, M: 80, N: 80 },
          styles: { 'A2:G2': H, 'I2:N2': H, 'A3:A6': H },
          formats: { 'I3:N6': '0.0%' },
          cells: {
            A1: 'Users by cohort',
            A2: 'Cohort', B2: 'M0', C2: 'M1', D2: 'M2', E2: 'M3', F2: 'M4', G2: 'M5',
            A3: 'January', B3: 12000, C3: 7800, D3: 6100, E3: 5200, F3: 4700, G3: 4400,
            A4: 'February', B4: 9500, C4: 6400, D4: 5100, E4: 4400, F4: 4000, G4: 3800,
            A5: 'March', B5: 14200, C5: 8100, D5: 6200, E5: 5300, F5: 4900, G5: 4600,
            A6: 'April', B6: 11000, C6: 7150, D6: 5700, E6: 4950, F6: 4500, G6: 4300,
            I1: 'Retention',
            I2: 'M0', J2: 'M1', K2: 'M2', L2: 'M3', M2: 'M4', N2: 'M5'
          }
        },
        target: ['I3:N6'],
        solution: { 'I3:N6': '=B3/$B3' },
        check: { I3: { mustContain: ['$B3'], containHint: 'pin only the column of the cohort base: $B3' } },
        explain: {
          idea: 'Retention compares a cohort with itself. Every row must be divided by its own first month, never by a global total and never by the previous month.',
          walk: [
            'I3 = B3/$B3 = 12000/12000 = 100%. The M0 column is always 100% by definition, and that is your check that the pinning is right.',
            'Pull right to J3: the numerator moves to C3 (7,800) but $B3 cannot move sideways, so it stays on the January base. 7800/12000 = 65%.',
            'Pull down to I4: the numerator moves to B4 and $B3 becomes $B4 — the February base. The row keeps comparing itself with itself.',
            'Read the finished block downwards: month-1 retention is 65%, 67%, 57%, 65%. March is the odd one out — a big cohort that retained badly, which usually means a promotion brought in the wrong users.',
            'Read it across: the curve flattens after month 3 at roughly 37-40%. That plateau is the real long-term retention.'
          ],
          mistakes: [
            'Full pinning ($B$3). Every row is then measured against January and February looks like 79% retention in month 0.',
            'Dividing by the previous month instead of month 0. That gives month-on-month survival, a different and also useful metric — but not retention, and mixing them up makes the numbers look far better than they are.',
            'Comparing cohorts of very different sizes without saying so. March is 50% bigger than February; its worse retention may simply be the price of that growth.'
          ],
          onTheJob: 'Cohort tables are the standard diagnostic for any subscription or repeat-purchase business. The shape of the curve decides whether growth is real or just a leaking bucket being refilled.'
        }
      },
      {
        id: '10.4', title: 'Shape of the distribution', points: 30,
        brief: 'From the revenue of the deal book work out: J2 — the median, J3 — the 25th percentile, J4 — the 75th percentile, J5 — the interquartile range, J6 — how many deals are bigger than the 75th percentile.',
        hint: 'PERCENTILE.INC($F$2:$F$21,0.25). For J6, COUNTIF with the criterion ">"&J4.',
        sheet: dealSheet({
          I1: 'Metric', J1: 'Value',
          I2: 'Median', I3: '25th percentile', I4: '75th percentile',
          I5: 'Interquartile range', I6: 'Deals above P75'
        }, { styles: { 'I1:J1': H }, colWidths: { I: 220, J: 130 } }),
        table: 'A1:G21',
        target: ['J2', 'J3', 'J4', 'J5', 'J6'],
        solution: {
          J2: '=MEDIAN($F$2:$F$21)',
          J3: '=PERCENTILE.INC($F$2:$F$21,0.25)',
          J4: '=PERCENTILE.INC($F$2:$F$21,0.75)',
          J5: '=J4-J3',
          J6: '=COUNTIF($F$2:$F$21,">"&J4)'
        },
        check: { J3: { mustUseAny: ['PERCENTILE.INC', 'PERCENTILE', 'QUARTILE.INC'] } },
        explain: {
          idea: 'A percentile is a position in the queue. The 25th percentile is the value that a quarter of the data sits below. Together the quartiles describe the shape of the distribution without you having to draw it.',
          walk: [
            'Sort the twenty revenues mentally. The median is the middle — half the deals are smaller, half bigger.',
            'PERCENTILE.INC(range, 0.25) finds the value a quarter of the way up the sorted list, interpolating between the two neighbouring values when the position falls between them.',
            'The interquartile range, P75 − P25, is the width of the middle half of the data. It is the spread measure that ignores the extremes, which is why it survives one enormous deal.',
            'J6 counts how many deals clear P75. By definition it should be about a quarter of twenty, so around five — and checking that is a quick way to confirm you did not mix up the arguments.',
            'The ">"&J4 pattern is the same glue you learned in level 4: build the criterion text out of a cell.'
          ],
          mistakes: [
            'Confusing PERCENTILE with PERCENTRANK. One takes a share and returns a value; the other takes a value and returns a share.',
            'Passing 25 instead of 0.25. Percentiles take a share between 0 and 1, and 25 gives #NUM!.',
            'Reporting an average alongside quartiles without noticing they disagree. When the mean sits outside the interquartile range, the distribution is heavily skewed and the mean is the wrong summary.'
          ],
          onTheJob: 'Pricing work lives on percentiles: "we are at the 80th percentile of the market" is a sentence built from exactly this calculation.'
        }
      },
      {
        id: '10.5', title: 'Weighted scorecard', points: 30,
        brief: 'Four sites are being scored on five criteria with different weights. In G3:G6 work out each site’s weighted score, in G8 check the weights add to 1, and in G9 name the winning site.',
        hint: 'G3: =SUMPRODUCT(B3:F3,$B$2:$F$2). G9: =INDEX($A$3:$A$6,MATCH(MAX($G$3:$G$6),$G$3:$G$6,0)).',
        sheet: {
          rows: 12, cols: 8,
          colWidths: { A: 140, B: 110, C: 110, D: 110, E: 110, F: 110, G: 140 },
          styles: { 'A2:G2': H, 'A3:A6': H },
          formats: { 'B2:F2': '0%', 'G3:G6': '0.00' },
          cells: {
            A1: 'Site selection scorecard, criteria scored 1 to 5',
            A2: 'Site', B2: 0.3, C2: 0.25, D2: 0.2, E2: 0.15, F2: 0.1, G2: 'Weighted score',
            A3: 'Kaluga', B3: 4, C3: 3, D3: 5, E3: 2, F3: 4,
            A4: 'Tver', B4: 3, C4: 5, D4: 3, E4: 4, F4: 3,
            A5: 'Ryazan', B5: 5, C5: 2, D5: 4, E5: 3, F5: 5,
            A6: 'Vladimir', B6: 2, C6: 4, D6: 4, E6: 5, F6: 2,
            A8: 'Weights add to', A9: 'Winner'
          }
        },
        target: ['G3:G6', 'G8', 'G9'],
        solution: {
          'G3:G6': '=SUMPRODUCT(B3:F3,$B$2:$F$2)',
          G8: '=SUM($B$2:$F$2)',
          G9: '=INDEX($A$3:$A$6,MATCH(MAX($G$3:$G$6),$G$3:$G$6,0))'
        },
        check: {
          G3: { mustUse: ['SUMPRODUCT'] },
          G9: { mustUseAny: ['INDEX', 'XLOOKUP'] }
        },
        explain: {
          idea: 'A weighted score is a dot product: multiply each score by the importance of its criterion and add them up. SUMPRODUCT does exactly that in one cell.',
          walk: [
            'Kaluga: 4×0.30 + 3×0.25 + 5×0.20 + 2×0.15 + 4×0.10 = 1.2 + 0.75 + 1.0 + 0.3 + 0.4 = 3.65.',
            'The weights row $B$2:$F$2 is pinned so it stays put when the formula is pulled down; the score row B3:F3 is free so it follows each site.',
            'G8 is not decoration. If the weights do not add to 1 the scores are not comparable to the 1-to-5 scale any more, and this cell is how you notice before the client does.',
            'G9 finds the biggest score with MAX, asks MATCH where it sits, and hands that position to INDEX to read the name. The same finder-and-fetcher pattern from level 5.',
            'Change one weight and watch the winner change. That fragility is the honest finding of most scorecards.'
          ],
          mistakes: [
            'Averaging the scores instead of weighting them. It quietly declares every criterion equally important, which is exactly the decision the client hired you to make explicitly.',
            'Weights that sum to 0.95 because one was mistyped. Everything still computes.',
            'Reporting the winner without reporting how close second place was. A 3.65 versus 3.60 result is a coin toss dressed as analysis.'
          ],
          onTheJob: 'Site selection, vendor choice, portfolio prioritisation — all weighted scorecards. The technique takes a minute; agreeing the weights with the client takes a week and is the actual work.'
        }
      },
      {
        id: '10.6', title: 'Budget versus actual', points: 30,
        brief: 'For each cost line work out D — the variance in money (actual minus budget), E — the variance as a percentage of budget, F — a flag reading "over" when the overspend is more than the tolerance in $H$2, otherwise "ok". Then in H4 count how many lines are over.',
        hint: 'E: =D2/B2. F: =IF(E2>$H$2,"over","ok"). H4: =COUNTIF(F2:F8,"over").',
        sheet: {
          rows: 12, cols: 9,
          colWidths: { A: 170, B: 120, C: 120, D: 130, E: 120, F: 100, G: 140, H: 110 },
          styles: { 'A1:F1': H, 'G1:H1': H },
          formats: { 'E2:E8': '0.0%', H2: '0%' },
          cells: {
            A1: 'Cost line', B1: 'Budget', C1: 'Actual', D1: 'Variance', E1: 'Variance %', F1: 'Flag',
            G1: 'Assumption', H1: 'Value', G2: 'Tolerance', H2: 0.05, G4: 'Lines over budget',
            A2: 'Payroll', B2: 4200000, C2: 4410000,
            A3: 'Rent', B3: 1800000, C3: 1800000,
            A4: 'Marketing', B4: 950000, C4: 1235000,
            A5: 'IT', B5: 640000, C5: 601000,
            A6: 'Travel', B6: 310000, C6: 372000,
            A7: 'Professional fees', B7: 480000, C7: 492000,
            A8: 'Other', B8: 220000, C8: 198000
          }
        },
        target: ['D2:D8', 'E2:E8', 'F2:F8', 'H4'],
        solution: {
          'D2:D8': '=C2-B2', 'E2:E8': '=D2/B2',
          'F2:F8': '=IF(E2>$H$2,"over","ok")',
          H4: '=COUNTIF(F2:F8,"over")'
        },
        check: { F2: { mustUse: ['IF'], mustContain: ['$H$2'] }, H4: { mustUse: ['COUNTIF'] } },
        explain: {
          idea: 'A variance analysis has three columns and one rule: money, percentage, and a threshold that turns the percentage into a decision. The percentage is what makes lines of different sizes comparable.',
          walk: [
            'Payroll is 210,000 over — the biggest variance in money by far. As a percentage it is 5.0%, which sits exactly on the tolerance and therefore does NOT flag, because the test is strictly greater than.',
            'Travel is only 62,000 over, a twentieth of the payroll variance, but that is 20% of its budget — comfortably the worst line in relative terms.',
            'That contrast is the entire reason both columns exist. Money tells you where the cash went; percentage tells you where control broke down.',
            'Marketing at 30% over and 285,000 in money is bad on both measures, which makes it the first line to investigate.',
            'H4 counts the flags rather than asking you to count them by eye — so the number on the slide updates when the tolerance changes.'
          ],
          mistakes: [
            'Computing variance as budget minus actual and then reading the signs backwards. Pick a convention, state it in the header, and stick to it.',
            'Flagging on money instead of percentage, and spending the meeting on payroll while Travel runs 20% over unnoticed.',
            'Using >= where the brief says more than. Payroll then flags and you have an argument about 5.0% versus 5%.'
          ],
          onTheJob: 'Monthly management reporting is this table, every month, for every cost centre. The flag column is what turns forty rows of numbers into three conversations.'
        }
      }
    ]
  });

  /* ========================================================= LEVEL 11 ===== */
  LEVELS.push({
    id: 11,
    title: 'Consulting cases',
    subtitle: 'Market sizing, price-volume-mix, the EBITDA bridge, capacity',
    goal: 'Build a calculation that survives the question "and where does that number come from?".',
    theory: [
      { h: 'Three blocks, in this order', p: 'Assumptions (typed in, usually blue), calculation (formulas only), answer. Not one number inside a calculation formula — otherwise the assumption cannot be changed and the model cannot be checked.' },
      { h: 'Top-down and bottom-up', p: 'Size a market twice, from both ends, and reconcile. A gap of 20-30% is normal. More than that means an assumption is wrong, and you want to find it before the meeting rather than during it.' },
      { h: 'Decomposing a change (PVM)', p: 'Revenue grew — because of volume, price, or mix? Volume effect = change in volume × old average price. Price effect = new volume × change in price. Mix is the remainder. The three must add back to the total change: that is your check line.' },
      { h: 'The bridge', p: 'A waterfall from last year’s EBITDA to this year’s is technically a running total: each bar starts where the previous one ended. The invisible base of each bar is MIN(running total before, running total after).' },
      { h: 'Check lines', p: 'Every model needs a row that proves the parts add to the whole. A consultant who shows a calculation without a check line is showing hope, not analysis.' }
    ],
    tasks: [
      {
        id: '11.1', title: 'Market sizing, top down', points: 35,
        brief: 'Size the market for a food delivery service. Fill the calculation block B8:B13 from the assumptions in B2:B6, and finish with B13 — the company’s revenue at the market share in B7.',
        hint: 'Each line is the previous line multiplied by the next assumption. No typed numbers inside the formulas — references only.',
        sheet: {
          rows: 16, cols: 5,
          colWidths: { A: 340, B: 170 },
          styles: { 'A1:B1': H, 'A8:A13': { label: true } },
          formats: { B3: '0%', B4: '0%', B5: '0%', B7: '0%', B12: '0.00', B13: '0.00' },
          cells: {
            A1: 'Assumption', B1: 'Value',
            A2: 'Population, millions', B2: 146,
            A3: 'Share living in cities', B3: 0.75,
            A4: 'Share aged 18 to 45', B4: 0.4,
            A5: 'Service penetration', B5: 0.12,
            A6: 'Average spend per year', B6: 14400,
            A7: 'Company market share', B7: 0.08,
            A8: 'Urban population, m', A9: 'Target age group, m',
            A10: 'Active users, m', A11: 'Market size, m',
            A12: 'Market size, bn', A13: 'Company revenue, bn'
          }
        },
        target: ['B8', 'B9', 'B10', 'B11', 'B12', 'B13'],
        solution: {
          B8: '=B2*B3', B9: '=B8*B4', B10: '=B9*B5', B11: '=B10*B6',
          B12: '=B11/1000', B13: '=B12*B7'
        },
        explain: {
          idea: 'A top-down sizing is a funnel. Start from a number nobody argues about — population — and narrow it one assumption at a time until you reach people who actually buy.',
          walk: [
            '146m × 75% = 109.5m people live in cities.',
            '× 40% = 43.8m are in the target age band.',
            '× 12% penetration = 5.26m active users. This is the assumption a client will challenge hardest, so it is the one that must sit in its own cell.',
            '× 14,400 per year = 75,686m, or about 75.7bn.',
            '× 8% share = about 6.1bn of company revenue.',
            'Each line is a separate cell rather than one long formula, so a partner can point at any step and ask "why" — and you can answer without unpicking a nested expression.'
          ],
          mistakes: [
            'Collapsing it into =146*0.75*0.4*0.12*14400. It produces the same number and is unusable: nobody can see or change the assumptions.',
            'Losing track of units. Millions of people times roubles per year gives millions of roubles, and the division by 1,000 to reach billions is where errors of a thousand times get made.',
            'Applying penetration to the whole population rather than to the target age group. Always be clear which base each percentage sits on.'
          ],
          onTheJob: 'This is the classic case-interview question and the first page of most market entry studies. Structure beats precision: a clearly-laid-out funnel with defensible assumptions wins over a more accurate number nobody can follow.'
        }
      },
      {
        id: '11.2', title: 'Bottom up, and reconcile', points: 35,
        brief: 'Size the same market from the supply side. Fill B9:B12, then compare with the top-down estimate in $B$13: B14 — the gap in percent, B15 — "reconciles" when the gap is within the tolerance in $B$16.',
        hint: 'B14: =B12/$B$13-1. B15: =IF(ABS(B14)<=$B$16,"reconciles","investigate").',
        sheet: {
          rows: 18, cols: 5,
          colWidths: { A: 340, B: 170 },
          styles: { 'A1:B1': H, 'A9:A15': { label: true } },
          formats: { B7: '0%', B14: '0.0%', B16: '0%', B11: '0.00', B12: '0.00', B13: '0.00' },
          cells: {
            A1: 'Assumption', B1: 'Value',
            A2: 'Partner restaurants, thousands', B2: 78,
            A3: 'Share actively trading', B3: 0.62,
            A4: 'Orders per restaurant per day', B4: 4,
            A5: 'Trading days per year', B5: 350,
            A6: 'Average order value', B6: 1180,
            A7: 'Company market share', B7: 0.08,
            A9: 'Active restaurants, thousands', A10: 'Orders per year, millions',
            A11: 'Market size, m', A12: 'Market size, bn',
            A13: 'Top-down estimate, bn', B13: 75.69,
            A14: 'Gap to top-down', A15: 'Verdict',
            A16: 'Tolerance', B16: 0.25
          }
        },
        target: ['B9', 'B10', 'B11', 'B12', 'B14', 'B15'],
        solution: {
          B9: '=B2*B3', B10: '=B9*B4*B5/1000', B11: '=B10*B6',
          B12: '=B11/1000', B14: '=B12/$B$13-1',
          B15: '=IF(ABS(B14)<=$B$16,"reconciles","investigate")'
        },
        check: { B15: { mustUse: ['IF', 'ABS'] } },
        explain: {
          idea: 'Two independent routes to the same number. If they agree, your confidence is earned. If they do not, you have found something — and finding it before the client does is the job.',
          walk: [
            '78,000 restaurants × 62% active = 48,360 trading partners.',
            '× 4 orders a day × 350 days = 67.7m orders a year. The division by 1,000 converts thousands of restaurants into millions of orders.',
            '× 1,180 per order = about 79.9bn.',
            'Top-down said 75.7bn. The gap is +5.5%, comfortably inside the 25% tolerance, so the verdict is "reconciles".',
            'ABS is there because a gap of −30% is just as much of a problem as +30%. Without it, an underestimate would sail through.',
            'Note the two routes share no assumptions at all: one counts people and spend, the other counts restaurants and orders. That independence is what makes agreement meaningful.'
          ],
          mistakes: [
            'Tuning the second estimate until it matches the first. That is not reconciliation, it is decoration, and it destroys the only value the exercise has.',
            'Forgetting ABS and only catching gaps in one direction.',
            'Reconciling two estimates that reuse the same key assumption. They will agree, and the agreement proves nothing.'
          ],
          onTheJob: 'Partners ask "did you sanity-check it the other way?" almost reflexively. Having the second estimate already built is the difference between a confident answer and a promise to come back.'
        }
      },
      {
        id: '11.3', title: 'Why revenue grew: price, volume, mix', points: 45,
        brief: 'Decompose the revenue growth into three effects. Fill F2:F4 and G2:G4 with revenue by year, C7, E7, F7 and G7 with the column totals, B10 with last year’s average price, B11 with the volume effect, B12 with the price effect, B13 with the mix effect as the residual, and B14 with a check — the three effects minus the actual change, which must be zero.',
        hint: 'Volume effect = (total volume 2024 − total volume 2023) × average price 2023. Price effect = SUMPRODUCT(volumes 2024, prices 2024 − prices 2023), that is =SUMPRODUCT(E2:E4,D2:D4-B2:B4). Mix is what is left over.',
        sheet: {
          rows: 18, cols: 8,
          colWidths: { A: 130, B: 100, C: 120, D: 100, E: 120, F: 140, G: 140 },
          styles: { 'A1:G1': H, 'A10:A14': { label: true } },
          cells: {
            A1: 'Product', B1: 'Price 2023', C1: 'Volume 2023', D1: 'Price 2024', E1: 'Volume 2024',
            F1: 'Revenue 2023', G1: 'Revenue 2024',
            A2: 'Basic', B2: 1200, C2: 12000, D2: 1250, E2: 11000,
            A3: 'Standard', B3: 1850, C3: 4300, D3: 1900, E3: 5200,
            A4: 'Premium', B4: 4200, C4: 620, D4: 4100, E4: 900,
            A7: 'Total',
            A10: 'Average price 2023', A11: 'Volume effect', A12: 'Price effect',
            A13: 'Mix effect', A14: 'Check (must be 0)'
          }
        },
        target: ['F2:F4', 'G2:G4', 'C7', 'E7', 'F7', 'G7', 'B10', 'B11', 'B12', 'B13', 'B14'],
        solution: {
          'F2:F4': '=B2*C2', 'G2:G4': '=D2*E2',
          C7: '=SUM(C2:C4)', E7: '=SUM(E2:E4)', F7: '=SUM(F2:F4)', G7: '=SUM(G2:G4)',
          B10: '=F7/C7',
          B11: '=(E7-C7)*B10',
          B12: '=SUMPRODUCT(E2:E4,D2:D4-B2:B4)',
          B13: '=G7-F7-B11-B12',
          B14: '=B11+B12+B13-(G7-F7)'
        },
        check: { B12: { mustUseAny: ['SUMPRODUCT', 'SUM'] }, B14: { tol: 0.5 } },
        explain: {
          idea: 'Revenue went up by 2.36m. The client does not want the number, they want the reason. PVM splits that change into "we sold more", "we charged more" and "we sold a different mix of things".',
          walk: [
            'Revenue 2023 is 24.96m, revenue 2024 is 27.32m, so the change to explain is +2.36m.',
            'Total volume barely moved: 16,920 units to 17,100, up just 180. At the 2023 average price of 1,475 that is worth only +266k. So volume is NOT the story.',
            'Price effect: each product’s price change multiplied by its 2024 volume. Basic +50 on 11,000 units, Standard +50 on 5,200, Premium −100 on 900 = +720k. Real, but still not the main story.',
            'Mix is the residual: 2.36m − 266k − 720k = +1.375m, more than half the total growth. The company sold fewer cheap Basic units and many more Standard and Premium ones.',
            'B14 proves the three parts add back to the whole. Zero means the decomposition is internally consistent. Anything else means an error upstream.',
            'The headline sentence writes itself: growth came almost entirely from mix, not from selling more or charging more.'
          ],
          mistakes: [
            'Using 2024 volumes for the volume effect and 2024 prices for the price effect. You then double-count the interaction and the check line will not close.',
            'Computing mix directly and skipping the check. The residual approach is safer precisely because the check is what validates it.',
            'Using the simple average of the three prices instead of the volume-weighted average for the volume effect. Level 2 warned about this; here it is worth 100k.'
          ],
          onTheJob: 'PVM is a standard commercial diagnostic and it shows up on plenty of finance interviews. "Revenue is up 9%, but it is all mix" changes the whole conversation about whether the growth is sustainable.'
        }
      },
      {
        id: '11.4', title: 'The EBITDA bridge', points: 40,
        brief: 'Build a bridge from 2023 EBITDA to 2024. C3:C8 — the running total after each effect. D3:D8 — each effect as a share of the total change. E3:E8 — the invisible base of each waterfall bar. B10 — closing EBITDA, B11 — the change in percent.',
        hint: 'C3: =C2+B3 and pull down. D3: =B3/($C$8-$C$2). E3: =MIN(C2,C3).',
        sheet: {
          rows: 14, cols: 6,
          colWidths: { A: 220, B: 140, C: 180, D: 140, E: 190 },
          styles: { 'A1:E1': H, 'A10:A11': { label: true } },
          formats: { 'D3:D8': '0.0%', B11: '0.0%' },
          cells: {
            A1: 'Driver', B1: 'Effect, m', C1: 'Running total', D1: 'Share of change', E1: 'Bar base',
            A2: 'EBITDA 2023', B2: 1850, C2: 1850,
            A3: 'Volume growth', B3: 320,
            A4: 'Price', B4: 410,
            A5: 'Raw materials', B5: -280,
            A6: 'Payroll', B6: -190,
            A7: 'Logistics', B7: -95,
            A8: 'Other', B8: 45,
            A10: 'EBITDA 2024', A11: 'Change versus 2023'
          }
        },
        target: ['C3:C8', 'D3:D8', 'E3:E8', 'B10', 'B11'],
        solution: {
          'C3:C8': '=C2+B3',
          'D3:D8': '=B3/($C$8-$C$2)',
          'E3:E8': '=MIN(C2,C3)',
          B10: '=C8', B11: '=C8/C2-1'
        },
        check: {
          D3: { mustContain: ['$C$8', '$C$2'], containHint: 'the denominator is the total change and must be pinned: $C$8-$C$2' },
          E3: { mustUse: ['MIN'] }
        },
        explain: {
          idea: 'A waterfall chart is a running total in disguise. Each bar starts where the previous one finished, and the "floating" look comes from an invisible bar underneath holding it up.',
          walk: [
            'C3 = C2 + B3: start at 1,850 and add the volume effect of 320 to reach 2,170. Pull it down and each row adds its own effect to the previous running total.',
            'By C8 the running total is 2,060 — 2024 EBITDA. The bridge closes because the running total ends where the year ends.',
            'D shows each effect against the NET change of 210. Volume alone is +320, which is 152% of the net change — more than 100%, and that is correct, not a bug. The positives are partly cancelled by the negatives.',
            'E is the chart trick. For an upward bar the base is where you started; for a downward bar it is where you ended. MIN(before, after) picks the right one every time, and the visible bar is the absolute effect sitting on top of it.',
            'The story: price and volume added 730, costs took away 565, and the business netted 11% growth. Without the bridge you would only see 1,850 → 2,060.'
          ],
          mistakes: [
            'Not pinning the denominator in D. Each row then divides by a different range and the shares mean nothing.',
            'Expecting the shares to add to 100% and "fixing" the ones over 100%. With offsetting positives and negatives they can exceed 100% individually; they still add to 100% overall.',
            'Building the running total with individual =1850+320, =2170+410 formulas. One insertion and the chain breaks silently.'
          ],
          onTheJob: 'The EBITDA bridge is probably the most-presented chart in consulting. Knowing that the invisible base is MIN of the two running totals is what lets you build one in two minutes instead of fighting the chart tool for twenty.'
        }
      },
      {
        id: '11.5', title: 'Capacity and hiring need', points: 40,
        brief: 'Work out B7 — the team’s available hours, B8 — billable hours at the target utilisation, B9 — potential revenue, B10 — how many consultants the pipeline in $B$5 requires, B11 — the shortfall in people, B12 — what utilisation would be needed to deliver the pipeline with the current team, B13 — "hire" when the shortfall is positive.',
        hint: 'B10 must round up — half a consultant does not exist. B12: =$B$5/B7.',
        sheet: {
          rows: 16, cols: 5,
          colWidths: { A: 310, B: 170 },
          styles: { 'A1:B1': H, 'A7:A13': { label: true } },
          formats: { B3: '0%', B12: '0.0%' },
          cells: {
            A1: 'Assumption', B1: 'Value',
            A2: 'Consultants in the team', B2: 24,
            A3: 'Target utilisation', B3: 0.75,
            A4: 'Working hours per person per year', B4: 1800,
            A5: 'Hours in the pipeline for the year', B5: 38000,
            A6: 'Rate per hour', B6: 6500,
            A7: 'Available team hours', A8: 'Billable hours',
            A9: 'Potential revenue', A10: 'Consultants required',
            A11: 'Shortfall, people', A12: 'Utilisation required', A13: 'Decision'
          }
        },
        target: ['B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13'],
        solution: {
          B7: '=B2*B4', B8: '=B7*B3', B9: '=B8*B6',
          B10: '=ROUNDUP($B$5/(B4*B3),0)', B11: '=B10-B2',
          B12: '=$B$5/B7', B13: '=IF(B11>0,"hire","team is sufficient")'
        },
        check: { B10: { mustUse: ['ROUNDUP'] }, B13: { mustUse: ['IF'] } },
        explain: {
          idea: 'A professional services firm sells hours. Capacity is people × hours × utilisation, and every staffing decision is a comparison between that number and the pipeline.',
          walk: [
            'Available hours: 24 × 1,800 = 43,200. That is the theoretical maximum if everyone billed every working hour, which nobody does.',
            'At 75% target utilisation the team can bill 32,400 hours — worth 210.6m at 6,500 an hour.',
            'The pipeline needs 38,000 hours. Each consultant delivers 1,800 × 75% = 1,350 billable hours, so 38,000 / 1,350 = 28.1 people. ROUNDUP makes it 29, because you cannot hire a tenth of a person and rounding down leaves work undelivered.',
            'Shortfall: 29 − 24 = 5 consultants.',
            'B12 asks the other question: could the current team do it by working harder? 38,000 / 43,200 = 88% utilisation. That is far above the 75% target and unsustainable — which converts "we could stretch" into "we must hire".'
          ],
          mistakes: [
            'Dividing the pipeline by total hours instead of billable hours, which ignores utilisation entirely and understates the need by a quarter.',
            'Rounding down. Twenty-eight people leave 135 hours of the pipeline undelivered.',
            'Reporting the shortfall without the required-utilisation line. The alternative to hiring is always "work harder", and you should price that option explicitly.'
          ],
          onTheJob: 'Every services business runs this calculation quarterly. It is also the shape of any capacity question — factory shifts, call centre agents, delivery vans — with different nouns.'
        }
      },
      {
        id: '11.6', title: 'Should we cut the price', points: 45,
        brief: 'A client proposes cutting the price by $B$6, expecting volume to rise by $B$7. Fill the base case in C3:C7 and the discount case in D3:D7, then B10 — the change in profit, B11 — the minimum volume increase that would leave profit unchanged, B12 — your recommendation.',
        hint: 'Required volume = (fixed costs + base profit) ÷ new contribution per unit. Divide by the base volume and subtract 1 to express it as a percentage increase.',
        sheet: {
          rows: 16, cols: 6,
          colWidths: { A: 280, B: 140, C: 160, D: 180 },
          styles: { 'A2:D2': H, 'A10:A12': { label: true } },
          formats: { B6: '0%', B7: '0%', B11: '0.0%' },
          cells: {
            A1: 'Unit economics',
            A2: 'Item', B2: 'Assumption', C2: 'Base case', D2: 'With discount',
            A3: 'Price', B3: 4500,
            A4: 'Volume, units', B4: 2800,
            A5: 'Variable cost per unit', B5: 2700,
            A6: 'Price cut', B6: 0.1,
            A7: 'Expected volume uplift', B7: 0.18,
            A8: 'Fixed costs', B8: 3600000,
            A10: 'Change in profit', A11: 'Minimum volume uplift needed', A12: 'Recommendation'
          }
        },
        target: ['C3', 'C4', 'C5', 'C6', 'C7', 'D3', 'D4', 'D5', 'D6', 'D7', 'B10', 'B11', 'B12'],
        solution: {
          C3: '=$B$3', C4: '=$B$4', C5: '=C3-$B$5', C6: '=C5*C4', C7: '=C6-$B$8',
          D3: '=$B$3*(1-$B$6)', D4: '=$B$4*(1+$B$7)', D5: '=D3-$B$5', D6: '=D5*D4', D7: '=D6-$B$8',
          B10: '=D7-C7',
          B11: '=($B$8+C7)/D5/$B$4-1',
          B12: '=IF(B10>0,"cut the price","hold the price")'
        },
        check: { B12: { mustUse: ['IF'] } },
        explain: {
          idea: 'A price cut is a bet: you give up margin on every unit hoping to sell enough extra units to more than make up for it. The arithmetic tells you how big that bet has to be.',
          walk: [
            'Base case: contribution is 4,500 − 2,700 = 1,800 per unit, on 2,800 units that is 5.04m, less 3.6m of fixed costs leaves 1.44m of profit.',
            'With a 10% cut the price becomes 4,050, so contribution falls to 1,350 — a 25% drop, because the whole cut comes out of the margin, not out of the price.',
            'Volume rises 18% to 3,304 units. Contribution is 4.46m, profit 860k.',
            'Profit therefore falls by 580k. The proposal destroys value.',
            'B11 asks how much volume WOULD be needed: (3.6m + 1.44m) / 1,350 = 3,733 units, which is 33.3% above the base volume, not 18%.',
            'So the honest answer is not "no" but "only if you believe volume rises by a third — do you?". That reframing is the deliverable.'
          ],
          mistakes: [
            'Applying the price cut to the contribution rather than to the price. A 10% price cut is a 25% contribution cut here, and that asymmetry is the entire point.',
            'Comparing revenue instead of profit. Revenue actually goes UP in the discount case, which is exactly how bad pricing decisions get approved.',
            'Presenting only the verdict. The break-even uplift is the number that makes the conversation productive.'
          ],
          onTheJob: 'Discount requests arrive constantly. The break-even volume uplift turns an argument about instinct into an argument about a testable assumption, and that is usually where the discount quietly dies.'
        }
      }
    ]
  });

  /* ========================================================= LEVEL 12 ===== */
  /* The official format: 20 questions of mixed difficulty, 60 minutes.       */
  var TX_HEAD = ['Date', 'Region', 'Product', 'Manager', 'Units', 'Price', 'Revenue'];
  var TX = [
    ['12/01/2024', 'Moscow', 'Software', 'Ivanov', 120, 1200, 144000],
    ['28/01/2024', 'St Petersburg', 'Services', 'Petrova', 45, 2400, 108000],
    ['14/02/2024', 'Moscow', 'Services', 'Ivanov', 80, 2400, 192000],
    ['03/03/2024', 'Urals', 'Software', 'Sidorov', 210, 1100, 231000],
    ['22/03/2024', 'St Petersburg', 'Software', 'Petrova', 95, 1150, 109250],
    ['08/04/2024', 'Moscow', 'Licences', 'Kuznetsov', 30, 8500, 255000],
    ['19/04/2024', 'Siberia', 'Services', 'Volkova', 60, 2200, 132000],
    ['07/05/2024', 'Urals', 'Licences', 'Sidorov', 18, 8200, 147600],
    ['21/05/2024', 'Moscow', 'Software', 'Kuznetsov', 340, 1150, 391000],
    ['11/06/2024', 'St Petersburg', 'Licences', 'Petrova', 24, 8500, 204000],
    ['26/06/2024', 'Siberia', 'Software', 'Volkova', 150, 1080, 162000],
    ['09/07/2024', 'Moscow', 'Services', 'Ivanov', 110, 2350, 258500],
    ['23/08/2024', 'Urals', 'Services', 'Sidorov', 70, 2250, 157500],
    ['17/09/2024', 'St Petersburg', 'Software', 'Kuznetsov', 260, 1120, 291200],
    ['05/11/2024', 'Siberia', 'Licences', 'Volkova', 12, 8800, 105600]
  ];
  function txCells(extra) {
    var cells = {};
    TX_HEAD.forEach(function (h, i) { cells[COLS[i] + '1'] = h; });
    TX.forEach(function (row, r) { row.forEach(function (v, i) { cells[COLS[i] + (r + 2)] = v; }); });
    Object.keys(extra || {}).forEach(function (k) { cells[k] = extra[k]; });
    return cells;
  }
  function txSheet(extra, opts) {
    opts = opts || {};
    var sp = Object.assign({ rows: 20, cols: 14 }, opts);
    sp.styles = Object.assign({ 'A1:G1': H }, opts.styles || {});
    sp.formats = Object.assign({ 'A2:A16': 'dd/mm/yyyy' }, opts.formats || {});
    sp.colWidths = Object.assign({ A: 110, B: 140, C: 110, D: 110, E: 90, F: 90, G: 110 }, opts.colWidths || {});
    sp.cells = txCells(extra);
    return sp;
  }

  var EXAM = {
    id: 12,
    title: 'Mock tests',
    subtitle: '50 papers · 20 questions · 60 minutes — the real format',
    goal: 'Sit the whole thing under time pressure with no hints, exactly as on the day — fifty times over, on fifty different sets of data.',
    exam: true,
    timeLimitSec: 60 * 60,
    passScore: 0.7,
    theory: [
      { h: 'What the real test looks like', p: 'Twenty questions of mixed difficulty, sixty minutes, no internet and no hints. You are given a file with data and a list of questions. What is marked is the number, and how fast you got to it.' },
      { h: 'What is assessed', p: 'Basic and more advanced formulas (SUM, AVERAGE, COUNT; IF, IFS, SUMIF; VLOOKUP, INDEX/MATCH), building tables and using filters and sorting, and building pivot tables including grouping, filtering and calculated fields. VBA and Power Query are not required.' },
      { h: 'Tactics', p: 'Three minutes a question on average. Read all twenty first and take the cheap ones; a pivot question is often faster than a formula question. One unanswered question costs less than five half-finished ones.' },
      { h: 'Check your own answers', p: 'Sanity-check every result: order of magnitude, sign, shares that cannot exceed 100%, totals that must reconcile. Half the mistakes on a timed test are caught by simply looking at the answer.' },
      { h: 'Keep off the mouse', p: 'Select to the edge of the data with ⌘⇧↓, jump with ⌘↓, toggle dollars with ⌘T, fill down with ⌘D. On the mouse you will lose a third of your time.' }
    ],
    tasks: [
      {
        id: 'E1', title: 'Revenue for a quarter in one region', points: 20,
        brief: 'J2 — total revenue of Moscow transactions dated in the second quarter of 2024, meaning 1 April to 30 June inclusive.',
        hint: 'SUMIFS with three conditions: the region, and two date bounds. The bounds sit in J4 and J5 — reach them with ">="&$J$4.',
        sheet: txSheet({
          I1: 'Metric', J1: 'Value',
          I4: 'Period start', J4: '01/04/2024', I5: 'Period end', J5: '30/06/2024',
          I2: 'Moscow revenue, Q2'
        }, { styles: { 'I1:J1': H }, colWidths: { I: 220, J: 150 }, formats: { J4: 'dd/mm/yyyy', J5: 'dd/mm/yyyy' } }),
        table: 'A1:G16',
        target: ['J2'],
        solution: { J2: '=SUMIFS($G$2:$G$16,$B$2:$B$16,"Moscow",$A$2:$A$16,">="&$J$4,$A$2:$A$16,"<="&$J$5)' },
        check: { J2: { mustUseAny: ['SUMIFS', 'SUMPRODUCT'] } },
        explain: {
          idea: 'A date range is two conditions on the same column: not before the start, and not after the end. Because dates are numbers, the ordinary comparison operators work on them.',
          walk: [
            'The same range $A$2:$A$16 appears twice, once with ">=" and once with "<=". That is legal and normal — SUMIFS simply applies both.',
            'The bounds come from cells via the & glue, so the period can be changed without touching the formula.',
            'Only two Moscow transactions fall in Q2: 8 April (255,000) and 21 May (391,000). The answer is 646,000.',
            'The 9 July transaction is deliberately just outside. If your answer is 904,500 you included it, which means one of your bounds is wrong.'
          ],
          mistakes: [
            'Using > and < instead of >= and <=, which silently drops any transaction landing exactly on a boundary date.',
            'Typing the dates inside quotes as ">=01/04/2024" — this works in some locales and not others, and on a test machine you have not configured it is a gamble. Point at cells instead.'
          ],
          onTheJob: 'Period comparisons are the bread and butter of reporting. Put period start and end in cells once and every formula on the sheet becomes re-runnable for any month.'
        }
      },
      {
        id: 'E2', title: 'Average ticket by product and size', points: 20,
        brief: 'J2 — the average revenue of Software transactions where more than 100 units were sold. J3 — how many such transactions there are.',
        hint: 'AVERAGEIFS and COUNTIFS, with ">100" on the units column.',
        sheet: txSheet({ I1: 'Metric', J1: 'Value', I2: 'Average revenue', I3: 'Number of transactions' },
          { styles: { 'I1:J1': H }, colWidths: { I: 210, J: 150 } }),
        table: 'A1:G16',
        target: ['J2', 'J3'],
        solution: {
          J2: '=AVERAGEIFS($G$2:$G$16,$C$2:$C$16,"Software",$E$2:$E$16,">100")',
          J3: '=COUNTIFS($C$2:$C$16,"Software",$E$2:$E$16,">100")'
        },
        explain: {
          idea: 'AVERAGEIFS and COUNTIFS take the same condition pairs. The only difference is that AVERAGEIFS needs a range to average as its first argument and COUNTIFS does not.',
          walk: [
            'Five Software transactions clear 100 units: 120, 150, 210, 260 and 340 units. The 95-unit one does not.',
            'Their revenues are 144,000, 162,000, 231,000, 291,200 and 391,000, averaging 243,840.',
            'COUNTIFS on the same conditions returns 5. Computing both is a free consistency check — if the count is zero the average would be #DIV/0!.',
            'Note that AVERAGEIFS divides by the number of matching rows, not by the whole table.'
          ],
          mistakes: [
            'Averaging the price column instead of revenue. The question asks for the average transaction, not the average unit price.',
            'Using ">=100" and picking up a transaction of exactly 100 units that the question excluded.'
          ],
          onTheJob: 'Segmenting by transaction size is the first step of any commercial analysis: big orders and small orders almost always behave differently.'
        }
      },
      {
        id: 'E3', title: 'Region by product summary', points: 30,
        brief: 'Fill J3:L6 with one formula — revenue by region (rows) and product (columns). Add row totals in M3:M6 and column totals in J7:M7. Put a check in J9: the grid total minus the raw total must be zero.',
        hint: 'Mixed references $I3 and J$2. The check is =SUM(J3:L6)-SUM(G2:G16).',
        sheet: txSheet({
          I2: 'Region \\ Product', J2: 'Software', K2: 'Services', L2: 'Licences', M2: 'Total',
          I3: 'Moscow', I4: 'St Petersburg', I5: 'Urals', I6: 'Siberia', I7: 'Total',
          I9: 'Check (must be 0)'
        }, { cols: 15, styles: { 'I2:M2': H, 'I3:I7': H }, colWidths: { I: 160, J: 110, K: 110, L: 120, M: 120 } }),
        table: 'A1:G16',
        target: ['J3:L6', 'M3:M6', 'J7:M7', 'J9'],
        solution: {
          'J3:L6': '=SUMIFS($G$2:$G$16,$B$2:$B$16,$I3,$C$2:$C$16,J$2)',
          'M3:M6': '=SUM(J3:L3)',
          'J7:M7': '=SUM(J3:J6)',
          J9: '=SUM(J3:L6)-SUM($G$2:$G$16)'
        },
        check: {
          J3: { mustUse: ['SUMIFS'], mustContain: ['$I3', 'J$2'] },
          J9: { tol: 0.5 }
        },
        explain: {
          idea: 'The classic matrix question. One formula with half-pinned references covers the body; the totals are ordinary SUMs; the check proves nothing fell through the gaps.',
          walk: [
            '$I3 pins the column so the region label cannot drift sideways. J$2 pins the row so the product label cannot drift downwards.',
            'Row totals sum across the three product columns; column totals sum down the four regions. The corner cell M7 ends up being the grand total either way, which is itself a check.',
            'J9 compares the grid against the raw data: both come to 2,888,650, so the difference is zero.',
            'If the check were non-zero it would mean a region or product in the data is spelled differently from the labels — and the grid would be quietly missing those rows.'
          ],
          mistakes: [
            'Pinning both labels fully, so the whole grid repeats one number.',
            'Skipping the check line. On a test it costs ten seconds and catches the error that would otherwise cost you the question.'
          ],
          onTheJob: 'This is the shape of almost every summary table you will ever be asked for. Build it once with the right dollars and it takes thirty seconds.'
        }
      },
      {
        id: 'E4', title: 'Transaction size band', points: 20,
        brief: 'In H2:H16 label every transaction: "large" from 250,000, "medium" from 130,000, otherwise "small". The thresholds are in K2 and K3.',
        hint: 'Nested IF, thresholds from $K$2 and $K$3, tested from the largest down.',
        sheet: txSheet({
          H1: 'Band', J1: 'Assumption', K1: 'Value',
          J2: 'Large from', K2: 250000, J3: 'Medium from', K3: 130000
        }, { styles: { 'H1': H, 'J1:K1': H }, colWidths: { H: 130, J: 170, K: 130 } }),
        table: 'A1:G16',
        target: ['H2:H16'],
        solution: { 'H2:H16': '=IF(G2>=$K$2,"large",IF(G2>=$K$3,"medium","small"))' },
        check: { '*': { mustUse: ['IF'], mustContain: ['$K$'] } },
        explain: {
          idea: 'The same waterfall as level 3: test the highest band first, and everything that falls through is handled by the next test.',
          walk: [
            'A 255,000 transaction clears the first test and is labelled "large" immediately.',
            'A 192,000 transaction fails the first test, reaches the second, clears it, and becomes "medium".',
            'A 108,000 transaction fails both and lands on "small".',
            'Thresholds live in cells, so the client can re-cut the bands without you rewriting fifteen formulas.'
          ],
          mistakes: [
            'Testing the small threshold first, which labels everything "medium" or "small" and makes "large" unreachable.',
            'Hard-coding 250000 into the formula.'
          ],
          onTheJob: 'Banding transactions is the prerequisite for almost every distribution analysis, and it is usually the helper column a pivot table then groups on.'
        }
      },
      {
        id: 'E5', title: 'Pull the target and compute achievement', points: 25,
        brief: 'In J2:J6 pull each manager’s annual target from the reference table L2:M6, and in K2:K6 work out achievement — actual over target. Compute the actual with a formula, not by eye.',
        hint: 'Actual is a SUMIF on the manager column. The target is a VLOOKUP or INDEX+MATCH into the reference table.',
        sheet: txSheet({
          I1: 'Manager', J1: 'Target', K1: 'Achievement',
          I2: 'Ivanov', I3: 'Petrova', I4: 'Sidorov', I5: 'Kuznetsov', I6: 'Volkova',
          L1: 'Manager', M1: 'Target',
          L2: 'Volkova', M2: 380000, L3: 'Ivanov', M3: 600000, L4: 'Kuznetsov', M4: 900000,
          L5: 'Petrova', M5: 420000, L6: 'Sidorov', M6: 540000
        }, {
          cols: 15, styles: { 'I1:K1': H, 'L1:M1': H },
          colWidths: { I: 120, J: 130, K: 130, L: 120, M: 120 }, formats: { 'K2:K6': '0.0%' }
        }),
        table: 'A1:G16',
        target: ['J2:J6', 'K2:K6'],
        solution: {
          'J2:J6': '=VLOOKUP($I2,$L$2:$M$6,2,0)',
          'K2:K6': '=SUMIF($D$2:$D$16,$I2,$G$2:$G$16)/J2'
        },
        check: {
          J2: { mustUseAny: ['VLOOKUP', 'INDEX', 'XLOOKUP'] },
          K2: { mustUseAny: ['SUMIF', 'SUMIFS', 'SUMPRODUCT'] }
        },
        explain: {
          idea: 'Two different operations in one question: a lookup pulls a value from another table, an aggregate computes one from this table. Knowing which is which is half the exam.',
          walk: [
            'The reference table is in a different order from the list of managers, which is exactly why a lookup is needed rather than a copy-paste.',
            'VLOOKUP finds the manager in column L and returns the target from column M.',
            'SUMIF adds every transaction belonging to that manager, and dividing gives achievement.',
            'Ivanov: 594,500 of revenue against a 600,000 target, so 99.1% — agonisingly short.'
          ],
          mistakes: [
            'Copying the targets across by hand in the order they appear in the reference table. The names do not line up and every number is attached to the wrong person.',
            'Forgetting the final 0 in VLOOKUP on an unsorted reference table, which can return a completely wrong row.'
          ],
          onTheJob: 'Actual-versus-target with the target coming from another system is the single most common reporting task in existence.'
        }
      },
      {
        id: 'E6', title: 'Seasonality by quarter', points: 25,
        brief: 'In H2:H16 work out the quarter of each transaction as a number from 1 to 4. Then in K2:K5 total the revenue of each quarter, and in L2:L5 its share of the year.',
        hint: 'Quarter: =ROUNDUP(MONTH(A2)/3,0). Revenue by quarter: SUMIF on the quarter column.',
        sheet: txSheet({
          H1: 'Quarter', J1: 'Quarter', K1: 'Revenue', L1: 'Share',
          J2: 1, J3: 2, J4: 3, J5: 4
        }, {
          cols: 14, styles: { 'H1': H, 'J1:L1': H },
          colWidths: { H: 110, J: 110, K: 140, L: 110 }, formats: { 'L2:L5': '0.0%' }
        }),
        table: 'A1:G16',
        target: ['H2:H16', 'K2:K5', 'L2:L5'],
        solution: {
          'H2:H16': '=ROUNDUP(MONTH(A2)/3,0)',
          'K2:K5': '=SUMIF($H$2:$H$16,J2,$G$2:$G$16)',
          'L2:L5': '=K2/SUM($G$2:$G$16)'
        },
        check: { H2: { mustUse: ['MONTH'] }, K2: { mustUseAny: ['SUMIF', 'SUMIFS'] } },
        explain: {
          idea: 'Add the grouping column first, then aggregate on it. Trying to do both in one formula is possible and much slower to write under time pressure.',
          walk: [
            'MONTH gives 1 to 12; dividing by 3 and rounding up collapses them into 1 to 4.',
            'SUMIF then treats the quarter column like any other category.',
            'The four shares must add to 100%. That is your check, and it takes one glance.',
            'Q4 here holds a single transaction in November — the data simply stops, which is worth noticing before you write "the business collapsed in Q4" on a slide.'
          ],
          mistakes: [
            'Using ROUND instead of ROUNDUP, which puts April in Q1.',
            'Forgetting that a helper column is allowed. On a timed test it is almost always the faster route.'
          ],
          onTheJob: 'Quarterly seasonality drives inventory, staffing and cash planning. The helper column you build here is also exactly what a pivot table would group on.'
        }
      },
      {
        id: 'E7', title: 'Growth rate and target', points: 25,
        brief: 'Revenue for 2020 to 2024 sits in B2:F2. Work out B4 — the CAGR over the period, B5 — the 2025 forecast if that rate continues, B6 — the CAGR required to hit the 2027 target in $B$7, B8 — "achievable" when the required rate is no higher than the historical one.',
        hint: 'Four intervals from 2020 to 2024. From 2024 to 2027 is three years.',
        sheet: {
          rows: 12, cols: 7,
          colWidths: { A: 250, B: 150, C: 120, D: 120, E: 120, F: 120 },
          styles: { 'A1:F1': H, 'A4:A8': { label: true } },
          formats: { B4: '0.0%', B6: '0.0%' },
          cells: {
            A1: 'Revenue, m', B1: 2020, C1: 2021, D1: 2022, E1: 2023, F1: 2024,
            A2: 'Actual', B2: 850, C2: 910, D2: 1020, E2: 1180, F2: 1340,
            A4: 'CAGR 2020-2024', A5: 'Forecast 2025', A6: 'CAGR required to 2027',
            A7: 'Target 2027, m', B7: 2400, A8: 'Verdict'
          }
        },
        target: ['B4', 'B5', 'B6', 'B8'],
        solution: {
          B4: '=(F2/B2)^(1/4)-1', B5: '=F2*(1+B4)',
          B6: '=($B$7/F2)^(1/3)-1',
          B8: '=IF(B6<=B4,"achievable","aggressive")'
        },
        check: { B6: { mustContain: ['$B$7'] }, B8: { mustUse: ['IF'] } },
        explain: {
          idea: 'Two CAGRs facing in opposite directions: one measures the past, the other prices the ambition. Comparing them is the analysis.',
          walk: [
            'Historical: (1340/850)^(1/4) − 1 = 12.1% a year.',
            'Forecast 2025 at that rate: 1340 × 1.121 = 1,502m.',
            'Required to 2027: (2400/1340)^(1/3) − 1 = 21.4% a year, because there are only three years left.',
            '21.4% needed against 12.1% delivered, so the verdict is "aggressive" — the target implies nearly doubling the historical growth rate.'
          ],
          mistakes: [
            'Using 4 years for the target period instead of 3.',
            'Comparing the required CAGR against last year’s single-year growth rather than the multi-year trend.'
          ],
          onTheJob: 'Whenever a client shows you a target, compute the implied CAGR and hold it against history. It is the fastest way to find out whether the plan has been thought about.'
        }
      },
      {
        id: 'E8', title: 'Investment decision', points: 30,
        brief: 'C4:C9 — the cumulative cash flow. B10 — the NPV at the rate in $B$1. B11 — the IRR. B12 — the payback year, meaning the first year in which the cumulative flow turns positive. B13 — the decision under the rule "NPV above zero AND IRR above the discount rate".',
        hint: 'Cumulative flow is an expanding range: =SUM($B$4:B4). For the payback year, MATCH over the cumulative column.',
        sheet: {
          rows: 16, cols: 5,
          colWidths: { A: 230, B: 160, C: 180 },
          styles: { 'A3:C3': H, 'A10:A13': { label: true } },
          formats: { B1: '0%', B11: '0.0%' },
          cells: {
            A1: 'Discount rate', B1: 0.14,
            A3: 'Year', B3: 'Cash flow', C3: 'Cumulative',
            A4: 0, B4: -9000, A5: 1, B5: 2200, A6: 2, B6: 2900,
            A7: 3, B7: 3400, A8: 4, B8: 3800, A9: 5, B9: 4100,
            A10: 'NPV', A11: 'IRR', A12: 'Payback year', A13: 'Decision'
          }
        },
        target: ['C4:C9', 'B10', 'B11', 'B12', 'B13'],
        solution: {
          'C4:C9': '=SUM($B$4:B4)',
          B10: '=B4+NPV($B$1,B5:B9)',
          B11: '=IRR(B4:B9)',
          B12: '=INDEX($A$4:$A$9,MATCH(TRUE,INDEX($C$4:$C$9>0,0),0))',
          B13: '=IF(AND(B10>0,B11>$B$1),"invest","decline")'
        },
        check: {
          C4: { mustContain: ['$B$4:B4'], containHint: 'the cumulative flow needs the expanding range $B$4:B4' },
          B10: { mustUse: ['NPV'] }, B11: { mustUse: ['IRR'] },
          B13: { mustUse: ['IF', 'AND'] }
        },
        explain: {
          idea: 'Three different views of the same cash flows: NPV says how much value, IRR says at what rate, payback says how long until the money is back. A decision rule then combines them.',
          walk: [
            'The cumulative column starts at −9,000 and climbs. It first turns positive in year 4, so payback is year 4.',
            'NPV at 14% is about 1,836 — positive, so the project creates value at the required rate. Note the year-0 flow is added outside the NPV function.',
            'IRR is 21.3%, comfortably above the 14% hurdle. NPV positive and IRR above the hurdle always agree in direction; they are two ways of stating the same fact.',
            'The AND in the decision rule means both must hold. Here they do, so "invest".'
          ],
          mistakes: [
            'Passing the whole range to NPV including year 0.',
            'Reading payback off the cash-flow column instead of the cumulative one.',
            'Reporting payback as a decision on its own — it ignores everything that happens after the payback year.'
          ],
          onTheJob: 'Investment committee papers carry all three numbers side by side precisely because each one hides something the others reveal.'
        }
      },
      {
        id: 'E9', title: 'Profit sensitivity grid', points: 30,
        brief: 'Fill B9:F13 — profit at different prices (rows) and variable costs (columns), with volume fixed at $B$4 and fixed costs at $B$5. In B15 count how many of the 25 scenarios are profitable.',
        hint: 'B9: =($A9-B$8)*$B$4-$B$5. B15: COUNTIF over the whole grid with ">0".',
        sheet: {
          rows: 18, cols: 7,
          colWidths: { A: 250, B: 120, C: 120, D: 120, E: 120, F: 120 },
          styles: { 'A8:F8': H, 'A9:A13': H },
          cells: {
            A1: 'Assumptions',
            A4: 'Volume, units', B4: 2800,
            A5: 'Fixed costs', B5: 3600000,
            A7: 'Profit: price (rows) × variable cost (columns)',
            A8: 'Price \\ Variable cost', B8: 2400, C8: 2600, D8: 2800, E8: 3000, F8: 3200,
            A9: 4000, A10: 4250, A11: 4500, A12: 4750, A13: 5000,
            A15: 'Profitable scenarios'
          }
        },
        target: ['B9:F13', 'B15'],
        solution: {
          'B9:F13': '=($A9-B$8)*$B$4-$B$5',
          B15: '=COUNTIF($B$9:$F$13,">0")'
        },
        check: {
          B9: { mustContain: ['$A9', 'B$8'] },
          B15: { mustUseAny: ['COUNTIF', 'SUMPRODUCT'] }
        },
        explain: {
          idea: 'Two-way sensitivity again, but now the second axis is a cost rather than a volume. The technique does not care what the assumptions mean.',
          walk: [
            '$A9 supplies the price from the row; B$8 supplies the variable cost from the column; volume and fixed costs are fully pinned.',
            'The top-left corner is the worst case for margin per unit and still profitable; the bottom-right is the best price against the worst cost.',
            'COUNTIF over the finished grid counts the profitable scenarios in one cell — far faster than eyeballing 25 numbers under time pressure.',
            'The answer tells you how much of the plausible space works, which is a more useful summary than any single scenario.'
          ],
          mistakes: [
            'Getting the two half-pins the wrong way round, which transposes the whole grid.',
            'Counting the profitable cells by eye and miscounting.'
          ],
          onTheJob: '"How wrong can we be before this stops working?" is the question behind every sensitivity grid, and it is usually the one the client actually cares about.'
        }
      },
      {
        id: 'E10', title: 'Clean up and reconcile', points: 25,
        brief: 'Column B holds amounts exported as text. Convert them to numbers in C2:C9, total them in F2, compare with the control total in $F$4 by putting the difference in F3, and in F5 write "reconciles" when the difference is zero.',
        hint: 'SUBSTITUTE removes the spaces and the currency, VALUE makes it a number. The difference is F2-$F$4.',
        sheet: {
          rows: 12, cols: 7,
          colWidths: { A: 110, B: 180, C: 150, E: 210, F: 150 },
          styles: { 'A1:C1': H, 'E1:F1': H },
          cells: {
            A1: 'Document', B1: 'Amount as exported', C1: 'Number',
            E1: 'Metric', F1: 'Value',
            E2: 'Total from the export', E3: 'Difference', E4: 'Control total', F4: 47829,
            E5: 'Verdict',
            A2: 'DOC-1', B2: '1 250 USD', A3: 'DOC-2', B3: '12 400USD', A4: 'DOC-3', B4: '890 USD',
            A5: 'DOC-4', B5: ' 3 100 USD ', A6: 'DOC-5', B6: '9 999USD', A7: 'DOC-6', B7: '640 USD',
            A8: 'DOC-7', B8: '15 300 USD', A9: 'DOC-8', B9: '4 250USD'
          }
        },
        target: ['C2:C9', 'F2', 'F3', 'F5'],
        solution: {
          'C2:C9': '=VALUE(SUBSTITUTE(SUBSTITUTE(B2," ",""),"USD",""))',
          F2: '=SUM(C2:C9)',
          F3: '=F2-$F$4',
          F5: '=IF(F3=0,"reconciles","investigate")'
        },
        check: { C2: { mustUseAny: ['VALUE', 'SUBSTITUTE'] }, F3: { tol: 0.5 } },
        explain: {
          idea: 'Half of data work is turning something Excel refuses to add into something it will. Then you prove the conversion did not lose anything by reconciling to a control total.',
          walk: [
            'The inner SUBSTITUTE strips every space, the outer one strips "USD", VALUE converts what remains.',
            'SUM over the converted column gives 47,829.',
            'The control total is 47,829, so the difference is zero and the verdict is "reconciles".',
            'The reconciliation is not ceremony. If one row had failed to convert it would be text, SUM would skip it silently, and only the control total would catch it.'
          ],
          mistakes: [
            'Summing column B directly and reporting 0.',
            'Converting the rows by retyping them, which works and proves nothing about the other 10,000 rows in the real file.'
          ],
          onTheJob: 'Every data hand-off should come with a control total. Agreeing one before the file is sent saves days of arguing about whose number is right.'
        }
      },
      {
        id: 'E11', title: 'Sort and read the top', points: 20,
        brief: 'Sort the transaction table by Revenue, largest first. Then put the region of the biggest transaction in J2, and the share of total revenue held by the top three transactions in J3.',
        hint: 'Sort on the Revenue header, then J2 is =B2 and J3 is =SUM(G2:G4)/SUM(G2:G16).',
        sheet: txSheet({ I1: 'Metric', J1: 'Value', I2: 'Region of the largest', I3: 'Share of top 3' },
          { styles: { 'I1:J1': H }, colWidths: { I: 200, J: 140 }, formats: { J3: '0.0%' } }),
        table: 'A1:G16',
        target: ['J2', 'J3'],
        solution: { J2: '=B2', J3: '=SUM(G2:G4)/SUM(G2:G16)' },
        expect: { sortedBy: { col: 'G', asc: false } },
        explain: {
          idea: 'Sorting is not cosmetic — it is what makes positional formulas such as "the top three" mean anything.',
          walk: [
            'Sorting by revenue descending puts the 391,000 Moscow software transaction in row 2.',
            'J2 = B2 reads the region from whatever row is now first: Moscow.',
            'J3 adds the first three revenue cells and divides by the total. About a third of the year’s revenue sits in three transactions.',
            'Run the same formulas before sorting and you get a different, meaningless answer — which is exactly the point.'
          ],
          mistakes: [
            'Sorting ascending and reporting the smallest transaction.',
            'Typing "Moscow" instead of pointing at the cell.'
          ],
          onTheJob: 'Sort, look at the top ten, look at the bottom ten. That is the first two minutes with any new data set, every time.'
        }
      },
      {
        id: 'E12', title: 'Filter and total correctly', points: 25,
        brief: 'Filter the table to the Software product. The answer block sits below the table, out of the filter’s reach. B19 — the revenue of the visible rows, B20 — the number of visible rows, B21 — the average revenue of the visible rows.',
        hint: 'SUBTOTAL with function numbers 9, 3 and 1. A plain SUM would ignore the filter entirely.',
        sheet: txSheet({
          A18: 'Summary',
          A19: 'Visible revenue', A20: 'Visible rows', A21: 'Average visible revenue'
        }, { rows: 24, styles: { 'A18': H }, colWidths: { A: 220 } }),
        table: 'A1:G16',
        target: ['B19', 'B20', 'B21'],
        solution: { B19: '=SUBTOTAL(9,G2:G16)', B20: '=SUBTOTAL(3,A2:A16)', B21: '=SUBTOTAL(1,G2:G16)' },
        expect: { filtered: { col: 'C', values: ['Software'] } },
        check: { '*': { mustUse: ['SUBTOTAL'] } },
        explain: {
          idea: 'When a total sits under a filtered table it must be a SUBTOTAL, or it will silently include rows the reader cannot see.',
          walk: [
            'Six Software transactions remain visible.',
            'SUBTOTAL(9, …) sums only those: 1,328,450.',
            'SUBTOTAL(3, …) counts them: 6. Function 3 is COUNTA, which works on the text in the Date column.',
            'SUBTOTAL(1, …) averages them: about 221,408.',
            'Swap any of them for SUM, COUNTA or AVERAGE and the answer jumps to the whole table — that is the trap the question is built around.'
          ],
          mistakes: [
            'Using SUM and reporting 2,888,650 for a filtered view.',
            'Using function number 2 on a text column and getting zero.'
          ],
          onTheJob: 'A filtered sheet with a plain SUM underneath is one of the most common real errors in client reporting, and one of the easiest for a reviewer to catch.'
        }
      },
      {
        id: 'E13', title: 'Pivot: revenue by region', points: 25,
        mode: 'pivot',
        brief: 'Build a pivot table with Region in ROWS and Sum of Revenue in VALUES.',
        hint: 'Region to Rows, Revenue to Values, aggregation Sum.',
        sheet: txSheet({}, {}),
        table: 'A1:G16',
        target: [],
        solution: {},
        expect: { pivot: { source: 'A1:G16', rows: ['Region'], cols: [], values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
        explain: {
          idea: 'The fastest possible answer to "revenue by X". Two clicks, no formulas, no dollars to get wrong.',
          walk: [
            'Region in Rows produces one row per distinct region, read straight from the data.',
            'Sum of Revenue fills them in. Moscow leads on 1,240,500.',
            'The Grand Total must equal 2,888,650 — the same total you got from SUM in the formula questions. Always check the corner.',
            'On a timed test, when a question says "by region" and does not demand a specific cell, the pivot is almost always the faster route.'
          ],
          mistakes: [
            'Dropping Revenue into Rows and getting fifteen rows of individual amounts.',
            'Leaving the aggregation on Count.'
          ],
          onTheJob: 'The brief for this test names pivot tables explicitly. Expect at least one question of exactly this shape and do not spend two minutes writing SUMIFS for it.'
        }
      },
      {
        id: 'E14', title: 'Pivot: product by region, Software only', points: 30,
        mode: 'pivot',
        brief: 'Build a pivot with Manager in ROWS, Region in COLUMNS, Sum of Revenue in VALUES, and a report filter on Product set to Software.',
        hint: 'Three areas plus the Filters box. Tick only Software in the filter.',
        sheet: txSheet({}, {}),
        table: 'A1:G16',
        target: [],
        solution: {},
        expect: {
          pivot: {
            source: 'A1:G16', rows: ['Manager'], cols: ['Region'],
            values: [{ field: 'Revenue', agg: 'sum' }],
            filters: [{ field: 'Product', values: ['Software'] }]
          }
        },
        explain: {
          idea: 'All four areas in one report: what goes down, what goes across, what gets added, and what the whole thing is scoped to.',
          walk: [
            'The filter removes Services and Licences before anything else happens, so every number in the report is Software only.',
            'Manager down the side and Region across the top shows who sells what where — Kuznetsov appears in both Moscow and St Petersburg, which a single-dimension report would have hidden.',
            'Blank intersections mean that manager sold no software in that region.',
            'The Grand Total is 1,328,450, matching the SUBTOTAL answer from the filter question. Two completely different techniques agreeing is a good sign.'
          ],
          mistakes: [
            'Putting Product in Rows instead of Filters — you then get a Software row alongside the others rather than a report scoped to it.',
            'Forgetting to untick the other products.'
          ],
          onTheJob: 'Manager × region × product is a standard sales cube. Being able to re-cut it live in a meeting is worth more than any pre-built slide.'
        }
      },
      {
        id: 'E15', title: 'Pivot: share by product', points: 25,
        mode: 'pivot',
        brief: 'Build a pivot with Product in ROWS and Revenue in VALUES, displayed as a percentage of the grand total.',
        hint: 'Add Revenue as a Sum, then change "Show values as" to % of grand total.',
        sheet: txSheet({}, {}),
        table: 'A1:G16',
        target: [],
        solution: {},
        expect: {
          pivot: {
            source: 'A1:G16', rows: ['Product'], cols: [],
            values: [{ field: 'Revenue', agg: 'sum', show: 'pctTotal' }], filters: []
          }
        },
        explain: {
          idea: 'Same aggregation, different presentation. The dropdown does the division for you and guarantees the shares add to 100%.',
          walk: [
            'Software is about 46% of revenue, Services about 33%, Licences about 21%.',
            'The percentages are computed against the grand total, so they sum to exactly 100% with no rounding argument.',
            'Doing it with formulas would mean an extra column of divisions by a pinned total — this is one dropdown.',
            'Switch back to "No calculation" at any time; nothing about the underlying aggregation changed.'
          ],
          mistakes: [
            'Choosing % of row total when there is no column field, which makes every row 100%.',
            'Presenting only shares with no absolute numbers anywhere on the page.'
          ],
          onTheJob: 'Revenue mix is on the first page of most commercial diagnostics, and it is always shown as a share.'
        }
      },
      {
        id: 'E16', title: 'Pivot: calculated field', points: 30,
        mode: 'pivot',
        brief: 'Average price per unit is not in the data. Build a pivot with Region in ROWS and a CALCULATED FIELD "Revenue / Units" in VALUES.',
        hint: 'Use "Add calculated field" in the Values area and write the formula over the field names.',
        sheet: txSheet({}, {}),
        table: 'A1:G16',
        target: [],
        solution: {},
        expect: {
          pivot: {
            source: 'A1:G16', rows: ['Region'], cols: [],
            values: [{ calc: 'Revenue / Units', name: 'Average price' }], filters: []
          }
        },
        explain: {
          idea: 'A calculated field creates a metric the source table does not contain. Here it is a ratio, which is exactly the case where you must understand how the pivot computes it.',
          walk: [
            'The pivot totals Revenue and totals Units for each region, then divides the two totals.',
            'That is the volume-weighted average price — the correct answer to "what did a unit sell for in this region", and the same idea as the SUMPRODUCT weighting in level 2.',
            'It is NOT the average of the per-transaction prices. For a region with one huge cheap order and one tiny expensive one those two numbers differ a lot.',
            'Field names are typed exactly as they appear in the header: Revenue / Units.'
          ],
          mistakes: [
            'Expecting the field to average the per-row ratios. Calculated fields work on the aggregated totals — a genuine gotcha worth remembering.',
            'Misspelling a field name, which silently produces zero.'
          ],
          onTheJob: 'Price per unit, cost per order, revenue per head — the metrics clients ask about are almost always ratios that have to be derived, and the weighting question is always the same one.'
        }
      },
      {
        id: 'E17', title: 'Two-way rate lookup', points: 25,
        brief: 'In C10:C12 pull the commission rate at the crossing of the product (A10:A12) and the region (B10:B12) from the matrix B2:E5.',
        hint: 'INDEX with two MATCHes: one down the product labels, one across the region labels.',
        sheet: {
          rows: 16, cols: 7,
          colWidths: { A: 140, B: 160, C: 130, D: 130, E: 130 },
          styles: { 'A2:E2': H, 'A3:A5': H, 'A9:C9': H },
          formats: { 'B3:E5': '0.0%', 'C10:C12': '0.0%' },
          cells: {
            A1: 'Commission rates',
            A2: 'Product \\ Region', B2: 'Moscow', C2: 'St Petersburg', D2: 'Urals', E2: 'Siberia',
            A3: 'Software', B3: 0.04, C3: 0.045, D3: 0.05, E3: 0.055,
            A4: 'Services', B4: 0.06, C4: 0.065, D4: 0.07, E4: 0.075,
            A5: 'Licences', B5: 0.03, C5: 0.035, D5: 0.04, E5: 0.045,
            A9: 'Product', B9: 'Region', C9: 'Rate',
            A10: 'Services', B10: 'Urals', A11: 'Licences', B11: 'Moscow', A12: 'Software', B12: 'Siberia'
          }
        },
        target: ['C10:C12'],
        solution: { 'C10:C12': '=INDEX($B$3:$E$5,MATCH($A10,$A$3:$A$5,0),MATCH($B10,$B$2:$E$2,0))' },
        check: { '*': { mustUse: ['INDEX', 'MATCH'] } },
        explain: {
          idea: 'INDEX takes a row number and a column number. Each comes from its own MATCH, so a two-dimensional table can be read with one formula.',
          walk: [
            'Services × Urals: MATCH finds Services at position 2 among the product labels and Urals at position 3 among the region labels.',
            'INDEX($B$3:$E$5, 2, 3) reads the second row and third column of the rate block: 7.0%.',
            'The INDEX block contains only the numbers. The label ranges sit alongside it and do not overlap — getting that alignment right is the whole task.',
            'Everything is pinned except the two lookup values, so one formula fills all three rows.'
          ],
          mistakes: [
            'Including the label row or column inside the INDEX block, which shifts every answer by one position.',
            'Matching a region against the product labels by mistake, giving #N/A.'
          ],
          onTheJob: 'Rate cards and commission grids are always two-dimensional, and this formula is how they get read into a model.'
        }
      },
      {
        id: 'E18', title: 'How many distinct customers', points: 25,
        brief: 'In C2:C13 put a 1 against the first appearance of each client and a 0 against repeats. In F2 count the distinct clients and in F3 the average revenue per distinct client.',
        hint: '=IF(COUNTIF($B$2:B2,B2)=1,1,0). The expanding range is the trick.',
        sheet: {
          rows: 16, cols: 7,
          colWidths: { A: 90, B: 190, C: 150, D: 110, E: 220, F: 120 },
          styles: { 'A1:D1': H, 'E1:F1': H },
          cells: {
            A1: 'Order', B1: 'Client', C1: 'First appearance', D1: 'Revenue',
            E1: 'Metric', F1: 'Value', E2: 'Distinct clients', E3: 'Revenue per client',
            A2: 'O-1', B2: 'Alpha', D2: 1200, A3: 'O-2', B3: 'Beta', D3: 800,
            A4: 'O-3', B4: 'Alpha', D4: 450, A5: 'O-4', B5: 'Gamma', D5: 2300,
            A6: 'O-5', B6: 'Beta', D6: 640, A7: 'O-6', B7: 'Delta', D7: 1900,
            A8: 'O-7', B8: 'Alpha', D8: 780, A9: 'O-8', B9: 'Epsilon', D9: 3100,
            A10: 'O-9', B10: 'Gamma', D10: 1150, A11: 'O-10', B11: 'Zeta', D11: 520,
            A12: 'O-11', B12: 'Delta', D12: 2050, A13: 'O-12', B13: 'Alpha', D13: 990
          }
        },
        target: ['C2:C13', 'F2', 'F3'],
        solution: {
          'C2:C13': '=IF(COUNTIF($B$2:B2,B2)=1,1,0)',
          F2: '=SUM(C2:C13)', F3: '=SUM(D2:D13)/F2'
        },
        check: { C2: { mustUse: ['COUNTIF'], mustContain: ['$B$2:B2'] } },
        explain: {
          idea: 'The range $B$2:B2 grows as the formula is pulled down, so each row sees only itself and the rows above. Only the first occurrence of a name ever counts as 1.',
          walk: [
            'Row 2, Alpha: the range is one cell, COUNTIF finds one Alpha, so the answer is 1.',
            'Row 4, Alpha again: the range now covers rows 2 to 4 and contains two Alphas, so the answer is 0.',
            'Adding the column counts every client exactly once: six distinct clients across twelve orders.',
            'Revenue per client divides by 6, not by 12 — the difference between revenue per client and average order value.'
          ],
          mistakes: [
            'Pinning both ends of the range, which makes the whole column zero except where a name appears exactly once.',
            'Counting orders when the question asks about clients.'
          ],
          onTheJob: 'Distinct counts are surprisingly hard in Excel and come up constantly: unique customers, unique SKUs, unique visitors.'
        }
      },
      {
        id: 'E19', title: 'Break-even', points: 25,
        brief: 'B7 — contribution per unit, B8 — break-even volume rounded up to a whole unit, B9 — profit at the planned volume, B10 — the safety margin over break-even.',
        hint: 'Contribution is price minus variable cost; break-even is fixed costs divided by contribution.',
        sheet: {
          rows: 12, cols: 5,
          colWidths: { A: 280, B: 160 },
          styles: { 'A1:B1': H, 'A7:A10': { label: true } },
          formats: { B10: '0.0%' },
          cells: {
            A1: 'Price per unit', B1: 3200,
            A2: 'Variable cost per unit', B2: 1950,
            A4: 'Fixed costs per month', B4: 2500000,
            A5: 'Planned volume', B5: 2600,
            A7: 'Contribution per unit', A8: 'Break-even volume',
            A9: 'Profit at plan', A10: 'Safety margin'
          }
        },
        target: ['B7', 'B8', 'B9', 'B10'],
        solution: {
          B7: '=B1-B2', B8: '=ROUNDUP(B4/B7,0)',
          B9: '=B7*B5-B4', B10: '=B5/B8-1'
        },
        check: { B8: { mustUseAny: ['ROUNDUP', 'ROUND'] } },
        explain: {
          idea: 'Contribution covers fixed costs first; only after they are covered does profit begin. Break-even is where the running total of contribution catches the fixed costs.',
          walk: [
            'Contribution: 3,200 − 1,950 = 1,250 per unit.',
            'Break-even: 2,500,000 / 1,250 = 2,000 units.',
            'At the planned 2,600 units profit is 1,250 × 2,600 − 2,500,000 = 750,000.',
            'Safety margin: 2,600 / 2,000 − 1 = 30%. Volume can fall by 30% before the business breaks even.'
          ],
          mistakes: [
            'Including fixed costs in the per-unit contribution.',
            'Rounding break-even down, which reports a volume that still loses money.'
          ],
          onTheJob: 'The first page of any business case, and the fastest way to sanity-check somebody else’s forecast.'
        }
      },
      {
        id: 'E20', title: 'Weighted average price', points: 25,
        brief: 'B8 — the volume-weighted average price across the whole portfolio. B9 — the plain average of the prices. B10 — the gap between them in percent.',
        hint: 'SUMPRODUCT of prices and volumes, divided by total volume. The gap is B8/B9-1.',
        sheet: {
          rows: 12, cols: 4,
          colWidths: { A: 200, B: 150, C: 130 },
          styles: { 'A1:C1': H, 'A8:A10': { label: true } },
          formats: { B10: '0.0%' },
          cells: {
            A1: 'Product', B1: 'Price', C1: 'Units',
            A2: 'Entry', B2: 900, C2: 18000,
            A3: 'Core', B3: 1600, C3: 6200,
            A4: 'Pro', B4: 3400, C4: 950,
            A5: 'Enterprise', B5: 7800, C5: 180,
            A8: 'Weighted average price', A9: 'Plain average of prices', A10: 'Gap'
          }
        },
        target: ['B8', 'B9', 'B10'],
        solution: {
          B8: '=SUMPRODUCT(B2:B5,C2:C5)/SUM(C2:C5)',
          B9: '=AVERAGE(B2:B5)',
          B10: '=B8/B9-1'
        },
        check: { B8: { mustUse: ['SUMPRODUCT'] }, B9: { mustUse: ['AVERAGE'] } },
        explain: {
          idea: 'The last question is the first trap again: an average is only meaningful once you say what it is weighted by.',
          walk: [
            'SUMPRODUCT multiplies each price by its volume and adds the products — that is total revenue.',
            'Dividing by total units gives the price of the average unit sold: about 1,214.',
            'The plain average of the four prices is 3,425 — nearly three times higher, because it treats 180 Enterprise units as equal in weight to 18,000 Entry units.',
            'The gap is around −65%. Quoting the wrong one of these two numbers in a pricing discussion would be a serious error.'
          ],
          mistakes: [
            'Reporting the plain average as "our average price".',
            'Weighting by revenue instead of by volume, which double-counts price and inflates the answer.'
          ],
          onTheJob: 'Blended rate, average realised price, weighted cost of capital — same arithmetic every time. Always say out loud what the weights are.'
        }
      }
    ]
  };

  /* -------------------------------------------------------- the 50 papers --
   * Paper 1 is the one written out above, question by question. Papers 2 to 50
   * are built by mocktests.js: each has its own transaction book and its own
   * twenty questions, drawn to the same quotas, so sitting one is the same
   * exercise on data you have never seen. */
  EXAM.papers = [{
    id: 'M01', n: 1,
    title: 'Mock test 1',
    subtitle: 'The worked paper — every answer explained in full',
    timeLimitSec: EXAM.timeLimitSec,
    passScore: EXAM.passScore,
    tasks: EXAM.tasks
  }].concat(MOCKS ? MOCKS.papers(2, MOCKS.COUNT) : []);
  LEVELS.push(EXAM);

  return {
    levels: LEVELS, exam: EXAM, papers: EXAM.papers,
    deals: DEALS, dealCells: dealCells, tx: TX, txCells: txCells
  };
});

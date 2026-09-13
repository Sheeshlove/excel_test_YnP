/* Formula engine tests. Every expected value has been checked against the way
 * Excel itself behaves. */
const E = require('../app/js/engine.js');
const XLF = require('../app/js/formula.js');

function sheet(cells) {
  const s = new E.Sheet({ rows: 40, cols: 12 });
  Object.keys(cells).forEach(a1 => s.setAt(a1, cells[a1]));
  return s;
}
function val(formula, cells) {
  const s = sheet(Object.assign({}, cells || {}, { Z99: '=' + formula.replace(/^=/, '') }));
  return s.get('Z99');
}

const DATA = {
  A1: 'Region', B1: 'Manager', C1: 'Product', D1: 'Revenue', E1: 'Cost', F1: 'Date',
  A2: 'Moscow', B2: 'Ivanov', C2: 'Software', D2: 1200, E2: 700, F2: '15/01/2024',
  A3: 'SPb', B3: 'Petrov', C3: 'Software', D3: 800, E3: 500, F3: '20/02/2024',
  A4: 'Moscow', B4: 'Sidorov', C4: 'Services', D4: 2400, E4: 1500, F4: '05/03/2024',
  A5: 'Kazan', B5: 'Ivanov', C5: 'Services', D5: 450, E5: 300, F5: '18/03/2024',
  A6: 'SPb', B6: 'Petrov', C6: 'Software', D6: 1750, E6: 900, F6: '02/04/2024',
  A7: 'Moscow', B7: 'Ivanov', C7: 'Software', D7: 3100, E7: 1600, F7: '25/04/2024'
};

const T = [];
function t(name, actual, expected, tol) {
  T.push({ name, actual, expected, tol: tol === undefined ? 1e-9 : tol });
}

/* --- arithmetic and precedence --- */
t('unary minus binds tighter than ^', val('-2^2'), 4);
t('percent operator', val('50%*200'), 100);
t('string concatenation', val('"a"&"b"&1'), 'ab1');
t('brackets', val('(2+3)*4'), 20);
t('division by zero', String(val('1/0')), '#DIV/0!');
t('comparison', val('5>=5'), true);
t('text sorts after numbers', val('"a">1'), true);

/* --- aggregates --- */
t('SUM over a range', val('SUM(D2:D7)', DATA), 9700);
t('AVERAGE', val('AVERAGE(D2:D7)', DATA), 9700 / 6, 1e-9);
t('MIN and MAX', val('MAX(D2:D7)-MIN(D2:D7)', DATA), 3100 - 450);
t('COUNT ignores text', val('COUNT(A2:D2)', DATA), 1);
t('COUNTA counts text too', val('COUNTA(A1:F1)', DATA), 6);
t('MEDIAN of an even count', val('MEDIAN(1,2,3,4)'), 2.5);
t('SUMPRODUCT', val('SUMPRODUCT(D2:D7,E2:E7)', DATA), 1200 * 700 + 800 * 500 + 2400 * 1500 + 450 * 300 + 1750 * 900 + 3100 * 1600);
t('ROUND half away from zero', val('ROUND(2.5,0)'), 3);
t('ROUND negative number', val('ROUND(-2.5,0)'), -3);
t('ROUND to decimals', val('ROUND(1234.5678,2)'), 1234.57);
t('ROUND to thousands', val('ROUND(128473215,-3)'), 128473000);
t('ROUNDUP', val('ROUNDUP(1.001,2)'), 1.01);
t('ROUNDDOWN', val('ROUNDDOWN(1.999,2)'), 1.99);
t('MROUND', val('MROUND(17,5)'), 15);
t('MOD of a negative', val('MOD(-3,5)'), 2);
t('STDEV.S', val('STDEV.S(2,4,4,4,5,5,7,9)'), 2.13808993529939, 1e-10);
t('STDEV.P', val('STDEV.P(2,4,4,4,5,5,7,9)'), 2);
t('LARGE', val('LARGE(D2:D7,2)', DATA), 2400);
t('SMALL', val('SMALL(D2:D7,1)', DATA), 450);
t('RANK descending by default', val('RANK(D4,D2:D7)', DATA), 2);
t('PERCENTILE.INC', val('PERCENTILE.INC(D2:D7,0.5)', DATA), 1475);

/* --- logic --- */
t('IF', val('IF(2>1,"yes","no")'), 'yes');
t('nested IF', val('IF(D7>3000,"A",IF(D7>1000,"B","C"))', DATA), 'A');
t('AND inside OR', val('AND(1>0,OR(FALSE,2>1))'), true);
t('IFERROR catches', val('IFERROR(1/0,"divide")'), 'divide');
t('IFERROR passes a good value through', val('IFERROR(10/2,"x")'), 5);
t('IFS', val('IFS(FALSE,1,TRUE,2)'), 2);
t('NOT', val('NOT(FALSE)'), true);
t('SWITCH', val('SWITCH(2,1,"a",2,"b","z")'), 'b');

/* --- conditional aggregates --- */
t('SUMIF', val('SUMIF(A2:A7,"Moscow",D2:D7)', DATA), 1200 + 2400 + 3100);
t('SUMIF with an operator', val('SUMIF(D2:D7,">1000")', DATA), 1200 + 2400 + 1750 + 3100);
t('SUMIFS with two conditions', val('SUMIFS(D2:D7,A2:A7,"Moscow",C2:C7,"Software")', DATA), 1200 + 3100);
t('COUNTIF', val('COUNTIF(B2:B7,"Ivanov")', DATA), 3);
t('COUNTIF with a wildcard', val('COUNTIF(B2:B7,"*ov")', DATA), 6);
t('COUNTIFS', val('COUNTIFS(A2:A7,"SPb",D2:D7,">1000")', DATA), 1);
t('AVERAGEIF', val('AVERAGEIF(A2:A7,"SPb",D2:D7)', DATA), (800 + 1750) / 2);
t('MAXIFS', val('MAXIFS(D2:D7,C2:C7,"Software")', DATA), 3100);
t('MINIFS', val('MINIFS(D2:D7,A2:A7,"Moscow")', DATA), 1200);
t('a not-equal condition', val('COUNTIF(A2:A7,"<>Moscow")', DATA), 3);
t('an operator glued to a cell', val('COUNTIF(D2:D7,">"&Y1)', Object.assign({ Y1: 1000 }, DATA)), 4);

/* --- SUBTOTAL respects the filter --- */
{
  const s = sheet(DATA);
  s.attachTable('A1:F7');
  s.setAt('Y1', '=SUBTOTAL(9,D2:D7)');
  s.setAt('Y2', '=SUM(D2:D7)');
  s.setAt('Y3', '=SUBTOTAL(3,A2:A7)');
  s.setAt('Y4', '=SUBTOTAL(1,D2:D7)');
  t('SUBTOTAL with no filter equals SUM', s.get('Y1'), 9700);
  s.setFilter(0, ['Moscow']);
  t('SUBTOTAL sums visible rows only', s.get('Y1'), 1200 + 2400 + 3100);
  t('SUM ignores the filter', s.get('Y2'), 9700);
  t('SUBTOTAL(3) counts visible rows', s.get('Y3'), 3);
  t('SUBTOTAL(1) averages visible rows', s.get('Y4'), (1200 + 2400 + 3100) / 3);
  s.clearFilters();
  t('clearing the filter restores SUBTOTAL', s.get('Y1'), 9700);
}

/* --- sorting --- */
{
  const s = sheet(DATA);
  s.attachTable('A1:F7');
  s.sortBy(3, false);
  t('sorting moves whole rows', s.get('A2') + '/' + s.get('D2'), 'Moscow/3100');
  t('sorting descending puts the smallest last', s.get('D7'), 450);
  s.sortBy(3, true);
  t('sorting ascending', s.get('D2'), 450);
}

/* --- lookup --- */
const LK = { A1: 'Code', B1: 'Name', C1: 'Price', A2: 101, B2: 'Alpha', C2: 10,
             A3: 205, B3: 'Bravo', C3: 20, A4: 310, B4: 'Charlie', C4: 30 };
t('VLOOKUP exact', val('VLOOKUP(205,A2:C4,2,FALSE)', LK), 'Bravo');
t('VLOOKUP approximate', val('VLOOKUP(250,A2:C4,3,TRUE)', LK), 20);
t('VLOOKUP not found', String(val('VLOOKUP(999,A2:C4,2,FALSE)', LK)), '#N/A');
t('HLOOKUP', val('HLOOKUP("Price",A1:C4,3,FALSE)', LK), 20);
t('MATCH exact', val('MATCH("Charlie",B2:B4,0)', LK), 3);
t('INDEX + MATCH', val('INDEX(C2:C4,MATCH(101,A2:A4,0))', LK), 10);
t('INDEX in two dimensions', val('INDEX(A2:C4,2,3)', LK), 20);
t('XLOOKUP', val('XLOOKUP(310,A2:A4,B2:B4)', LK), 'Charlie');
t('XLOOKUP fallback', val('XLOOKUP(1,A2:A4,B2:B4,"none")', LK), 'none');
t('XLOOKUP next smaller', val('XLOOKUP(250,A2:A4,B2:B4,"none",-1)', LK), 'Bravo');
t('CHOOSE', val('CHOOSE(3,"a","b","c")'), 'c');
t('OFFSET', val('SUM(OFFSET(A2,0,2,3,1))', LK), 60);
t('ROWS and COLUMNS', val('ROWS(A2:C4)*COLUMNS(A2:C4)'), 9);
t('INDIRECT', val('INDIRECT("C3")', LK), 20);
t('two-way lookup', val('INDEX(A2:C4,MATCH(205,A2:A4,0),MATCH("Price",A1:C1,0))', LK), 20);

/* --- text --- */
t('LEFT, RIGHT and MID', val('LEFT("Consulting",4)&RIGHT("Consulting",3)&MID("Consulting",5,2)'), 'Consingul');
t('LEN', val('LEN("Yakov and Partners")'), 18);
t('FIND', val('FIND(" ","Yakov and Partners")'), 6);
t('SUBSTITUTE', val('SUBSTITUTE("1 000 000"," ","")'), '1000000');
t('TRIM', val('TRIM("  a   b  ")'), 'a b');
t('PROPER', val('PROPER("john smith")'), 'John Smith');
t('TEXTJOIN skips blanks', val('TEXTJOIN("-",TRUE,"a","","b")'), 'a-b');
t('VALUE', val('VALUE("1234")+1'), 1235);
t('cleaning an exported number', val('VALUE(SUBSTITUTE("1 250"," ",""))'), 1250);
t('TEXT as a percentage', val('TEXT(0.1234,"0.0%")'), '12.3%');
t('TEXT with thousands separators', val('TEXT(1234567.891,"#,##0.00")'), '1,234,567.89');
t('CONCAT', val('CONCAT("a","b","c")'), 'abc');

/* --- dates --- */
t('DATE into YEAR', val('YEAR(DATE(2024,3,15))'), 2024);
t('EOMONTH in a leap year', val('DAY(EOMONTH(DATE(2024,2,10),0))'), 29);
t('EDATE', val('MONTH(EDATE(DATE(2024,1,31),1))'), 2);
t('DATEDIF in months', val('DATEDIF(DATE(2023,1,15),DATE(2024,3,14),"m")'), 13);
t('DAYS', val('DAYS(DATE(2024,3,1),DATE(2024,2,1))'), 29);
t('YEARFRAC on a 30/360 basis', val('YEARFRAC(DATE(2024,1,1),DATE(2024,7,1),0)'), 0.5);
t('WEEKDAY type 2', val('WEEKDAY(DATE(2024,3,4),2)'), 1);
t('a typed-in date becomes a serial number', (() => { const s = sheet(DATA); return s.get('F2'); })(), XLF.ymdToSerial(2024, 1, 15));
t('NETWORKDAYS', val('NETWORKDAYS(DATE(2024,3,1),DATE(2024,3,31))'), 21);
t('quarter from a date', val('ROUNDUP(MONTH(DATE(2024,4,2))/3,0)'), 2);

/* --- finance --- */
t('NPV', val('NPV(0.1,100,100,100)'), 100 / 1.1 + 100 / 1.21 + 100 / 1.331, 1e-9);
t('IRR', val('IRR(A1:A4)', { A1: -1000, A2: 400, A3: 400, A4: 400 }), 0.09701, 1e-4);
t('PMT', val('PMT(0.08/12,120,-100000)'), 1213.276, 1e-3);
t('FV', val('FV(0.05,10,0,-1000)'), 1628.894627, 1e-6);
t('PV', val('PV(0.05,10,0,-1628.894627)'), 1000, 1e-5);
t('NPER', val('NPER(0.05,-1000,5000)'), Math.log(4 / 3) / Math.log(1.05), 1e-6);
t('RATE', val('RATE(10,-1000,8000)'), 0.04277498, 1e-6);
t('CAGR by exponent', val('(2000/1000)^(1/5)-1'), Math.pow(2, 0.2) - 1, 1e-12);
t('XNPV', val('XNPV(0.1,A1:A3,B1:B3)', { A1: -1000, A2: 600, A3: 600, B1: '01/01/2024', B2: '01/01/2025', B3: '01/01/2026' }),
  -1000 + 600 / Math.pow(1.1, 366 / 365) + 600 / Math.pow(1.1, 731 / 365), 1e-6);

/* --- array behaviour --- */
t('SUMPRODUCT with a condition', val('SUMPRODUCT((A2:A7="Moscow")*D2:D7)', DATA), 1200 + 2400 + 3100);
t('two conditions multiplied', val('SUMPRODUCT((A2:A7="Moscow")*(C2:C7="Software")*D2:D7)', DATA), 1200 + 3100);
t('conditions added behave as OR', val('SUMPRODUCT(((A2:A7="Moscow")+(A2:A7="Kazan"))*D2:D7)', DATA), 1200 + 2400 + 3100 + 450);
t('a condition against a computed average', val('SUMPRODUCT((D2:D7>AVERAGE(D2:D7))*D2:D7)', DATA), 2400 + 1750 + 3100);
t('double negation', val('SUMPRODUCT(--(A2:A7="Moscow"))', DATA), 3);

/* --- information and errors --- */
t('ISNUMBER', val('ISNUMBER(1)'), true);
t('ISBLANK', val('ISBLANK(Y50)'), true);
t('ISERROR', val('ISERROR(1/0)'), true);
t('errors propagate', String(val('SUM(1,1/0)')), '#DIV/0!');
t('#NAME? for an unknown function', String(val('NOTAFUNCTION(1)')), '#NAME?');
t('circular reference is caught', (() => {
  const s = new E.Sheet({}); s.setAt('A1', '=A2'); s.setAt('A2', '=A1');
  return String(s.get('A1'));
})(), '#CIRCULAR!');

/* --- references --- */
t('absolute reference', val('$D$2+D3', DATA), 2000);
t('translating a formula down', XLF.translate('B2-C2', 1, 0), 'B3-C3');
t('translation respects $', XLF.translate('D2/$D$9', 3, 0), 'D5/$D$9');
t('translation of mixed references', XLF.translate('$A2*B$1', 1, 1), '$A3*C$1');
t('strings are left alone when translating', XLF.translate('IF(A1>0,"A1 grew",B1)', 0, 2), 'IF(C1>0,"A1 grew",D1)');

/* --- Russian function names still work as aliases --- */
t('Russian alias СУММ', val('СУММ(D2:D7)', DATA), 9700);
t('Russian alias with semicolons', val('ЕСЛИ(2>1;"да";"нет")'), 'да');
t('Russian decimal comma', val('ОКРУГЛ(2,5;0)'), 3);
t('English commas with English names', val('IF(1>0, "y", "n")'), 'y');

/* ------------------------------------------------------------------- run */
let pass = 0, fail = 0;
T.forEach(x => {
  let ok;
  if (typeof x.expected === 'number' && typeof x.actual === 'number') ok = Math.abs(x.actual - x.expected) <= x.tol;
  else ok = x.actual === x.expected;
  if (ok) pass++;
  else { fail++; console.log('  x ' + x.name + '\n      got: ' + JSON.stringify(x.actual) + '   expected: ' + JSON.stringify(x.expected)); }
});
console.log(`\nformula engine: ${pass} passed, ${fail} failed (${T.length} checks)`);
module.exports = { pass, fail };
if (require.main === module && fail) process.exit(1);

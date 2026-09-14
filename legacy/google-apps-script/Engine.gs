/**
 * phwng.online — Payroll Engine (ES5 thuần, dùng chung cho Apps Script và trình duyệt)
 *
 * Policy row: { email, code, label, type, input_key, rate, tiers, min, note }
 *   type:
 *     fixed            → + rate (mỗi tháng)
 *     per_unit         → + rate × input[input_key]
 *     per_unit_tenure  → + rate(bậc theo thâm niên) × input   | tiers = "0:50000;3:70000;6:100000" (tháng thâm niên : đơn giá)
 *     tier             → + mức thưởng cao nhất đạt được       | tiers = "2500:300000;3750:550000"  (ngưỡng : tiền[+x%])
 *     percent          → + rate% × input  (chỉ áp dụng khi input ≥ min, nếu có min)
 *     penalty_below    → − rate nếu input < min
 *     penalty_per_unit → − rate × input
 *   Nhóm tổng hợp (theo type/code): base (code bắt đầu "base"), fees (fixed/per_unit/per_unit_tenure/percent), bonus (tier), penalty.
 */
var PayrollEngine = (function () {
  function num(v) { v = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isNaN(v) ? 0 : v; }
  function parseTiers(s) {
    return String(s || '').split(';').map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) {
      var i = p.indexOf(':'); var th = num(p.slice(0, i)); var val = p.slice(i + 1).trim();
      var amount = num(val.split('+')[0]), pct = /\+\s*([\d.]+)%/.exec(val);
      return { th: th, amount: amount, pct: pct ? Number(pct[1]) : 0 };
    }).sort(function (a, b) { return a.th - b.th; });
  }
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /**
   * @param rows   policy rows của 1 người
   * @param input  { key: value } số liệu tháng của người đó
   * @param tenure số tháng thâm niên (để áp bậc per_unit_tenure)
   */
  function computeOne(rows, input, tenure) {
    input = input || {}; tenure = num(tenure);
    var r = { base: 0, fees: 0, bonus: 0, penalty: 0, total: 0, kpi_ok: true, breakdown: [], kpi: { met: 0, total: 0, rate: 100, items: [] } };
    rows.forEach(function (p) {
      if (String(p.active) === 'false' || String(p.active) === 'FALSE') return;
      var key = p.input_key, x = num(input[key]), rate = num(p.rate), min = num(p.min), amt = 0, how = '';
      var isBase = /^base/i.test(String(p.code));
      switch (String(p.type)) {
        case 'fixed': amt = rate; how = fmt(rate) + ' đ/tháng'; break;
        case 'per_unit': if (!x) return; amt = rate * x; how = x + ' × ' + fmt(rate); break;
        case 'per_unit_tenure': {
          if (!x) return; var t = parseTiers(p.tiers), unit = 0;
          t.forEach(function (tt) { if (tenure >= tt.th) unit = tt.amount; });
          amt = unit * x; how = x + ' × ' + fmt(unit) + ' (thâm niên ' + tenure + ' th)'; break;
        }
        case 'tier': {
          var t2 = parseTiers(p.tiers), hit = null;
          t2.forEach(function (tt) { if (x >= tt.th) hit = tt; });
          if (!hit) return;
          amt = hit.amount + x * hit.pct / 100;
          how = 'đạt ' + fmt(x) + ' ≥ ' + fmt(hit.th) + (hit.pct ? ' → ' + fmt(hit.amount) + ' + ' + hit.pct + '%' : ''); break;
        }
        case 'percent': if (!x || (min && x < min)) return; amt = x * rate / 100; how = rate + '% × ' + fmt(x); break;
        case 'penalty_below': {
          var ok = x >= min;
          r.kpi.total++; if (ok) r.kpi.met++;
          r.kpi.items.push({ key: key, label: (typeof INPUT_LABELS !== 'undefined' && INPUT_LABELS[key]) || String(p.label).replace(/^Phạt\s*/i, ''), actual: x, min: min, ok: ok, pct: min ? Math.min(999, Math.round(x / min * 100)) : 100 });
          if (ok) return;
          amt = -rate; how = fmt(x) + ' < tối thiểu ' + fmt(min); r.kpi_ok = false; break;
        }
        case 'penalty_per_unit': if (!x) return; amt = -rate * x; how = x + ' × ' + fmt(rate); break;
        default: return;
      }
      if (!amt) return;
      var group = isBase ? 'base' : amt < 0 ? 'penalty' : (p.type === 'tier' || /^b_/.test(String(p.code)) || /^thưởng/i.test(String(p.label))) ? 'bonus' : 'fees';
      r[group] += amt;
      r.breakdown.push({ code: p.code, label: p.label, group: group, how: how, amount: Math.round(amt) });
    });
    r.base = Math.round(r.base); r.fees = Math.round(r.fees); r.bonus = Math.round(r.bonus); r.penalty = Math.round(r.penalty);
    r.total = r.base + r.fees + r.bonus + r.penalty;
    r.kpi.rate = r.kpi.total ? Math.round(r.kpi.met / r.kpi.total * 100) : 100;
    return r;
  }

  function monthsBetween(startDate, month) { // month = 'YYYY-MM'
    if (!startDate) return 0;
    var s = new Date(startDate), m = String(month).split('-');
    if (isNaN(s.getTime()) || m.length < 2) return 0;
    return Math.max(0, (Number(m[0]) - s.getFullYear()) * 12 + (Number(m[1]) - 1 - s.getMonth()));
  }

  return { computeOne: computeOne, monthsBetween: monthsBetween, parseTiers: parseTiers, fmt: fmt };
})();

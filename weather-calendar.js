// MyScript内置模板:v6
// 天气 + 日历 · 大号小组件（MyScript 版）
//
// 【参数（小组件配置里的「参数」字段）】
//   留空            用兜底城市
//   杭州            指定城市（联网查坐标）
//   dark / light    强制主题；不写则跟随系统（用自适应的 label/secondaryLabel）
//   8000            步数目标（纯数字那一段）
//   杭州,dark,8000  三者任意组合，顺序随便
//
// 【可用 API 速查】
//   Health.todaySteps() / Health.sum(类型, 天数) / Health.average(类型, 天数) / Health.latest(类型)
//   await fetch(url, {method, headers, body}) -> {status, ok, headers, text(), json()}
//   Storage.get/set / console.log
//   UI: view/vstack/hstack/text/image/spacer/divider/chart/progress
//   Widget.parameter / Widget.family / Widget.name / Widget.present(视图)

// 兜底坐标：改这里成你所在城市
// 杭州 30.2741,120.1551   北京 39.9042,116.4074   上海 31.2304,121.4737
// 广州 23.1291,113.2644   深圳 22.5431,114.0579   成都 30.5728,104.0668
var FALLBACK_LAT = 30.2741;
var FALLBACK_LON = 120.1551;
var FALLBACK_CITY = '杭州';

// WMO 天气码 -> 中文
var WMO_CN = {
  0: '晴', 1: '晴间多云', 2: '局部多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '毛毛雨', 53: '毛毛雨', 55: '密毛毛雨',
  56: '冻毛毛雨', 57: '冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪',
  80: '阵雨', 81: '阵雨', 82: '强阵雨',
  85: '阵雪', 86: '强阵雪',
  95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '雷暴伴冰雹'
};

// WMO 天气码 -> SF Symbol
var WMO_SYM = {
  0: 'sun.max.fill', 1: 'sun.max.fill', 2: 'cloud.sun.fill', 3: 'cloud.fill',
  45: 'cloud.fog.fill', 48: 'cloud.fog.fill',
  51: 'cloud.drizzle.fill', 53: 'cloud.drizzle.fill', 55: 'cloud.drizzle.fill',
  56: 'cloud.sleet.fill', 57: 'cloud.sleet.fill',
  61: 'cloud.rain.fill', 63: 'cloud.rain.fill', 65: 'cloud.heavyrain.fill',
  66: 'cloud.sleet.fill', 67: 'cloud.sleet.fill',
  71: 'cloud.snow.fill', 73: 'cloud.snow.fill', 75: 'cloud.snow.fill', 77: 'cloud.snow.fill',
  80: 'cloud.sun.rain.fill', 81: 'cloud.rain.fill', 82: 'cloud.heavyrain.fill',
  85: 'cloud.snow.fill', 86: 'cloud.snow.fill',
  95: 'cloud.bolt.rain.fill', 96: 'cloud.bolt.rain.fill', 99: 'cloud.bolt.rain.fill'
};
// 夜间把太阳换成月亮
var WMO_SYM_NIGHT = { 0: 'moon.stars.fill', 1: 'moon.stars.fill', 2: 'cloud.moon.fill' };

var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
var WEEK_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

// 调色板：auto 用自适应色；dark/light 写死黑白，避免浅色模式下灰字压在黑底上看不见
var PAL = { fg: 'label', sub: 'secondaryLabel' };
function setPalette(theme) {
  if (theme === 'dark') { PAL.fg = 'white'; PAL.sub = 'gray'; }
  else if (theme === 'light') { PAL.fg = 'black'; PAL.sub = 'gray'; }
  else { PAL.fg = 'label'; PAL.sub = 'secondaryLabel'; }
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function gi(v) { return Math.round(v); }

// 定位文字限长（组件里没有跑马灯，只能省略号）
function shortPlace(txt) {
  var t = String(txt || '').trim();
  if (t.length > 5) { t = t.slice(0, 5) + '…'; }
  return t;
}

function fmtTime(ts) {
  var d = new Date(Number(ts) || 0);
  if (isNaN(d.getTime())) { return ''; }
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

// 只到分钟：中号组件横向空间紧张，完整时间会被截断成 "2026-09-20..."
function fmtTimeShort(ts) {
  var d = new Date(Number(ts) || 0);
  if (isNaN(d.getTime())) { return ''; }
  return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// 当前整点，格式要和 Open-Meteo 的 hourly.time 对齐：'2026-09-18T19:00'
function isoHour(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    + 'T' + pad2(d.getHours()) + ':00';
}

function wmoText(code) { return WMO_CN[code] || '未知'; }
function wmoSymbol(code, isDay) {
  if (!isDay && WMO_SYM_NIGHT[code]) { return WMO_SYM_NIGHT[code]; }
  return WMO_SYM[code] || 'cloud.fill';
}

// 农历日的中文写法：初一..初十 / 十一..十九 / 二十 / 廿一..廿九 / 三十
// （Intl 给的是阿拉伯数字"11"，而参考图用的是"十一"）
function lunarDay(n) {
  if (n < 1 || n > 30) { return String(n); }
  var units = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (n <= 10) { return '初' + units[n]; }        // 初一..初十
  if (n < 20) { return '十' + units[n - 10]; }     // 十一..十九
  if (n === 20) { return '二十'; }
  if (n < 30) { return '廿' + units[n - 20]; }     // 廿一..廿九
  return '三十';
}

// 农历：借 Intl 的中文日历，再把"日"从阿拉伯数字换成中文写法
function lunarText(date) {
  try {
    var fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' });
    var raw = fmt.format(date);
    // Intl 有时会带上年份（丙午年八月十一），只取月日部分
    var idx = raw.indexOf('年');
    if (idx >= 0) { raw = raw.slice(idx + 1); }
    return raw.replace(/[0-9]+$/, function (digits) { return lunarDay(parseInt(digits, 10)); });
  } catch (e) {
    return '';
  }
}

// ── 参数解析 ────────────────────────────────────────────────
var rawParam = String(Widget.parameter || '').trim();
var segs = rawParam.split(',');
var paramCity = '';
var paramTheme = '';
var paramGoal = 0;
for (var si = 0; si < segs.length; si++) {
  var piece = segs[si].trim();
  var low = piece.toLowerCase();
  if (low === 'dark' || low === 'light' || low === 'auto') { paramTheme = low; }
  else if (/^[0-9]+$/.test(piece)) { paramGoal = parseInt(piece, 10); }
  else if (piece) { paramCity = piece; }
}

async function geocodeCity(name) {
  var url = 'https://geocoding-api.open-meteo.com/v1/search?name='
    + encodeURIComponent(name) + '&count=1&language=zh&format=json';
  var res = await fetch(url);
  var j = res.json();
  if (j && j.results && j.results.length) { return j.results[0]; }
  return null;
}

// ── 取数据（必须在构建视图之前全部拿到）────────────────────────
async function gather() {
  var now = new Date();
  var d = {
    year: '' + now.getFullYear(),
    monthText: (now.getMonth() + 1) + '月',
    dayNum: '' + now.getDate(),
    weekText: WEEK[now.getDay()],
    lunar: lunarText(now),
    week: [],
    city: '',
    temp: '--',
    cond: '',
    symbol: 'cloud.fill',
    hi: '',
    lo: '',
    hourly: [],
    days: [],
    theme: (paramTheme === 'light' || paramTheme === 'dark') ? paramTheme : 'auto',
    steps: 0,
    updatedText: fmtTime(now.getTime()),
    updatedAt: now.getTime(),
    stepGoal: paramGoal > 0 ? paramGoal : 6000,
    note: ''
  };

  // 本周周历条（周日 ~ 周六）
  var ws = new Date(now);
  ws.setDate(ws.getDate() - ws.getDay());
  ws.setHours(0, 0, 0, 0);
  for (var i = 0; i < 7; i++) {
    var dd = new Date(ws.getTime() + i * 86400000);
    d.week.push({
      label: WEEK_SHORT[i],
      num: '' + dd.getDate(),
      today: dd.toDateString() === now.toDateString()
    });
  }

  // 城市：参数优先，否则兜底坐标
  var lat = FALLBACK_LAT;
  var lon = FALLBACK_LON;
  var cityName = FALLBACK_CITY;
  if (paramCity) {
    var hit = await geocodeCity(paramCity);
    if (hit) {
      lat = hit.latitude;
      lon = hit.longitude;
      cityName = hit.name || paramCity;
    } else {
      cityName = paramCity;
    }
  }
  d.city = shortPlace(cityName);

  // ★ 步数：直接读 HealthKit（原版是读快捷指令写的 iCloud 文件）
  try {
    var steps = Health.todaySteps();
    d.steps = (steps === null || steps === undefined) ? 0 : Math.round(steps);
  } catch (e) {
    d.steps = 0;
    console.log('读步数失败: ' + e);
  }

  // 天气（Open-Meteo）
  try {
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4)
      + '&current=temperature_2m,weather_code,is_day'
      + '&hourly=temperature_2m,weather_code'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min'
      + '&timezone=Asia%2FShanghai&forecast_days=3';
    var res = await fetch(url);
    var j = res.json();

    var cur = j.current || {};
    if (cur.temperature_2m !== null && cur.temperature_2m !== undefined) {
      d.temp = gi(cur.temperature_2m) + '°';
    }
    d.cond = wmoText(cur.weather_code);
    d.symbol = wmoSymbol(cur.weather_code, cur.is_day === 1);

    var dl = j.daily || {};
    if (dl.temperature_2m_max && dl.temperature_2m_max.length) {
      d.hi = gi(dl.temperature_2m_max[0]) + '°';
      d.lo = gi(dl.temperature_2m_min[0]) + '°';
    }
    if (dl.time) {
      for (var k = 1; k <= 2 && k < dl.time.length; k++) {
        d.days.push({
          label: k === 1 ? '明天' : '后天',
          symbol: wmoSymbol(dl.weather_code[k], true),
          hi: gi(dl.temperature_2m_max[k]) + '°',
          lo: gi(dl.temperature_2m_min[k]) + '°'
        });
      }
    }

    var hr = j.hourly || {};
    if (hr.time && hr.time.length) {
      var nowStr = isoHour(now);
      var start = 0;
      for (var q = 0; q < hr.time.length; q++) {
        if (hr.time[q] >= nowStr) { start = q; break; }
      }
      for (var wi = start; wi < hr.time.length && d.hourly.length < 6; wi++) {
        d.hourly.push({
          hour: hr.time[wi].slice(11, 13) + '时',
          temp: gi(hr.temperature_2m[wi]) + '°',
          tempNum: hr.temperature_2m[wi],
          symbol: wmoSymbol(hr.weather_code[wi], true)
        });
      }
    }
  } catch (err) {
    d.note = '天气获取失败';
    console.log('天气失败: ' + err);
  }

  return d;
}

// ── 顶部：年月 + 农历 + 大号日数 + 周几 + 步数 ────────────────
function headerBlock(d) {
  return hstack({ spacing: 9, align: 'center' }, [
    vstack({ spacing: 0 }, [
      text(d.year, { font: 'caption2', color: PAL.sub }),
      text(d.monthText, { font: 'title3', weight: 'semibold', color: PAL.fg }),
      d.lunar ? text(d.lunar, { font: 'caption2', color: PAL.sub }) : null
    ]),
    text(d.dayNum, { font: 'largeTitle', weight: 'bold', color: PAL.fg }),
    text(d.weekText, { font: 'headline', color: PAL.fg }),
    spacer(),
    stepBlock(d, true, false)
  ]);
}

// ── 周历条 ──────────────────────────────────────────────────
function weekStrip(d) {
  var cells = [];
  for (var i = 0; i < d.week.length; i++) {
    var w = d.week[i];
    var kids = [
      text(w.label, { font: 'caption2', color: w.today ? 'systemRed' : PAL.sub })
    ];
    kids.push(w.today
      ? text(w.num, { font: 'subheadline', weight: 'bold', color: 'white',
                      padding: 5, background: 'systemRed', cornerRadius: 99 })
      : text(w.num, { font: 'subheadline', color: PAL.sub, padding: 5 }));
    cells.push(vstack({ spacing: 4, align: 'center', frame: { maxWidth: 'infinity' } }, kids));
  }
  return hstack({ spacing: 0, align: 'center' }, cells);
}

// ── 天气主区 ────────────────────────────────────────────────
function weatherBlock(d) {
  return hstack({ spacing: 0, align: 'center' }, [
    vstack({ spacing: 2, frame: { maxWidth: 'infinity' } }, [
      hstack({ spacing: 8, align: 'baseline' }, [
        text(d.temp, { font: 'largeTitle', weight: 'bold', color: PAL.fg }),
        text(d.cond, { font: 'subheadline', color: PAL.fg })
      ]),
      d.hi ? text('最高 ' + d.hi + ' · 最低 ' + d.lo, { font: 'caption2', color: PAL.sub }) : null
    ]),
    image(d.symbol, { frame: { width: 32, height: 32 }, color: 'systemYellow' })
  ]);
}

// ── 逐小时折线图 ────────────────────────────────────────────
function chartBlock(d, compact) {
  if (d.hourly.length === 0) { return null; }
  var marks = [];
  var values = [];
  for (var i = 0; i < d.hourly.length; i++) {
    marks.push({ label: d.hourly[i].hour, value: d.hourly[i].tempNum, symbol: 'circle' });
    values.push(d.hourly[i].tempNum);
  }
  // 纵轴按这批温度的实际范围自适应（从 0 开始会把曲线挤成直线）
  var tmin = Math.floor(Math.min(values) - 1);
  var tmax = Math.ceil(Math.max(values) + 1);
  if (tmax - tmin < 3) { tmax = tmin + 3; }

  var chartNode = chart({
    style: 'line', height: compact ? 44 : 56, curved: true,
    yMin: tmin, yMax: tmax, marks: marks
  });
  if (compact) { return chartNode; }
  return vstack({ spacing: 4, frame: { maxWidth: 'infinity' } }, [
    text('逐小时预报', { font: 'caption2', color: PAL.sub }),
    chartNode
  ]);
}

// ── 城市 + 明天 / 后天 ──────────────────────────────────────
function daysBlock(d, withToday, compact) {
  var cells = [];
  // 天气失败时把原因直接显示出来：组件在另一个进程里跑，
  // 不显示出来就只能看到 "--" 而不知道是网络问题还是解析问题
  var placeText = d.city || '定位中';
  var placeColor = PAL.sub;
  if (d.note) {
    placeText = d.note;
    placeColor = 'systemRed';
  }
  cells.push(hstack({ spacing: 3, align: 'center' }, [
    image(d.note ? 'exclamationmark.triangle.fill' : 'location.fill',
          { frame: { width: 9, height: 9 }, color: placeColor }),
    text(placeText, { font: 'caption2', color: placeColor, lineLimit: 1, truncation: 'middle' })
  ]));

  // 中号（compact）：四个格子**均匀铺开**（参考图就是这个排法），
  //   定位贴左边缘，其余按等宽分布；文字允许缩到 80%，铺开也不会截断。
  // 大号：保持自然宽度（用户明确说大号不要再动）。
  var cellProps = compact ? { frame: { maxWidth: 'infinity' } } : {};
  var fitProps = compact ? { minimumScaleFactor: 0.8 } : {};

  function sub(p) { var o = {}; for (var k in p) { o[k] = p[k]; } return o; }
  function merge(a, b) { var o = {}; for (var k in a) { o[k] = a[k]; } for (var k in b) { o[k] = b[k]; } return o; }

  if (withToday && d.hi) {
    cells.push(hstack(merge({ spacing: 4, align: 'center' }, cellProps), [
      text('今天', merge(merge({ font: 'caption2', color: PAL.sub, lineLimit: 1 }, fitProps), {})),
      text(d.lo.replace('°', '') + '/' + d.hi,
           merge({ font: 'caption2', weight: 'semibold', color: PAL.fg, lineLimit: 1 }, fitProps))
    ]));
  }

  // 与参考图一致：中号也是「城市 + 今天 + 明天 + 后天」四条
  //（参考图里中间那条同样会被截断，这是空间所限，不是 bug）。
  // i < d.days.length 是兜底：天气取失败时 d.days 为空数组，
  // 只判条数会取到 undefined 并在构建视图时抛错（已踩过）。
  for (var i = 0; i < d.days.length; i++) {
    var x = d.days[i];
    cells.push(hstack(merge({ spacing: 4, align: 'center' }, cellProps), [
      text(x.label, merge({ font: 'caption2', color: PAL.sub, lineLimit: 1 }, fitProps)),
      image(x.symbol, { frame: { width: 15, height: 15 }, color: PAL.sub }),
      text(x.lo.replace('°', '') + '/' + x.hi,
           merge({ font: 'caption2', weight: 'semibold', color: PAL.fg, lineLimit: 1 }, fitProps))
    ]));
  }
  return hstack({ spacing: compact ? 10 : 9, align: 'center' }, cells);
}

// ── 中号：日期 / 天气 挤在一行 ──────────────────────────────
function headerRow(d) {
  return hstack({ spacing: 9, align: 'center' }, [
    vstack({ spacing: 1, frame: { maxWidth: 'infinity' } }, [
      hstack({ spacing: 6, align: 'center' }, [
        image(d.symbol, { frame: { width: 24, height: 24 }, color: 'systemYellow' }),
        text(d.temp, { font: 'title3', weight: 'bold', color: PAL.fg, lineLimit: 1 })
      ]),
      text(d.cond, { font: 'caption2', color: PAL.sub, lineLimit: 1 })
    ]),
    divider(),
    vstack({ spacing: 0 }, [
      hstack({ spacing: 5, align: 'baseline' }, [
        text(d.monthText, { font: 'caption2', color: PAL.sub, lineLimit: 1 }),
        text(d.dayNum, { font: 'title2', weight: 'bold', color: PAL.fg, lineLimit: 1 }),
        // 中号宽度紧张：允许缩到 75%，避免"周一"被截成省略号
        text(d.weekText, { font: 'subheadline', color: PAL.fg, lineLimit: 1,
                           minimumScaleFactor: 0.75 })
      ]),
      d.lunar ? text(d.lunar, { font: 'caption2', color: PAL.sub }) : null
    ]),
    divider(),
    spacer(),
    stepBlock(d, true, true)
  ]);
}

// ── 步数（★ 数据来自 HealthKit）──────────────────────────────
function stepBlock(d, withTime, compact) {
  var hasData = d.steps > 0;
  var reached = hasData && d.steps >= d.stepGoal;
  var kids = [];

  var timeText = compact ? fmtTimeShort(d.updatedAt) : d.updatedText;
  if (withTime && timeText) {
    kids.push(hstack({ spacing: 3, align: 'center' }, [
      image('arrow.clockwise', { frame: { width: 9, height: 9 }, color: PAL.sub }),
      text(timeText, { font: 'caption2', color: PAL.sub, lineLimit: 1 })
    ]));
  }
  if (hasData) {
    kids.push(reached
      ? text('已达标', { font: 'caption2', weight: 'semibold', color: 'systemGreen', lineLimit: 1 })
      : text('再走走吧', { font: 'caption2', weight: 'semibold', color: 'systemOrange', lineLimit: 1 }));
  }
  kids.push(hstack({ spacing: 4, align: 'center' }, [
    image('figure.walk', { frame: { width: 15, height: 15 }, color: PAL.sub }),
    text(hasData ? String(d.steps) : '-', { font: 'headline', weight: 'bold', color: PAL.fg }),
    hasData ? text('步', { font: 'caption2', color: PAL.sub }) : null
  ]));

  return vstack({ spacing: 0, align: 'trailing' }, kids);
}

// ── 拼装 ────────────────────────────────────────────────────
function buildView(d) {
  setPalette(d.theme);

  var fam = String(Widget.family || '');
  var compact = fam.indexOf('Medium') >= 0 || fam.indexOf('Small') >= 0;
  var tiny = fam.indexOf('Small') >= 0;

  // auto 主题不设背景，让系统组件背景透出来（label/secondaryLabel 会自适应）；
  // 只有显式 dark/light 才写死黑白
  var rootProps = { spacing: compact ? 7 : 9, padding: compact ? 11 : 13 };
  if (d.theme === 'light') { rootProps.background = 'white'; }
  if (d.theme === 'dark') { rootProps.background = 'black'; }

  var kids = [];
  if (compact) {
    kids.push(headerRow(d));
    kids.push(divider());
    kids.push(chartBlock(d, true));
    if (!tiny) {
      kids.push(divider());
      kids.push(daysBlock(d, true, true));
    }
  } else {
    kids.push(headerBlock(d));
    kids.push(weekStrip(d));
    kids.push(divider());
    kids.push(weatherBlock(d));
    kids.push(chartBlock(d, false));
    kids.push(divider());
    kids.push(daysBlock(d, false, false));
  }
  return view(rootProps, kids);
}

// ── 入口 ────────────────────────────────────────────────────
var data = await gather();
console.log('步数=' + data.steps + ' 城市=' + data.city + ' 温度=' + data.temp + (data.note ? ' (' + data.note + ')' : ''));
Widget.present(buildView(data), { date: new Date(Date.now() + 30 * 60 * 1000) });
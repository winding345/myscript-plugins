// MyScript内置模板:sync5
// 从任意 HTTP 来源同步脚本（GitHub / 自己的服务器 / 别人的插件源）
//
// 【怎么用】
//   1) 预览面板的「参数」里填来源地址，然后运行；
//   2) 或者把地址写死在下面的 DEFAULT_SOURCE 里。
//
// 【两种来源都支持】
//   A. 索引文件 index.json（推荐，可一次装多个，方便分享）：
//        { "scripts": [ { "name": "天气 + 日历", "file": "weather-calendar.js" } ] }
//      放在 GitHub 仓库里 -> 用 raw 地址：
//        https://raw.githubusercontent.com/用户名/仓库名/main/index.json
//   B. 单个 .js 文件：脚本名取文件名
//        https://raw.githubusercontent.com/用户名/仓库名/main/weather-calendar.js
//
// 同名脚本会**原地覆盖代码（id 不变）**，桌面小组件的绑定不受影响。

// 默认来源：用户的 GitHub 插件源仓库（本机服务不会常驻，所以默认走 GitHub）
var DEFAULT_SOURCE = 'https://raw.githubusercontent.com/winding345/myscript-plugins/main/index.json';

// 统一处理 GitHub 的网页地址 -> raw 地址（用户常常直接复制浏览器地址栏）
function toRawURL(u) {
  var s = String(u).trim();
  // https://github.com/用户/仓库/blob/main/路径 -> raw
  if (s.indexOf('github.com') >= 0 && s.indexOf('/blob/') >= 0) {
    s = s.replace('https://github.com/', 'https://raw.githubusercontent.com/')
         .replace('/blob/', '/');
  }
  return s;
}

// 从脚本代码里取出版本标记，如 "// MyScript内置模板:v11" -> "v11"
function versionTag(code) {
  if (!code) { return ''; }
  var m = String(code).match(/MyScript内置模板:(v[0-9]+)/);
  return m ? m[1] : '';
}

function baseDir(u) {
  var i = String(u).lastIndexOf('/');
  return i > 0 ? String(u).slice(0, i + 1) : String(u);
}

function fileNameOf(u) {
  var s = String(u).split('?')[0];
  var i = s.lastIndexOf('/');
  var name = i >= 0 ? s.slice(i + 1) : s;
  if (name.slice(-3) === '.js') { name = name.slice(0, -3); }
  return name || '未命名脚本';
}

// 支持**多个来源**：换行、逗号、空格分隔都行，逐个同步。
// 例：参数里填
//   https://raw.githubusercontent.com/你/插件源/main/index.json
//   http://10.221.148.177:8080/scripts/index.json
var rawParam = String(Widget.parameter || '').trim();
var sourceList = (rawParam || DEFAULT_SOURCE)
  .split(/[\s,]+/)
  .map(function (s) { return s.trim(); })
  .filter(function (s) { return s.length > 0; })
  .map(toRawURL);

var lines = [];
var okCount = 0;
var failCount = 0;

function report(title, color) {
  // 注意：这里不能用 PAL —— 那是天气脚本自己的变量，不是引擎全局（踩过）
  var kids = [ text(title, {font: 'headline', color: color || 'label'}) ];
  for (var i = 0; i < lines.length; i++) {
    kids.push(text(lines[i], {font: 'caption2', color: 'secondaryLabel'}));
  }
  for (var k = 0; k < sourceList.length; k++) {
    kids.push(text('来源：' + sourceList[k], {font: 'caption2', color: 'secondaryLabel', lineLimit: 2}));
  }
  if (okCount > 0) {
    kids.push(text('✓ 已更新 ' + okCount + ' 个脚本，回桌面或脚本列表查看',
                   {font: 'caption2', color: 'systemGreen'}));
  }
  return view({spacing: 4}, kids);
}

// ⚠️ 这里**不要**给 URL 加时间戳参数（如 ?t=Date.now()）来绕 CDN 缓存。
// 引擎是"第一遍收集 URL、第二遍注入响应"的两遍模型，时间戳每次都变会让
// 两遍的 key 对不上，结果是取不到任何响应（表现为"响应尚未取得"），
// 整个同步脚本失效 —— 这个 bug 真实发生过。
// GitHub raw 的 CDN 缓存只能靠"等几分钟"规避。

// ── 同步单个来源（索引文件或单个 .js）──
async function syncOne(source) {
  var res = await fetch(source);
  var body = res.text();
  if (res.status !== 200 || body.length === 0) {
    failCount++;
    lines.push('✗ ' + source + '：' + (res.error || ('HTTP ' + res.status)));
    return;
  }

  var isIndex = false;
  var index = null;
  if (body.charAt(0) === '{') {
    try { index = JSON.parse(body); } catch (e) { index = null; }
    if (index && index.scripts && index.scripts.length) { isIndex = true; }
  }

  if (!isIndex) {
    Scripts.upsert(fileNameOf(source), body);
    okCount++;
    lines.push('✓ ' + fileNameOf(source) + '（' + body.length + ' 字节）');
    return;
  }

  var dir = baseDir(source);
  for (var i = 0; i < index.scripts.length; i++) {
    var item = index.scripts[i];
    var fileURL = String(item.file || '').indexOf('http') === 0 ? item.file : (dir + item.file);
    var one = await fetch(fileURL);
    var code = one.text();
    if (one.status === 200 && code.length > 0) {
      var scriptName = String(item.name || fileNameOf(fileURL));
      // 更新提示：比较本地与新版的内置模板版本标记（形如 // MyScript内置模板:v11）
      var localCode = Scripts.get(scriptName);
      var localVer = versionTag(localCode);
      var remoteVer = versionTag(code);
      Scripts.upsert(scriptName, code);
      okCount++;
      if (localVer && remoteVer && localVer !== remoteVer) {
        lines.push('↑ ' + scriptName + '：' + localVer + ' → ' + remoteVer + '（已更新）');
      } else if (!localVer) {
        lines.push('＋ ' + scriptName + '：新安装（' + code.length + ' 字节）');
      } else {
        lines.push('＝ ' + scriptName + '：已是最新（' + remoteVer + '）');
      }
    } else {
      failCount++;
      lines.push('✗ ' + (item.name || item.file) + '：' + (one.error || ('HTTP ' + one.status)));
    }
  }
}

for (var si = 0; si < sourceList.length; si++) {
  await syncOne(sourceList[si]);
}

return report(sourceList.length > 1 ? '同步完成（' + sourceList.length + ' 个来源）' : '脚本同步完成',
              failCount ? 'systemOrange' : 'systemGreen');
# MyScript 插件源

给 **MyScript**（iOS 自用脚本小组件 App）用的脚本源。
放在 GitHub 上就是一个可分享的"插件源"，别人填你的 raw 地址即可一键安装。

## 别人的安装方式

**方式一（推荐）：App 内粘贴链接**
1. 打开 MyScript → 脚本页 → **从 URL 导入脚本**
2. 粘贴：

```
https://raw.githubusercontent.com/<你的用户名>/<仓库名>/main/index.json
```

（直接粘贴浏览器里的 `github.com/.../blob/...` 地址也行，App 会自动转成 raw）

**方式二：跑「同步脚本」**
在 App 里新建「同步脚本」，把上面的链接填进预览面板的**参数**框，然后运行。

## 当前包含的插件

| 脚本 | 说明 |
|---|---|
| 天气 + 日历 | 大号/中号小组件：实时天气（Open-Meteo）、逐小时折线、周历、农历、步数（直读 HealthKit） |
| 同步脚本 | 从任意 HTTP 来源同步脚本（就是它自己所在的这套机制） |

## 加自己的插件

1. 把 `.js` 文件放到仓库里
2. 在 `index.json` 的 `scripts` 数组里加一项：

```json
{ "name": "脚本名（决定覆盖谁，同名即覆盖）", "file": "your-script.js" }
```

3. 提交推送即可。**同名脚本是原地覆盖代码、脚本 id 不变**，
   所以已绑定到桌面小组件的脚本更新后不需要重新配置。

## 脚本能用的 API（速查）

```
Health.todaySteps() / Health.sum(类型,天数) / Health.average(类型,天数) / Health.latest(类型)
await fetch(url, {method, headers, body}) -> {status, ok, headers, text(), json()}
Storage.get/set/remove          // 每个脚本自己的持久存储
Scripts.list() / Scripts.get(名) / Scripts.upsert(名, 代码)   // 操作其它脚本
console.log(...)

// 界面（hyperscript 风格：JSX 编译后的形态，不需要转译器）
view/vstack/hstack/text/image/spacer/divider/chart/progress
props: font / weight / color（支持 systemRed、secondaryLabel、#RRGGBB）/ spacing / padding /
       frame({maxWidth:'infinity'}) / background / cornerRadius / lineLimit …

Widget.parameter / Widget.family / Widget.name / Widget.present(视图, {date})
```

## 更新本仓库里的脚本

这些脚本由主工程的 `scripts/export-templates.sh` 从内置模板导出，
改脚本请在主工程改内置模板后重新导出，避免两处不一致。

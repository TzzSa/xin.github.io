# 我们的小日子 💛

一个属于两个人的小站：恋爱计时器 + 四个默契小游戏。纯 HTML / CSS / JavaScript，无需构建、无需后端，数据保存在浏览器本地，可直接用 GitHub Pages 免费托管。

## 功能

**恋爱计时器**

- 实时显示「在一起 X 天 X 时 X 分 X 秒」，每秒跳动
- 纪念日管理：支持年度重复（生日、周年）和一次性（见面日、100 天）
- 最近一个纪念日以进度环呈现，列表按临近程度自动排序

**八个互动小游戏**

| 游戏 | 玩法 |
|---|---|
| 💌 默契大考验 | 10 道关于对方的题，两人各答一遍；完全一致记满分，语义包含记部分分，算出默契度百分比并逐题对照 |
| 🎡 今天听谁的 | 可自定义 2–8 个选项的转盘，专治「今晚吃什么」 |
| ✨ 今日份刮刮卡 | 12 条情话 / 小任务，刮开查看，每天自动换一张 |
| 💛 爱心手速 PK | 30 秒点击爱心，连击有加成，成绩进排行榜 |
| ⏱ 十秒挑战 | 心里默数 10 秒按停，看各自误差；两人都有成绩时额外给出「同步率」评级 |
| 🧠 记忆翻牌 | 4×4 配对，默认图案卡，可换成「你们专属的 8 个词」；记录最少步数 |
| 🎨 你画我猜 | Canvas 画板 + 30 个词 + 60 秒倒计时；画完自动盖上，递给 TA 猜完再揭晓 |
| 🎯 真心话大冒险 | 真心话 / 大冒险 / 随便三种模式，随机抽取不重复，题库可自定义 |

## 本地预览

双击 `index.html` 即可打开。若浏览器限制了本地文件，用任意静态服务器：

```bash
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## 部署到 GitHub Pages

**第一步：创建仓库**

在 GitHub 新建仓库（Public 才能用免费 Pages），例如起名 `our-days`。

**第二步：上传文件**

把本目录内容推到仓库的 `main` 分支（保留 `assets/` 目录结构）：

```bash
git init
git add .
git commit -m "init: 我们的小日子"
git branch -M main
git remote add origin https://github.com/<你的用户名>/our-days.git
git push -u origin main
```

也可以直接在 GitHub 网页端用「Add file → Upload files」拖拽上传，注意 `assets/` 里的三个文件都要传。

**第三步：开启 Pages**

仓库页面 → **Settings** → 左侧 **Pages** → Source 选 **Deploy from a branch** → Branch 选 `main`、目录选 `/ (root)` → **Save**。

等约 1 分钟，访问：

```
https://<你的用户名>.github.io/our-days/
```

> 资源全部用相对路径引用，所以仓库名是什么都能正常访问，不需要改代码。
> 如果之后改了仓库名，链接会变，但页面不需要重新配置。

**想要私人一点？**

仓库设为 Private 后，Pages 需要付费套餐。免费方案下建议：仓库保持 Public，但不在 README 里写真名，链接只发给对方。

## 改成你们自己的

所有内容都在源码里，改完 push 即生效。

| 想改什么 | 改哪里 |
|---|---|
| 问答题库 | `assets/app.js` 的 `QUESTIONS` 数组（10 条，随意增减） |
| 刮刮卡文案 | `assets/app.js` 的 `CARDS` 数组（12 条） |
| 转盘默认选项 | `assets/app.js` 的 `DEFAULT_WHEEL` 数组 |
| 翻牌图案 | `assets/app.js` 的 `MEMO_EMOJI` 数组（8 个） |
| 你画我猜词库 | `assets/app.js` 的 `DRAW_WORDS` 数组（30 个，重复无害） |
| 真心话 / 大冒险 | `assets/app.js` 的 `DEFAULT_TRUTH` / `DEFAULT_DARE` 数组 |
| 配色 | `assets/style.css` 顶部的 `:root` 变量 |
| 网站标题 | `index.html` 的 `<title>` 与 `.brand h1` |
| 手速游戏时长 | `assets/app.js` 里 `startTap()` 的 `DUR`（默认 30000 毫秒） |
| 画画时长 | `assets/app.js` 里 `startDrawTimer()` 的 `draw.left = 60`（秒） |

配色改法示例——把奶油暖白换成温柔粉紫，只需改这几个变量：

```css
:root{
  --cream:   #FDFBFF;
  --cream-2: #F5EEFB;
  --honey:   #C89BE8;
  --honey-d: #9B6BC4;
  --peach:   #E3CDF5;
  --line:    #EDE4F6;
}
```

## 数据存在哪

全部保存在浏览器 `localStorage`，**不会上传到任何服务器**。这意味着：

- 换设备或清理浏览器数据会丢失，可用设置里的「导出备份」生成口令保存
- 计时器和游戏各自独立可用；留言类功能因无后端，需要两人用同一台设备
- 无痕模式下数据不保留

## 目录结构

```
.
├── index.html          # 页面结构
├── assets/
│   ├── style.css       # 样式（奶油暖白）
│   ├── core.js         # 纯逻辑：日期、比对、存储（无 DOM 依赖，可单测）
│   └── app.js          # 交互与游戏
└── README.md
```

## 浏览器支持

Chrome / Edge / Safari / Firefox 现代版本，移动端与桌面端均已适配（含刘海屏安全区与触摸目标尺寸）。刮刮卡使用 Canvas，转盘使用 CSS `conic-gradient`，两者在现代浏览器中广泛支持。

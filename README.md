# dsh-plugin-github-radar

DSH 的客户端插件：在 Web GUI 里开一个「GitHub 雷达」面板，看今天/本周/本月在涨的仓库，收藏，读 README（可一键翻成中文），标星，浅克隆到本地。

它不是独立网页——就是 DSH 自己的一个全局面板，占 `main` 槽，左栏有一个入口，样式跟随主题（亮/暗都吃 `--dsw-alias-*` token）。

![面板](docs-panel.png)

## 结构

```
dsh-plugin-github-radar/
├── package.json      # dsh.client.platform=web，导出 ./client
├── lib/index.js      # 宿主半侧：/github-radar/api/*、抓取、克隆、登录、翻译
├── lib/client.js     # 浏览器半侧：__ModuleLoader__ bundle，注册 main + 侧栏入口
└── docs-panel.png
```

- **宿主**负责所有脏活：抓 `github.com/trending`、取 `raw.githubusercontent.com` 的 README、`git clone --depth 1`、调模型翻译。浏览器直连 GitHub 会被 CORS 挡住，所以这些必须在宿主做。
- **浏览器**只做 UI，`fetch('/github-radar/api/...')` 同源调用，不用额外端口、不用起第二个进程。

## 两个可选能力

### README 中文翻译

README 弹层右上角有「原文 / 中文」。点「中文」时宿主把 README 切成**代码块**和**正文段**两类：

- 代码块原样保留、直接输出，既不会被翻坏，也不会被喂给模型让它接着往下写
- 正文按段落切段，逐段调用当前 DSH 配置的模型（`ctx.llm`，默认取 `deepseek-account` / `deepseek-flash`），SSE 流式回传，边翻边看
- 单段空回复就退回原文并标注，不会让整篇失败
- **分批翻译**：每次约 12000 字符；翻到这批的末尾时，正文末尾和弹层底部都会出现「继续翻译（剩 N 字）」，点一下再翻下一批
- 每翻完一批就落盘，中途关掉弹层不白翻；下次打开先显示已翻的部分，还能从断点继续
- 结果缓存在 `~/Data/github-radar/translations/<owner>__<repo>__<engine>.json`，按引擎分开存；**每翻完一段就落盘**，中途关掉弹层也不白翻，下次直接读缓存
- 「重新翻译」强制重跑；换引擎会各存一份，互不覆盖

用的是你 DSH 里已经配好的模型，不额外要 key。没挂模型的 profile 会直接报「没有挂载任何模型服务」。

**引擎可选**（README 弹层左下角的下拉）：

| 引擎 | 说明 |
| --- | --- |
| 任意已配置的模型 | 从 `ctx.llm` 里列出来，`flash / mini / lite / small` 这类小模型排在最前，默认就用它 |
| Google 翻译 | 官方 Cloud Translation API **v2，需要一个 API key**；没有 key 时选它会弹出配置框 |
| 免费机翻 · MyMemory | 不花模型额度，但**限制很死**：单次 500 字符、每天约 1000 词，翻两个 README 就可能 429。限流时会自动退回模型继续 |

#### 接入 Google 翻译

需要 key，官方接口不接受匿名调用（免费的那个 `translate_a/single?client=gtx` 端点不用 key，但这台机器上直接被限流返回 Sorry 页，不可用）。

1. GCP 控制台启用 **Cloud Translation API**
2. 创建 API key（建议加限制：只允许 Translation API）
3. 面板里把引擎切到「Google 翻译」，粘 key，保存时会先翻一个词验证

key 存 `~/Data/github-radar/google.json`（权限 600），验证失败会立即删除。计费按字符：**每月 50 万字符免费**，超出约 $20/百万字符——翻译一篇 1.2 万字符的 README 大约消耗月度额度的 1/40。注意它比 deepseek-flash 翻同样内容贵一两个数量级，选它的理由通常是「不想动模型额度」或「手上有 GCP 额度」。

选择存在 `~/Data/github-radar/settings.json`。翻译这种活确实不需要强模型——如果以后在 DSH 里配了本地或免费的提供方，它会直接出现在这个下拉里。

### GitHub 登录

右上角「登录 GitHub」，两种来源：

1. 直接粘贴 Personal Access Token（classic 要 `repo` 范围；fine-grained 要仓库读权限）
2. 什么都不填，终端里跑 `gh auth login`——插件会自动复用 `gh auth token`

登录后能做：

| 能力 | 未登录 | 登录后 |
| --- | --- | --- |
| 趋势榜单、README、翻译 | ✅ | ✅ |
| 克隆公开仓库 | ✅ | ✅ |
| 克隆私有仓库 | ❌ | ✅ |
| 面板内直接标星 / 取消 | ❌（点了会提示登录） | ✅ |
| GitHub API 额度 | 60 次/小时 | 5000 次/小时 |

token 存在 `~/Data/github-radar/auth.json`，写入后 chmod 600。克隆时通过 `GIT_CONFIG_*` 环境变量传 header，token 不会进 argv、也不会写进 `.git/config`。

## 安装

插件按 DSH 的组合包（bundle）格式发布，一条命令：

```bash
dsh plugin --profile desktop add dsh-plugin-github-radar   # npm 发布之后
dsh plugin --profile desktop add file:/绝对路径/github-radar-plugin  # 本地目录
```

它会同时写进 profile 的 `dependencies` 和 `dsh.profile.bundles`，条目由包内 `cordis.patch.yml` 提供，不用手工改配置。

`dsh.bundle` 这个声明是社区目录的硬性要求——只声明 `dsh.client` 的包不可一键安装。本包两者都有。

## 分享出去

### 方式一：发布到 npm

```bash
cd github-radar-plugin
npm publish --access public
```

包名、`dsh.bundle`、`files`、`engines.dsh` 都已就位；`lib/client.js` 是构建产物（本插件没有构建步骤，手写即产物），发布后直接可用。

### 方式二：进社区目录（推荐）

[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 是社区维护的插件目录，也是 DSH「插件 → 发现」里默认可用的市场索引（当前 4000+ 条）。

提交方式：给那个仓库提 PR，只加一个文件 `data/plugins/<owner>__<repo>.yml`：

```yaml
url: https://github.com/1578361862-art/dsh-plugin-github-radar
name: 1578361862-art/dsh-plugin-github-radar
category: ui
description:
  en: GitHub trending board with one-click clone and README translation.
  zh: GitHub 趋势看板，一键克隆与 README 机翻。
```

要求：

- 仓库公开，且**创建满 1 天**（新仓库可以过一天再提交）
- 仓库打上 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic
- `package.json` 里声明 `dsh.bundle`

### 方式三：自建索引

不想等 PR，也可以把 format-1 索引 JSON 放在任意 https 地址（GitHub Pages、Gist raw、自己的域名），别人在「插件 → 发现 → 添加索引源」里填 URL 即可：

```json
{
  "format": 1,
  "title": "dsh-plugin-github-radar",
  "plugins": [
    {
      "name": "dsh-plugin-github-radar",
      "title": { "en": "GitHub Radar", "zh": "GitHub 雷达" },
      "author": "you",
      "homepage": "https://github.com/1578361862-art/dsh-plugin-github-radar",
      "repository": { "url": "https://github.com/1578361862-art/dsh-plugin-github-radar" },
      "metadata": { "keywords": ["github", "trending"] },
      "versions": [
        {
          "version": "0.1.0",
          "publishTimestamp": 1762300000,
          "source": { "type": "npm" },
          "engines": { "dsh": ">=0.2.1-rc.5" }
        }
      ]
    }
  ]
}
```

`source` 也可以是 git：`{ "type": "git", "url": "https://github.com/you/github-radar", "commit": "<40 位小写 SHA>", "path": "github-radar-plugin" }`。索引本身必须 https 托管。

### 安全提醒

市场插件以宿主权限运行，能读写文件、起进程、访问网络。装别人的插件前看清来源；自己的插件分享出去也最好在 README 里写清楚它动了哪些路径。

## 用法速查

| 操作 | 结果 |
| --- | --- |
| 今日 / 本周 / 本月 | 切 trending 时间范围 |
| 语言下拉 | 只看某个语言（18 种） |
| 过滤框 | 按仓库名、描述、语言筛 |
| 克隆 | `git clone --depth 1` 到 `~/Code/<owner>__<repo>` |
| 收藏 | 收进右侧收藏夹，存 `~/Data/github-radar/collection.json` |
| README | 弹层看，Markdown 正常渲染，可切中文（引擎可选） |
| ☆ | 在 GitHub 标星（需登录） |
| ↗ | 去 GitHub |

## 数据

按家目录规则分两处：

```
~/Data/github-radar/          # 插件自己的状态
├── auth.json                 # 登录 token（600）
├── collection.json           # 收藏夹
└── translations/*.json       # 译文缓存

~/Code/<owner>__<repo>/       # 克隆下来的仓库，都是普通 git 仓库
```

克隆目录用 `owner__repo` 而不是裸仓库名：`~/Code` 下可能已有同名目录，加前缀才不会把别人的仓库当成「已经在本地了」。两个根都可以用环境变量覆盖：`GITHUB_RADAR_CODE`、`GITHUB_RADAR_HOME`。

## 卸载

```bash
dsh plugin --profile desktop remove dsh-plugin-github-radar
```

本地目录装的，再删掉 `~/.dsh/profiles/desktop/node_modules/dsh-plugin-github-radar` 这个软链。数据目录 `~/Data/github-radar` 与 `~/Code` 下已克隆的仓库不会被删除，需要的话自己清。

## 接口（宿主）

```
GET    /github-radar/api/trending?since=daily|weekly|monthly&lang=
GET    /github-radar/api/state
POST   /github-radar/api/collection   {action:'add'|'remove', item}
POST   /github-radar/api/clone        {owner, repo}
GET    /github-radar/api/readme?owner=&repo=
POST   /github-radar/api/reveal       {dir}
GET    /github-radar/api/auth
POST   /github-radar/api/auth         {token}
DELETE /github-radar/api/auth
GET    /github-radar/api/engines
POST   /github-radar/api/engines     {engine}
POST   /github-radar/api/google      {key}
DELETE /github-radar/api/google
GET    /github-radar/api/stars?repos=a/b,c/d
POST   /github-radar/api/star         {owner, repo, star}
POST   /github-radar/api/translate    {owner, repo, force}   → SSE
```

## 已知限制

- 解析的是 `github.com/trending` 的 HTML，未登录访问只有 **15 条**；GitHub 改版会失灵（页面显示「这次没扫到」）。
- 榜单在宿主内存里缓存 10 分钟。
- 克隆是浅克隆，需要完整历史就进目录 `git fetch --unshallow`。
- 翻译一次最多约 12000 字符，长 README 的后半段保留原文。
- README 渲染是内置的轻量解析器（不引第三方库）：裸 HTML 会被去掉只留文字，`<details>` 折叠块会被摊平。
- 客户端 `apply` 和翻译都包了 try/catch：插件自身出错只打日志，不会拖垮 Web 启动。

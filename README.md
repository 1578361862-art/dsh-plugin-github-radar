# GitHub 雷达 · dsh-plugin-github-radar

> 在 DSH 的 Web GUI 里开一块「GitHub 雷达」面板：看今天 / 本周 / 本月在涨的仓库，收藏、读 README（可一键翻成中文）、标星、浅克隆到本地。

![DSH](https://img.shields.io/badge/DSH-%E2%89%A5%200.2.1--rc.5-4f46e5?style=flat-square)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Platform](https://img.shields.io/badge/platform-web-0ea5e9?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)

![GitHub 雷达面板](docs-panel.png)

它是 DSH 自己的全局面板，不是独立网页：占 `main` 槽，左栏有入口，亮 / 暗主题跟随 `--dsw-alias-*`。所有外部请求都由宿主半侧代发，浏览器只做 UI，同源 `fetch('/github-radar/api/...')`，不用额外端口。

## 快速开始

```bash
git clone https://github.com/1578361862-art/dsh-plugin-github-radar.git
cd dsh-plugin-github-radar
dsh plugin --profile desktop add file:$PWD
```

重启 DSH，左栏出现「GitHub 雷达」。

插件尚未发布到 npm；发布后可用 `dsh plugin --profile desktop add dsh-plugin-github-radar`。也可以把仓库根目录的 `index.json` 托管到任意 https 地址，在「插件 → 发现 → 添加索引源」里填 URL。

卸载：

```bash
dsh plugin --profile desktop remove dsh-plugin-github-radar
```

`file:` 方式安装的，再删掉 `~/.dsh/profiles/desktop/node_modules/dsh-plugin-github-radar` 软链。

## 功能

| 能力 | 说明 |
| --- | --- |
| 趋势榜 | 今日 / 本周 / 本月，18 种语言筛选，宿主缓存 10 分钟 |
| 收藏 | 右侧收藏夹，落盘 `collection.json` |
| 读 README | 弹层渲染 Markdown，可切「原文 / 中文」 |
| 翻译 | 走 DSH 已配置的模型，或 Google 翻译 / MyMemory |
| 标星 | 面板内直接 star / unstar，需登录 |
| 克隆 | `git clone --depth 1` 到 `~/Code/<owner>__<repo>` |

## 用法

| 操作 | 结果 |
| --- | --- |
| 今日 / 本周 / 本月 | 切换 trending 时间范围 |
| 语言下拉 | 只看某个语言 |
| 过滤框 | 按仓库名、描述、语言筛 |
| 克隆 | 浅克隆到 `~/Code/<owner>__<repo>` |
| 收藏 | 收进收藏夹，存 `~/Data/github-radar/collection.json` |
| README | 弹层查看，可切中文 |
| ☆ | 在 GitHub 标星（需登录） |
| ↗ | 去 GitHub 页面 |

## README 翻译

README 弹层右上角「原文 / 中文」。宿主把 README 切成**代码块**和**正文段**：

- 代码块原样保留，不翻、不喂给模型
- 正文逐段调用当前 DSH 配置的模型（`ctx.llm`，默认 `deepseek-account` / `deepseek-flash`），SSE 流式回传
- 单段空回复退回原文并标注，不会让整篇失败
- **分批翻译**：每批约 12000 字符，末尾出现「继续翻译（剩 N 字）」，点一下翻下一批
- 每翻完一批就落盘，关掉弹层不白翻；下次打开先显示已翻部分，可从断点继续
- 缓存按引擎分开存，换引擎互不覆盖；「重新翻译」强制重跑

引擎在弹层左下角选：

| 引擎 | 说明 |
| --- | --- |
| 任意已配置模型 | 从 `ctx.llm` 列出，`flash / mini / lite / small` 排前面，默认用它 |
| Google 翻译 | Cloud Translation API v2，需要 API key，无 key 时弹配置框 |
| MyMemory | 免费机翻，单次 500 字符、每天约 1000 词，限流时自动退回模型 |

用 DSH 里已经配好的模型，不额外要 key。没挂模型的 profile 会直接提示「没有挂载任何模型服务」。

### 接入 Google 翻译

1. GCP 控制台启用 **Cloud Translation API**
2. 创建 API key（建议限制为只允许 Translation API）
3. 面板里引擎切到「Google 翻译」，粘 key，保存时先翻一个词验证

key 存 `~/Data/github-radar/google.json`（权限 600），验证失败立即删除。计费按字符，**每月 50 万字符免费**，超出约 $20 / 百万字符；翻译一篇 1.2 万字符的 README 约消耗月度额度的 1/40。它比 deepseek-flash 贵一两个数量级，选它的理由通常是「不想动模型额度」或「手上有 GCP 额度」。

## 登录 GitHub

右上角「登录 GitHub」，两种来源：

1. 粘贴 Personal Access Token（classic 需要 `repo`；fine-grained 需要仓库读权限）
2. 留空，终端里跑 `gh auth login`——插件复用 `gh auth token`

| 能力 | 未登录 | 登录后 |
| --- | --- | --- |
| 趋势榜单、README、翻译 | ✅ | ✅ |
| 克隆公开仓库 | ✅ | ✅ |
| 克隆私有仓库 | ❌ | ✅ |
| 面板内标星 / 取消 | ❌ | ✅ |
| GitHub API 额度 | 60 次/小时 | 5000 次/小时 |

token 存 `~/Data/github-radar/auth.json`，写入后 chmod 600。克隆时通过 `GIT_CONFIG_*` 环境变量传 header，token 不进 argv、也不写进 `.git/config`。

## 数据

```text
~/Data/github-radar/          # 插件状态，可用 GITHUB_RADAR_HOME 覆盖
├── auth.json                 # 登录 token（600）
├── collection.json           # 收藏夹
├── settings.json             # 引擎选择
├── google.json               # Google 翻译 key（600，可选）
└── translations/*.json       # 译文缓存，按引擎分文件

~/Code/<owner>__<repo>/       # 克隆的仓库，普通 git 仓库，可用 GITHUB_RADAR_CODE 覆盖
```

克隆目录用 `owner__repo` 而不是裸仓库名，避免和 `~/Code` 下已有的同名目录冲突。

## 架构

```text
dsh-plugin-github-radar/
├── package.json      # dsh.bundle + dsh.client(platform=web)，导出 ./client
├── cordis.patch.yml  # bundle patch：注册 github-radar 服务
├── lib/index.js      # 宿主半侧：API 路由、抓取、克隆、登录、翻译
└── lib/client.js     # 浏览器半侧：__ModuleLoader__ bundle，注册 main + 侧栏入口
```

宿主负责所有需要绕过 CORS 或有权限的活：抓 `github.com/trending`、取 `raw.githubusercontent.com` 的 README、`git clone --depth 1`、调模型翻译。

宿主接口：

```text
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
POST   /github-radar/api/engines      {engine}
POST   /github-radar/api/google       {key}
DELETE /github-radar/api/google
GET    /github-radar/api/stars?repos=a/b,c/d
POST   /github-radar/api/star         {owner, repo, star}
POST   /github-radar/api/translate    {owner, repo, force}   → SSE
```

`client.apply` 和翻译都包了 try/catch：插件自身出错只打日志，不会拖垮 Web 启动。

## 安全

- 市场插件以宿主权限运行，能读写文件、起进程、访问网络；装别人的插件前看清来源
- 本插件读写的位置：`~/Data/github-radar/`、`~/Code/<owner>__<repo>/`
- token 只存在本地 600 权限文件，不写进仓库、不写进 `.git/config`

## 常见问题

**榜单是空的，显示「这次没扫到」？**
github.com/trending 的 HTML 解析失败或限流。未登录时只有 15 条；稍后重试，或看是不是 GitHub 改版了。

**装完看不到面板？**
重启 DSH。确认 profile 里 `dsh.profile.bundles` 有这一条，且 `~/.dsh/profiles/desktop/node_modules/dsh-plugin-github-radar` 指向正确。

**翻译只翻了一半？**
长 README 按 12000 字符分批，点「继续翻译」接着翻，或调大批次。

**提示没有挂载模型？**
当前 profile 没配模型服务，或者改用 Google / MyMemory 引擎。

**私有仓库克隆失败？**
先在面板登录（PAT）或终端 `gh auth login`，确认 token 有该仓库的读权限。

## 已知限制

- 解析 `github.com/trending` 的 HTML，未登录只有 15 条，GitHub 改版会失灵
- 榜单在宿主内存缓存 10 分钟
- 克隆是 `--depth 1`，需要完整历史就进目录 `git fetch --unshallow`
- README 用内置轻量解析器（不引第三方库）：裸 HTML 去标签只留文字，`<details>` 会摊平
- 翻译分批，超长 README 需要手动点「继续翻译」

## 开发

没有构建步骤：`lib/client.js` 是手写产物，改完直接装回 profile 验证。

```bash
node --check lib/index.js
node --check lib/client.js
dsh plugin --profile desktop add file:$PWD   # 本地装/更新
```

要求 Node ≥ 20、DSH ≥ 0.2.1-rc.5。`package.json` 里 `dsh.bundle` 和 `dsh.client` 缺一不可：只声明 `dsh.client` 的包不能一键安装。

## 发布

npm 发布、进社区目录、自建索引的完整步骤见 [docs/PUBLISHING.md](docs/PUBLISHING.md)。

## 许可

[MIT](LICENSE) © Yee

# 架构与实现

写给改代码的人。README 只讲怎么用，这里讲它怎么跑。

## 两半

插件分宿主侧和浏览器侧，以 `dsh.bundle` + `dsh.client` 两个声明同时发布：

```text
package.json        dsh.bundle.patch → cordis.patch.yml
                    dsh.client.platform = web，导出 ./client
cordis.patch.yml    安装时由 launcher 应用，注册 github-radar 服务
lib/index.js        宿主侧：HTTP 路由、抓取、克隆、登录、翻译
lib/client.js       浏览器侧：__ModuleLoader__ bundle，注册 main 面板 + 侧栏入口
```

为什么必须拆：浏览器直接请求 `github.com` 会被 CORS 挡住，`git clone` 也需要进程权限，所以抓取、克隆、调模型都在宿主做。浏览器只画 UI，用同源的 `fetch('/github-radar/api/...')` 调宿主，不额外开端口。

## 宿主接口

前缀 `/github-radar/api`。

```text
GET    /trending?since=daily|weekly|monthly&lang=
GET    /state
POST   /collection   {action:'add'|'remove', item}
POST   /clone        {owner, repo}
GET    /readme?owner=&repo=
POST   /reveal       {dir}
GET    /auth
POST   /auth         {token}
DELETE /auth
GET    /engines
POST   /engines      {engine}
POST   /google       {key}
DELETE /google
GET    /stars?repos=a/b,c/d
POST   /star         {owner, repo, star}
POST   /translate    {owner, repo, force}   → SSE
```

## 数据文件

根目录 `GITHUB_RADAR_HOME`，默认 `~/Data/github-radar`：

| 文件 | 内容 |
| --- | --- |
| `collection.json` | 收藏夹 |
| `auth.json` | GitHub token，写入后 chmod 600 |
| `settings.json` | 当前翻译引擎 |
| `google.json` | Google 翻译 key，600，验证失败即删除 |
| `translations/*.json` | 译文缓存，按 `<owner>__<repo>__<engine>.json` 分文件 |
| `trending.json` | 当天的榜单缓存 |

克隆根目录 `GITHUB_RADAR_CODE`，默认 `~/Code`，仓库落在 `<owner>__<repo>/`。

## 榜单缓存

- 缓存键 `since|lang`，文件里只保留**当天**的条目，跨天自动清掉
- 同一天内直接读盘，不重复打 GitHub；带 `force` 才重新抓
- 抓取失败时退回上一次缓存，响应里标 `stale`，前端显示「这次没扫到」并保留旧数据
- 解析的是 `github.com/trending` 的 HTML，未登录只有 15 条

## README 抓取

按顺序尝试 `HEAD` / `main` / `master` 三个 ref 和 `README.md`、`readme.md`、`README.MD`、`README.rst`、`README.txt` 五种文件名，命中即返回。单次抓取上限 12000 字节，文本截到 60000 字符。

## 克隆

- 目标 `${owner}__${repo}`，目录已存在就直接返回 `existed`
- `git clone --depth 1 --single-branch`，120 秒超时后 SIGKILL
- 登录时 token 通过 `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_0` / `GIT_CONFIG_VALUE_0` 传 `http.https://github.com/.extraheader`，不进 argv、不写 `.git/config`
- 输出里的 token 会被替换成 `<token>` 再回传

## 翻译管线

1. 把 README 切成**代码块**和**正文段**两类，代码块原样输出，不送模型
2. 正文逐段调用 `ctx.llm`（引擎形如 `model:<provider>/<model>`），SSE 流式回传
3. 每批有 12000 字符预算，翻满就停，前端出现「继续翻译（剩 N 字）」
4. 结果按引擎分文件缓存，键是 README 内容的 hash；每翻完一批就落盘
5. 再次打开时按 `offset` 读缓存，从断点续翻；`force` 跳过缓存重跑

免费引擎 `free` 走 MyMemory，单次 500 字符、每天约 1000 词，限流时自动退回模型。Google 引擎走 Cloud Translation API v2，没 key 时前端弹配置框。

## 错误处理

`client.apply` 和翻译入口都包了 try/catch：插件自身出错只写日志，不会拖垮 Web 启动。接口统一返回 `{ok, ...}`，失败带 `error` 字符串，前端直接展示。

## 本地开发

没有构建步骤，`lib/client.js` 是手写产物：

```bash
node --check lib/index.js
node --check lib/client.js
dsh plugin --profile desktop add file:$PWD   # 本地装/更新
```

要求 Node ≥ 20、DSH ≥ 0.2.1-rc.5。改完装回 profile、重启 DSH 验证。

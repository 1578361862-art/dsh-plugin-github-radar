# 发布与分发

面向插件作者：把 GitHub 雷达（或你自己的 DSH 插件）交给别人安装。三条路可以同时走。

## 方式一：发布到 npm

```bash
npm publish --access public
```

仓库里的 `package.json` 已就位：包名、`dsh.bundle`、`files`、`engines.dsh` 都齐了；`lib/client.js` 是构建产物（本插件没有构建步骤，手写即产物），发布后直接可用。

发布之后别人这样装：

```bash
dsh plugin --profile desktop add dsh-plugin-github-radar
```

## 方式二：进社区目录（推荐）

[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 是社区维护的插件目录，也是 DSH「插件 → 发现」里默认可用的市场索引。

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

- 仓库公开，且**创建满 1 天**
- 打上 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic
- `package.json` 里声明 `dsh.bundle`

## 方式三：自建索引

不想等 PR，可以把 format-1 索引 JSON 放在任意 https 地址（GitHub Pages、Gist raw、自己的域名），别人在「插件 → 发现 → 添加索引源」里填 URL 即可。本仓库根目录的 `index.json` 就是一个可用示例：

```json
{
  "format": 1,
  "title": { "en": "GitHub Radar", "zh": "GitHub 雷达" },
  "plugins": [
    {
      "name": "dsh-plugin-github-radar",
      "title": { "en": "GitHub Radar", "zh": "GitHub 雷达" },
      "author": "Yee",
      "homepage": "https://github.com/1578361862-art/dsh-plugin-github-radar",
      "repository": { "url": "https://github.com/1578361862-art/dsh-plugin-github-radar" },
      "metadata": { "category": "ui", "keywords": ["github", "trending"] },
      "versions": [
        {
          "version": "0.2.0",
          "publishTimestamp": 1793885506,
          "source": { "type": "npm" },
          "engines": { "dsh": ">=0.2.1-rc.5" }
        }
      ]
    }
  ]
}
```

`source` 也可以是 git：

```json
{ "type": "git", "url": "https://github.com/you/github-radar", "commit": "<40 位小写 SHA>", "path": "github-radar-plugin" }
```

索引本身必须 https 托管。

## 安全提醒

市场插件以宿主权限运行，能读写文件、起进程、访问网络。装别人的插件前看清来源；自己的插件分享出去时，最好在 README 里写清楚它动了哪些路径——本插件动的是 `~/Data/github-radar/` 与 `~/Code/<owner>__<repo>/`。

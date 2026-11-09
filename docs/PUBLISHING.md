# 发布与分发

面向插件作者：把 GitHub 雷达（或任何一个 DSH 插件）交给别人安装。

## 一、打一个 Release tarball（本仓库采用的方式）

仓库里没有构建步骤，`lib/` 就是产物，所以打一个包即可：

```sh
npm pack                     # → dsh-plugin-github-radar-0.5.0.tgz
gh release create v0.5.0 dsh-plugin-github-radar-0.5.0.tgz \
  --title v0.5.0 --notes "首个公开版本"
```

**资产名别带版本号**，这样下面这条链接永远指向最新一版：

```
https://github.com/1578361862-art/dsh-plugin-github-radar/releases/latest/download/dsh-plugin-github-radar.tgz
```

`latest/download/` 只把 `latest` 解析成当前最新 release，文件名是照字面取的。资产名带版本号的话，下一个版本就会 404。要带版本号就钉死 tag（`releases/download/v0.5.0/...`）。

## 二、进社区目录（曝光的主路）

[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 是社区维护的插件目录，也是 DSH「插件 → 发现」和 dshmarket 的市场索引。给那个仓库提 PR，**只加一个文件**：`data/plugins/<owner>__<repo>.yml`。

```yaml
url: https://github.com/1578361862-art/dsh-plugin-github-radar
name: 1578361862-art/dsh-plugin-github-radar
category: git
description:
  en: A DSH panel for GitHub trending with local favorites, one-click shallow clone and README translation.
  zh: DSH 面板：GitHub 趋势榜单，支持本地收藏、一键浅克隆与 README 机翻。
tarball: https://github.com/1578361862-art/dsh-plugin-github-radar/releases/latest/download/dsh-plugin-github-radar.tgz
```

收录要求：

- 仓库公开，且**创建满 1 天**（CI 自动查）
- 打上 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic
- `package.json` 声明 `dsh.bundle`，旁边有 `cordis.patch.yml`
- 一个 PR 最多 3 条；描述必须和代码对得上

## 三、发 npm（可选，体验更好）

```sh
npm publish
```

发过之后别人直接 `dsh plugin --profile <profile> add dsh-plugin-github-radar`，带版本号、能检查更新，也免掉源码安装时的构建授权。本仓库暂时走 tarball，没有发 npm。

## 四、自建索引（可选）

把一份 format-1 的 `index.json` 放到任意 https 地址，别人在「插件 → 发现 → 添加索引源」里填 URL 就能看到你的插件列表。适合发布一组插件、又不想等目录 PR 的情况。格式以上游 `dsh-plugin-catalog` 的 `index.json` 为准；本仓库不再自带一份，避免和目录条目两头维护。

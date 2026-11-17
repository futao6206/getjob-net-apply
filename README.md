# 网申自动填写

在公司校招、秋招的报名页，用这台电脑上的简历把表填上。这是一个油猴脚本，免费，不代点提交。北森、大易（用友大易）、Moka（摩卡）、国聘上比较常见。

所有资料保存在这台电脑上。

## 常见报名页

这些系统上的报名表比较常见：

- 北森网申：`zhiye.com`，例如 `vivo.zhiye.com`
- 大易网申、用友大易：`hotjob.cn`
- Moka 网申、摩卡招聘：`mokahr.com`、`moka.com`
- 国聘网申：`iguopin.com`
- 中国电信招聘：`job.chinatelecom.com.cn`

不少公司的校招、秋招页就挂在北森或大易上。公司自己的报名页，只要有姓名、手机、学校、学历、经历这类格子，也可以试填。

## 演示

[![自动填写网申工具：40个字段3秒填完](https://i2.hdslb.com/bfs/archive/8efe919e379d85d108cceb6e0b84d333d7a2b1e3.jpg)](https://www.bilibili.com/video/BV1aLWQ64EpJ/)

[自动填写网申工具：40个字段3秒填完](https://www.bilibili.com/video/BV1aLWQ64EpJ/)

## 使用方式

### 官网直接体验（推荐）

不用安装油猴，也不用配置环境。打开 GetJob 官网即可直接体验：

**https://getjob.help/?src=net-apply&via=readme**

网申填写免费，不扣积分。

### 桌面端

下载 GetJob 桌面端后，在「投递设置」页最底部打开。网申填写免费，不扣积分。

### 油猴脚本

已经打开公司报名页、只想填写当前这一张表时，使用本仓库的脚本。本脚本免费，不用登录。
安装步骤见下方，图文说明见 [使用教程](doc/使用教程.md)。

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。Chrome、Edge 也可以用 Violentmonkey；下面以 Tampermonkey 为准。
2. 打开浏览器的扩展管理，打开开发者模式。点进 Tampermonkey 的详情，打开「允许用户脚本」。少了这一项，脚本能装上，页面上没有「网申填写」按钮。
3. 打开 GitHub 上的 Raw，由 Tampermonkey 弹出安装页：<https://raw.githubusercontent.com/futao6206/getjob-net-apply/main/dist/getjob-net-apply.user.js>
4. 点页面右下角「网申填写」，手填资料，或选一份文字版 PDF。修改会自动保存在这台电脑。
5. 用已经登录的浏览器打开公司报名页，点「自动填写当前页面」。这个按钮只填当前这一页。
6. 自己看一遍空格，再自己点报名站的提交。脚本不代点提交。

表单在 iframe 里不会填。已经写过字的格子不会覆盖。脚本不点提交、下一步、保存、新增经历。

教育经历、工作经历只填第一段，第二段留空。扫描版 PDF 不拆字段，改成手填。

`vendor/pdfjs` 里的 pdf.js 为 Apache-2.0，文件头保留原说明，不改成 MIT。其余代码为 MIT。

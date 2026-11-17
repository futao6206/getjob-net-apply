# 网申自动填写

油猴脚本。在公司招聘页、校招和秋招的网申页，用本机保存的简历填写报名表。北森、大易、Moka（摩卡）、国聘上比较常见；其他公司自己的报名表，只要页面像报名表，也可以试填。免费，不代点提交。

不填写 BOSS直聘、智联、猎聘、前程无忧的职位页和聊天页。

### 证件号

桌面端不保存证件号，也不替你填写。这个脚本没有登录，也不会上传。证件号只留在你这台电脑的脚本管理器里，用来填当前报名表。以本仓库的脚本为准。

## 使用方式

### 官网直接体验（推荐）

不用安装油猴，也不用配置环境。打开 GetJob 官网即可直接体验：

**https://getjob.help/?src=net-apply&via=readme**

网申填写免费，不扣积分。下载桌面端后，在「投递设置」页最底部打开。本脚本同样免费，不用登录。

### 油猴脚本

已经打开公司报名页、只想填写当前这一张表时，使用本仓库的脚本。
安装步骤见下方，图文说明见 [使用教程](doc/使用教程.md)。

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。Chrome、Edge 也可以用 Violentmonkey；下面以 Tampermonkey 为准。
2. 打开浏览器的扩展管理，打开开发者模式。点进 Tampermonkey 的详情，打开「允许用户脚本」。
3. 安装本脚本。体积允许时，用 Greasy Fork 页的「安装此脚本」。放不下时，打开 GitHub 上的 Raw，由 Tampermonkey 弹出安装页：<https://raw.githubusercontent.com/futao6206/getjob-net-apply/main/dist/getjob-net-apply.user.js>
4. 点页面右下角「网申填写」，手填资料，或选一份文字版 PDF，然后点保存。
5. 用已经登录的浏览器打开公司报名页，点「按简历填写」。
6. 自己看一遍空格，再自己点报名站的提交。脚本不代点提交。

`vendor/pdfjs` 里的 pdf.js 为 Apache-2.0，文件头保留原说明，不改成 MIT。其余代码为 MIT。

自行套壳不在支持范围内。

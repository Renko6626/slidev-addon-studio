# Studio 当前状态

按 2026-11-21 的仓库与发布结果整理。产品定位与约束见 [overall](overall.md)。

## 桌面及 Studio addon 0.5.4，2026-11-21

- 桌面客户端 0.5.4 已通过 Windows 实机验收并在 GitHub 设为 Latest。轻量和完整 ZIP 均随附验收时的 addon 0.5.3。客户端查新已识别 0.5.4。[正式版下载](https://github.com/Renko6626/slidev-addon-studio/releases/tag/desktop-v0.5.4)
- 独立 addon 0.5.4 提供可编辑表格、系统字体搜索和导入。标签为 `v0.5.4`，对应 tgz 已附于同一 Release。发布候选通过 522 项测试，跳过 1 项可选 HTTP QA，TypeScript 与 Vue 类型检查通过。使用该 tgz 的全新工程已通过实际安装与 Slidev 网页构建。[编辑器改动](releases/0.5.4.md)
- 发布前在 Linux 通过全量测试 518 项，跳过 1 项可选 HTTP QA，类型检查通过。两个 ZIP 已核对归档完整性、Windows x64 可执行文件和内嵌桌面代码。从完整版 ZIP 解出的 pnpm 和缓存按 Windows x64 目标安装了 715 个包，下载数为 0。[客户端改动](releases/desktop-0.5.4.md)

### Windows x64 实机端到端验收

桌面 0.5.4 完整版（随附 Studio 0.5.3）在 Windows x64 的 C、D 两个 NTFS 卷上通过本轮端到端验收。用户人工试用未发现问题。

- 在 C 盘解压经 SHA-256 核对的发布 ZIP，并从桌面界面在 D 盘的两个不同父目录新建标准工程。为测试进程指定 D 盘 pnpm store，通过不可达代理模拟外网不可用。两次离线安装各安装 715 个包，下载均为 0。首次向 D 盘补齐 24,187 个文件，第二次复用该缓存。`node.cmd` 实际运行 Electron 随附的 Node 24.22.2。
- `fsutil hardlink list` 确认两个工程与 D 盘 store 共用同一个 Rolldown 原生文件。按 NTFS 文件 ID 去重后，第二个工程新增约 26.2 MiB 文件分配空间，约为同机强制复制对照 481.1 MiB 的 5.5%，达到低于 20% 的验收目标。
- 中文文本编辑、保存关闭、直接重开、另存和工程 ZIP 原生导入均通过。副本和导入工程保留文稿、素材、锁文件以及 Studio tgz。工程 ZIP 排除了依赖目录、缓存和旧构建。
- 桌面导出网页播放 ZIP 后，原编辑服务仍返回 HTTP 200，源工程备注和已有 `dist` 保留。播放包携带本地图片、音频和工程字体，未收录测试备注。关闭 Studio 后，解压的 `start.cmd` 使用空闲本机端口启动播放器，首页返回 HTTP 200。
- Windows 源码专项测试通过 29 项。全量 `pnpm test --reporter=dot` 有 511 项通过、5 个路径断言失败、1 项跳过，另有 `source-context.test.ts` 因无法解析 `@slidev/parser` 未加载。`pnpm typecheck` 也报告无法解析该包。

## 0.5.3 发布，2026-11-18

- npm 的 `latest` 为 Studio 0.5.3。通过 npm CLI 从源码标签打包发布，公开归档的 SHA-512 与 registry 元数据及本地候选一致。 [npm](https://www.npmjs.com/package/@renko_1055/slidev-addon-studio/v/0.5.3) / [改动记录](releases/0.5.3.md)
- Windows x64 轻量版以 0.5.3 预发布，内含从 npm 下载的同一份 Studio 归档。桌面稳定版本为 0.5.2。 [桌面 0.5.3](https://github.com/Renko6626/slidev-addon-studio/releases/tag/desktop-v0.5.3)
- `pnpm test --reporter=dot` 通过 424 项，跳过 1 项既有可选 HTTP QA。`pnpm typecheck`、`git diff --check` 和 `node scripts/release.cjs build` 通过。核对了 ZIP 的 CRC、Windows x64 可执行文件及九种图标尺寸资源、ASAR 内容、随包版本及 GitHub 交付资产的 SHA-256。Windows 实机验收待完成。

## 源码与交付

- 本地 main 已整合 `codex/studio-import-export` 的三个功能提交：`d08abf4`（演示导出与工程 ZIP 导入）、`74e3f89`（只读源码定位与桌面原生工程管理）、`3821d93`（中性源码入口和复制内容）。此前 `660e2f2` 提供的包更新与桌面改进保留。已有工程打开不会自动升级。
- [0.5.2](releases/0.5.2.md) 曾在全新 Slidev 53 模板中完成冻结安装验证。更早的改动见 [0.5.0](releases/0.5.0.md) 和 [0.5.1](releases/0.5.1.md)。

## 当前可用能力

- 可视化制作：页面列表与预设、富文本、自动高度/固定大小文本框、垂直对齐与内边距、工程字体导入和预览、图片、形状、音视频、多选排版、图层、背景、复制粘贴、备注、动画与放映。
- 人与 agent 接续制作：只读源码、文件位置与页面信息复制、随包技能、完整样例、组件可编辑字段与公共 runtime。agent 由外部工具运行，复制信息不附带任务指令。
- 内置交互：单选、多选、规则控件、独立题干/选项/反馈、选项增删及本次试播首次答对计数。动态表达式和自定义选项结构仍按源码维护。
- 本地工程：源码写回、显式保存、工程 ZIP，以及 PDF/PNG/图片型 PPTX 导出入口；桌面壳提供新建、打开、ZIP 导入、另存、日志、依赖准备和手动 Studio 包更新。原生工程管理不依赖项目编译，允许显式确认后从磁盘重新加载或返回主页。
- 可选网页交付：支持新接口的桌面壳与 addon 提供 Windows x64 网页播放 ZIP，随附静态站点、本地素材和固定 miniserve；接收者解压后运行 `start.cmd`，不安装 Studio。默认排除演讲备注；外链资源仍可能联网，进一步编辑需保留源工程。
- 独立交付：普通 Slidev 工程可以继续编辑和构建；addon 不要求账号、Git、数据库或协作工作台。

详细行为以[使用指南](usage.zh-CN.md)与[限制说明](limitations.md)为准。手机答题、远程服务和多人同步没有因提供 Pinia/runtime 而实现。

## 已有验证记录

下表来自此前实施记录；这次整合后的实际验证结果见下一节。

| 范围 | 已有结果 | 证据边界 |
| --- | --- | --- |
| 统一包更新阶段 | `pnpm test`：389 通过，1 项可选 HTTP QA 跳过；`pnpm typecheck` 与临时 `vue-tsc@3.1.8 --noEmit --project tsconfig.json` 通过 | 不代表 Windows 或真实操作验收 |
| 桌面包来源与更新 | 相关包、工程、更新、发布及保存检查通过；本地 HTTP 与真实临时文件验证归档及写入 | 未使用真实 npm 执行工程更新 |
| 发布命令 | `node scripts/release.cjs build --dry-run` 及其 `--offline` 模式通过 | 未联网获取正式包，未制作新 ZIP |
| 人机协同样例与 runtime | 实际 tgz 安装后的 Slidev 52.19 样例、子路径静态构建及保留 patches 的工作台 53.0 模板构建通过 | 属于此前版本记录，不代表所有 Slidev 版本兼容 |
| Windows 桌面基础 | 历史版本做过 Linux 真实工程启动、保存与另存探针，以及 Windows ZIP 交叉打包和库存核对 | Linux 结果不能替代 Windows 实机 |

## 本次合并验证，2026-11-17

- `node_modules/.bin/vitest run`：396 通过，1 项既有可选 HTTP QA 跳过。
- `node_modules/.bin/tsc --noEmit`：通过。Vue SFC 检查使用既有缓存 vue-tsc 3.1.5，显式调用工程 TypeScript 5.9.3，参数为 `--noEmit --project tsconfig.json`：通过；没有安装或升级依赖。
- `node_modules/.bin/slidev build playground/slides.md --base /studio-check/ --out /tmp/studio-merge-build.GydGo3`：通过。
- `node --check` 检查 `desktop/main.cjs`、`desktop/projects.cjs`、`desktop/preload.cjs`、`desktop/project-management.cjs`：通过；`git diff --check` 通过。

合并后的生产代码与测试和原功能分支一致，手工解决的冲突仅在 README 和桌面说明。已完成计划中的有效结论并入现行文档，原始过程保留在分支提交历史。

## 网页播放包接入验证，2026-11-17

实现位于 `codex/studio-web-playback`，以本地 main 的 `9ac844f` 为基线。源码版号不变，没有发布 npm 或制作新的 Windows 桌面包。

- `node_modules/.bin/vitest run`：402 通过，1 项既有可选 HTTP QA 跳过。新增覆盖资源摘要与缓存，以及真实子进程构建/归档、取消/保存失败、构建失败保留旧目标与停止导出。
- `node_modules/.bin/tsc --noEmit` 和缓存 vue-tsc 3.1.5 的 `--noEmit --project tsconfig.json`：通过；未安装或升级依赖。
- `node --check` 检查 `desktop/main.cjs`、`desktop/preload.cjs`、`desktop/playback.cjs`、`desktop/web-playback.cjs`、`desktop/scripts/prepare.cjs`、`desktop/scripts/prepare-playback.cjs`；`git diff --check`：通过。
- 临时真实样例通过生产导出函数构建 ZIP。Linux Node 22.22.1 下，同一真实编辑服务在导出前后均返回 HTTP 200；原文稿、manifest 和已有 `dist` 保持原样。夹具测试另覆盖锁文件保持与外部临时目录清理。样例仅在临时副本设置本机字体，导出实现不改作者字体配置。
- ZIP 解压后使用同版本 Linux miniserve 验证 `/`、`/1`、`/2`、`/4`、47 个 JS/CSS 的字节和 MIME、SVG/MP4/WAV 字节及音视频 206 Range；唯一备注探针未进入输出脚本。
- 正式链路样例 `Studio-Web-Playback-integrated-win-x64.zip` 为 2,600,285 字节，SHA-256 为 `ab1eecc9332f4a6840b7f23875d0ec635f91950e143e875eccec49a17afbaddb`，本地产物、校验与验证 JSON 保存在仓库同级的 `release/web-playback/integrated-2026-11-17/`。

这轮探针在 Linux 执行。后续对新桌面入口、原生保存对话框和解压启动的验证见 [Windows x64 实机端到端验收](#windows-x64-实机端到端验收)。

## 文本框与工程字体验证，2026-11-17

实现位于 `codex/studio-text-fonts`，基于 main 的 `bcff561`。保留现有编辑器与工程格式，没有新增依赖、发布 npm 或制作 Windows 桌面包。已完成的计划结论并入使用与开发文档，计划过程保留在 Git 历史。

- `node_modules/.bin/vitest run`：408 通过，1 项既有可选 HTTP QA 跳过。关键新增覆盖固定框尺寸与模式、内容容器读写/编辑、字体文件与标准 CSS、工程 ZIP 携带，以及手工 CSS 相对 URL 重定位。
- `node_modules/.bin/tsc --noEmit` 与既有缓存 vue-tsc 的 `--noEmit --project tsconfig.json`：通过；`git diff --check` 通过。
- 临时真实工程通过 `POST @studio/fonts` 导入 757,076 字节的 DejaVu Sans TTF，HTTP 读取字节一致，MIME 为 `font/ttf`；开发虚拟 CSS 能读取新登记。使用系统字体验证，不向项目源码附带默认字体。
- 真实 Slidev 根路径网页播放包及 `--base /font-check/` 静态构建均携带原字体字节和注册 CSS；生产样式中使用正确的字体 URL。导出后编辑服务仍返回 HTTP 200。
- 编辑页和播放页已截图查看；只导航、截图，没有自动点击、填写、导入或拖拽流程。字体表单、选区内应用字体、输入法及 Windows 行为仍待实际使用。
- 字体演示播放 ZIP 为 2,985,369 字节，SHA-256 为 `39660e7f4ead9e52a2ff3afc0fa498e8089d45b9f74aed5d8d472570c28ffcee`，随附 DejaVu 许可。本地产物与验证 JSON 在同级 `release/text-fonts/preview-2026-11-17/`。

一次独立代码审阅发现标准 CSS 的单引号/无引号相对字体 URL 在生产构建中定位错误；已补真实注册文件用例并修正。没有扩展自动缩字、字体子集化、系统字体扫描或额外后台。

随后 Sol 独立审阅发现旧文本框首次设置布局会转义已有 Vue 插值。已让布局包装原样保留正文；文字编辑的新输入仍按原规则转义。新增回归用例已先复现失败再通过；本次局部验证运行 `vitest run test/elements.test.ts test/rich-text.test.ts`（37 通过）、`tsc --noEmit` 和 `git diff --check`，均通过，未重跑浏览器或 Windows 验收。

## 当前源码桌面预览包，2026-11-17

- 已按用户要求从 `codex/studio-text-fonts` 的 `ce77a51` 制作 Windows x64 轻量源码预览 ZIP 和 addon tgz；清单版本保持 `0.5.1`，产物名使用 `source-ce77a51` 区分原正式包，没有替换原归档或发布 npm/GitHub。
- 目录为仓库同级 `release/studio/previews/2026-11-17-ce77a51/`。桌面 ZIP 为 166,645,502 字节，addon 为 274,743 字节；随附 README、SHA256SUMS 和 verification.json。
- 实际执行 workspace prepare 与 Forge `make --platform=win32 --arch=x64`。核对 app.asar 中的主进程/桥接/播放模块与源码一致，ZIP 内 addon 与单独 tgz 一致，miniserve 固定摘要与播放模板一致；ZIP 完整性检查和 SHA-256 复核通过。
- 将实际 tgz 解压为临时工程安装包后，Slidev `build --base /packed-check/ --without-notes --download false` 通过，字体字节和生产注册路径保持。未在 Windows 运行此包。
- 新建工程使用随包 Studio；已有工程保留自己的依赖，同版本不自动替换为预览源码。线上工作台与现有文稿没有随本次打包升级。

## 线上统一接入与发布，2026-11-17

- `codex/studio-online-host` 已合入 main 并发布 Studio `0.5.2`；桌面壳版号保持。线上活动/个人草稿上下文由 runtime 启动环境提供，编辑器先保存再返回活动，生产播放不包含这些入口。
- addon `vitest run`：411 通过，1 项既有可选 HTTP QA 跳过；`tsc --noEmit`、缓存 vue-tsc、`git diff --check` 通过。Sol 独立审阅未发现核心阻断问题。
- 将真实 tgz 安装到保留两个原补丁的 Slidev CLI/client 53.0.0 临时模板，HTTP/WS 探针及 `/edit/<UUID>/` 的导入页保存、素材上传、字体字节与工程 ZIP 均通过；`/preview/<UUID>/` 静态构建字体路径正确，未包含工作区上下文。已截图查看顶部活动/草稿/返回入口，没有自动点击或填写。
- 工作台代码 `97649a4` 已通过原 Coolify 五服务部署，新活动模板固定 `0.5.2`。用户选择备份后清空旧活动、两个草稿和构建数据，保留账号及登录接入配置；未逐个升级旧工程。业务归零、身份配置前后校验、服务健康及公网匿名门禁通过。详情见[工作台接入记录](https://github.com/Renko6626/slidev-experiment/blob/main/docs/editor.md)。

## 桌面客户端发行流程，2026-11-17

桌面 0.5.2 提供离线本版日志、手动稳定客户端查新和固定 GitHub Release 下载入口；发布脚本要求桌面更新日志，新建 Release 默认预发布，补充离线版不改变稳定状态。Windows x64 轻量 ZIP 已于 2026-11-18（北京时间）[正式发布并设为 Latest](https://github.com/Renko6626/slidev-addon-studio/releases/tag/desktop-v0.5.2)。本次用户明确要求正式发布，已按该指令提升同一批校验产物的发布状态；Windows 实机验收尚未完成，发布说明已明示。流程见[桌面指南](../desktop/README.md)，本版说明见[客户端 0.5.2](releases/desktop-0.5.2.md)。

本次 `vitest run` 422 项通过、1 项既有可选 HTTP QA 跳过；`tsc --noEmit`、6 个修改后 JavaScript 文件的语法检查、`node scripts/release.cjs build --dry-run` 与差异检查通过。发布 dry-run 在临时文件/校验表用例中确认不调用 GitHub；未将临时文件当作真实桌面产物。生产查询模块实际访问 GitHub 成功，当前正确返回未找到稳定桌面包。一次独立审阅未发现核心阻断问题。

实施保持现有 Electron Forge ZIP、npm Studio 包和模块边界，没有引入额外依赖或更新服务。代码已合并推送 main，发布标签 `desktop-v0.5.2` 固定源码提交 `c23669fd5643c7621ba22eb077ec40f9e8febbed`；完成的设计和计划过程保留在 Git 历史。

正式构建从 npm 取得精确 Studio 0.5.2，归档与已发布包逐字节一致。合并后的桌面/发布相关检查 25 项通过；实际 ZIP 的 CRC、Windows x64 PE、ASAR 中客户端代码、随包版本/日志、pnpm 与 miniserve 校验通过。远端 ZIP、addon 和校验表三个资产的 GitHub SHA256 摘要与本地一致，公开下载 HTTP 200，实际客户端查询识别稳定版 0.5.2。ZIP 为 166650816 字节（约 159 MiB），SHA256 为 `e2d591aae3ca6e2acb959ddf42947a9e27bcb79f981ff5aeccd7c6e95d330458`；本地产物与验证记录在仓库相邻的 `release/studio/0.5.2/`。本轮只分发轻量版，未重新发布 npm 或部署线上工作台。

## 尚待实际使用验证

实际 PDF 打印、标签页采集和 PNG/PPTX 产物、Windows 原生工程管理菜单及恢复确认框、真实错误工程重新加载、网络更新与进程重启、输入法、原生剪贴板、全屏和音视频解码仍需按实际场景试用。

正常使用发现问题后，根据日志和工程文件修复；这些验收缺口不自动扩展为新的恢复系统或大范围自动化。验证命令与发布方式见[开发说明](development.md)及[桌面指南](../desktop/README.md)。

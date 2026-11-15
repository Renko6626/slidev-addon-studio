# Studio 阶段状态

## 阶段提交检查点，2026-11-15

用户要求将工程“文件”页及 Windows 桌面宿主两阶段源码、测试、计划和说明提交并推送至 `origin/codex/studio-rich-text`。Windows ZIP 保留在本地 `release/studio-windows-2026-11-15/` 交付目录，不纳入 Git。本次不合并 main、不发布 npm、不创建 GitHub Release。下方各阶段的“未提交”记录描述实施完成时的状态，以本检查点作为后续归档范围。

## Windows 桌面宿主预览，2026-11-15

用户确认的路线为 Windows x64、Electron 内置 Node、Forge ZIP。已新增独立 `desktop/` 包，包含工程文件操作、单工程运行器、原生对话框/菜单、隔离 preload 和最小欢迎页。Studio 文件页检测到宿主后显示新建、打开、另存及关闭；主进程在切换和关闭前调用 Studio 保存接口。工程仍是标准目录，不依赖网站、Git 或数据库。

已有工程启用随附 Studio 前会询问，只修改 addon 和启用配置，保留 CLI/主题/Vue。另存复用现有工程 ZIP，不覆盖非空目录。依赖安装使用 pnpm JS；Windows `node.cmd` 将安装脚本转接到应用自己的 exe，没有第二份 Node。桌面依赖由自己的 `pnpm-workspace.yaml` 隔离并使用 hoisted 布局，不改变根工程布局。

- [实施计划](superpowers/plans/2026-11-15-windows-host.md)、[设计](superpowers/specs/2026-11-15-windows-host-design.md)和[使用/打包说明](../desktop/README.md)已记录。
- `pnpm test`：230 通过、1 项既有 QA 跳过；`pnpm typecheck`、Vue SFC 检查、desktop CJS/JS 语法检查及 `git diff --check` 通过。
- `pnpm exec slidev build playground/slides.md --out /tmp/sunyunbo/studio-windows-host-static-build-20261115` 通过。未改写用户 playground。
- 真实全新工程探针使用 Electron 45.3.2 / 内置 Node 24.22.2 完成依赖安装、安装脚本、Slidev 启动、保存、工程 ZIP 及另存；安装脚本记录的 exe 确认为 Electron。源码/文件页组件与幻灯片模块通过实际开发服务编译。证据位于 `/tmp/sunyunbo/studio-desktop-runtime-fixed-bzmlwwo6/`。
- 全新安装曾解析出 Markdown-it 15，导致 Markdown 插件启动失败；普通 Node 同样复现。已对新建模板固定 14.3.0，回归及实际启动通过，不修改已有工程的版本。使用随附 addon 的工程每次打开执行缓存安装，避免另建取消/恢复状态。
- `pnpm desktop:make` 在 Linux 交叉生成 Windows ZIP 成功。检查了 Windows exe、当前 app.asar 源码、JSZip 生产依赖、pnpm JS、模板和源码 addon，确认没有独立 `node.exe`。ZIP 约 156.7 MiB。
- 交付文件 `/data/sunyunbo/www/better-ppt/release/studio-windows-2026-11-15/Slidev-Studio-0.1.0-win-x64.zip`，同目录附 SHA256SUMS 与使用说明；SHA-256 为 `d0578880186887bd53643a2f343c4f29acd7de6d12852521a0b6872fbbd66af4`。
- 一次独立只读审阅未发现需要修正的核心缺陷。未执行浏览器自动点击、输入或交互流程；无 Windows/Wine，原生对话框、node.cmd 实际执行、窗口关闭及包启动仍待 Windows 试用。Linux 结果不能替代 Windows 验收。
- 未提交/推送/合并、未发布 npm、未改网站部署；没有安装器、签名、自动更新或云端同步。

## 工程与“文件”页，2026-11-15

当前源码在 `codex/studio-rich-text` 增加了“文件”选项卡：工程名称、目录、入口、保存状态、只读文件树、保存及工程 ZIP 下载。工程沿用标准 Slidev 目录，不要求 Git、账号或 `project.yaml`；新建、打开、另存及切换仍由工作区或未来桌面宿主提供。

保存沿用自动写回，标题栏保存和 Ctrl/Cmd+S 会应用当前文字与备注，并等待实际写入。写入失败会显示状态并停止下载。工程 ZIP 从当前磁盘读取，包含新增和未提交内容；排除依赖、Git 历史、构建缓存及本机凭据配置。符号链接和工程外的幻灯片源码会提示具体路径，避免静默缺页。

- 计划与范围见[实施计划](superpowers/plans/2026-11-15-project-files.md)及[行为约定](superpowers/specs/2026-11-15-project-files-design.md)。本轮未提交、推送、合并或发布 npm，线上已安装版本没有随之更新。
- `pnpm test`：225 通过，1 项既有服务 QA 跳过。审阅修正后运行受影响的 5 个测试文件，24 项通过。
- `pnpm typecheck`、临时工具 `pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json` 通过；后者未增加仓库开发依赖。
- `pnpm exec slidev build playground/slides.md --out /tmp/sunyunbo/studio-project-files-build-20261115` 通过，原 playground 未改写。
- 临时 HTTP 工程在 `/` 和 `/edit/http-probe/` 下的信息与 ZIP 下载均通过；6 个改动 Vue 组件经开发服务编译通过。ZIP 检查确认最新正文、中文文件名、二进制素材、响应文件名及排除规则。探针及结果在 `/tmp/sunyunbo/studio-project-files-http-uswxmxit/`。
- 一次独立只读审阅后修正文件页按键传播、文字序列化错误被备注写入掩盖的问题。不新增请求队列、自动恢复或导出任务系统。
- 未执行浏览器自动点击、输入或实际下载交互，也未验证 Windows 安装包；Ctrl/Cmd+S、原生下载和文件页视觉交互仍需用户试用。

## 本次会话检查点

2026-11-15 阶段归档分支：`codex/studio-rich-text`，目标远端为本 fork 的 `origin`。

- `831db0b`：首次按下拖动、文字提交后的点击切换和选区保留。
- `6b02444`：Studio 文本框接入 Tiptap/ProseMirror，支持局部/光标/整框格式、段落列表与编辑历史。
- `9d9b352`：“开始”常驻字体和段落两组，右侧保留详细属性，进入文本编辑自动显示开始。
- 本次一并保存用户在 `playground/slides.md` 中的拖动试用记录。
- 最近验证：`pnpm test` 216 通过、1 项服务 QA 跳过；TypeScript、Vue SFC 检查及开发页截图通过。真实选区、输入法和剪贴板仍待试用，已知文字边界见 [限制说明](limitations.md)。
- 本次仅阶段性提交和推送，不合并 `main`、不发布 npm。

以下内容为前序阶段记录；各功能的详细验证见对应计划。

记录日期：2026-11-15。本阶段将 Renko fork 扩展为完整编辑器，并补齐文本图片与对象剪贴板。内容仍保存为 Markdown 和本地素材；没有引入协作账号、Git 业务接口、数据库或桌面框架。

后续拖动与点击切换改动保存在 `codex/studio-pointer-interaction` 功能分支：首次按下直接拖动，文字提交后同一次点击选择其他对象或取消选择，异步重选不覆盖后来的选择。实现与检查见[拖动与点击切换记录](superpowers/plans/2026-11-15-pointer-interaction.md)。该分支尚未合并或发布；下方原有整合记录保留为历史阶段记录。

文字区的下一阶段位于 `codex/studio-rich-text`（基于上述拖动提交），为 Studio 文本框接入 Tiptap/ProseMirror，支持局部/光标/整框格式、段落列表及编辑历史。范围、实现和验证见[富文本计划](superpowers/plans/2026-11-15-rich-text.md)，普通 Markdown 和复杂组件继续使用原路径。该阶段亦未合并或发布。

## 当前成果

| 阶段 | 已交付内容 | 实现记录 |
| --- | --- | --- |
| 编辑工作区 | 左侧逐页浏览、分组功能区、中央画布、右侧属性、备注、预览和放映 | [计划与验证](superpowers/plans/2026-11-15-studio-editor.md) |
| 文本框和图片 | 整框文字格式、自动高度、图片插入与替换、锁比、完整显示与填满外框 | [计划与验证](superpowers/plans/2026-11-15-text-images.md) |
| 对象剪贴板 | 原生复制粘贴、同一文稿跨页插入、错位副本、准确选中、保留输入态行为 | [计划与验证](superpowers/plans/2026-11-15-object-clipboard.md) |
| 中英文及工程适配 | 独立 Vue I18n、Vite base、素材目录和 URL 写回 | [早期设计](superpowers/specs/2026-11-08-studio-i18n-design.md) |

主要功能提交为 `40e9bc3`、`1850533`、`3993273`、`4b08beb`；`ad6b5f1` 保存了当时的示例试用状态。当前 `playground/slides.md` 是开发和手动试用文稿，也保留了后续试用中的编辑记录。

## 版本与集成

源码中的新工作区、基础元素和对象剪贴板尚未发布为新 npm 版本，`package.json` 仍为 `0.3.1-renko.1`。安装该 npm 版本不会获得本阶段源码新增能力。

本轮工作是整理文档、阶段性提交、推送并合并到 `main`。Release 工作流仅由版本标签触发；本轮不创建标签、不发布 npm，也不升级协作工作台或已有活动的依赖。

## 验证范围

本轮文档整理及当前试用文稿的整合检查已完成：

- `pnpm test`：197 个用例通过；1 个需要 `STUDIO_QA_URL` 的服务 QA 跳过。
- 本轮 `pnpm typecheck`、`pnpm exec slidev build playground/slides.md --out /tmp/studio-merge-build` 通过。功能阶段另已通过临时 Vue SFC 类型检查，本轮未改产品代码。
- 本地 Markdown 链接目标检查与 `git diff --check` 通过。
- 普通开发路径、子路径编辑视图、静态图片展示已查看截图。仓库保存了[工作区](images/workspace.png)、[文本图片](images/text-images.png)和[图片显示模式](images/picture-frames.png)截图。
- 完成过各功能阶段的只读代码审阅；发现的模式关闭保护、列表复制边界及动画包装保留问题已修复。
- 没有自动执行浏览器输入、点击、拖动、文件选择、剪贴板或全屏流程。真实交互验收仍需用户试用。

## 已知限制与后续

页面结构变更仍刷新并清空撤销历史；第一页与跨文件排序限制保留。对象剪贴板限定同一入口的完整顶层对象，不复制任意父布局或共享分组语义。新要素“回到文档流”的入口可见性尚未完全统一。

后续候选包括多选/分组、SVG 图形对象、自由裁剪、字体管理、手动视图缩放、隐藏页管理和本地打包。它们需要分别确认范围，不自动纳入本轮。

历史[编辑器设计](superpowers/specs/2026-11-14-studio-editor-design.md)中的部分“后续”已在文本图片和剪贴板阶段完成。完整当前边界以[限制说明](limitations.md)为准。

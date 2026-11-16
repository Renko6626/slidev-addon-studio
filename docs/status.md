# Studio 阶段状态

## 当前源码：人机协同制作与原生素材，2026-11-16

版本为 `0.4.0-renko.1`。随包增加 studio-authoring skill、公开 API 的完整样例及音视频素材；agent 指南与桌面 AGENTS 明确人机协同的编辑交接。StudioMedia 沿用现有 runtime 控制播放资格，素材支持与限制见 [素材说明](custom-code/media.md)，升级说明见 [发布记录](releases/0.4.0-renko.1.md)。

验证：

- `pnpm test`：368 项中 367 通过、1 项既有可选 HTTP QA 跳过；`pnpm typecheck` 和 `vue-tsc@3.1.8 --noEmit` 通过。
- 实际 tgz 安装到独立 52.19 样例后，根路径和 `/edit/example/` 静态构建通过；样例包含本地 MP4/WAV。
- 保留工作台模板 53.0 与既有 patches 的临时工程安装、`/preview/release/` 构建通过；没有改动线上服务。
- `playground/component-fields.md` 子路径构建和既有 playground 构建通过；skill 校验与包库存检查通过。
- 一次只读审阅发现已处于播放状态时首次挂载未自动播放；已用真实 SFC 测试复现并修复。未扩大为重试或恢复机制。
- 未执行浏览器自动交互、Windows 实机或实际音视频解码验收。上述媒体单元测试模拟浏览器原生播放调用。

下文各阶段“未发布”“尚未打包”均描述当时状态。

## 当前源码：字段化题目模板，2026-11-16

`codex/studio-component-fields` 已将标准题目页改为规则控件、普通富文本题干、字段化 StudioButton 和拥有自身文案的 StudioFeedback。题目配置只保留 mode 与 `{ id, correct }` 选项；移除 StudioQuestionTitle 与旧的跨对象文字回写。普通文本框、自定义组件及标准交互对象的题目绑定在整题复制时统一更新。按用户要求不提供历史文稿迁移或兼容分支。

源码及验证记录见 [模板实施记录](superpowers/plans/2026-11-16-question-field-templates.md)。下文旧阶段的组件/API 描述仅代表当时状态。


## 当前源码：Pinia 自定义交互基础，2026-11-16

`codex/studio-custom-runtime` 提供应用级 Pinia、公共运行上下文、独立预览状态、题目首次答对计数、普通可定位计数组件和自定义示例。排版拖拽由 Studio 制作工具负责，播放时关闭 Slidev 原生拖拽入口。新桌面工程声明 Pinia，并附 agent 接入指南。本阶段源码已从 `codex/studio-custom-runtime` 快进合并到 main；未发布 npm 或打包桌面版本。

源码扩展 API 变更：`dispatchInteraction(signal)` 改为 `dispatchInteraction(runtime, signal)`；组件内使用 `useQuiz().dispatch(signal)`。Pinia 固定 3.0.4，Vue peer 下限 ^3.5.11；拖拽私有适配仅核对本仓库 Slidev 52.19。

- 完整 `pnpm test`：345 通过、1 项既有可选 HTTP QA 跳过；`pnpm typecheck` 通过。
- 静态构建发现省略扩展名的 Slidev constants 导入，修正后受影响三文件 14 项测试、类型检查和 `pnpm exec slidev build playground/custom-code.md --out /tmp/studio-custom-runtime-build` 通过。
- `npm pack --dry-run --json` 与产物库存检查通过，接入文档、公共入口及初始化文件包含在包内，静态产物未发现 Studio 编辑 UI 标记。
- 逐项及整分支 sol 审阅通过。修正计数器 snippet 重复定位属性；没有新增通用插入机制或无关测试。
- 未进行浏览器交互/截图验收、Windows 实机、工作台 53.0、多人联网或发布验证。内存状态不跨浏览器同步，手机答题服务仍属后续工作。

入口：[示例](../playground/custom-code.md)、[代码约定](custom-code/conventions.md)、[组件规范](custom-code/components.md)、[实施记录](superpowers/plans/2026-11-16-custom-runtime.md)。验证与审阅原始记录在 `/tmp/studio-custom-runtime-evidence-20261116/`。

## 阶段归档：题目管理控件与桌面准备进度，2026-11-15

归档分支为 `codex/studio-page-presets`，包含独立题目管理控件、题干拆分、关联虚线和配置入口，及桌面主页的依赖安装状态、滚动进度条与实际输出。题目统一使用新结构，不保留旧版题干兼容分支。用户要求阶段性提交并推送当前分支，暂不打包。

代码和检查结果见下方两节；此次归档不重复已经通过的检查、不新增验证范围。没有构建 Windows ZIP、发布 npm 或合并 main。下方“尚未提交／未推送”的描述为各功能完成时的记录，以本归档范围和实际 Git 历史为准。

## 当前源码：桌面主页工程准备进度，2026-11-15

新建工程仍使用内置 pnpm 安装依赖。主页增加当前阶段、滚动进度条、已用时间和最新实际安装信息；pnpm 包计数显示解析/复用/下载/安装数量，不估算总百分比。沿用现有状态事件，日志输出继续保留。查看日志不会结束主页的忙碌状态，失败后停下进度并保留错误提示。

- `pnpm exec vitest run test/desktop-runtime.test.ts test/desktop-projects.test.ts`：6 项通过。新增的一个真实 Node 子进程用例验证跨数据块分行、stdout/stderr 状态转发和日志保留，先失败后通过。
- `node --check desktop/runtime.cjs`、`node --check desktop/main.cjs`、`node --check desktop/welcome.js`、`pnpm typecheck` 与 `git diff --check` 通过。
- 仅导航并初始化状态查看主页安装中、失败和空闲截图；确认等待时按钮禁用且日志入口可用、已用时间更新，失败/空闲时隐藏进度。截图 `/tmp/studio-desktop-progress-{installing,error,idle}.png`，没有浏览器错误或自动交互。
- 一次限定范围的只读审阅未发现阻塞问题。未重复联网安装全新工程，未打包或在 Windows 实机验证，现有 Windows ZIP 尚不包含本轮改动。

## 当前源码：独立题目管理控件，2026-11-15

题页统一采用独立的 `StudioQuestion` 管理节点和 `StudioQuestionTitle` 题干。选中管理节点配置名称、题干、选项/答案和反馈，并显示与子组件的虚线关联；选中子组件只显示当前关联，属性提供定位到管理控件。节点默认只在编辑时显示，可开启播放时显示题目名称；隐藏不注销题目。删除题干保留题目，删除控件前提示并保留关联对象。按用户明确要求，移除旧版合并题干模式和兼容分支，直接使用新结构。沿用当前 Markdown、ID 绑定和运行实例，没有新增依赖或布局分组。

- `pnpm test`：314 通过、1 项既有 QA 跳过；关键行为覆盖隐藏后答题、删除题干、配置可见性切换、题干写回、复制关联和删除控件提示。独立审阅发现并修正按钮/反馈关联属性误绑定配置对象的问题，已有组件用例增加 ID 断言，先失败后通过。
- `pnpm typecheck`、`pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json` 通过。
- `pnpm exec slidev build playground/interactions.md --out /tmp/studio-question-controls-build` 通过。
- 编辑截图核对管理节点的 6 条关联线和题干的 1 条关联线、整题配置与定位入口。静态截图中编辑器/关联线数量均为 0，管理节点 `display: none`，题干和选项文字完整。截图为 `/tmp/studio-question-controls-{control,title,static}.png`。播放名称显示由真实组件测试验证，未执行浏览器开关操作。
- 浏览器仅导航、初始化截图选区及只读检查，未自动点击、输入、拖动或答题。截图校验遇到旧开发进程未发现新增组件，使用新的 3094 本地开发进程完成；静态浏览器只有已知 Wake Lock 提示。
- 本轮修改留在当前工作区，尚未提交、推送、打包或在 Windows 实机试用；现有 Windows ZIP 不包含这轮改动。
- 后续按用户要求清除兼容分支：`StudioQuestion` 默认且始终为管理控件，`presentation` 只保留 `hidden` / `summary`，题干统一由 `StudioQuestionTitle` 显示。删除合并题干的旧断言，未新增测试；运行 `pnpm exec vitest run test/interaction-source.test.ts test/quiz-components.test.ts test/interaction-inline-editor.test.ts test/interactions.test.ts test/multiselect.test.ts test/pointer-interaction.test.ts`，40 项通过。`pnpm typecheck`、上述 Vue SFC 检查和同一题页静态构建再次通过。未重复浏览器或 Windows 验收。

## 当前源码：选择题交互首版，2026-11-15

运行逻辑 `c032797`、制作配置 `5b29891` 和编辑集成 `539d288` 已在主工作区整合。支持单选/多选题页与关联按钮、固定四选项的文案和答案配置、简单文字编辑、按钮外观预览、反馈效果及集合复制关联重命名。试播切页保留作答，回编辑重置；外部扩展只接统一 `dispatchInteraction` 信号入口，没有网络或任意脚本托管。

整合验收已有结果如下；文档收尾未重复运行测试或构建：

- `pnpm test`：308 通过，1 项需显式启用的 QA 跳过。
- `pnpm typecheck` 通过。
- `pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json` 通过。
- `pnpm exec slidev build playground/interactions.md --out /tmp/studio-quiz-final-build` 通过。
- 已查看单选配置、多选按钮配置、预览和静态截图；静态页面编辑器数量为 0，两题与按钮文案完整。仅导航及初始化选择用于截图，没有自动点击、输入、拖动或答题流程；浏览器仅有既有 Wake Lock 提示。截图保存在本地 `../release/studio-quiz-2026-11-15/`。

本轮未在 Windows 测试、未重新打包、未推送或发布 npm。首版不提供增删选项数量、题型切换、计分或计时。用法见[中文指南](usage.zh-CN.md#选择题与按钮)，信号示例见[组件说明](components.md#question-interactions)。

## 多选、图层与背景/图片位置检查点，2026-11-15

三个阶段已在主工作区整合，功能提交为 `9b11787`、`6a304e3`、`a8f8246`。沿用 Vue、Slidev、`v-drag` 和 Markdown 写回，没有新增持久对象模型或服务。

- 多选：Shift 点选、空白处框选，批量移动、复制、粘贴、删除，六向对齐和水平/垂直等距；一次批量动作一次撤销。多选时禁用字体与段落控件，不包含永久组合、批量缩放/旋转或跨页选择。
- 图层：从“视图”“对象”或右侧图层入口打开；支持对象只在同一父容器内调序，未知组件仅可选择。背景不参与选择、图层或对象剪贴板；CSS 层级保留在放映和静态构建中。
- 背景与图片：自由画布支持背景颜色、图片和清除，有效背景更改会清空选区；图片“填满外框”提供 `object-position` 百分比和居中复位，外框不变，未提供拖动裁剪工具。

三阶段整合验收已有结果如下；本次文档收尾未重复运行测试或构建：

- `pnpm test`：285 通过，1 项需显式启用的 QA 跳过。
- `pnpm typecheck` 通过。
- `pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json` 通过。
- `pnpm exec slidev build playground/three-stages-check.md --out /tmp/studio-three-stages-build` 通过。
- 已查看最终多选、图层、图片位置与静态层级截图。静态页面没有编辑器 UI，图层 `100/102/101` 正确保留。浏览器只有已知 Wake Lock 权限提示；未自动点击、输入或拖动，仅设置截图初始状态。

该检查点的三个阶段当时尚未推送、重新打包或在 Windows 验收，也未发布 npm。此前用户对 Windows 的良好反馈针对 `7378cc0` 检查点旧包，不代表这三个阶段已通过 Windows 验收。使用方法见[中文指南](usage.zh-CN.md)，当前范围见[限制说明](limitations.md)。

## 历史阶段记录

下文保留各阶段当时的实现、发布状态与验证结果；当前状态以上文为准。

## 原生标题与段落富文本，2026-11-15

本阶段在 `codex/studio-native-text` 实施，基于 `da1531a`，已按用户要求阶段性提交、合并到主工作树的 `main` 并推送远端。普通 ATX Markdown 标题、段落及独立 HTML 标题/段落共用已有 Tiptap 字体与段落工具，支持局部、光标和整块格式。简单标记保留 Markdown，其他格式保存为标准 HTML；保留标题层级、文档流及原 HTML 根属性。新增段落写为相邻块，生成的 HTML 列表可继续编辑；组件内文、frontmatter 和复杂源码沿用原路径。

- [设计](superpowers/specs/2026-11-15-native-text-design.md)、[实施计划](superpowers/plans/2026-11-15-native-text.md)及使用/限制说明已更新；无新依赖或服务接口。
- `pnpm test`：238 通过、1 项既有 QA 跳过；审阅及选区修正后的受影响测试 29 项通过。`pnpm typecheck`、临时 Vue SFC 检查通过。
- `pnpm exec slidev build playground/slides.md --out /tmp/sunyunbo/studio-native-text-static-build-20261115` 通过，原 playground 未改动。
- 临时工程的富文本 HTML 与 3 个编辑器 Vue 组件在 `/` 和 `/edit/native-probe/` 下均可编译；结果见 `/tmp/sunyunbo/studio-native-text-http-20261115/results.json`。
- 一次只读审阅后修正字面 Markdown、HTML 和实体被重新解释的问题，改用语义 HTML 保留实际文字；精确重选在等待渲染时也保留用户后来的选择。
- 未执行浏览器自动点击、输入或交互流程，真实选区与输入法仍需试用。按用户要求暂不更新 Windows ZIP；已有桌面预览包不包含本轮改动，未发布 npm。

## 阶段提交检查点，2026-11-15

工程“文件”页及 Windows 桌面宿主两阶段源码、测试、计划和说明已提交为 `da1531a`，推送至 `origin/codex/studio-rich-text`，随后按用户要求合并到主工作树及 `origin/main`。Windows ZIP 保留在本地 `release/studio-windows-2026-11-15/` 交付目录，不纳入 Git。未发布 npm 或创建 GitHub Release。下方各阶段的“未提交/未合并”记录描述当时状态，以本检查点作为后续归档范围。

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

## 富文本阶段会话检查点（历史）

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

## 早期工作区成果（历史）

| 阶段 | 已交付内容 | 实现记录 |
| --- | --- | --- |
| 编辑工作区 | 左侧逐页浏览、分组功能区、中央画布、右侧属性、备注、预览和放映 | [计划与验证](superpowers/plans/2026-11-15-studio-editor.md) |
| 文本框和图片 | 整框文字格式、自动高度、图片插入与替换、锁比、完整显示与填满外框 | [计划与验证](superpowers/plans/2026-11-15-text-images.md) |
| 对象剪贴板 | 原生复制粘贴、同一文稿跨页插入、错位副本、准确选中、保留输入态行为 | [计划与验证](superpowers/plans/2026-11-15-object-clipboard.md) |
| 中英文及工程适配 | 独立 Vue I18n、Vite base、素材目录和 URL 写回 | [早期设计](superpowers/specs/2026-11-08-studio-i18n-design.md) |

主要功能提交为 `40e9bc3`、`1850533`、`3993273`、`4b08beb`；`ad6b5f1` 保存了当时的示例试用状态。当前 `playground/slides.md` 是开发和手动试用文稿，也保留了后续试用中的编辑记录。

## 早期版本与集成（历史）

源码中的新工作区、基础元素和对象剪贴板尚未发布为新 npm 版本，`package.json` 仍为 `0.3.1-renko.1`。安装该 npm 版本不会获得本阶段源码新增能力。

本轮工作是整理文档、阶段性提交、推送并合并到 `main`。Release 工作流仅由版本标签触发；本轮不创建标签、不发布 npm，也不升级协作工作台或已有活动的依赖。

## 早期整合验证（历史）

本轮文档整理及当前试用文稿的整合检查已完成：

- `pnpm test`：197 个用例通过；1 个需要 `STUDIO_QA_URL` 的服务 QA 跳过。
- 本轮 `pnpm typecheck`、`pnpm exec slidev build playground/slides.md --out /tmp/studio-merge-build` 通过。功能阶段另已通过临时 Vue SFC 类型检查，本轮未改产品代码。
- 本地 Markdown 链接目标检查与 `git diff --check` 通过。
- 普通开发路径、子路径编辑视图、静态图片展示已查看截图。仓库保存了[工作区](images/workspace.png)、[文本图片](images/text-images.png)和[图片显示模式](images/picture-frames.png)截图。
- 完成过各功能阶段的只读代码审阅；发现的模式关闭保护、列表复制边界及动画包装保留问题已修复。
- 没有自动执行浏览器输入、点击、拖动、文件选择、剪贴板或全屏流程。真实交互验收仍需用户试用。

## 早期限制与后续候选（历史）

页面结构变更仍刷新并清空撤销历史；第一页与跨文件排序限制保留。对象剪贴板限定同一入口的完整顶层对象，不复制任意父布局或共享分组语义。新要素“回到文档流”的入口可见性尚未完全统一。

当时的后续候选包括多选/分组、SVG 图形对象、自由裁剪、字体管理、手动视图缩放、隐藏页管理和本地打包，均按各后续阶段分别确认范围。

历史[编辑器设计](superpowers/specs/2026-11-14-studio-editor-design.md)中的部分“后续”已在文本图片和剪贴板阶段完成。完整当前边界以[限制说明](limitations.md)为准。

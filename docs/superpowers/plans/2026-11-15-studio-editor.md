# Studio 完整编辑模式实施计划

> 历史阶段记录。当前功能、版本状态和已知限制见 [阶段状态](../../status.md)。后续阶段可能已完成文中的暂缓项。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在现有 addon 内完成 PowerPoint 式编辑外壳，保留真实 Slidev 画布与 Markdown 编辑能力。

**Architecture:** UI 继续由 `StudioRoot` 提供编辑上下文，顶部、页面栏、属性、插入目录和备注分别呈现。复用原有写回和页面 API；显示区域使用实际中央空间测量，模式使用现有开关、路由查询和 Slidev 全屏对象。

**Tech Stack:** 现有 Vue 3、TypeScript、VueUse、Vue I18n、Slidev 和 Vitest；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-11-14-studio-editor-design.md`

## Global Constraints

- 只修改 addon fork；不接入 Git、工作台、账号、数据库或桌面框架。
- 沿用 Markdown、`public/`、Vite base、现有源码映射和写回语义。
- 中英文一致；用户内容、组件名和片段不强制翻译。
- 首版自动适应，无手动缩放、多选、图层引擎、恢复队列或跨文件排序。
- 保留页面结构操作刷新与清空撤销历史等现有限制。
- 用户已授权制定计划后直接实施，不再增加计划批准或执行方式选择。
- 本次按用户验证约定：只给关键新增行为补简短测试；完整改动集中验证，不逐小步重复全量测试。浏览器仅打开页面并截图，不自动点击、输入或操作业务流程。

## Review Focus

- 页面比例或窗口宽度变化后，画布仍位于中央，选框坐标沿用实际 DOM；用适应尺寸测试和截图验证。
- `?studio=1` 在子路径下可直接进入，关闭/预览后查询参数与偏好一致；测试入口查询解析，静态审阅路由联动。
- 页面栏与顶部调用同一组页面操作，仍清空旧历史并定位返回页；保留现有 deck 测试，检查共享调用。
- 原位编辑未完成时，切页/退出/放映不丢草稿；检查禁用与现有快捷键路径。交互实操留给用户。
- 缩略图渲染不被误当主画布；目录插入后属性、动画选项卡及备注保持正确当前页；复用既有选择代码并进行整体验证。

## 文件与职责

- `client/state.ts`：外壳标签、侧栏显隐、目录选择等少量 UI 状态；原有内容选择不变。
- `client/composables/useEditorMode.ts`：入口查询、预览、由 Studio 发起的全屏及返回。
- `client/composables/useDeckActions.ts`：收敛页面栏和工具栏已需要的页面操作。
- `client/editor-view.ts`：无 DOM 的适应画布与入口参数逻辑，供实际外壳调用和行为测试。
- `client/ui/StudioRoot.vue`：布局、上下文及中央空间测量；`StudioToolbar.vue`：文稿栏、分类、分组命令。
- `client/ui/StudioDock.vue`：右侧详细设置；新增 `StudioLibrary.vue`、`StudioNotes.vue`：目录浮层及唯一备注表单。
- 原有 `PanelSlides`、`PanelInspect`、`PanelLayout`、`PanelAnimate`、`PanelComponents`：分别适配页面栏、高级选项、拆出备注/切换、目录插入完成反馈。
- `styles/studio.css`、两份 i18n 字典、`types/slidev-client.d.ts`：样式、文案、实际使用的 Slidev API 声明。
- `test/editor-view.test.ts`：只覆盖比例适应与入口解析关键新增行为；README 更新使用说明。

### Task 1: 编辑入口和共用操作

**Interfaces:** `editorOpenFromQuery(value, fallback): boolean`；`fitSlide(area, slide): { left, top, width, height, scale }`，输入矩形及幻灯片宽高；`useDeckActions()` 返回 `add/duplicate/remove/move`；`useEditorMode()` 返回 `preview/present/returnToEditor`。

- [x] 新增入口解析与画布适应行为测试：显式开/关覆盖偏好、未提供参数沿用偏好；宽/高限制下正确居中、空区域不产生 NaN。
- [x] 实现纯函数及 UI 状态；移动原 `PanelSlides.run` 到共用 composable，保留刷新导航与历史语义。
- [x] 通过 Slidev router 更新 `studio` 参数；沿用 fullscreen，退出自发全屏后返回，失败时提示；编辑文字时阻止模式切换。
- [x] 用新测试验证实际生产函数，结果必须通过。

### Task 2: 布局与页面导航

**Interfaces:** 页面栏使用 `useDeckActions`；中央空白占位区域供 `StudioRoot` 测量；`useSlideCanvas` 继续从 `#slide-content` 计算选框位置。

- [x] 外壳改为顶部、左右栏、中央占位、备注和底栏；为真实 Slidev 页面设置与中央区域对应的位置和大小，关闭时还原。
- [x] 改造页面列表为可键盘聚焦的缩略图列表，避免嵌套按钮；按宽度传递缩略图尺寸，当前页自动滚入可见区。
- [x] 窄窗口自动隐藏可选侧栏，明确入口可恢复；属性面板关闭只收起属性，不退出整个编辑器。
- [x] 备注移入唯一组件，按当前页读取并用已有 change 语义写回；底栏提供备注开关及适应比例。

### Task 3: 功能区与详细设置

**Interfaces:** 顶部使用现有 `actions`、`BASIC_BLOCKS`、`useStudioHistory`、`useDeckActions`；目录组件通过完成事件关闭；右侧面板模式 `auto/layout/animate/transition`。

- [x] 实现文稿名称、撤销重做、预览/放映和分类标签；开始/插入/设计/切换/动画/视图/对象各组只放已有可执行命令。
- [x] 选中对象时提供上下文标签，取消选择回到开始；详细动画面板不因对象选择变化被强制切走。
- [x] 将现有页面切换表单抽成 `PanelTransition.vue`，复用同一 frontmatter 写回和选项；动画仅保留元素与点击步骤。
- [x] 目录以可关闭浮层呈现，保留画布可拖入和右侧属性；组件插入完成后关闭，切到当前对象属性。
- [x] 元素源码/类名放入高级 details；新按钮和提示同步中英文；不把文档顺序描述成置顶/置底。

### Task 4: 验证与交付

- [x] 更新 README：完整编辑模式、`?studio=1`、备注/预览入口和保留限制。
- [x] 集中运行 `pnpm test`、`pnpm typecheck`，预期全部适用检查通过；真实服务 QA 在未配置 URL 时允许跳过并报告。
- [x] 用现有 Slidev playground 做构建和开发页面编译；开发模式需实际加载 Studio，不能仅凭导出构建通过。
- [x] 如截图工具可用，打开带 `studio=1` 的 playground，检查正常桌面和窄窗口布局；不进行自动交互测试。
- [x] 一次只读完整改动审阅；仅修复具体核心问题，运行受影响检查，不为理论风险扩展功能。
- [x] 保存功能分支提交，报告命令结果、截图和未实际操作验证的项目；不发布、不合并到 main。


## 执行与验证记录

完成于 2026-11-15，功能分支 `codex/studio-workspace`。在现有干净检出中创建功能分支以复用依赖，未修改 main 或发布。实际 SlideContainer 使用已有尺寸观察器适应中央区域，未另建渲染链路。

- `pnpm test`：179 通过，1 个要求 `STUDIO_QA_URL` 的真实服务 QA 跳过。
- `pnpm typecheck`：通过。
- Vue SFC 类型检查：通过；临时使用 vue-tsc，显式调用项目已有 TypeScript 5.9.3，未改项目依赖。运行入口为 `vue-tsc --noEmit`（当时使用临时工具并显式指定项目 TypeScript）。
- `pnpm exec slidev build playground/slides.md --out /tmp/studio-build`：通过。
- 开发页面 `/3?studio=1`：1440×900 和 960×720 截图检查通过；窄窗口中原生 Slidev 控制条已隐藏。
- 一次只读完整审阅完成。关闭保护的同步回调重入导致选区丢失，通过实际模式 composable 的回归测试复现并修复；预览往返保留其他查询参数也得到覆盖。
- 同一修正轮恢复新备注和目录区域的浏览器右键菜单。这是新界面引入的实际编辑回归，修复只调整选择器，没有增加 DOM 测试基础设施。
- 按用户约定集中验证，仅为关键新行为和具体故障增加永久测试。未做自动点击、输入、拖动或放映流程验收；这些交互待用户试用。截图环境中既有 Slidev Wake Lock 权限被 headless 浏览器拒绝，未修改上游权限行为。
- 桌面和较窄窗口截图保存在 [仓库截图](../../images/workspace.png)。未接入工作台/Git、未新增依赖、未发布或合并。

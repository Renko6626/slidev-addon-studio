# Studio 拖动与点击切换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 首次按下直接拖动，文字编辑后的同一次点击完成对象切换。

**Architecture:** 在现有选择 composable 内复用指针选择处理，由 StudioRoot 接到 gizmo。InlineEditor 提交草稿后将外部点击交回选择处理；异步重选不覆盖后来的用户选择。

**Tech Stack:** 现有 Vue、TypeScript、Slidev、Vitest，不新增依赖。

**Spec:** `docs/superpowers/specs/2026-11-15-pointer-interaction-design.md`

## Global Constraints

- 用户已批准设计并要求直接实施；本次自行执行，不再增加计划确认。
- 保留 Markdown、真实画布、4/12 屏幕像素阈值、一次拖动一次写回。
- 不增加队列、手势回放、持久对象 ID 或全局交互状态机。
- 不进行浏览器自动点击、输入或拖动；只给关键行为增加简短回归测试。
- 使用当前检出的功能分支 `codex/studio-pointer-interaction`，复用已有依赖。

## Review Focus

- 首次按下与已有覆盖层拖动都可用，轻点不改源码。
- 同一文字对象双击可编辑，快速连续拖动及不同对象不会被双击保护吞掉。
- 草稿提交先读取 A，再选择 B；源码模式外部点击同样处理。
- 旧 commit 和重选等待不抢回选区；文字改变行数后 B 仍根据源码映射定位。
- 输入内部、浮动文字工具、右键及其他面板保持现有操作；保存期间不启动新拖动。

### Task 1: 首次拖动与双击

**Files:** `client/composables/useSelection.ts`、`useTransformGizmo.ts`、`client/ui/StudioRoot.vue`、`test/pointer-interaction.test.ts`。

**Interfaces:** useSelection 提供 `selectOnPointer(event, startDrag?)` 与 `editOnPointer(event)`；可选回调接收初次按下并调用 gizmo.startMove。gizmo 在同一对象的完整点击之后识别第二次按下，双击回调复用编辑入口。

- [x] 用真实 composable 和最小宿主事件替身覆盖首次拖动写回、轻点不写回、不同对象快速拖动与双击。
- [x] 接通选择和拖动；完成拖动后不保留双击候选，缩放/旋转不参加文字双击判定。

### Task 2: 文字提交与选区交接

**Files:** `client/context.ts`、`client/ui/InlineEditor.vue`、`StudioRoot.vue`、`client/composables/useSelection.ts`、`test/pointer-interaction.test.ts`。

**Interfaces:** StudioContext 暴露 `selectOnPointer`；InlineEditor 外部按下同步启动 apply，再调用选择入口且不启动拖动；reselect 保留调用时的选区引用并在异步完成前核对。

- [x] 外部点击复用同一选择处理，覆盖可视与源码编辑；apply 对重复的 blur 调用直接返回。
- [x] commit 写入后若用户已选其他对象则跳过旧重选；reselect 等待期间也不得覆盖新选择。
- [x] 重选时通过已有 describe/resolveRange 修正被文字行数变化影响的范围；支持 frontmatter 目标重新绑定。
- [x] 对重选被新选择/空白取消打断，以及源行号改变的 B 定位增加行为检查；真实文字输入与浏览器事件衔接留给用户试用。

### Task 3: 验证与交付

- [x] 集中执行 `pnpm test`、`pnpm typecheck`、Vue SFC 类型检查与必要的开发组件编译；不重复搭建 UI 验证环境。
- [x] 一次只读完整改动审阅，仅处理本轮核心问题。
- [x] 更新交互说明和验证记录，保存在功能分支，不发布或合并。

## 执行记录

- 基线 `fe5e6b6`；只存在上轮新增的设计草稿，未发现用户未提交的产品改动。
- 按用户集中验证约定执行；不机械逐任务重复全量测试。

- 修改集中在现有选择、gizmo、StudioRoot 和 InlineEditor；增加一项组件上下文回调，没有新增依赖或存储机制。
- `pnpm exec vitest run test/pointer-interaction.test.ts` 首轮复现首次拖动、连续拖动和重选问题；修正后完整 `pnpm test` 为 206 通过、1 个要求 `STUDIO_QA_URL` 的服务 QA 跳过。畸形元数据用例输出预期警告。
- `pnpm typecheck` 通过。
- Vue SFC 类型检查通过：`node -e 'require("/data/sunyunbo/.npm/_npx/c84f07d5af870f7e/node_modules/vue-tsc/index.js").run(require.resolve("typescript/lib/tsc"))' -- --noEmit`，复用本机已有工具及项目 TypeScript，没有改依赖。
- 开发编译：`pnpm exec slidev playground/slides.md --port 3072`，只打开 `/3?studio=1` 并截图，工作区显示正常。截图为 `/tmp/studio-pointer-interaction.png`；仅出现既有 Slidev Wake Lock 权限拒绝，未改变其行为。
- 一次独立只读审阅完成，没有确定的 Important/Critical 遗留问题。针对合成双击与外部按下监听的先后关系，补回“编辑器已就绪才允许提交”的局部条件，避免同一次按下提交尚未初始化的草稿；修正后重新运行 Vue SFC 检查。
- 检查调用真实选择和拖动 composable，宿主 DOM 使用最小替身；没有挂载完整 InlineEditor/SelectionLayer 做自动交互验收。中文输入、双击光标落点、覆盖层命中和连续操作的真实手感待用户试用。
- 本轮实现范围已完成；文字工具及富文本体验的系统调整仍是下一阶段。保留功能分支，不推送、不合并、不发布。

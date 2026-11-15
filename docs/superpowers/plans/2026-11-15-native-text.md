# Native Text Rich Editing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in this session, following the existing implementation workflow.

**Goal:** 让普通标题和段落共用 Studio 文本框的富文本工具，保持标准 Slidev 源码。

**Architecture:** 既有 Tiptap 引擎和保存链路不变，在 client/text 内补充原生块源码适配，统一 useTextEditor 的提交及选中恢复。

**Tech Stack:** 当前 Vue、Tiptap/ProseMirror、TypeScript、Vitest/jsdom；无新依赖。

**Spec:** `docs/superpowers/specs/2026-11-15-native-text-design.md`

## Global Constraints

- 保留标题语义、文档流、原有样式/定位/动画，不自动转为 Studio 文本框。
- 能用 Markdown 表达时继续保留 Markdown；其他格式使用标准 HTML。
- 不从组件渲染结果覆盖作者源码，不扩展 frontmatter 或任意复杂容器。
- 复用已有控件、编辑历史及测试文件；不自动执行浏览器交互。
- 在功能分支实施；完成后用户已要求阶段性提交并合并，暂不更新桌面 ZIP。

## Review Focus

- Markdown → HTML 后 source kind/tag 变化，必须重新选中准确范围。
- heading 不应被包装成 div/p 而失去标题层级。
- 原 HTML 的 class/style/v-drag/v-click 和相邻源码保持。
- 作者的模板表达式、自定义属性及嵌套组件不能经 DOM 编辑丢失。
- 段落/列表写回应为合法结构，重开后仍可富文本编辑。

### Task 1: 原生文字读写

**Files:** `client/text/source.ts`, `test/rich-text.test.ts`。

**Interfaces:** `readEditableText(content, target)` 返回可编辑内容和源码范围；`writeEditableText(content, source, html)` 返回完整内容及重新选中的 range/tag。

- [x] 添加实际原生标题/段落读写和属性保留测试，先观察缺失能力。
- [x] 实现源码适配；简单格式保留 Markdown，必要格式使用原语义 HTML。
- [x] 对不支持的内文保留原编辑路径；覆盖多段落和列表结果。

### Task 2: 编辑器与功能区

**Files:** `client/composables/useTextEditor.ts`, `client/ui/InlineEditor.vue`, `client/ui/StudioRoot.vue`, `client/ui/StudioToolbar.vue`, `client/ui/parts/TextElementFields.vue`, `styles/studio.css`, i18n。

- [x] 复用已有富文本实例，捕获编辑前源码并统一应用，保留文本框行为。
- [x] Markdown/HTML 变化后恢复选中；点击其他对象不抢回选区。
- [x] 原生文字支持 F2 和进入“开始”；工具栏按支持能力启用，更新中英文提示。
- [x] 编辑时文字继承原标签的字体尺寸，避免内部段落套用主题正文样式。
- [x] 运行相关现有编辑与富文本测试。

### Task 3: 验证与说明

- [x] 集中运行测试、TS、Vue SFC、静态构建和临时 HTTP 编译探针。
- [x] 一次只读审阅，修正实际核心问题，不扩大边界功能。
- [x] 更新使用/限制/状态文档及计划，报告实际结果和交互验证边界。

## 验证结果

- `pnpm test`：238 项通过、1 项既有 QA 跳过。审阅及选区修正后，仅重跑受影响的 `pnpm test test/pointer-interaction.test.ts test/rich-text.test.ts`：29 项通过。
- `pnpm typecheck` 通过；`pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json` 通过，未新增依赖。
- `pnpm exec slidev build playground/slides.md --out /tmp/sunyunbo/studio-native-text-static-build-20261115` 通过，未改动原 playground。
- 临时 HTTP 工程在 `/` 和 `/edit/native-probe/` 下编译富文本幻灯片及 StudioRoot、InlineEditor、StudioToolbar 成功；探针和结果位于 `/tmp/sunyunbo/studio-native-text-http-20261115/`。
- 一次独立只读审阅发现字面 Markdown 块标记、HTML 和实体会被重新解释；已让这些内容走既有语义 HTML 写回，并增加实际内容保留断言。精确范围重选也沿用现有选择变化检查，等待渲染期间不会覆盖后来的选择。
- 未执行浏览器自动点击、输入或交互；真实选区、输入法及 Windows 使用仍待试用。完成后按用户要求阶段性提交、合并到主工作树的 `main` 并推送远端；暂不更新已有桌面 ZIP，未发布 npm。

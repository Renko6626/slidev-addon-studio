# 新建页版式 Implementation Plan

**Goal:** 提供可直接编辑的七种新建页版式，整理基础插入入口。
**Architecture:** 复用现有对象序列化和 deck insert；共享版式对象数据驱动预览及内容生成。
**Tech Stack:** 现有 Vue、TypeScript、Slidev，无新依赖。
**Spec:** `docs/superpowers/specs/2026-11-15-page-presets-design.md`

## Global Constraints

- 保留现有工作区改动；在当前功能分支连续实施，不迁移未提交的文字/形状功能。
- 不扩展已有页自动换版式、模板管理或业务组件。
- 验证按完整改动集中执行，浏览器最多截图。

## Tasks

- [x] `client/page-presets.ts` 定义共享版式及序列化；`test/page-presets.test.ts` 验证对象编辑、替换与画布尺寸。
- [x] `PanelPagePresets.vue` 展示同源预览，通过 `useDeckActions.add` 的现有插入接口创建页面；接入 `StudioLibrary`、工具栏和左栏。
- [x] 整理 `PanelComponents` 扩展块与工具栏标题插入，添加中英文说明和样式，保留高级 layout 设置。
- [x] 集中运行 `pnpm test`、`pnpm typecheck`、Slidev 构建，检查 diff 并记录结果。

## Review Focus

检查图片占位可更换、文本可编辑、空白页无占位文字、非 16:9 画布、已有内容不被新建操作替换。复用已有 deck 插入测试；不为文案样式新增测试。

## 结果

- `pnpm test`：259 passed、1 skipped；修复新增测试 nullable 类型声明后，`pnpm test test/page-presets.test.ts`：4 passed。
- `pnpm typecheck`：通过。
- `pnpm exec slidev build playground/slides.md --out /tmp/studio-page-presets-build`：通过。
- 通过临时 Vite SSR 调用真实生成器生成七页文稿，`pnpm exec slidev build playground/page-presets-check.md --out /tmp/studio-page-presets-content-build`：通过；临时文稿已清理。
- `git diff --check`：通过。
- 1440×900、1000×760 版式库截图及生成图文页截图已查看。仅设置初始面板显示状态并导航截图，未自动点击、输入或执行编辑流程。浏览器报告 Slidev Wake Lock 权限拒绝，页面正常显示。
- 独立只读审阅未发现本轮核心可用性问题。实际插入、编辑文字和文件选择仍由用户试用，不将单元测试当作交互验收。
- 当前分支 `codex/studio-page-presets` 保留既有未提交的文字/形状改动；没有提交、发布或更新其他工程依赖。

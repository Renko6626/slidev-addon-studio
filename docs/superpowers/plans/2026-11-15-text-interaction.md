# Text Interaction Implementation Plan

> 使用 executing-plans 在当前会话实施；用户要求快速推进，沿用当前干净工作目录，不改变技术路线。

**Goal:** 改善文字选区与工具衔接，补齐常用段落和粘贴操作。
**Architecture:** 复用 text/editor、text/source、useTextEditor 和 TextElementFields 的既有职责。
**Tech Stack:** Vue、Tiptap、TypeScript；无新依赖。
**Spec:** `docs/superpowers/specs/2026-11-15-text-interaction-design.md`

## Constraints
不改组件数据结构或文本框尺寸；不自动浏览器交互；只为关键新增行为补现有测试。

## Tasks
- [x] 在现有富文本测试补选词、段落间距、列表适配和粘贴的行为断言。
- [x] editor/source 实现选词、间距和安全列表读写；useTextEditor 衔接选区与粘贴。
- [x] 复用格式字段增加字号步进、字体预览、间距；浮动条提供粘贴模式，修正按钮和输入焦点。
- [x] 集中检查、一次审阅，记录结果和试用边界。


## 验证与审阅
- 新增行为先观察失败；实现后富文本测试通过。一次独立只读审阅复现段中粘贴多拆段和单项列表取消后恢复原前缀，已用既有测试文件覆盖并修正。
- `pnpm exec vitest run`：246 通过，1 项既有 QA 跳过。最后两处修正后仅重跑 `pnpm exec vitest run test/rich-text.test.ts`，26 通过。
- `pnpm exec tsc --noEmit` 通过；`pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json` 通过，最后修正后亦通过。
- `pnpm exec slidev build playground/slides.md --out /tmp/studio-text-interaction-build-20261115` 通过。
- 开发页 `http://localhost:3086/10?studio=1` 只读打开截图，编辑器编译与布局可用；截图 `/tmp/studio-text-images-interaction.png`。仅出现已有 Wake Lock 权限提示。未执行自动点击、输入、拖动、选区或剪贴板交互。
- 本轮修改当前工作区源码，未发布 npm 或重打桌面 ZIP。模板/组件库清理待后续工作。

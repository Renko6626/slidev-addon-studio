# 文字编辑 B 方案实施记录

用户已确认采用 B：纯文本字段、富文本、源码三条路径，并要求明确的 HTML / Markdown / 组件标签源码入口。

## 实施范围

- [x] 题目文案和 frontmatter 字段共用纯文本编辑界面，分别保留业务写回与 frontmatter 保存。
- [x] 常规文本框、标题、段落、列表沿用现有 Tiptap 富文本及会话撤销。
- [x] 复杂 HTML、引用、混合容器和其他不支持内容直接读取原始源码，移除旧 block/container/html 的 DOM 就地编辑路径。
- [x] 属性面板和右键菜单提供编辑 HTML / Markdown / 组件标签入口，原属性面板内的独立源码草稿改为共用入口。
- [x] 源码编辑显示行范围，应用只替换会话持有范围，取消不写入。源码框没有 Markdown 格式按钮，避免对 HTML 误用。
- [x] 富文本切换源码先保存全部草稿、再恢复原 DOM；会话范围保留，新增多个段落也进入草稿。
- [x] 删除无消费者的容器序列化功能及其 7 个专属用例，保留富文本仍使用的 Markdown 保真检查和序列化。
- [x] 更新编辑参考、限制说明及中文使用指南。

## 证据

工作树 `/data/sunyunbo/www/better-ppt/.worktrees/studio-text-paths`，分支 `codex/studio-text-paths`，基线 `ec7f26d`。没有混入另一工作树中尚未提交的组件 snippet 修复。

新增 6 个真实编辑器会话用例：复杂 HTML 定范围写回、Vue 绑定不变、取消恢复、富文本多段草稿切源码、显式源码入口绕过富文本、引用块不扩大到邻居。前四个用例在改动前失败。原有题目文案写回和未改不写入用例保留。

- `pnpm test`：344 通过，1 项可选 HTTP QA 跳过。
- 最后的入口标签工具提取后，`pnpm exec vitest run test/interaction-inline-editor.test.ts test/rich-text.test.ts`：34 通过。
- `pnpm typecheck`、`git diff --check` 通过。
- `pnpm exec slidev build playground/slides.md --out /tmp/studio-text-paths-build` 通过。
- 开发服务 HTTP 编译检查：InlineEditor.vue、PanelInspect.vue、StudioRoot.vue、setup/context-menu.ts 返回 200。
- 静态构建检查时发现菜单标签帮助函数间接引入富文本依赖，已提取为无运行时依赖的 source-label.ts；再次构建恢复原有 shortcuts 体积范围。

没有浏览器自动交互、Windows 验收、发布或桌面打包。本轮改动待提交、推送与合并。

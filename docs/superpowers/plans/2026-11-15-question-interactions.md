# Question interactions implementation plan

Spec: `docs/superpowers/specs/2026-11-15-question-interactions-design.md`。用户已授权首版实现，沿用此前 sol 并行执行与主 agent 最终验收方式。

## 分工与接口

- [x] 运行逻辑：`shared/quiz.ts` 的类型/判定与 `runtime/interactions.ts` 的会话和统一入口；`runtime/useInteractionPage.ts` 适配 Slidev 页面实例；三个普通 Vue 组件及必要静态样式。所有公开组件/信号遵守 spec。输出 `setInteractionEditing(boolean)`、`dispatchInteraction(signal): boolean`；编辑器只调用会话入口，不导入运行时的文稿状态。
- [x] 编辑制作：`client/md/interactions.ts` 读取/写回组件参数、模板生成与复制重命名；`InteractionFields.vue` 及插入入口，题目/按钮配置和非运行态外观预览。与另外两方协调文本读写 helper 与 runtime types。
- [x] 生命周期与编辑衔接：Studio 模式开关接入 runtime setter；InlineEditor 题干/按钮简单文字编辑；剪贴板/复制使用 source helper重新绑定包含题目配置的集合。确认静态构建和源码注释选择范围，处理打包文件清单与必要本地类型声明。
- [x] 按上述顺序整合，集中测试/类型/构建/截图，记录实际结果及未验收项。代理仅本地提交，主 agent 最终收尾文档。

## 共同约束

保持现有源码模型、组件接口和 Markdown 保存，无新依赖/后端/脚本沙箱/通用工作流。未知复杂源码保留高级编辑。首版两种题型，不扩展计分、联网、恢复队列。不要运行浏览器自动交互；新增测试仅关键实际行为。共享文件最小改动，不回退其他工作。新增重要边界先报告，常规字段/样式实现自行推进。


## 交付与验收

三个实现阶段已整合为 `c032797`、`5b29891`、`539d288`。使用说明、组件信号示例及 `playground/interactions.md` 随本次文档收尾提交。

整合验收：`pnpm test` 308 通过、1 项 opt-in QA 跳过；`pnpm typecheck`、临时 `vue-tsc@3.1.8` / `typescript@5.9.3` 全项目检查，以及 `pnpm exec slidev build playground/interactions.md --out /tmp/studio-quiz-final-build` 均通过。已查看配置、预览与静态截图，静态没有编辑器 UI；未自动点击、输入、拖动或答题。未进行 Windows 测试、重新打包、推送或 npm 发布。详细结果见[当前状态](../../status.md)。

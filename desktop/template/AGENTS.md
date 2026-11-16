# 人机协同制作这份演示

人和 coding agent 在同一份工程中多轮接续创作。人用 Studio 编辑内容、排版和试播，agent 根据任务补充内容、效果与逻辑。先读 `node_modules/slidev-addon-studio/skills/studio-authoring/SKILL.md`，再按需查接口。

接手前请人应用并保存，读取最新文件；agent 修改期间暂停在 Studio 编辑同一内容，完成后查看刷新结果。

普通标题和说明保留为独立文本框；需要分别移动的对象不要封装进整页组件。组件内部常改文字和图片要通过 props、studio 元数据和字段标记暴露。后续修改逻辑时保留用户已经调整的 v-drag、文字和素材。交付时列明可编辑入口及仍需代码修改的部分。

这是普通 Slidev 工程。入口是 `slides.md`，可复用 Vue 组件放在 `components/`，图片放在 `public/`。仅按实际需要创建 `stores/`、`composables/`、`services/` 和 `setup/`。

先读随 addon 安装的接入指南：[agent-guide.md](node_modules/slidev-addon-studio/docs/custom-code/agent-guide.md)，再按需阅读同目录的代码约定和组件规范。桌面工程将 addon 安装在 `slidev-addon-studio` 这个包名下；即使归档的原始包名带有 scope，也用 `slidev-addon-studio/runtime` 导入公共接口。

- 外观和内容用 props 配置，位置与外框用页面 `v-drag`；组件保留单个真实 DOM 根。
- 内置题目与正确次数复用 `useQuiz()`。不要复制一套答案状态或自行累加计数。
- 自定义 store 使用工程直接依赖的 Pinia，通过 `useStudioContext().runtime.pinia` 获取当前实例；setup 通过 `getStudioRuntime(app)` 复用宿主，不安装第二个 Pinia。
- 组件挂载不代表正在放映；业务操作检查 `context.active`，整场服务观察 `runtime.canRunServices`。编辑、缩略图、组件库及辅助视图不启动真实操作。
- import 时不联网、开计时或提交答案。启动服务须有明确配置与停止函数，并在失去运行资格、卸载和 HMR 时清理。
- Pinia 只共享当前浏览器的内存状态。手机答题、远程控制、持久化和多人同步需要另行确认服务方案。

保留既有工程结构。新依赖、重要接口或模型变化、后台和部署先说明方案与取舍，等用户确认。不要默认为低频演示增加队列、重试或恢复系统。

验证运行 `pnpm build`，修改核心业务时再运行工程已有的相关检查。报告实际命令和未验证项；浏览器默认最多截图，不自动点击或填写表单。

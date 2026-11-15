# Pinia 自定义交互运行基础实施计划

> **For agentic workers:** 执行时使用 superpowers:executing-plans 逐项推进；用户另行选择委派时再使用 superpowers:subagent-driven-development。步骤用复选框跟踪。用户工作约定优先于技能默认流程。

**Goal:** 提供适合 coding agent 的 Pinia 共享状态、组件接入边界和仅制作时可拖拽的运行基础，以现有题目和正确次数显示为完整示例。

**Architecture:** 保留 Vue/Slidev/Markdown 架构；addon 在 runtime 内按 stores/composables 组织，活动工程按 components/stores/composables/services/setup 组织。每个应用共享主运行 Pinia，预览子树使用隔离上下文；外部接入通过显式宿主调用同一业务入口。

**Tech Stack:** Vue 3.5、TypeScript、Pinia 3.0.4、现有 Slidev/Vite、Vitest；无其他新直接依赖。

**Spec:** [自定义交互运行基础设计](../specs/2026-11-16-custom-runtime-design.md)。先读设计，再执行本计划。

**状态：2026-11-16 已完成实施与审阅，保留在 codex/studio-custom-runtime。** 五项任务及整分支审阅通过；未合并、推送或发布。验证与未验证范围见文末。

## Global Constraints

- 保留 Markdown、现有组件标签和页内 question ID。
- 不迁移 Studio 编辑器自己的选择、撤销和文稿状态到 Pinia。
- 建议固定 pinia@3.0.4；Vue peer 下限调整为 ^3.5.11。
- 手机服务、身份、揭晓流程、同步、持久化、代码编辑器和发布不在本阶段。
- 不新增网络队列、恢复机制、数据库或持久对象 ID。
- 仅 Studio 编辑时可排版；预览和放映不允许原生排版拖拽。
- UI 验证最多截图，不自动点击、填写表单或执行浏览器交互流程。
- 新增测试只覆盖具体核心行为缺口；沿用现有测试层和 fixture，不机械重复覆盖。
- 工作台兄弟仓库及其 Slidev 53.0 模板不在本轮修改范围。

## Review Focus

1. 初始化模式和辅助视图不能误启动真实服务：任务 1 的运行资格测试。
2. 缩略图和组件库不能污染主放映状态：任务 2 的真实 Vue 上下文测试。
3. 不同页同名题、重挂载和重复作答不能误计数：任务 3 的现有 interactions 测试。
4. 原生双击不能在播放启动排版，正常业务点击仍有效：任务 4 的真实转换后逻辑测试。
5. 发布文件和静态构建不能遗漏公共入口或带入编辑器：任务 5 的包清单检查和构建。

## 文件职责与迁移

新增 runtime/index.ts、runtime/types.ts、runtime/app.ts、runtime/preview.ts、runtime/stores/quiz.ts、runtime/composables/useStudioContext.ts、runtime/composables/useQuiz.ts。

移动 runtime/useInteractionPage.ts 到 runtime/composables/useInteractionPage.ts；更新所有 imports，不保留多套同名状态实现。runtime/interactions.ts 保留为动作路由和实例注册，shared/quiz.ts 保留为纯规则。

新增 setup/main.ts、setup/root.ts、shared/editor-mode.ts；编辑模式桥接继续位于 client/composables/useEditorMode.ts。新增 node/presentation-drag.ts，经现有 setup/vite-plugins.ts 安装。

新增 components/StudioCorrectCount.vue；现有四个答题组件保留名称、props、文件位置。更新 playground/interactions.md，并添加自定义使用示例 playground/components/QuizProgress.vue、playground/custom-code.md。

代码约定草稿已位于 docs/custom-code/，实施中同步更新，交付前移除“未实现”状态。根 package files 已包括 runtime/setup/components，无需新增一个 exports 白名单封锁原有路径。

## Task 1：应用 Pinia 和运行资格

**Files:** package.json、pnpm-lock.yaml、runtime/{types,app,index}.ts、setup/{main,root}.ts、shared/editor-mode.ts、client/{editor-view,state}.ts、client/composables/useEditorMode.ts、types/slidev-client.d.ts；test/editor-mode.test.ts，必要时新增 test/runtime-app.test.ts。

**Interfaces:** 实现设计中的 StudioRuntime、installStudioRuntime(app)、getStudioRuntime(app)。mode、canRunServices 为只读 refs；resetTrial():void；onReset(callback:()=>void):()=>void。内部编辑桥接通过 runtime/app.ts 的 setRuntimeEditing(runtime, value:boolean) 使用，不导出公共 barrel。根 setup 负责初始模式和视图资格，编辑器负责后续显式切换。

- [x] 阅读当前 setup 调用顺序和 app 生命周期；锁定安装位置，复用已经安装的 $pinia，没有则创建。同一个 app 重复安装返回同一对象；不依赖全局 active Pinia。
- [x] 增加 pinia@3.0.4，更新 Vue peer 下限和锁文件；不升级其他依赖。自定义项目直接依赖规则写入文档。
- [x] 实现初始模式：安装后资格为 false；router 就绪后按 URL/已有偏好/静态模式赋值。抽出共享编辑模式判断，保持 fitSlide 等编辑布局代码在 client。
- [x] 实现后续 edit/run 边界重置、root 视图变化和 onReset 注册清理；app 卸载清理宿主拥有的资源，不销毁别人提供的 Pinia。
- [x] 扩展已有 editor-mode 测试，必要时补应用测试：studio=1 和偏好为编辑时服务从未获准；静态不受编辑偏好影响；有效主放映为 true；presenter/print/notes/embedded 为 false；run→run 不重置；两个实际 Vue app 的 store 不共享。断言状态和回调次数，不断言私有调用顺序。
- [x] 运行 `pnpm exec vitest run test/editor-mode.test.ts test/runtime-app.test.ts`（若全部复用旧文件则省略不存在的文件）及 `pnpm typecheck`，结果须通过。

## Task 2：组件上下文与独立预览

**Files:** runtime/composables/useStudioContext.ts、runtime/preview.ts、client/ui/parts/{ComponentPreview,SlideThumbnail}.vue；复用 test/sfc.ts，新增 test/runtime-context.test.ts。

**Interfaces:** StudioContext 为设计中的 runtime/view/page/active。内部 `createPreviewRuntime(): StudioRuntime`、`disposePreviewRuntime(runtime):void`、`providePreviewRuntime(runtime):void` 只供 preview provider 使用，不进入公共 barrel。useStudioContext 先检查预览覆盖，再访问 Slidev 页面上下文。

- [x] 为组件库和缩略图包装轻量 provider，创建独立 Pinia，卸载时释放；不为页面每个子组件新建 Pinia。
- [x] useStudioContext 将 Slidev 的页面/视图映射到公共类型；活动主页面的 active 才为 true。全局层 page=null，预览和辅助视图 active=false。
- [x] 通过真实 Vue provider/组件及已有 SFC fixture 验证：两个预览实例互不影响；主 store 不受预览写入影响；同一主页面兄弟共享 store；缺少 SlideWrapper 的组件库可渲染；切页 active 改变，卸载调用资源清理。
- [x] 运行 `pnpm exec vitest run test/runtime-context.test.ts test/catalog.test.ts`；不浏览器自动交互。

## Task 3：题目 Pinia 迁移和正确次数

**Files:** runtime/stores/quiz.ts、runtime/interactions.ts、runtime/composables/{useInteractionPage,useQuiz}.ts、runtime/index.ts、components/Studio{Question,QuestionTitle,Button,Feedback,CorrectCount}.vue；test/{interactions,quiz-components,interaction-inline-editor,editor-mode}.test.ts。

**Interfaces:** 现有 InteractionQuestion 结构及 QuizSignal 保留；公共 useQuiz 和 dispatchInteraction(runtime,signal) 按设计。内部 `useQuizStore = defineStore('studio/quiz', ...)`；records 按页面数字及 question ID 分层，含 configuration/state/credited；getter correctCount；actions `register(page,id,configuration)`、`apply(page,signal):boolean`、`resetAnswers():void`。这些 store 操作不向应用作者公开。

- [x] 将纯判题继续委托 applyQuizSignal。store register 同配置保留状态，实际配置变化重置；apply 接受结果后首次 correct 设置 credited；correctCount 从 credited 派生。
- [x] 运行路由持有实际主页面注册者，store 持有页面/ID 状态。页面卸载移除接收者，保留记录到重置；保留现有歧义拒绝和非当前页拒绝语义。
- [x] 迁移四个组件和模式桥接到上下文实例，去掉旧模块级 editing/pages 和隐式宿主动作入口；更新仓库内测试及 docs/components.md 的调用示例。
- [x] 新增 StudioCorrectCount：label='已答对'、fontSize=24、color='inherit'；单根可定位；通过 useQuiz 读取计数，studio YAML 注册到组件库。不新增工具栏菜单。
- [x] 复用 interactions 测试覆盖：第一页 q 答对计 1，重复答对仍 1；答错/清空仍 1；第二页同名 q 答对变 2；相同配置重挂载不重复计分；重置变 0；非有效页面动作返回 false；配置变化重置该题贡献。
- [x] 组件测试覆盖两个计数视图同步、预览计数独立和普通 props 渲染；保留现有单选/多选规则断言，不在新层重复所有判题组合。
- [x] 运行 `pnpm exec vitest run test/interactions.test.ts test/quiz-components.test.ts test/interaction-inline-editor.test.ts test/editor-mode.test.ts`。

## Task 4：锁定播放排版拖拽

**Files:** node/presentation-drag.ts、setup/vite-plugins.ts；test/presentation-drag.test.ts，保留 test/pointer-interaction.test.ts。

**Interfaces:** `presentationDragPlugin(clientRoot: string): Plugin`，接收 Slidev 的 `options.clientRoot`，仅适配该目录下的 composables/useDragElements.ts；startDragging 方法替换为无操作。不改变位置样式、源码保存、组件业务双击和 Studio gizmo。

- [x] 在既有 Vite 插件返回数组中安装窄适配，同时用于 serve/build。路径匹配考虑 Vite query，不修改无关同名文件。
- [x] 精确验证目标方法匹配一次；缺失或歧义时给出包含 Slidev 文件及“不兼容原生拖拽适配”的构建错误，不偷偷扩大匹配规则。
- [x] 利用项目现有工具编译实际安装版本的转换后逻辑，在 jsdom/Vue 测试中验证指令及 VDrag/VDragArrow 的启动路径无效、位置不变；业务 button 点击和自定义双击仍可触发。不得仅断言字符串被替换。
- [x] 运行 `pnpm exec vitest run test/presentation-drag.test.ts test/pointer-interaction.test.ts`，保留 Studio 制作拖拽的既有检查。
- [x] 若发现 Studio 自身依赖被禁用入口、需要复制定位实现或升级 Slidev，停止此任务并说明新的架构选择，继续其他独立文档工作。

## Task 5：可运行示例、模板与文档交付

**Files:** playground/interactions.md、playground/custom-code.md、playground/components/QuizProgress.vue、desktop/projects.cjs、desktop/template/AGENTS.md、docs/{README,components,development,usage.zh-CN,limitations}.md、docs/custom-code/{conventions,components,agent-guide}.md；test/examples.test.ts、test/desktop-projects.test.ts。

**Interfaces:** 示例仅使用公共 runtime；QuizProgress 用 useQuiz().correctCount，不另造计分。新桌面工程声明直接 Pinia 版本，模板 AGENTS.md 说明目录和核心规则并链接随 addon 提供的约定文档。

- [x] 添加两页内置题目加可定位计数显示，另一个自定义 Vue 示例证明复用公共状态；不同页摆放不同位置，尺寸和字号独立配置。
- [x] 补充无网络副作用的 service 接入示意：getStudioRuntime(app)、显式运行资格、停止函数和 dispatch；明确实际网络 transport 未提供，不做假遥控演示。
- [x] desktop/projects.cjs 仅为新建工程增加 Pinia 直接依赖；已有工程启用 addon 不静默重写其 Pinia/Vue。模板给出简明 agent 指引，不塞入大型演示活动。
- [x] 将 docs/custom-code 加入 package files，确保模板中能读到真实本地文档；具体入口使用 node_modules/slidev-addon-studio/docs/custom-code/agent-guide.md，模板说明包别名。新增设计文档不进入运行 bundle。
- [x] 更新 docs/README 索引和组件调用文档；说明旧 dispatch 签名迁移、Vue 下限、预览隔离、仅编辑拖拽、局部/整场重置以及联网边界。实现验证后才移除草稿状态。
- [x] 仅在新依赖清单/示例编译行为有覆盖缺口时扩展现有 desktop-projects/examples 用例，不测试文档措辞或源码字符串。
- [x] 完整改动集中运行 `pnpm test`、`pnpm typecheck`、`pnpm exec slidev build playground/custom-code.md --out /tmp/studio-custom-runtime-build`。沿用 test/sfc.ts 的真实组件编译，必要时使用已有 vue-tsc 工具，不为检查安装另一套永久依赖。
- [x] 检查包清单包括 runtime 公共入口、组件、setup 和接入文档，静态输出不包含 Studio 编辑 UI。可查看编辑和静态截图，不自动操作。
- [x] 报告实际命令、结果和未验证项。Windows 实机、工作台 Slidev 53.0、远程多人流程和发布未验证，不用测试通过替代这些验收。

## 规划阶段自检

- 设计的目录、宿主、预览、题目迁移、计数、拖拽、文档分别有对应任务。
- canRunServices 覆盖初始化和辅助窗口；不因引入 Pinia 自动新增网络功能。
- 公共签名以设计为准；内部 store 不成为用户可依赖的 API。
- 同一故障优先在一层覆盖；文档编写本身不运行产品全量测试。
- 执行前确认具体设计，执行中遇到新架构选择另报，不按技能扩大范围。


## 完成记录

实现由 sol 子代理执行并逐项审阅，整分支审阅覆盖 `9f057dd..58b4372`。题目元数据的重复 v-drag 已在 `7a002c6` 修正；真实构建发现的 constants 扩展名问题已在 `87a78e2` 修正并验证。没有遗留阻塞项。

- `pnpm test`：345 通过，1 项既有 opt-in HTTP QA 跳过。
- `pnpm typecheck`：通过。
- 导入修正后，`pnpm exec vitest run test/runtime-context.test.ts test/quiz-components.test.ts test/interactions.test.ts`：14 通过，typecheck 再次通过。
- `pnpm exec slidev build playground/custom-code.md --out /tmp/studio-custom-runtime-build`：通过。
- `npm pack --dry-run --json`：包含公共 runtime、setup、组件和三份接入文档；静态产物库存未发现 Studio 编辑 UI 标记。
- 文档本地链接、代码块和 `git diff --check`：通过。收尾仅更新文档，不重复产品验证。

未执行浏览器交互或截图验收、Windows 实机/重新打包、工作台 Slidev 53.0、多设备活动服务或发布。日志与审阅报告留存于 `/tmp/studio-custom-runtime-evidence-20261116/`。

实施中的局部调整：预览复用已有 runtime factory；私有拖拽插件显式接收当前 options.clientRoot，避免 pnpm 依赖布局影响目标定位；源码示例使用相对公共 barrel，安装项目使用包别名。均保持已确认的架构边界。

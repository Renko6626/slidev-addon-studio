# 自定义交互运行基础设计

状态：2026-11-16 用户已确认并授权 sol 子代理按本设计实施。本文是实施基线，完成情况以计划与代码为准。

## 目标与范围

让 coding agent 能按明确约定编写页面组件、共享状态和外部接入。用现有单选、多选及全局正确次数验证接入路径。作者在 Studio 拖拽排版，预览和放映保持位置固定。

本阶段包括 Pinia、应用运行上下文、现有题目运行时迁移、正确次数组件、组件预览隔离、排版拖拽边界及开发文档。保留 Markdown、现有组件标签和页内 question ID。

手机答题服务、参与者身份、主持人开题/收题/揭晓、远程状态同步、持久化、代码编辑器、新的网络协议和发布均为后续独立阶段。本阶段给外部接入明确接口，不实现活动后台。不迁移 Studio 编辑器自己的选择、撤销和文稿状态到 Pinia。

## 方案比较

1. 每个组件自行维护状态和连接：制作单个互动方便，但多视图、跨页及预览行为难以统一。
2. 一个全局脚本管理所有内容：集中方便，但界面、业务和通信混杂，不利于 agent 独立修改。
3. Vue 组件、Pinia stores、composables 和 services 分工，由宿主组装：推荐。沿用 Web 工程习惯，同时明确运行环境。

用户已认可第 3 种职责方向并要求采用 Pinia。Pinia 不提供跨设备同步，不作为活动服务的替代品。

## 两种工程的目录

Addon 内部保留已有编辑器与 Node 边界：

```text
client/                         # Studio 编辑器，不能被播放运行时代码导入
node/                           # 源码、元数据和 Vite 适配
components/                     # 保留已有 StudioQuestion 等名字和路径
  StudioCorrectCount.vue        # 新增累计正确题数显示
runtime/
  index.ts                      # 新公共入口
  types.ts                      # 公共类型
  app.ts                        # 应用级 Pinia、上下文及重置回调
  stores/quiz.ts                # 答题状态及计数
  composables/useStudioContext.ts
  composables/useQuiz.ts
  composables/useInteractionPage.ts
  interactions.ts               # 注册与动作路由，状态委托给 store
  preview.ts                    # 编辑预览子树的独立运行上下文
setup/main.ts                   # 安装运行基础
setup/root.ts                   # 导航就绪后确定模式与服务运行资格
shared/quiz.ts                  # 现有纯判题逻辑，不依赖编辑器和网络
```

活动工程的推荐结构：

```text
components/quiz/QuizCard.vue
stores/quiz.ts
composables/useQuiz.ts
services/question-api.ts
services/remote-control.ts
setup/main.ts
slides.md
```

目录按需要创建。简单功能先使用单文件，变大再拆同名子目录。组件库递归扫描，但按文件名识别组件，因此不同目录也使用唯一、带功能前缀的 PascalCase 名称。活动工程的 components 不复制 addon 内置题目逻辑；使用内置题目时调用公共 useQuiz。

## Pinia 安装与依赖

建议固定 `pinia@3.0.4`，与现有 Vue 3.5 路线配合；对应 Vue peer 下限调整为 `^3.5.11`。不自动选择 Pinia 新大版本。Pinia 放入 addon dependencies；直接编写 `defineStore` 的活动工程也应声明同版本直接依赖，避免依赖 pnpm 的传递依赖可见性。

`setup/main.ts` 为每个 Vue app 安装一个运行宿主。若 app 已安装 Pinia，复用其公开类型声明中的 `$pinia`；否则创建并安装。保存 app 到 runtime 的对应关系。活动工程后执行的 setup 通过 `getStudioRuntime(app).pinia` 复用实例，不再安装第二个 Pinia。不得以进程级 `getActivePinia()` 回退来猜测实例。

业务代码在组件内通过宿主取得 Pinia；组件外显式传入 runtime 或 Pinia。模块顶层可 defineStore，不得在 import 时 useStore、连接网络、开计时或发送业务操作。运行宿主只导入 runtime/shared，静态构建不能带入 client 富文本编辑器。

## 公共接口草案

从 `slidev-addon-studio/runtime` 导入（项目使用现有包别名）。不要导入 client、内部 store 或 Slidev 私有模块。

```ts
type StudioMode = 'edit' | 'run'
type StudioView = 'slide' | 'global' | 'preview' | 'presenter' | 'print'

interface StudioRuntime {
  readonly pinia: Pinia
  readonly mode: Readonly<Ref<StudioMode>>
  readonly canRunServices: Readonly<Ref<boolean>>
  resetTrial(): void
  onReset(callback: () => void): () => void
}
interface StudioContext {
  readonly runtime: StudioRuntime
  readonly view: Readonly<Ref<StudioView>>
  readonly page: Readonly<Ref<number | null>>
  readonly active: Readonly<Ref<boolean>>
}
function installStudioRuntime(app: App): StudioRuntime
function getStudioRuntime(app: App): StudioRuntime
function useStudioContext(): StudioContext
function useQuiz(): {
  question(id: string): ComputedRef<DeepReadonly<InteractionQuestion> | undefined>
  correctCount: ComputedRef<number>
  dispatch(signal: QuizSignal): boolean
}
function dispatchInteraction(runtime: StudioRuntime, signal: QuizSignal): boolean
```

install 对同一 app 重复调用返回原宿主；get 在未安装时给出明确错误。`onReset` 只注册同步业务重置回调，返回取消注册函数，不扩展成通用事件总线。`resetTrial` 重置内置题目与计数并调用已登记回调。

本轮迁移原有 `dispatchInteraction(signal)` 为显式 runtime 参数，仓库内调用与文档一并修改，不保留隐式全局宿主回退。现有组件标签、props 和题目动作不改。旧函数签名属于源码扩展 API 的变更，交付时需明确告知。

`useQuiz().dispatch` 只接受当前有效主页面的动作。应用级 dispatch 从 runtime 中寻找唯一有效主页面，同样拒绝不存在、歧义或不适用动作并返回 false；不排队、不广播。`useQuiz` 在全局层可以读 correctCount，但 question 返回 undefined、dispatch 返回 false。

## 模式、页面和预览

首版只定义 edit/run；现有 Preview 与 Present 都是 run，不将全屏等同于正式联网。后续正式活动连接由显式操作配置，本阶段不虚构第三种已可用模式。

安装阶段 mode 暂为 edit、canRunServices=false。setup/root.ts 在 router 就绪后同步判定初始编辑状态：开发且编辑器可用时，URL 的 studio=1/0 优先，其次读取已有 slidev-studio:open 偏好；静态构建忽略编辑偏好。共用纯判断函数移到 shared/editor-mode.ts，由现有 client/editor-view.ts 转导出，避免 runtime 导入 client。初始模式赋值不视为用户切换，不重置未启动的试播。

canRunServices 仅在根导航初始化完成、mode=run、有效主放映视图且非 presenter/print/notes/embedded 时为 true；组件库和缩略图宿主恒为 false。服务观察这一资格而非只观察 mode，并仍要求作者显式开启真实网络。进入辅助视图或返回编辑立即失去资格。初始化前不启动、初始化后 edit 不短暂启动，都是必须验证的行为。

active 仅在 run、当前主页面、非演讲者/打印/备注视图时为 true。页面组件挂载不代表 active。隐藏的预加载页可以注册配置，不可作答。

编辑画布显示配置但禁止业务操作；组件库卡片及页面缩略图子树使用独立 runtime/Pinia，与主放映隔离。这些 runtime 固定为预览环境，active=false，子树卸载时释放。自定义组件必须通过上下文取得 Pinia，禁止在模块顶层保存主宿主实例，否则会绕过隔离。预览 provider 先提供环境覆盖，再调用依赖页面注入的 Slidev composable，组件库没有 SlideWrapper 时也必须成立。

编辑器跨 edit/run 边界时重置本次试播；run 到 run、切页、进出全屏不重置。刷新重置内存状态。示例配置变化在编辑时处理；开发热更新不承诺保留试播结果，可回编辑后重新试播，不增加恢复系统。

页面级副作用使用 watch(context.active, ...) 启停，并在 onScopeDispose 清理；整个运行期间的服务由 setup/main.ts 观察 runtime.canRunServices 启停，在 app 卸载及 HMR dispose 时停止。启动真实网络必须显式配置，不因 import 或预览自动启动。

## 题目状态和计数

沿用 shared/quiz.ts 判定语义：单选立即判分，多选提交判分，允许重试。主持人延迟揭晓以后单独设计。

题目在 store 中使用 `(pageNumber, questionId)` 标识，避免不同页面同名题互相覆盖；页面编号只在本次试播有效，页面结构修改会按当前机制刷新。不新增持久 UUID 或迁移 Markdown。注册表仍按实际 SlideWrapper 实例判断有效接收者，不能将缩略图注册合并进主页面。

建议计数口径为“本次试播中曾答对的题目数”：每题第一次答对记一次，随后答错、清空选择或重复答对不减分、不重复计数。它不是提交次数，也不是参与者成绩。以每题 `credited` 标记计算总数，避免计数器和题目标记双重维护。这是本计划的产品默认，需随设计评审确认。

切页和主组件暂时卸载保留本次试播记录；卸载只移除注册接收者，不删除计分。相同页面/ID 的重新注册复用同配置记录，配置实际改变则重置该题记录及 credited。配置比较复用现有规则，不建立版本管理。resetTrial 清空作答和 credited，但保留仍挂载题目的配置和注册。

复制整页自然拥有新 pageNumber；复制含管理控件的对象集合沿用已有 question 重命名。单独复制显示组件仍绑定原题。一次迁移不扩大为跨页题目共享模型。

## 可编辑组件契约

详细约定见 [组件规范](../../custom-code/components.md)。最低要求：单个真实 DOM 根、样式属性能落到定位根、尺寸由外框约束、配置 props、可读预览、业务操作通过公共接口、生命周期清理。

StudioCorrectCount 读取全局 correctCount，提供 label、fontSize、color 三个 props；默认“已答对”、24px、inherit。它是普通可插入组件，通过现有组件库 props 元数据编辑，使用 v-drag 定位，不新增工具栏或自动字号缩放。无需新题目管理节点。

## 只允许 Studio 排版拖拽

本地 Slidev 52.19 的 v-drag 指令、VDrag、VDragArrow 都调用 useDragElement().startDragging，SlidesShow 在播放时也渲染 DragControl。仅关闭 Studio 面板或禁用保存不会锁定位置。

建议在 addon 的现有 Vite 适配中增加一个窄的 `node/presentation-drag.ts` transform：只针对已解析的 @slidev/client/composables/useDragElements.ts，将原生 startDragging 方法变为无操作，保留位置计算、样式和保存工具。Studio 自己的 useTransformGizmo 继续负责编辑排版。这样不拦截组件业务双击，也不复制整套定位实现。

这是本设计需要评审的具体实现选择，使用了 Slidev 私有实现。适配集中在一个文件，校验匹配一次；不匹配时给出明确版本不兼容错误，不能静默宣称播放已锁定。覆盖开发和静态构建。此阶段验证本仓库安装的 52.19；工作台的 53.0 适配与模板更新留给独立集成，不宣称已兼容。若必须新增另一套定位格式或扩大 patch 范围，实施者停在该决策点提交方案。

## 文档与交付

编写代码约定、组件契约、agent 接入清单，提供共享计数示例。文档初稿在本次规划阶段落盘并标注未实现；实施完成后再改为可用状态。桌面模板只在本仓库补充依赖及文档入口，不在本阶段发布桌面包；不修改兄弟工作台仓库。

## 验证边界

复用现有 interactions、quiz-components、editor-mode、catalog、pointer-interaction 和 SFC fixture。新增断言只覆盖应用/预览隔离、计数与重置、播放不能启动排版拖拽这些核心行为。源码字符串断言不能作为拖拽验证，需要对转换后的真实生产逻辑触发事件，检查位置和交互结果。

完整改动后集中运行 pnpm test、pnpm typecheck、现有 SFC 编译检查和示例静态构建。UI 验证最多截图，不自动点击、填表或跑端到端活动。单元/组件事件测试不等同于浏览器验收。无需为本次文档改动运行产品测试。

## 参考依据

- [Pinia 3.0.4 依赖与 Vue 下限](https://github.com/vuejs/pinia/blob/v3.0.4/packages/pinia/package.json)
- [组件外使用 Pinia 时显式传实例](https://pinia.vuejs.org/core-concepts/outside-component-usage.html)
- [Store 命名及定义](https://pinia.vuejs.org/core-concepts/)
- 本地 runtime/interactions.ts、runtime/useInteractionPage.ts、client/composables/useEditorMode.ts。
- 本地 Slidev setup/main.ts、modules/v-drag.ts、composables/useDragElements.ts、builtin/VDrag.vue、internals/SlidesShow.vue。

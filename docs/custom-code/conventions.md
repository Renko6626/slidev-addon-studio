# 自定义代码组织约定

以下约定适用于当前源码的公共 runtime。本指南随 0.4.0-renko.1 分发，使用已安装的旧版本时先确认依赖。

## 目录和依赖

| 位置 | 内容 | 依赖限制 |
| --- | --- | --- |
| components/功能/ | Vue 界面、样式、局部显示状态 | 通过 composable/public runtime 使用业务能力 |
| stores/功能.ts | Pinia state/getters/actions | 不导入组件、Studio client 或 DOM |
| composables/use功能.ts | 连接 Vue 上下文、store 和生命周期 | 不复制 store 的业务规则 |
| services/功能-api.ts | fetch、连接、外部数据转换 | 不直接修改页面、不给自己创建另一份 store |
| utils/功能.ts | 无副作用的计算 | 不创建共享状态、网络或定时器 |
| setup/main.ts | 取得宿主、组装 service 和业务操作 | 不承载具体判题算法 |

只建立用到的目录；无需给一个简单组件配齐六层。功能增大时，可以将 stores/quiz.ts 拆成 stores/quiz/index.ts 和相邻模块，但不移动现有 addon 的编辑器、Node 工具和全部 shared 代码。

组件用 PascalCase 且文件名在项目中唯一；composable 用 useXxx；store 用 useXxxStore，Pinia ID 采用 deck/功能名，内置 store 使用 studio/ 前缀。服务用明确的动词或对象名称，不用 common.ts 收纳所有内容。项目 imports 使用普通相对路径，暂不新增路径别名或自动导入框架。

## Pinia

项目直接编写 store 时，在项目依赖中声明 pinia@3.0.4。Vue 采用 >=3.5.11 的 3.5 系列。addon 安装或复用应用 Pinia，项目 setup 通过 getStudioRuntime(app).pinia 获取；不再次 app.use(createPinia())。

模块顶层只 defineStore，实例在 setup 或明确的运行入口中创建。自定义组件使用 useStudioContext().runtime.pinia 传给 useXxxStore，以便组件库/缩略图使用其独立预览实例。服务由调用者传入需要的 action 或 Pinia，不依赖模块导入顺序。

Pinia 允许直接写 state，但本项目约定跨组件业务修改通过 action 完成。读取可直接访问 store.xxx；需要解构响应式字段时使用 storeToRefs，不能直接解构后期待继续响应。action 使用 choose/submit/reset 等业务动词，避免暴露任意 setState 作为主要接口。

配置和运行状态分开：题干、答案、颜色保存到文稿/props；选中项、反馈结果、正确次数存在 store。不得在点击答案时回写 Markdown，不把 Pinia 持久化插件作为默认依赖。

## 本地和外部操作

页面按钮与服务消息调用同一业务 action。service 只负责通信和格式转换，业务有效性由 action 判断。使用内置答题时调用公共 dispatchInteraction(runtime, signal)，不要直接写其内部 store。

当前动作仍是 choose、set-option、submit、clear-pending；没有 reveal/open/close 等已经实现的承诺。返回 false 表示当前动作未被接受；由控制界面提示或允许用户重试，不自动排队补发。

本阶段的正确次数表示本次试播答对的不同题目数。观众每人一份成绩和主持人流程属于后续服务设计，不能用一个浏览器的 count 冒充所有参与者共享成绩。

## 运行与清理

宿主 mode 为 edit/run；Preview 和 Present 均为 run。页面是否可执行由 context.active 决定，不能用 onMounted、全屏或 URL 包含某个字符串代替。

- 当前页副作用：watch(context.active) 启停，在 onScopeDispose 停止。
- 整场运行服务：setup 观察 runtime.canRunServices，显式配置后启动；失去资格、app 卸载和 HMR dispose 停止。初始化期间、编辑器、演讲者、打印、备注和 embedded 视图均不启动。
- 自定义 store 重置：runtime.onReset(() => store.$reset())，退出组装作用域时取消注册；使用 Setup Store 时自己实现 reset。
- 普通切页不触发整场重置；任何 reset 入口都明确其范围。
- import 无业务副作用；停止函数释放自己创建的监听、定时器、连接。普通请求失败展示状态并提供手动重试，不引入自动恢复机制。

Pinia HMR 可用于自定义 store，使用官方 acceptHMRUpdate；开发时修改活动配置后回编辑重新试播。该约定不承诺代码热更新时保留正式活动。

## 公共接口边界

活动工程通过包别名 `slidev-addon-studio/runtime` 导入。桌面工程使用此别名安装归档；手动安装当前 scoped 包时可用 `pnpm add -D slidev-addon-studio@npm:@renko_1055/slidev-addon-studio`（先核对需要的接口与已发布版本），或 `pnpm add -D slidev-addon-studio@link:../slidev-addon-studio` 链接 checkout（将 `../slidev-addon-studio` 替换为实际含 `package.json` 的源码目录）。仓库 playground 自己用相对路径 `../../runtime` 读取同一公共入口，无需给源码工程另装一个自引用别名。该入口只导出受支持的类型、宿主访问、上下文、useQuiz 和动作入口。禁止通过 client/state.ts、runtime/stores/quiz.ts 或 Slidev 私有路径获取能力。

Addon 自己的 Slidev 适配集中管理；发现公共接口缺失，先说明实际需求，再决定扩展。不要在每个自定义组件复制适配逻辑。

## 建议的最小示例

复用内置题目：插入 StudioQuestion、独立选项与反馈，再插入 StudioCorrectCount。自定义外观组件通过 useQuiz 读取同一题目与累计次数，不再自建一个计数器。

新业务如抽签：先写 stores/lottery.ts 和 components/lottery/LotteryPanel.vue。确需外部名单时才增加 services/participants-api.ts；抽签规则仍放在 store 或纯函数中。

参考：[Pinia 组件外使用](https://pinia.vuejs.org/core-concepts/outside-component-usage.html)、[Store 定义与 storeToRefs](https://pinia.vuejs.org/core-concepts/)、[HMR](https://pinia.vuejs.org/cookbook/hot-module-replacement.html)。

## Service 组装示意

这里仅定义同步订阅接口和生命周期，不提供 Socket、HTTP、手机端或活动后台。`subscribe` 由已确认的业务集成提供；没有配置时不调用组装函数。不要把下面的适配函数当作已经可用的远程控制。

```ts
// services/bind-quiz-signals.ts
import { watch } from 'vue'
import type { Ref } from 'vue'
import { dispatchInteraction } from 'slidev-addon-studio/runtime'
import type { QuizSignal, StudioRuntime } from 'slidev-addon-studio/runtime'

type Subscribe = (receive: (signal: QuizSignal) => boolean) => () => void

export function bindQuizSignals(
  runtime: StudioRuntime,
  enabled: Ref<boolean>, // 作者明确开启；默认 false
  subscribe: Subscribe, // 返回释放订阅/连接的停止函数
) {
  let stopService: (() => void) | undefined
  const stopWatch = watch(
    [runtime.canRunServices, enabled],
    ([eligible, requested]) => {
      stopService?.()
      stopService = undefined
      if (eligible && requested)
        stopService = subscribe(signal => dispatchInteraction(runtime, signal))
    },
    { immediate: true, flush: 'sync' },
  )
  return () => {
    stopWatch()
    stopService?.()
    stopService = undefined
  }
}
```

工程的 `setup/main.ts` 在取得实际配置后组装，停止函数交给 app 和 HMR：

```ts
import type { AppContext } from '@slidev/types'
import { getStudioRuntime } from 'slidev-addon-studio/runtime'
import { bindQuizSignals } from '../services/bind-quiz-signals'
// 由工程提供 enabled ref 和真实 subscribe；本 addon 不实现这两个配置。
import { quizSignals } from '../services/activity-config'

export default function ({ app }: AppContext) {
  const runtime = getStudioRuntime(app)
  if (!quizSignals) return
  const stop = bindQuizSignals(runtime, quizSignals.enabled, quizSignals.subscribe)
  app.onUnmount(stop)
  if (import.meta.hot) import.meta.hot.dispose(stop)
}
```

安装阶段 `canRunServices=false`；根导航就绪且为主运行视图后才可能为 true。edit/run 不能单独作为联网开关。该示意不发送消息，也不新增 transport、后台或默认连接。收到动作时以 dispatch 返回值为准，false 不会排队等待下一页。

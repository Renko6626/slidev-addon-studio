# 自定义组件接入规范

当前源码支持公共 runtime、defineProps、studio YAML 元数据和 v-drag。组件作者同时阅读 [代码约定](conventions.md)；已安装的旧 npm 或桌面版本需要单独更新。

## 根据组件用途准备能力

| 能力 | 展示组件 | 有本地交互的组件 | 需要外部数据的组件 |
| --- | --- | --- | --- |
| 单个真实 DOM 定位根 | 必须 | 必须 | 必须 |
| 可配置内容/外观 props | 按需 | 按需 | 按需 |
| 可直接插入的 snippet | 必须 | 必须 | 必须 |
| 无副作用的预览 | 必须 | 必须 | 必须 |
| 运行上下文/active | 使用共享状态时需要上下文 | 必须 | 有自动请求时必须 |
| 业务 action 入口 | 不需要 | 必须 | 发生业务修改时必须 |
| 清理资源 | 无资源则不需要 | 注册资源时需要 | 注册资源时需要 |
| 加载/失败/空数据表现 | 按需 | 按需 | 必须 |

没有必要让所有组件实现 start/stop/reset 三个方法。组件自己的资源随 Vue scope 清理，整场重置在 store 和运行入口完成。

## 定位与尺寸

可作为 Studio 独立对象的组件有一个真实 HTML 根元素，不用 Fragment、Teleport 或纯文本根承载定位。多根内容由作者显式包裹。默认继承 class/style；如果 inheritAttrs:false，必须把 $attrs 转发到同一个定位根。

位置、外框宽高、旋转归页面 v-drag 管理，组件不写 fixed/absolute 的页面坐标，不用 CSS transform 覆盖外框旋转。内部可以 flex/grid 和局部定位；统一 box-sizing:border-box，避免 min-width 抵消作者缩小外框。文字可以换行或按组件约定溢出，不默认自动缩小字号。

```html
<StudioCorrectCount label="已答对" :font-size="28"
  v-drag="[720,30,220,64]" />
```

同一 store 可以由多个不同位置、不同字号的组件显示。全局数据不要求挂在 global-top.vue；逐页可排版的对象放在页面正文。全局层对象的可视化编辑不在本阶段范围。

Studio 编辑时选择、拖动、缩放和旋转；预览与播放时位置固定。组件不实现自己的排版拖拽，不安装通用拖拽库。业务本身需要拖动（如拖动拼图）属于单独业务交互，不得修改页面 v-drag 数据。

完整 QuizCard 的内部按钮默认不作为 Studio 独立对象。需要分别移动题干、选项和反馈，就将它们分别写入页面，绑定同一题目。

题目属性面板支持添加和删除选项。添加会创建新的规则项和内置 StudioButton；删除会移除规则项及同题同选项的内置选择按钮，其他编号、内容和位置保持不变。删除正确答案后应重新标记答案。新按钮放在画布中央，可自行拖动。

coding agent 可以直接修改 StudioQuestion 的 `options` 数组，并增删或调整绑定同一 `question`、`option` 的按钮。选项数量不受 ABCD 限制；单选使用 `choose`，多选使用 `set-option`。自定义选项组件和动态表达式由作者维护，面板不会自动删除自定义组件。

## Props、事件与公开操作

- props 表达可保存的配置：label、fontSize、color、question 等；使用明确 TypeScript 类型、合理默认值和 camelCase 命名，模板可用 kebab-case。
- 不将 Socket、Pinia 实例、DOM 元素、函数回调作为属性面板要求用户填写的配置。
- 数组/对象 props 的默认值使用工厂。动态表达式继续通过源码编辑；不要求现有属性面板理解任意 JavaScript。
- 业务修改调用 useQuiz().dispatch 或自定义 store action。使用原生 button，保留键盘操作；只在需要时阻止事件冒泡，避免答题点击顺带翻页。
- emit 适合向父组件报告本地 UI 意图，不用跨页 emit 链拼装共享状态。无需为了远程控制 defineExpose 或保存组件实例引用。
- 在内置题目中，question 是当前页题目标识；显示组件不能自行创建同 ID 的第二套题目。

## 预览和执行

onMounted 可能发生在缩略图、组件库、预加载页或演讲者视图中。显示逻辑应能在 active=false 时渲染，业务修改必须检查 active，最终 action 也必须执行其适用性检查。

Studio 的组件库和缩略图子树提供独立 Pinia，其 `view` 为 `preview`、`page` 为 `null`、`active` 为 `false`。组件库没有题目上下文时显示说明/示例，不能抛错或修改主运行状态。通过纯 props 提供演示数据最简单；例如 demoCount 仅用于 preview 环境，不能覆盖真实 run 状态。

联网组件的预览使用固定示例数据。preview:false 可作为暂时不可预览的明确选择，但会显示占位，不作为最终制作体验。元数据 preview 是真实渲染模板，不能因此认为网络副作用被隔离。

## 元数据

使用现有 studio YAML 和 defineProps 自动推导控件，不新增另一种组件清单格式。

```vue
<studio lang="yaml">
description: 显示本次试播已答对的题目数
category: 答题
snippet: '<StudioCorrectCount label="已答对" :font-size="24" />'
preview: '<StudioCorrectCount label="已答对" :font-size="24" />'
props:
  label:
    label: 显示文案
  fontSize:
    label: 字号
  color:
    label: 文字颜色
    control: color
</studio>
```

以纯默认值渲染时计数为 0。增强的演示 props 只在确实需要展示某个状态时添加。同一组件不要同时提供多套不一致的默认值。

## 显式字段与画布编辑

需要控制属性面板暴露范围时，设置 `propsMode: declared`。只展示 `props` 中声明的非隐藏字段；省略该设置的旧组件继续自动推断。`hidden: true` 隐藏库入口，仍保留页面实例的字段元数据。

```vue
<script setup lang="ts">
withDefaults(defineProps<{
  contentHtml?: string
  imageSrc?: string
  imageAlt?: string
  internalCode?: string
}>(), { contentHtml: '<p>内容</p>', imageSrc: '', imageAlt: '', internalCode: '' })
</script>

<template>
  <div data-studio-component="MyCard">
    <div data-studio-field="contentHtml" v-html="contentHtml" />
    <img data-studio-field="imageSrc" :src="imageSrc || undefined" :alt="imageAlt">
  </div>
</template>

<studio lang="yaml">
propsMode: declared
props:
  contentHtml:
    label: 内容
    control: richtext
  imageSrc:
    label: 图片
    control: image
  imageAlt:
    label: 图片说明
    control: text
</studio>
```

上例文件名须为 MyCard.vue；根标记必须与组件名一致。一个字段仅标记一个区域，富文本使用专用 div、图片使用 img。嵌套组件必须声明自己的根边界；Studio 不跨边界寻找字段。富文本区域不承载其他字段或 Vue 子组件。

单击、拖动始终操作整个组件；双击文字区域进入现有富文本编辑，图片区域对应属性面板的替换操作。F2 在只有一个富文本字段时直接编辑；有多个字段且未指定目标时打开属性面板。面板也有“编辑内容”、文件选择、素材库和清除图片入口。图片为空时应保留区域或占位，避免无法从画布发现它。

字段值来自页面组件标签。未写值时仅使用可解析的静态字符串默认值；未知默认值、变量表达式、对象 v-bind 和动态键提示通过组件标签源码修改。清除图片写空字符串，不会删除属性而重新启用默认图片。富文本切源码编辑仍只写该字段；整组件源码按钮编辑完整标签。无法唯一定位区域、或内容超出支持的富文本标记时，提供原始字段值的源码编辑。

写回使用 JSON 字符串绑定并编码属性实体，保留其他属性、插槽、定位和相邻源码。直接书写普通字符串属性也支持读取。未修改不写回，取消恢复编辑前的 DOM；不能通过组件内部当前显示的文字反推源值。

本地图片字段保存 public 根相对路径（如 `/samples/landscape.svg`）。组件在有 Vite base 前缀时负责显示路径：对以单个 `/` 开头的本地路径添加 `import.meta.env.BASE_URL`，绝对 URL 原样使用。见图文选项示例的 `imageUrl`。替换图片只改字段，组件外框与内部排版由原模板/CSS 决定。

完整示例：[EditableOptionCard.vue](../../playground/components/EditableOptionCard.vue)、[单选与多选页面](../../playground/component-fields.md)。该组件的图文内容属于自身 props，question/option 通过源码绑定现有题目，业务代码调用公共 useQuiz。它整体移动、内部文字可编辑，但不提供任意内部对象组合或独立图层。

标准 StudioButton 已采用相同字段约定。题目控件只保存规则，题干为普通文本框，反馈文案由 StudioFeedback 保存。自定义组件约定使用 question 作为题目绑定属性；整题复制时它与普通 HTML 的 data-studio-question-ref 一同重映射。只复制子对象时保留绑定。

## 完成标准

组件可从库插入、配置内容及外观；可作为一个明确源码对象定位；缩略图不污染运行状态；编辑时不会提交答案；预览/播放能正常业务交互且不能排版拖动；静态构建可用；离开作用域不遗留自己启动的资源。

验证使用已有检查和必要的真实组件测试，UI 最多截图。不能只以截图证明交互正常，也不能自行启动浏览器点击和表单流程。


## 读取和重置示例

活动工程可在组件 setup 中这样读取当前页题目与整场正确次数：

```ts
import { useQuiz, useStudioContext } from 'slidev-addon-studio/runtime'

const { question, correctCount, dispatch } = useQuiz()
const currentQuestion = question('question-1') // ComputedRef，未注册时为 undefined
const { runtime, active } = useStudioContext()

function clearChoices() {
  // 仅清空当前题的选择和反馈，保留已经取得的计数。
  return dispatch({ question: 'question-1', action: 'clear-pending' })
}
function restartTrial() {
  if (active.value) runtime.resetTrial() // 全部内置题目及登记的自定义状态
}
```

`correctCount.value` 是整场共享的次数，`currentQuestion.value?.state` 是当前页题目的只读答案。全局层可以读次数，但没有当前题目，不能通过 `useQuiz().dispatch` 答题。内置题目没有单题撤销计数 API；改题目配置会重置该题记录和贡献。需要整场归零时明确调用 `resetTrial()`。

仓库的 `playground/components/QuizProgress.vue` 是完整实现，只通过公共入口读取次数、检查 active 并重置。`playground/custom-code.md` 展示它与内置计数器共享状态；`playground/interactions.md` 展示单选、多选的不同摆放。它们属于源码示例，不随安装包分发；本地 checkout 可运行 `pnpm exec slidev playground/custom-code.md`。

随 npm 包分发的完整工程位于 `examples/human-agent/`：GuestSpotlight 展示复杂内部效果与可编辑图文的边界，后续页面复用内置题目和计数。复制整个目录安装依赖即可运行，组件只导入公共 runtime。

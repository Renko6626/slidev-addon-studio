# 自定义组件接入规范

状态：设计草案。新增运行 API 待实施；defineProps、studio YAML 元数据和 v-drag 已由当前工程使用。组件作者同时阅读 [代码约定](conventions.md)。

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

## Props、事件与公开操作

- props 表达可保存的配置：label、fontSize、color、question 等；使用明确 TypeScript 类型、合理默认值和 camelCase 命名，模板可用 kebab-case。
- 不将 Socket、Pinia 实例、DOM 元素、函数回调作为属性面板要求用户填写的配置。
- 数组/对象 props 的默认值使用工厂。动态表达式继续通过源码编辑；不要求现有属性面板理解任意 JavaScript。
- 业务修改调用 useQuiz().dispatch 或自定义 store action。使用原生 button，保留键盘操作；只在需要时阻止事件冒泡，避免答题点击顺带翻页。
- emit 适合向父组件报告本地 UI 意图，不用跨页 emit 链拼装共享状态。无需为了远程控制 defineExpose 或保存组件实例引用。
- 在内置题目中，question 是当前页题目标识；显示组件不能自行创建同 ID 的第二套题目。

## 预览和执行

onMounted 可能发生在缩略图、组件库、预加载页或演讲者视图中。显示逻辑应能在 active=false 时渲染，业务修改必须检查 active，最终 action 也必须执行其适用性检查。

preview 环境提供独立 Pinia。组件库没有题目上下文时显示说明/示例，不能抛错或修改主运行状态。通过纯 props 提供演示数据最简单；例如 demoCount 仅用于 preview 环境，不能覆盖真实 run 状态。

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

## 完成标准

组件可从库插入、配置内容及外观；可作为一个明确源码对象定位；缩略图不污染运行状态；编辑时不会提交答案；预览/播放能正常业务交互且不能排版拖动；静态构建可用；离开作用域不遗留自己启动的资源。

验证使用已有检查和必要的真实组件测试，UI 最多截图。不能只以截图证明交互正常，也不能自行启动浏览器点击和表单流程。

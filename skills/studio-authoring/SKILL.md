---
name: studio-authoring
description: Use when creating or modifying a Slidev Studio presentation, activity interaction, or custom component that a person will finish by dragging objects, editing text, and replacing assets in Studio.
---

# Studio 人机协同制作

agent 完成复杂效果、业务逻辑和第一版排版；人用 Studio 完成最后的位置、文案和素材微调。交付物既要能播放，也要保留这些编辑入口。

## 先确认工程与接口

阅读工程 AGENTS.md、package.json 和已有页面。沿用已有 Slidev、Vue 和 addon 环境，不因使用本技能自动升级依赖。新依赖、重要接口、后台和部署变更先说明取舍并等待用户确认。

addon 通常安装为 `slidev-addon-studio`，公共入口为 `slidev-addon-studio/runtime`。查阅实际安装包的 `docs/custom-code/agent-guide.md`，需要字段编辑时读同目录 `components.md`，需要共享状态或服务时读 `conventions.md`。源码 checkout、旧 npm 包、旧 Windows 包可能有不同能力；以安装包接口为准。不要为缺少的接口臆造实现，也不要直接导入 addon 的 client 或内部 store。

## 为人的微调留下边界

先从用户任务判断哪些对象需要独立移动、哪些内容需要修改。已有信息足够时直接实施，不要求用户逐项回答技术问题。

| 人的操作 | agent 的实现 |
| --- | --- |
| 改标题、题干、说明并移动位置 | 页面正文中的独立 Studio 文本框 |
| 移动、缩放或旋转一张卡片 | 页面上一个带 `v-drag` 的组件 |
| 改组件内部文字、头像或主色 | props 加 `<studio>` 字段声明；富文本/图片加区域标记 |
| 把头像和姓名分别挪动 | 两个独立页面对象，不封装进不可拆的内部布局 |
| 改粒子、着色器、判题或计算规则 | agent 修改组件或业务代码 |

完成合理的初稿排版，不把排版全部留给用户。不把整页绘制到 canvas/SVG 后再要求人改字；复杂特效可以用 canvas/SVG，常改文字和图片留在独立对象或字段里。不默认为每个装饰参数增加面板控件。

页面文本框示例：

```html
<div data-studio-element="text" v-drag="[60,40,840,NaN]" style="font-size:32px"><p>活动标题</p></div>
```

## 可编辑组件约定

- 保留一个真实 DOM 根并接收 class/style；外框位置、宽高和旋转归页面 `v-drag`。内部 flex/grid 可以自由设计，根上不要用 transform 覆盖页面旋转。
- 特效放在内部层，装饰层用 `pointer-events: none`；编辑状态有清楚、稳定的内容和占位，不让动画追着鼠标跑。
- 文件名全工程唯一，例如 `GuestCard.vue`；定位根标记 `data-studio-component="GuestCard"`。
- 文字 props 用 `control: richtext`，并在专用 div 上写 `data-studio-field="contentHtml"`；图片 props 用 `control: image`，在 img 上标记对应字段。一个字段只标记一个区域，富文本区域不混入 Vue 子组件。
- `<studio lang="yaml">` 使用 `propsMode: declared`，只声明人需要改的字段，给出可直接插入的 snippet 和无副作用的 preview。完整例子在安装包 `examples/human-agent/`。
- 页面使用可读的静态字面值传入可编辑内容。变量表达式、动态 v-bind 的值需要代码修改，不能承诺在画布直接编辑。
- 图片保存为 public 根相对路径；组件显示时加 Vite base。不要保存 `/edit/<workspace>/` 等部署前缀，不把本机绝对路径写进页面。
- 用户已经微调过的 v-drag、字段值和无关样式应保留。修改逻辑时局部修改组件，不重新生成整份 slides.md。

## 业务与播放

配置保存到 props/Markdown；答案、计时和游戏进度属于运行状态。只建立实际需要的组件与 store，不给简单展示组件套服务框架。

组件使用 `useStudioContext()`；页面业务操作和副作用由 `context.active.value` 控制。挂载、全屏或 URL 不代表正在播放。缩略图和组件库也会挂载真实组件。

内置答题复用 `useQuiz()`：`question(id)` 为当前页只读 computed；`correctCount` 是当前浏览器试播中首次答对的不同题目数，不是多人比分。动作使用 `dispatch`；支持 choose、set-option、submit、clear-pending。清空选择保留计数，整场重来用 `runtime.resetTrial()`。

自定义 Pinia store 使用上下文的 `runtime.pinia`，不要再安装一个 Pinia。需要整场重置时注册 `runtime.onReset` 并清理注册。整场服务观察 `runtime.canRunServices`，仅在明确配置后启动；页面资源随 active 启停，在 scope 卸载和 HMR 时清理。import 不联网、不启动计时、不提交答案。手机与跨设备同步必须另定服务方案。

## 交付给人

运行工程已有的相关检查和构建；只为核心新增行为或具体 bug 补必要测试。浏览器默认最多截图，不自动点击、填写或跑交互流程。

交接写清：哪些对象可拖、哪些文字可双击改、图片在哪替换；哪些效果/规则仍需 agent；怎样开始试播和重置；实际检查结果及未验证项。不要把构建成功说成现场音视频或 Windows 已验收。

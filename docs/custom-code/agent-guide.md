# Coding agent 人机协同制作指南

目标是 agent 完成复杂特效、逻辑与初稿，人用 Studio 做最后的位置、文案和素材微调。按项目实际安装的版本确认接口，不把当前源码能力套到旧 npm 或 Windows 包。

随包技能位于 `skills/studio-authoring/SKILL.md`。可以直接让 agent 读取，也可以将整个 `studio-authoring` 文件夹复制到所用 agent 的技能目录；它不要求自动安装或改写机器配置。完整可复制工程位于 `examples/human-agent/`，使用公共包入口，不依赖本仓库 playground。

## 制作与修改的交付约定

- 普通标题、说明和题干优先使用独立 Studio 文本框；需要分别移动的内容保持独立页面对象。
- 卡片等整体排版可以封装为组件，但常改文字、图片和必要外观通过显式字段暴露。复杂特效放组件内部，不吞掉正文的编辑入口。
- agent 给出完整初稿排版，人可以在其上微调；后续改逻辑要保留用户改过的 v-drag 和字段，不重新覆盖整份文稿。
- 交付时说明“哪些能拖、哪些能改字/换图、哪些还需改代码”，不要把画面能显示当作人可以编辑。

字段标记和组件边界见 [组件规范](components.md)。共享状态或外部数据按需阅读 [代码约定](conventions.md)，普通静态内容无需配齐多层目录。

## 开始修改前

人可以通过 Studio“查看 → 源码”复制工程目录、当前页原始 Markdown、文件位置、选中组件定义及最近错误。收到这些页面信息后仍先核对磁盘当前代码；日志可能早于最近一次修复。工程脚本列表只是定位入口，不代表完整依赖。复杂修改在工程目录中进行，Studio 不提供新的 Vue/TS 编辑器。桌面项目无法编译时，原生工程管理菜单可复制运行诊断；修复后再重新加载，保留既有人工布局。

1. 阅读项目 AGENTS.md 和依赖；确认正在修改活动工程还是 Studio addon。桌面工程的包别名是 `slidev-addon-studio`，本文安装路径是 `node_modules/slidev-addon-studio/docs/custom-code/agent-guide.md`。
2. 明确要改的是外观、共享规则、外部数据还是宿主能力；只修改对应范围。
3. 查找已有组件和 store。使用内置题目时复用 useQuiz，不新建另一份相同答案状态。
4. 说明状态归属：当前组件、当前浏览器试播，或外部活动服务。Pinia 的共享范围不跨设备。
5. 新依赖、重要接口/模型变更、后台服务和部署方式先提出方案，由用户确认。

## 常见任务入口

| 用户要求 | 推荐修改 |
| --- | --- |
| 改计数器样式 | components 中的显示组件及 props |
| 把计数器移到另一侧 | 页面上的 v-drag 配置或 Studio 操作 |
| 改计分规则 | store action/纯规则函数，不在模板里累加 |
| 同一份分数显示在几页 | 多处显示组件读取同一 store |
| 请求题库 | services 请求和格式转换，store 接收业务数据 |
| 手机遥控 | 先确认活动服务路线；消息最终调用同一业务操作 |
| 新的互动类型 | 一个 store 和一个组件起步，按实际需要增加其他层 |

## 写代码时

- 组件/应用代码仅使用公共 runtime 入口，不依赖编辑器内部 state、DOM 选择器或 Slidev 私有文件。
- 组件通过上下文 Pinia 取得 store；服务显式接收依赖。import 时不启动活动。
- props 保存配置，store 保存试播状态；操作经过 action，计数只由一个业务入口维护。
- 每个 service 写清启动者和停止者；所有定时器和事件订阅有清理。
- 页面 active 和组件 mounted 分开；预览使用示例数据，不发送正式操作。
- 不为少量低频使用自动增加队列、重试、恢复状态、数据库表或幂等协议。
- 不把只读 Pinia facade 当作安全沙箱；本阶段针对可信作者代码。

## 交付证据

列出改动文件、使用接口、实际运行命令和结果，以及未验证项。新增测试只覆盖具体核心行为缺口，复用现有 fixture。检查通过后结束，不重复全量验证。浏览器最多截图；发布、远程后台和跨仓库模板同步需要另有明确范围。


## 接口速查

从 `slidev-addon-studio/runtime` 导入 `getStudioRuntime`、`useStudioContext`、`useQuiz`、`dispatchInteraction` 及其公共类型。addon 已在 setup 安装宿主；工程 setup 使用 `getStudioRuntime(app)`，组件使用 `useStudioContext()`。

- 当前页答案：`useQuiz().question(id)` 返回 computed，只读且可能为 undefined。
- 整场次数：`useQuiz().correctCount`，每页每题首次答对贡献一次。
- 页面操作：`useQuiz().dispatch(signal)`；组件外操作：`dispatchInteraction(runtime, signal)`。
- 局部清空：`clear-pending` 只清选择和反馈；整场重置：`runtime.resetTrial()`。
- 自定义 store：传入上下文的 `runtime.pinia`，需要随整场重置时登记 `runtime.onReset` 并保留取消函数。

旧代码 `dispatchInteraction(signal)` 需改为显式传宿主。不要从模块顶层保存一个主宿主供所有组件复用，这会绕过组件库和缩略图的独立状态。无网络的 service 组装示意见[代码约定](conventions.md#service-组装示意)。

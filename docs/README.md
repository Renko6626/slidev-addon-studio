# Studio 文档

当前源码提供完整编辑工作区、文本框与图片工具，以及同一文稿内的对象复制粘贴。Studio 独立于协作工作台，内容继续保存为 Markdown 和本地素材。

| 文档 | 内容 |
| --- | --- |
| [项目首页](../README.md) | 安装、源码与 npm 版本区别、功能概览和快捷键 |
| [中文使用指南](usage.zh-CN.md) | 进入编辑、文本图片、复制粘贴、备注与放映 |
| [编辑参考](editor-reference.md) | 原有元素、组件、动画和布局的详细操作 |
| [组件与布局元数据](components.md) | Props、`<studio>` 配置、主题色及布局文字标记 |
| [开发与配置](development.md) | 模块职责、验证、子路径适配和发布边界 |
| [已知限制](limitations.md) | 源码映射、页面操作、剪贴板及暂缓功能 |
| [阶段状态](status.md) | 本阶段成果、验证证据和历史计划入口 |
| [自定义代码约定](custom-code/conventions.md) | Pinia、公共 runtime、service 启停和代码组织 |
| [自定义组件规范](custom-code/components.md) | 组件定位、配置、预览和运行接口要求 |
| [素材格式与播放](custom-code/media.md) | 图片兼容、音视频控制与实际播放边界 |
| [Coding agent 接入指南](custom-code/agent-guide.md) | 任务入口、边界与交付证据 |

`superpowers/specs/` 与 `superpowers/plans/` 保存当时的设计和执行记录。判断当前能力时，以首页、使用指南和阶段状态为准；历史文档中的“后续”不一定仍未完成。

当前源码的题目正确次数、独立预览和自定义组件已接入公共 runtime。可运行源码示例：`pnpm exec slidev playground/interactions.md` 和 `pnpm exec slidev playground/custom-code.md`。新版发布与验证范围见 [0.4.0-renko.1](releases/0.4.0-renko.1.md)。安装包包含 `docs/custom-code/`，桌面工程可从 `node_modules/slidev-addon-studio/docs/custom-code/agent-guide.md` 阅读。

随包提供 `skills/studio-authoring/SKILL.md` 和完整的 `examples/human-agent/` 工程。样例可以复制到可写目录运行，避免只在源码 checkout 中才能找到参考。

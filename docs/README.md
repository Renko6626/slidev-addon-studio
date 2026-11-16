# Studio 文档

Slidev Studio 面向一个人与 coding agent 多轮协同创作演示文稿。人通过 Studio 编辑，agent 通过代码扩展，双方接续修改同一份普通 Slidev 工程。

| 文档 | 用途 |
| --- | --- |
| [整体定位与约束](overall.md) | 创作模式、人与 agent 的分工、工程与模块边界、改动决策 |
| [项目首页](../README.md) | 安装、启动与文档入口 |
| [中文使用指南](usage.zh-CN.md) | 画布、文字、素材、页面、题目与放映操作 |
| [组件与布局元数据](components.md) | Props、`<studio>`、布局文字及题目 API |
| [开发与配置](development.md) | 源码职责、配置、验证和发布方式 |
| [已知限制](limitations.md) | 源码映射、对象编辑、runtime 和素材边界 |
| [当前状态](status.md) | 当前源码、已有交付记录与验收缺口 |
| [Windows 桌面指南](../desktop/README.md) | 本地工程、日志、更新、离线范围与打包 |
| [Coding agent 接入指南](custom-code/agent-guide.md) | 读取工程、保留人的修改与交付要求 |
| [自定义组件规范](custom-code/components.md) | 定位、可编辑字段、预览和运行契约 |
| [自定义代码约定](custom-code/conventions.md) | Pinia、公共 runtime 与服务生命周期 |

随包提供 [studio-authoring 技能](../skills/studio-authoring/SKILL.md)与完整的 [human-agent 工程](../examples/human-agent/README.md)。素材格式见[素材与播放](custom-code/media.md)。源码中的 `playground/` 用于开发验证；需要复制制作起点时使用随包工程。

版本差异保留在 `releases/`。已完成的历史设计、执行计划和阶段流水已清理，过程可通过 Git 历史查看；当前约束在对应主题文档中维护。

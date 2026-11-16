# 标准题目模板字段化

用户已确认继续修改标准模板，并明确早期阶段无需历史 PPT 数据迁移。本轮沿用已实现的组件字段约定，不增加依赖或第二套编辑器。

## 完成内容

- [x] StudioQuestion 只保存题目规则：mode、options 的 id/correct，以及控件名称和展示方式。
- [x] 题干使用普通富文本对象，以 data-studio-question-ref 关联题目；删除 StudioQuestionTitle。
- [x] StudioButton 自己保存 contentHtml、imageSrc、imageAlt，通过 declared 字段进入现有文本与素材编辑入口；动作、绑定及状态预览保持原路径。
- [x] StudioFeedback 自己保存等待、正确、错误文案；画布可直接修改等待文案，面板可修改三个字段。
- [x] 删除从题目控制器读取/写回显示文案的专门编辑分支。改文案不重置作答状态，修改判题规则仍重置。
- [x] 整组复制时重映射普通题干和自定义组件的题目关联；单独复制内容保留原关联。
- [x] 更新标准单选/多选模板、示例和组件文档。不保留旧 label/title 数据接口或迁移器。

工作区：`/data/sunyunbo/www/better-ppt/.worktrees/studio-component-fields`，分支 `codex/studio-component-fields`。包含前序字段约定及文字路径改动，实施记录时尚未提交；本阶段随后由用户要求提交、推送并合并至 main。

## 验证

- `pnpm test`：360 通过，1 项可选 HTTP QA 跳过。
- `pnpm exec vitest run test/interaction-source.test.ts test/interaction-inline-editor.test.ts test/quiz-components.test.ts test/interactions.test.ts test/multiselect.test.ts`：40 通过；覆盖源码写回、复制关联、真实组件作答、文案修改保留状态及画布编辑。
- `pnpm typecheck`：通过。
- `pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json`：通过，未新增项目依赖。
- `pnpm exec slidev build playground/interactions.md --out /tmp/studio-question-template-build`：通过。
- 开发服务读取六个受影响 SFC 均返回 200；实际目录保留隐藏组件及其 declared 字段，按钮暴露富文本/图片/图片说明，反馈暴露三种文案。
- 主 agent 自查发现选项编号误用判题对象，修正为显示 props.option，并在已有组件测试断言实际编号。

- 最后修正后 `pnpm exec vitest run test/quiz-components.test.ts`：8 通过；Vue 类型检查再次通过。
- `git diff --check`：通过。

完整测试及构建日志：`/tmp/studio-question-template-full.log`、`/tmp/studio-question-template-build.log`。没有执行浏览器自动交互、原生文件选择、Windows 或发布验证。

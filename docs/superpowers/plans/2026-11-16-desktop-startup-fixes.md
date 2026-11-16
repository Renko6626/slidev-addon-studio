# 桌面联网版启动问题

用户报告：联网版依赖安装成功后，新建/打开项目有时超时或不稳定。未提供 Windows 失败日志，不把代码复现等同于已确认用户设备上的全部原因。

## 证据与范围

- 真实子进程提供 1.3 秒 HTML 响应：旧 1 秒探测无法就绪；调整后约 1.6 秒完成。
- 已安装标准联网工程的原有依赖检查始终返回 needsInstall:true；离线标准工程已有就绪检查，可局部复用。
- 启动失败丢失实际 spawn 错误；直接观察已有退出 Promise 保留错误并结束等待。
- main 在 loadURL 成功前设置 current，加载失败后仍被同工程短路判断当作打开成功；失败分支清空 current 并停止子进程。

修复沿用现有运行时、日志和检查，不增加恢复队列、状态文件或新的子系统。新增回归用例放在现有 desktop-runtime/desktop-projects 测试层。版本 0.5.1，交付默认联网包。

## 验证

- [x] 相关回归、类型和语法检查。
- [x] 临时普通工程真实安装/启动/重新打开，保留日志。
- [x] 默认联网版打包与包内容/校验检查。
- 不运行浏览器自动交互；Windows 实机验证由用户试用后反馈。


## 已取得证据

- `pnpm exec vitest run test/desktop-runtime.test.ts test/desktop-projects.test.ts test/release.test.ts`：13 通过。新增用例分别覆盖慢 HTML 响应、进程启动错误、标准联网工程重复打开及旧 addon 不能误判为已准备好。
- `pnpm typecheck`、三个修改的 desktop CJS 文件 `node --check`、`git diff --check`：通过。
- `node /tmp/studio-startup-fix-probe.cjs`：Linux / Node 22.22.1，真实临时工程与当前打包 addon；优先使用本机下载缓存，安装 5865ms，首次启动及主组件编译 3377ms，重开及编译 3309ms，两次组件 HTTP 200，依赖检查均 needsInstall:false。
- 探针记录：`/tmp/sunyunbo/studio-startup-fix-341kT0/result.json`；完整运行日志在同目录 `data/logs/current-project.log`，探针外层日志 `/tmp/studio-startup-fix-probe.log`。
- 独立只读复核未发现阻塞问题。此次没有 Windows 实机、真实冷网络下载或浏览器交互验证。

- `pnpm release:build`：已生成 `release/studio/0.5.1/Slidev-Studio-0.5.1-win32-x64-online.zip`。ZIP CRC/SHA256、无离线依赖、内嵌 addon 0.5.1 和 app.asar 中三个修复文件与当前源码字节一致的检查通过。构建日志 `/tmp/studio-release-0.5.1-online.log`。未发布 GitHub/npm。

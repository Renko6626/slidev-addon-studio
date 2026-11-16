# 本地打包与手动发布

用户确认统一使用 X.Y.Z，当前 addon 与 desktop 均从 0.5.0 开始。用户随后明确 GitHub 发布保持手动，不增加云端大文件打包上传。

沿用 Node、Electron Forge、现有联网/离线准备流程。增加一个本地脚本负责版本同步、构建归档和显式 GitHub 上传；默认联网，--offline 为可选。产物存到仓库相邻 release/studio/X.Y.Z，包含 Windows ZIP、addon tgz、按模式区分的 SHA256SUMS。版本不带日期、提交号或预发布后缀；模式写在文件名中。

保留现有 npm 标签发布工作流，移除自动创建 GitHub Release 的步骤。本次不推标签、不上传 GitHub、不发布 npm。生成并检查新联网包后删除相邻 release 下旧 studio-* 目录中的 zip/tgz 和对应旧校验表；保留截图、说明、patch、验证记录及其他项目。

不增加安装器、签名、自动更新、发布服务器或新依赖。离线选项保留现有标准工程依赖范围，不在本轮重复构建离线大包。

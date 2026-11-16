# 图片、音频与视频

本版使用浏览器原生解码，保留原文件，不自动转码。文件扩展名是素材分类依据，不保证其中的编码一定可播放。

| 类型 | 素材库接受的扩展名 | 单文件上传上限 |
| --- | --- | --- |
| 图片 | png、jpg、jpeg、jfif、gif、svg、webp、avif、apng、bmp、ico | 32 MiB |
| 视频 | mp4、webm、mov、m4v、ogv | 128 MiB |
| 音频 | mp3、wav、m4a、aac、ogg、oga、opus、flac | 128 MiB |

从“插入 → 素材”上传和插入。图片插入、背景和字段替换共用图片格式列表；图片无法解码时不会替换当前页面引用。HEIC/HEIF、TIFF、PSD 等请先导出 PNG、JPEG 或 WebP，不能只改扩展名。GIF/APNG 等动画按浏览器本身的能力播放，Studio 不拆帧。

音视频插入为可独立定位的 `StudioMedia`。选中后可替换文件，调整素材路径、视频封面、自动播放、原生控制条、循环、静音、音量（0–1）和起播时间（秒）。替换保留外框和播放设置；替换为另一类型时同步 audio/video 类型。动态绑定的路径通过组件源码修改。

```html
<StudioMedia kind="audio" src="/music.mp3" :volume="0.5" v-drag="[60,380,480,100]" />
<StudioMedia kind="video" src="/opening.mp4" poster="/cover.jpg" :start-time="2" :muted="true" :autoplay="true" v-drag="[60,80,640,360]" />
```

本地路径写 public 根相对路径，组件显示时处理 Vite base。编辑、组件库、缩略图及辅助视图不启用播放；当前主播放页可操作。离开页面或返回编辑暂停并回到起播时间。默认不自动播放；浏览器拒绝自动播放时显示手动播放按钮。无声自动播放也不保证所有设备允许。

视频优先准备 MP4（H.264 视频/AAC 音频）或 WebM；音频可用 MP3 或 PCM WAV。MOV、AAC、M4A 以及不同 MP4 编码受浏览器和系统影响。读取失败会提示检查路径与编码，不把所有错误都说成编码问题。请在实际 Windows/浏览器设备上确认最终素材。

较大文件可以直接复制到 public 后从素材库插入；这个办法不解除浏览器内存、工程 ZIP 或在线代理的实际限制。在线环境可能另有限制，失败时按提示检查文件或本地放入，不自动重传。当前没有音视频剪辑、淡入淡出、跨页音乐或离线转换功能。

旧页面中的 SlidevVideo 和原生 audio/video 保留原样；新增 StudioMedia 的编辑静默规则不自动修改旧标签，升级旧页面时由 agent 按需替换。

格式参考：[MDN 图片格式](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types)、[MDN 媒体容器与编码](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)。

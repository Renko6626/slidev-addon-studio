---
theme: default
addons:
  - .
layout: none
title: "以下哪个选项是偶数？"
---

<StudioQuestion question="question-1" mode="single" name="单选题" :options="[{&quot;id&quot;:&quot;A&quot;,&quot;correct&quot;:true},{&quot;id&quot;:&quot;B&quot;,&quot;correct&quot;:false},{&quot;id&quot;:&quot;C&quot;,&quot;correct&quot;:false},{&quot;id&quot;:&quot;D&quot;,&quot;correct&quot;:false}]" v-drag="[70,10,220,32]" />

<div data-studio-element="text" v-drag="[70,60,820,80]" style="font-size:32px;line-height:1.3;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;min-height:1em;margin:0;padding:0" data-studio-question-ref="question-1">以下哪个选项是偶数？</div>

<StudioButton question="question-1" action="choose" option="A" contentHtml="&lt;p&gt;2&lt;/p&gt;" v-drag="[70,170,400,76]" />

<StudioButton question="question-1" action="choose" option="B" contentHtml="&lt;p&gt;3&lt;/p&gt;" v-drag="[490,170,400,76]" />

<StudioButton question="question-1" action="choose" option="C" contentHtml="&lt;p&gt;5&lt;/p&gt;" v-drag="[70,266,400,76]" />

<StudioButton question="question-1" action="choose" option="D" contentHtml="&lt;p&gt;7&lt;/p&gt;" v-drag="[490,266,400,76]" />

<StudioFeedback question="question-1" effect="fade" correctText="回答正确！" incorrectText="再想一想，可以修改后重新作答。" idleText="单击一个选项即可判断。" v-drag="[70,390,820,56]" />

<StudioCorrectCount label="已答对" :font-size="22" color="#2563EB" v-drag="[665,10,244,40]" />

---
layout: none
title: "以下哪些选项是偶数？"
---

<StudioQuestion question="question-1" mode="multiple" name="多选题" :options="[{&quot;id&quot;:&quot;A&quot;,&quot;correct&quot;:true},{&quot;id&quot;:&quot;B&quot;,&quot;correct&quot;:false},{&quot;id&quot;:&quot;C&quot;,&quot;correct&quot;:true},{&quot;id&quot;:&quot;D&quot;,&quot;correct&quot;:false}]" v-drag="[70,10,220,32]" />

<div data-studio-element="text" v-drag="[70,60,820,80]" style="font-size:32px;line-height:1.3;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;min-height:1em;margin:0;padding:0" data-studio-question-ref="question-1">以下哪些选项是偶数？</div>

<StudioButton question="question-1" action="set-option" option="A" contentHtml="&lt;p&gt;2&lt;/p&gt;" v-drag="[70,170,400,76]" />

<StudioButton question="question-1" action="set-option" option="B" contentHtml="&lt;p&gt;3&lt;/p&gt;" v-drag="[490,170,400,76]" />

<StudioButton question="question-1" action="set-option" option="C" contentHtml="&lt;p&gt;4&lt;/p&gt;" v-drag="[70,266,400,76]" />

<StudioButton question="question-1" action="set-option" option="D" contentHtml="&lt;p&gt;5&lt;/p&gt;" v-drag="[490,266,400,76]" />

<StudioButton question="question-1" action="submit" fill="#2563EB" color="#FFFFFF" contentHtml="&lt;p&gt;确认答案&lt;/p&gt;" v-drag="[70,370,190,52]" />

<StudioButton question="question-1" action="clear-pending" contentHtml="&lt;p&gt;清空选择&lt;/p&gt;" v-drag="[280,370,190,52]" />

<StudioFeedback question="question-1" effect="fade" correctText="回答正确！" incorrectText="再想一想，可以修改后重新作答。" idleText="选择选项后，点击确认答案。" v-drag="[70,444,820,56]" />

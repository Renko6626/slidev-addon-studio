---
theme: default
addons:
  - .
layout: none
title: "以下哪个选项是偶数？"
---

<StudioCorrectCount label="已答对" :font-size="22" color="#2563EB" v-drag="[665,12,244,40]" />

<StudioQuestion question="question-1" name="单选题" mode="single" title="以下哪个选项是偶数？" :options="[{&quot;id&quot;:&quot;A&quot;,&quot;label&quot;:&quot;2&quot;,&quot;correct&quot;:true},{&quot;id&quot;:&quot;B&quot;,&quot;label&quot;:&quot;3&quot;,&quot;correct&quot;:false},{&quot;id&quot;:&quot;C&quot;,&quot;label&quot;:&quot;5&quot;,&quot;correct&quot;:false},{&quot;id&quot;:&quot;D&quot;,&quot;label&quot;:&quot;7&quot;,&quot;correct&quot;:false}]" correctText="回答正确！" incorrectText="再想一想，可以修改后重新作答。" idleText="单击一个选项即可判断。" v-drag="[71,10,224,33]" />

<StudioQuestionTitle question="question-1" v-drag="[71,61,838,82]" />

<StudioButton question="question-1" action="choose" option="A" v-drag="[71,174,409,78]" />

<StudioButton question="question-1" action="choose" option="B" v-drag="[500,174,409,78]" />

<StudioButton question="question-1" action="choose" option="C" v-drag="[71,272,409,78]" />

<StudioButton question="question-1" action="choose" option="D" v-drag="[500,272,409,78]" />

<StudioFeedback question="question-1" effect="fade" v-drag="[71,398,838,58]" />

---
layout: none
title: "以下哪些选项是偶数？"
---

<StudioCorrectCount label="累计答对" :font-size="30" color="#047857" v-drag="[560,378,349,56]" />

<StudioQuestion question="question-1" name="多选题" mode="multiple" title="以下哪些选项是偶数？" :options="[{&quot;id&quot;:&quot;A&quot;,&quot;label&quot;:&quot;2&quot;,&quot;correct&quot;:true},{&quot;id&quot;:&quot;B&quot;,&quot;label&quot;:&quot;3&quot;,&quot;correct&quot;:false},{&quot;id&quot;:&quot;C&quot;,&quot;label&quot;:&quot;4&quot;,&quot;correct&quot;:true},{&quot;id&quot;:&quot;D&quot;,&quot;label&quot;:&quot;5&quot;,&quot;correct&quot;:false}]" correctText="回答正确！" incorrectText="再想一想，可以修改后重新作答。" idleText="选择选项后，点击确认答案。" v-drag="[71,10,224,33]" />

<StudioQuestionTitle question="question-1" v-drag="[71,61,838,82]" />

<StudioButton question="question-1" action="set-option" option="A" v-drag="[71,174,409,78]" />

<StudioButton question="question-1" action="set-option" option="B" v-drag="[500,174,409,78]" />

<StudioButton question="question-1" action="set-option" option="C" v-drag="[71,272,409,78]" />

<StudioButton question="question-1" action="set-option" option="D" v-drag="[500,272,409,78]" />

<StudioButton question="question-1" action="submit" fill="#2563EB" color="#FFFFFF" label="确认答案" v-drag="[71,378,194,54]" />

<StudioButton question="question-1" action="clear-pending" label="清空选择" v-drag="[286,378,194,54]" />

<StudioFeedback question="question-1" effect="fade" v-drag="[71,453,838,58]" />

import type { ResumeItem } from "../profile/schema";

/*
 * A fixed résumé for the layout tests that check exact page counts and where sections land: the original demo persona (Lin Wen,
 * fictional person, fictional companies), in English and in Chinese. It does not follow the real CV in profile/, so editing the CV
 * cannot break these tests; the tests that check the real CV fits the page still use profile/.
 */

const links = [
  { label: "Email", href: "mailto:i@zerah.cc" },
  { label: "GitHub", href: "https://github.com/qzz0518" },
  { label: "Read.cv", href: "https://read.cv/zerah" },
];

export const demoOwner = { name: "Lin Wen", nameLocal: "林文", handle: "@linwen", role: "Design engineer", location: "Shanghai", links };

export const demoResume: ResumeItem = {
  kind: "resume",
  id: "resume",
  label: "Résumé",
  anecdote: "Two pages, set in one weekend, edited for three weeks.",
  story: "One page for the work and one for everything else. Every line had to earn its place; the first draft was five pages long.",
  summary: "Design engineer who ships the whole thing — from the first sketch to the last pixel of motion.",
  experience: [
    {
      org: "Paperplane Labs",
      role: "Staff design engineer",
      from: "2022",
      to: "Now",
      bullets: ["Led the tactile UI system used by 6 product teams.", "Cut interaction latency from 140 ms to 38 ms on mid-range phones.", "Mentored 5 engineers into design-engineering roles."],
    },
    {
      org: "Northwind Type Co.",
      role: "Senior front-end engineer",
      from: "2019",
      to: "2022",
      bullets: ["Built the variable-font specimen engine behind 40+ release pages.", "Shipped a WebGL page-curl viewer — 2.1M sessions in year one."],
    },
    {
      org: "Little Kiln Studio",
      role: "Product designer",
      from: "2017",
      to: "2019",
      bullets: ["Designed and launched 3 consumer apps from zero.", "Ran 60+ usability sessions."],
    },
  ],
  education: [{ school: "Tongji University", degree: "B.Des, Industrial Design", from: "2013", to: "2017" }],
  skills: ["TypeScript", "WebGL / three.js", "Motion design", "Design systems", "Rust (hobby)", "Figma"],
  languages: ["English", "中文"],
};

export const demoOwnerZh = { name: "林文", handle: "@linwen", role: "设计工程师", location: "上海", links: [{ ...links[0]!, label: "邮箱" }, links[1]!, links[2]!], lang: "zh-CN" };

export const demoResumeZh: ResumeItem = {
  kind: "resume",
  id: "resume",
  label: "简历",
  anecdote: "两页，一个周末排好版，又改了三个星期。",
  story: "一页写工作，一页写其余的一切。每一行都得站得住脚，初稿足足有五页。",
  summary: "设计工程师，从第一张草图到最后一帧动效，整件事自己做完。",
  experience: [
    {
      org: "Paperplane Labs",
      role: "资深设计工程师",
      from: "2022",
      to: "至今",
      bullets: ["主导触感界面系统，6 个产品团队在用。", "在中端手机上把交互延迟从 140 ms 降到 38 ms。", "带 5 位工程师转入设计工程方向。"],
    },
    {
      org: "Northwind Type Co.",
      role: "高级前端工程师",
      from: "2019",
      to: "2022",
      bullets: ["搭建可变字体样张引擎，40 多个发布页面都由它生成。", "上线 WebGL 翻页阅读器，第一年 210 万次访问。"],
    },
    {
      org: "Little Kiln Studio",
      role: "产品设计师",
      from: "2017",
      to: "2019",
      bullets: ["从零设计并上线 3 款消费类应用。", "主持了 60 多场可用性测试。"],
    },
  ],
  education: [{ school: "同济大学", degree: "工业设计学士", from: "2013", to: "2017" }],
  skills: ["TypeScript", "WebGL / three.js", "动效设计", "设计系统", "Rust（业余）", "Figma"],
  languages: ["中文", "英语"],
};

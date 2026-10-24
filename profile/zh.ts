import type { Profile } from "../src/profile/schema";
import { albumsFor, CV, profile, type PostcardText } from "./en";
import { seal } from "./seal";

/* 杨子江 · 作品集（中文版）。内容与 en.ts 一一对应，文字取自 alexisyang.com 的中文页面。 */

const placeNotes = [
  "我长大的地方，也是学科竞赛开始的地方。",
  "中国人民大学，2019–2023 年，经济学学士（金融学专业），优秀毕业生。",
  "KEDGE 商学院，供应链管理学士，本科双学位项目。",
  "ESSEC 高等商学院，管理学硕士，房地产与可持续发展教席。",
  "2026 年 AEW 研究与策略，2024 年法国巴黎银行集团法务部，2025 年 Adagio 咨询项目。",
  "乔治·华盛顿大学商学院，2025 年 8 月至 2026 年 1 月交换。",
  "2026 年 10 月的日本之行，第一站。",
  "2026 年 10 月，日本。",
  "2026 年 10 月，日本，跨过濑户内海。",
  "2026 年 10 月，日本，濑户内海上的小岛。",
  "2026 年 10 月，日本。",
  "2026 年 10 月，日本。",
  "2026 年 10 月，日本，海边。",
  "2026 年 10 月，日本。",
  "2026 年 10 月，日本，回巴黎前的最后一站，10 月 17 日返程。",
  "2027 年 1 月起的毕业实习。城市还没有定下来。",
];

const postcardsZh: PostcardText[] = [
  { label: "修远楼", place: "中国人民大学", placeLocal: "修远楼", message: "钢笔手绘。不是专业的建筑图纸，只是喜欢把一个地方看得足够仔细，再把它画到纸上。" },
  { label: "开太楼", place: "中国人民大学", placeLocal: "开太楼", message: "两周之后。父亲从事建筑设计，我从小就会留意比例、细节，以及人们如何使用一栋建筑。" },
  { label: "AEW", place: "巴黎，AEW", message: "在欧洲研究与策略团队的六个月：城市评分、季度报告，以及 2026 年 7 月写字楼市场展望中的全部图表。" },
  { label: "Pro Bono", place: "巴黎，法国巴黎银行", message: "集团法务部 Pro Bono 项目：协助重启欧洲、中东及非洲地区的公益法律服务，整理进度、汇报材料与 SharePoint。" },
  { label: "合唱", place: "中国人民大学", placeLocal: "一二·九合唱音乐节", message: "第三十三届「一二·九」合唱音乐节。担任钢琴伴奏，也在中声部演唱。" },
  { label: "排练", place: "演出之前", message: "听着整个合唱团，同时守住自己的那条声部。" },
  { label: "实验室", place: "上海", message: "在实验室里度过的下午：拆解问题，检验假设，从没成功的地方学东西。" },
  { label: "一等奖", place: "上海", placeLocal: "白猫杯", message: "2018 年上海市青少年「白猫杯」应用化学与技能竞赛（高中组）一等奖。" },
  { label: "辩论", place: "上海", message: "英语辩论交流中担任一辩：开篇立论，搭建论证框架，再认真听对方的回应。" },
  { label: "厨房", place: "巴黎", message: "做饭是与家乡保持联系最简单的方式之一。在海外生活后，它也成了向朋友介绍家乡的一种方式。" },
  { label: "生煎", place: "走到哪里，都有上海", placeLocal: "生煎", message: "有时候，就从一锅生煎开始。" },
  { label: "潜水", place: "水下", message: "在水下，慌乱只会让困难更难。先稳住呼吸，弄清发生了什么，再从容行动。" },
];

const [card, resume, ticket, polaroid, note] = profile.items;

export const profileZh: Profile = {
  lang: "zh-CN",
  name: "杨子江",
  role: "不动产研究与策略",
  location: "巴黎",
  timezone: "Europe/Paris",
  bio: "ESSEC 管理学硕士在读。曾在 AEW 从事欧洲不动产研究，在法国巴黎银行参与国际项目。寻求 2027 年 1 月起的毕业实习。",
  coverTitle: "杨子江 · 作品集",
  seal,
  source: profile.source,
  links: [
    { label: "邮箱", href: "mailto:zijiang.yang1@essec.edu" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/yangzijiang" },
    { label: "个人网站", href: "https://alexisyang.com" },
  ],
  items: [
    {
      ...card!,
      kind: "card",
      label: "名片",
      anecdote: "不动产研究、商业策略与国际业务，在中国、法国和美国之间。",
      story: "这个袋子里其他东西的简短版本。里面一面，留给会回信的人。",
      specs: [
        { k: "所在", v: "巴黎" },
        { k: "语言", v: "中文 · 英语 · 法语" },
      ],
      front: { name: "杨子江", role: "不动产研究与策略", tagline: "从研究到洞见，从洞见到策略" },
      inside: [
        { k: "邮箱", v: "zijiang.yang1@essec.edu" },
        { k: "网站", v: "alexisyang.com" },
        { k: "LinkedIn", v: "in/yangzijiang" },
      ],
      insideNote: "寻求 2027 年 1 月起的毕业实习机会。",
    },
    {
      ...resume!,
      kind: "resume",
      label: "简历",
      anecdote: "AEW 的欧洲不动产研究，Adagio 首席执行官的拓展咨询，法国巴黎银行的国际项目推进。",
      story: "从原始数据到清晰的建议：在 AEW、在 Adagio 项目、在 Pro Bono 项目里，都是同一个习惯。",
      specs: [
        { k: "更新", v: "2026 年 10 月" },
        { k: "另有", v: "English · Français" },
      ],
      summary: "ESSEC 管理学硕士在读，结合定量分析、策略研究与跨文化协作经验。寻求 2027 年 1 月起不动产投资、资产管理、研究或策略方向的毕业实习。",
      experience: [
        {
          org: "AEW（法盛投资管理）",
          role: "另类资产投资研究与策略分析实习生",
          from: "2026.02",
          to: "2026.08",
          bullets: [
            "自动化欧洲办公及物流投资市场的多指标评分，物流覆盖城市从 45 个扩大至 72 个，发布周期从 6 个月缩短至 3 个月。",
            "为 2026 年 7 月欧洲写字楼市场展望收集数据、完成定量与回归分析，并制作报告中的全部图表。",
            "围绕收购、出售及债务融资开展资产市场定位分析；完成波兰国别研究。",
          ],
        },
        {
          org: "Adagio × ESSEC",
          role: "欧洲拓展咨询项目，共同负责人",
          from: "2025.01",
          to: "2025.07",
          bullets: ["为三个品牌评估 35 座以上欧洲城市，比较租赁、特许经营与管理合同模式。", "向 Adagio 首席执行官汇报市场优先级建议，项目评分 19/20。"],
        },
        {
          org: "法国巴黎银行集团法务部 Pro Bono",
          role: "法务助理（实习）",
          from: "2024.02",
          to: "2024.08",
          bullets: ["协助重启欧洲、中东及非洲地区的 Pro Bono 项目：Excel 进度跟踪、汇报材料、项目 SharePoint 维护。"],
        },
      ],
      education: [
        { school: "ESSEC 高等商学院", degree: "管理学硕士 · Grande École，房地产与可持续发展教席", from: "2023", to: "2027" },
        { school: "乔治·华盛顿大学商学院", degree: "研究生交换", from: "2025", to: "2026" },
        { school: "中国人民大学", degree: "经济学学士（金融学），优秀毕业生", from: "2019", to: "2023" },
        { school: "KEDGE 商学院", degree: "供应链管理学士", from: "2019", to: "2023" },
      ],
      skills: ["市场研究", "定量与回归分析", "多指标评分", "数据可视化", "Excel · PowerPoint · Power BI", "VBA 与 R（课程）"],
      languages: ["中文（母语）", "英语（IELTS 7.5）", "法语（TCF B2）"],
      pdf: `${CV}Zijiang_Yang_CV_ZH.27b1d2c45515e0ee.pdf`,
    },
    {
      ...ticket!,
      kind: "ticket",
      label: "汇报通行证",
      anecdote: "35 座以上欧洲城市，三个品牌，一份交给首席执行官的建议。项目评分 19/20。",
      story: "ESSEC 与 Adagio 的企业战略咨询项目：长住型公寓市场研究、需求指标、多指标评分与竞品对标，最终为 Access、Original 和 Premium 三个品牌给出城市优先级与运营模式建议。",
      event: "Adagio × ESSEC",
      date: "2025",
      city: "巴黎",
      seat: "共同负责人",
      talk: "Adagio 下一步去哪里？",
      serial: "19/20",
      specs: [
        { k: "城市", v: "35+" },
        { k: "品牌", v: "Access · Original · Premium" },
      ],
      links: [{ label: "在个人网站查看项目", href: "https://alexisyang.com/?lang=zh#adagio-strategy" }],
    },
    {
      ...polaroid!,
      kind: "polaroid",
      label: "拍立得",
      anecdote: "大西洋彼岸的一个学期：乔治·华盛顿大学商学院交换。",
      story: "MBA 层级课程：美国商法（合同法、财产法与侵权法），房地产投资与开发的定量分析，以及 Power BI 数据分析。",
      caption: "华盛顿特区",
      image: "photos/washington.jpg",
      tint: "#c9d3da",
      place: "华盛顿特区",
      date: "2025 年秋",
      back: "2025 年 8 月至 2026 年 1 月，经 ESSEC 选拔赴 GWU 交换。",
    },
    {
      ...note!,
      kind: "note",
      label: "便笺",
      anecdote: "一筆箋是一种窄长的信纸，只写几行：比一封信短，比一条消息多一点心意。",
      text: "谢谢你打开它。我正在寻找 2027 年 1 月起不动产投资、资产管理、研究或策略方向的毕业实习。如果这里有什么让你感兴趣，欢迎写信给我。",
      from: "子江",
      date: "2026-10-24",
    },
  ],
  albums: albumsFor(placeNotes, postcardsZh, "子江"),
};

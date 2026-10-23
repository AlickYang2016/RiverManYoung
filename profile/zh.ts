import type { Profile } from "../src/profile/schema";
import { profile } from "./en";
import { seal } from "./seal";

/*
 * The same demo persona as en.ts, written in Simplified Chinese (`?sample=zh`): the page chrome turns Chinese and every
 * Han character is set in the SC faces. Fictional person, fictional companies; every message, anecdote and number is sample copy.
 * The photos are the same files. The colour cards keep their Japanese names (romaji and 和色 kanji); only the notes are Chinese.
 */

/** The thirty-two 和色 of the card album, with Chinese notes (same order and colours as the English sample). */
const colourNotes = [
  "月亮升起之前，天空那一层极淡的蓝。",
  "蓝染缸里最浅的一染：浸一次就拿出来。",
  "「往缸里瞧一眼」：布只浸了一下，刚刚有点蓝。",
  "兑了水的浅葱色，像浅溪里的石头。",
  "青瓷的釉色：偏冷的绿，里面带一点灰。",
  "安静下来的青瓷，像是经过了风雨。",
  "发白的灰，银粉的颜色。",
  "银灰，江户「四十八茶百鼠」里的一种。",
  "底下透着蓝的灰。",
  "藏青色的灰，傍晚过后街道的颜色。",
  "暗沉的蓝灰，从前宫中服丧时穿的颜色。",
  "白色里带着一丝蓝染的气息。",
  "淡到几乎发白的缥色。",
  "薄云的灰，白里带一点绿。",
  "灰多于青，像远远望见的冬天的海。",
  "带灰的千草绿，像落了霜的草。",
  "从前只为皇帝烧制的青瓷「秘色」：淡淡的、带雾的蓝。",
  "锡的颜色：比银更暗、更哑的灰。",
  "港口的灰，阴天里码头边的水。",
  "安静下来的浅葱色，发灰的蓝绿。",
  "掺了灰、变柔和的缥色。",
  "御纳户色（储物间的蓝），像生了锈一样暗哑。",
  "加了铁色、暗下来的御纳户色，近乎石板。",
  "安静的灰，底下透着一点蓝绿，像淋湿的屋瓦。",
  "孔雀石研得极细，几乎成了白色：掺了乳白的绿。",
  "研得又细又淡的石青，旧寺壁画上的那种蓝绿。",
  "浅浅的缥色，像棉布在蓝染缸里只浸过几次。",
  "以江户水乡深川命名的灰绿。",
  "带着绿意的灰，借了茶人千利休的名字。",
  "淡淡的缥色，掺了一点灰，像下雨前的天。",
  "深沉的青绿，名字来自将军爱穿的御召绉绸。",
  "蓝染本身的颜色，也是这本作品集除了黑色之外唯一的印色。",
];

/** The twelve postcards, in the English sample's order; place names and messages in Chinese, the Japanese captions as they are. */
const postcardText = [
  { label: "龙安寺", place: "京都，龙安寺", message: "十五块石头，坐在哪儿都只能看见十四块。每一块上都落着雪。" },
  { label: "美瑛", place: "北海道，美瑛", message: "一棵树，一片雪原，方圆一公里没有别人。我在那儿站了二十分钟。" },
  { label: "芦之湖", place: "箱根，芦之湖", message: "雾一直没散。船还是在 9:40 开了。" },
  { label: "直岛", place: "香川，直岛", message: "海滩上一座石鸟居，潮水正从它下面涨上来。" },
  { label: "尾道", place: "广岛，尾道", message: "渡船过一次水道要四分钟。我来回坐了六趟。" },
  { label: "稻村崎", place: "镰仓，稻村崎", message: "这里的蓝调时刻大约只有二十分钟。那天的光一直是红的。" },
  { label: "白川乡", place: "岐阜，白川乡", message: "雪埋到屋檐，每个屋顶都在太阳下微微冒着热气。" },
  { label: "宫岛", place: "广岛，宫岛", message: "退潮的时候能一直走到鸟居下面。我还是留在岸上，等潮水回来。" },
  { label: "河口湖", place: "山梨，河口湖", message: "一座十步就能走完的小岛，一只鸭子绕着它游。我数到第十二圈就不数了。" },
  { label: "岚山", place: "京都，岚山", message: "渡月桥长 155 米。我在雪里慢慢走了两个来回。" },
  { label: "富士山", place: "富士山", message: "一个人坐在小船上钓鱼，富士山就在他身后。一个小时里，他一次也没回过头。" },
  { label: "新宿", place: "东京，新宿", message: "从三十楼往外看，6:40 整座城市变成蓝色，然后灯一盏盏亮了。" },
];

export const profileZh: Profile = {
  lang: "zh-CN",
  name: "林文",
  handle: "@linwen",
  role: "设计工程师",
  location: "上海",
  timezone: "Asia/Shanghai",
  bio: "我做小而有手感的界面，让人想伸手拿起来的那种。产品设计和前端开发，一共做了八年。",
  coverTitle: "林文 · 作品集",
  seal,
  source: "https://github.com/qzz0518/sasshi",
  links: [
    { label: "邮箱", href: "mailto:i@zerah.cc" },
    { label: "GitHub", href: "https://github.com/qzz0518" },
    { label: "Read.cv", href: "https://read.cv/zerah" },
  ],
  items: [
    {
      kind: "card",
      id: "card",
      label: "名片",
      anecdote: "600 克棉浆纸，印了 120 张，已经送出去 114 张。",
      story: "在静安一家只有两个人的小印刷铺做的活版印刷，单色，压一次。那个小圆点是唯一不是黑色的墨。名片对折一次，里面留给真正会回信的人。",
      specs: [
        { k: "纸张", v: "600 克棉浆纸" },
        { k: "印刷", v: "活版，单色" },
        { k: "尺寸", v: "91 × 55 毫米，对折" },
      ],
      front: { name: "林文", role: "设计工程师", tagline: "做让人想拿起来的东西" },
      inside: [
        { k: "邮箱", v: "i@zerah.cc" },
        { k: "网站", v: "read.cv/zerah" },
        { k: "所在", v: "上海 · UTC+8" },
      ],
      insideNote: "2027 年春天起，接一些小而用心的项目。",
    },
    {
      kind: "resume",
      id: "resume",
      label: "简历",
      anecdote: "两页，一个周末排好版，又改了三个星期。",
      story: "一页写工作，一页写其余的一切。每一行都得站得住脚，初稿足足有五页。",
      specs: [
        { k: "页数", v: "2" },
        { k: "更新", v: "2026" },
        { k: "语言", v: "中文 · 英文" },
      ],
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
    },
    {
      kind: "ticket",
      id: "ticket",
      label: "大会门票",
      anecdote: "第一次上台演讲：400 位听众，22 分钟，现场演示一次跑通。",
      story: "讲的是怎样让界面像纸一样：有分量，有摩擦，落下来有纸的样子。现场演示的就是这本作品集的第一次翻页，跑在一台借来的笔记本上。",
      event: "前端周末",
      date: "2024-09-14",
      time: "09:30",
      venue: "滨江会堂",
      city: "上海",
      seat: "讲者",
      talk: "会动的纸",
      serial: "No. 0142",
      links: [{ label: "幻灯片", href: "https://example.com/linwen/paper-that-moves" }],
    },
    {
      kind: "polaroid",
      id: "polaroid",
      label: "拍立得",
      anecdote: "镰仓一家海边咖啡馆的窗前，这本作品集的第一张草图就画在这里。",
      story: "等下一班江之电的工夫，我在这扇窗下的吧台坐了一会儿。两个学生一直站在栏杆边，轮流给海拍照。你现在看到的这一页，就是从那张吧台上开始的。",
      caption: "镰仓，11:40",
      image: "photos/polaroid-kamakura-window.jpg",
      tint: "#c9d3da",
      place: "镰仓",
      date: "2025-11-04",
      back: "旅行的第二天。一杯冰咖啡，作品集画在一张收据的背面。",
    },
    {
      kind: "note",
      id: "note",
      label: "便笺",
      anecdote: "一筆箋是一种窄长的信纸，只写几行：比一封信短，比一条消息多一点心意。",
      text: "谢谢你打开它。这里要是有什么让你好奇，就写信给我。每一封我都会回，慢一点，但一定回。",
      from: "林",
      date: "2026-10-19",
    },
  ],
  albums: {
    cards: profile.albums.cards.map((c, i) => ({ ...c, note: colourNotes[i] ?? c.note })),
    postcards: profile.albums.postcards.map((p, i) => {
      const t = postcardText[i];
      return t ? { ...p, label: t.label, place: t.place, message: t.message, from: "林", ...(p.credit && { credit: p.credit.replace(/^Photo: /, "摄影：") }) } : p;
    }),
  },
};

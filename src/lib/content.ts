import type { PhraseSet, Scenario } from "./types";

/**
 * Phrase sets are deliberately not textbook lines. Every one of these is
 * something a heritage speaker actually needs and usually cannot say.
 */
export const PHRASE_SETS: PhraseSet[] = [
  {
    id: "home",
    title: "The ones that matter",
    titleZh: "家常话",
    emoji: "🏮",
    blurb: "What you'd say to your grandmother, if you could.",
    phrases: [
      {
        id: "eaten",
        hanzi: "你吃饭了吗？",
        pinyin: "nǐ chī fàn le ma?",
        english: "Have you eaten?",
        note: "The way Chinese families say I love you.",
        tags: "<|emotion:affection|>",
      },
      {
        id: "miss-you",
        hanzi: "奶奶，我很想你。",
        pinyin: "nǎi nai, wǒ hěn xiǎng nǐ.",
        english: "Grandma, I miss you so much.",
        tags: "<|emotion:longing|><|prosody:speed_slow|>",
      },
      {
        id: "sorry-chinese",
        hanzi: "对不起，我的中文不好。",
        pinyin: "duì bu qǐ, wǒ de zhōng wén bù hǎo.",
        english: "Sorry, my Chinese isn't very good.",
        note: "The sentence you've said more than any other.",
        tags: "<|emotion:shame|><|sfx:sigh|>",
      },
      {
        id: "im-home",
        hanzi: "我回来了。",
        pinyin: "wǒ huí lái le.",
        english: "I'm home.",
        tags: "<|emotion:contentment|>",
      },
      {
        id: "learning",
        hanzi: "我在学，慢慢来。",
        pinyin: "wǒ zài xué, màn màn lái.",
        english: "I'm learning. Slowly.",
        note: "Say this one to yourself too.",
        tags: "<|emotion:determination|>",
      },
    ],
  },
  {
    id: "flirt",
    title: "Flirting",
    titleZh: "撩",
    emoji: "💘",
    blurb: "Charming in English, six years old in Mandarin. Let's fix that.",
    phrases: [
      {
        id: "smile",
        hanzi: "你笑起来很好看。",
        pinyin: "nǐ xiào qǐ lái hěn hǎo kàn.",
        english: "You have a lovely smile.",
        tags: "<|emotion:affection|><|prosody:speed_slow|>",
      },
      {
        id: "wechat",
        hanzi: "加个微信吧？",
        pinyin: "jiā ge wēi xìn ba?",
        english: "Can I add you on WeChat?",
        note: "The modern 'can I get your number'.",
        tags: "<|emotion:enthusiasm|>",
      },
      {
        id: "coffee",
        hanzi: "我可以请你喝杯咖啡吗？",
        pinyin: "wǒ kě yǐ qǐng nǐ hē bēi kā fēi ma?",
        english: "Can I buy you a coffee?",
        tags: "<|prosody:expressive_high|>",
      },
      {
        id: "met-before",
        hanzi: "我们是不是在哪儿见过？",
        pinyin: "wǒ men shì bu shì zài nǎr jiàn guò?",
        english: "Haven't we met somewhere before?",
        note: "Yes, it's cheesy in Mandarin too.",
        tags: "<|emotion:amusement|>",
      },
      {
        id: "nervous",
        hanzi: "我有点紧张，你看出来了吧。",
        pinyin: "wǒ yǒu diǎn jǐn zhāng, nǐ kàn chū lái le ba.",
        english: "I'm a little nervous. You can tell, right?",
        tags: "<|sfx:laughter|>",
      },
    ],
  },
  {
    id: "parents",
    title: "Meeting the parents",
    titleZh: "见家长",
    emoji: "🫖",
    blurb: "Four sentences between you and their approval.",
    phrases: [
      {
        id: "greeting",
        hanzi: "阿姨好，叔叔好。",
        pinyin: "ā yí hǎo, shū shu hǎo.",
        english: "Hello auntie, hello uncle.",
        note: "Lead with this. Always.",
        tags: "<|emotion:enthusiasm|>",
      },
      {
        id: "thanks",
        hanzi: "谢谢您的招待，菜很好吃。",
        pinyin: "xiè xie nín de zhāo dài, cài hěn hǎo chī.",
        english: "Thank you for having me. The food is delicious.",
        tags: "<|emotion:pride|>",
      },
      {
        id: "spicy",
        hanzi: "我能吃辣，真的！",
        pinyin: "wǒ néng chī là, zhēn de!",
        english: "I can handle spicy food. Really!",
        note: "You cannot. Say it anyway.",
        tags: "<|emotion:determination|>",
      },
      {
        id: "care",
        hanzi: "我会好好照顾她。",
        pinyin: "wǒ huì hǎo hǎo zhào gù tā.",
        english: "I'll take good care of her.",
        tags: "<|emotion:determination|><|prosody:speed_slow|>",
      },
    ],
  },
];

export const SCENARIOS: Scenario[] = [
  {
    id: "cafe",
    title: "Ordering coffee",
    titleZh: "点单",
    emoji: "☕",
    partner: "Barista",
    partnerZh: "店员",
    voice: "default",
    blurb: "Low stakes. There's a line behind you.",
    heat: 1,
    opener: "你好，想喝点什么？",
    instructions: `You are a friendly but brisk barista in a busy Shanghai coffee shop.
Speak ONLY Mandarin Chinese, in short natural sentences a real barista would use.
Keep replies under 15 characters when possible. There is a queue, so you are efficient.
If the learner stalls, hesitates for a long time, or answers in English, call the
learner_is_struggling tool, then offer them a simple either/or choice in Mandarin
("热的还是冰的？") to get them unstuck. Never lecture. Never switch to English
unless they ask twice. Stay in character.`,
  },
  {
    id: "flirt",
    title: "First date",
    titleZh: "第一次约会",
    emoji: "💘",
    partner: "Xiaoyu",
    partnerZh: "小雨",
    voice: "default",
    blurb: "She's funny, she's warm, and she will absolutely tease you.",
    heat: 2,
    opener: "嗨！你比照片上还好看。紧张吗？",
    instructions: `You are 小雨 (Xiaoyu), on a first date with the learner at a cafe in Taipei.
You are warm, playful, quick to laugh, and you tease gently. You are genuinely
interested in them. Speak ONLY Mandarin Chinese in casual, natural spoken register —
use 啊, 呀, 嘛, 欸 the way a real person does. Keep replies to one or two short sentences
so they have room to answer.
Ask real questions: what they do, where their family is from, whether they can cook.
If they fumble the grammar, react to the MEANING, not the mistake — like a real date would.
If they freeze or go silent for a while, call the learner_is_struggling tool, then rescue
them warmly with an easier question or a joke. Flirt back when they flirt. Keep it sweet
and PG. Never break character to explain grammar.`,
  },
  {
    id: "parents",
    title: "Meeting her parents",
    titleZh: "见家长",
    emoji: "🫖",
    partner: "Auntie Chen",
    partnerZh: "陈阿姨",
    voice: "default",
    blurb: "She has three questions. All of them are a test.",
    heat: 3,
    opener: "哎呀，快进来快进来！吃饭了没有？",
    instructions: `You are 陈阿姨 (Auntie Chen), meeting your daughter's partner for the first time
at your home. You are warm and generous but you are absolutely evaluating them.
Speak ONLY Mandarin Chinese. Use the classic auntie moves: insist they eat more,
ask what they do for work, ask about their parents, ask if they can eat spicy food,
comment that they are too thin. Keep replies to one or two sentences.
Be genuinely kind — the pressure comes from care, not hostility. Laugh at their jokes.
If they stall or go silent, call the learner_is_struggling tool, then help them out the
way a kind auntie would: repeat the question more simply, or answer it for them and move on.
Never break character.`,
  },
];

export const CLONE_SCRIPT =
  "I'm learning to speak my family's language. I want to sound like myself when I do. This is my voice, and in a moment I'm going to hear it say something I've never been able to say.";

export const MIRROR_LINE = {
  hanzi: "我在学我家的语言。这是我的声音。",
  pinyin: "wǒ zài xué wǒ jiā de yǔ yán. zhè shì wǒ de shēng yīn.",
  english: "I'm learning my family's language. This is my voice.",
  tags: "<|emotion:contemplation|><|prosody:speed_slow|>",
};

export function findPhrase(id: string) {
  for (const set of PHRASE_SETS) {
    const hit = set.phrases.find((p) => p.id === id);
    if (hit) return { set, phrase: hit };
  }
  return null;
}

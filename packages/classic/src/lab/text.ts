/**
 * The Lab page's words, in English and Russian. The Russian must have every key the English
 * has (the type says so). `fill` fills the holes: `{n}` is a value, `{n:step|steps}` the word
 * that goes with it (English: one|other; Russian: one|few|many).
 */

export interface CardText {
  title: string;
  text: string;
  /** Labels of the card's controls, by the control's id. */
  params: Record<string, string>;
  /** What came out, by outcome. */
  results: Record<string, string>;
}

export interface LabText {
  lang: string;
  title: string;
  subtitle: string;
  intro: string;
  play: string;
  pause: string;
  story: string;
  backToGame: string;
  allFindings: string;
  rights: string;
  loading: string;
  failed: string;
  cards: Record<CardId, CardText>;
}

export type CardId = 'vault' | 'wallRun' | 'landing' | 'pace' | 'runner' | 'circle' | 'camera';

export const EN: LabText = {
  lang: 'English',
  title: 'The Lab',
  subtitle: 'How Playman Extreme Running works',
  intro:
    'Parapet Classic plays exactly like the 2007 original, so it can also take the original apart. Each experiment below runs the real game rules on the original’s own data: change the settings and watch what the runner does.',
  play: 'Play',
  pause: 'Pause',
  story: 'The full story',
  backToGame: 'Play the game',
  allFindings: 'All fifteen findings',
  rights:
    'Playman Extreme Running (2007) was made by Mr.Goodliving and published by RealNetworks; its graphics, levels and music belong to their rights holders. This page is part of a non-commercial fan remake, not affiliated with them.',
  loading: 'Loading the original’s data…',
  failed: 'The experiments could not start in this browser.',
  cards: {
    vault: {
      title: 'The game never sees a held key',
      text: 'The original does not know whether a key is held: it only catches the moment a key goes down, and remembers it. Press UP once more during a jump and the press waits (the arrow over the head) until the runner lands on the block, then the runner vaults it, whenever you pressed. But press anything on the very moment of landing and the waiting press is lost.',
      params: {
        press: 'Second UP: {n} {n:step|steps} after the jump',
        again: 'Press UP again on the landing',
      },
      results: {
        vault: 'A vault: the press waited {w} {w:step|steps} for the landing.',
        lost: 'No vault: a new press on the landing took the place of the waiting one.',
        jump: 'Pressed after the landing: just a new jump.',
      },
    },
    wallRun: {
      title: 'The wall run: press early, it waits',
      text: 'In the air the runner feels ahead with an invisible line. Once it meets a wall and turns green, UP gets the wall run ready, and it starts by itself on contact. The catch: a press right on contact gives two kicks and a climb onto the roof, an earlier one only one kick. Switch the original’s rules off one at a time to see which does what.',
      params: {
        press: 'Second UP: {n} {n:step|steps} after the jump',
        lookahead: 'Looking ahead',
        keep33: 'The wall run keeps the press',
        keep30: 'Waiting for the wall keeps the press',
      },
      results: {
        none: 'Nothing: the runner slides down the wall.',
        one: 'One kick, then down.',
        twoClimb: 'Two kicks, and a climb onto the roof.',
        twoFall: 'Two kicks, but not enough to reach the roof.',
      },
    },
    landing: {
      title: 'Landing stops the fall, not the run',
      text: 'At touchdown the speed of the fall (orange arrow) simply vanishes, and the runner keeps its horizontal speed (blue). How hard the landing is depends on the height alone; DOWN in the air softens it.',
      params: { height: 'Height: {n} {n:tile|tiles}', down: 'DOWN in the air' },
      results: {
        clean: 'Lands and runs on.',
        soft: 'A soft landing: 25 points, the speed kept.',
        roll: 'A landing roll: 70 points.',
        stumble: 'Too hard: a stumble, and half the speed is gone.',
        crash: 'A crash: about four seconds to get up.',
      },
    },
    pace: {
      title: 'Slow phones slow the game down',
      text: 'Each frame the original moves the game on by the time the frame took, but never by more than 150 units, and with the fraction cut off. So a slow phone plays in slow motion, and a fast screen falls a little behind on every frame. Parapet keeps the fraction and runs at the same pace on any screen.',
      params: { fps: '{n} {n:frame|frames} a second' },
      results: {
        pace: 'The original would run at {p} % of its own pace (below, for comparison: {c} {c:frame|frames} a second).',
      },
    },
    runner: {
      title: 'The runner is a vector puppet',
      text: 'The runner is not a set of ready pictures but a puppet of 19 layers of small sprites, placed anew in each of 463 keyframes and blended between them. Pull it apart, dress it as another character, or turn the blending off.',
      params: {
        spread: 'Pieces apart: ×{n}',
        look: 'Character',
        tween: 'Blend between keyframes',
        dots: 'Ghost (taking turns)',
      },
      results: { runner: '19 layers, 65 sprites, 463 keyframes.' },
    },
    circle: {
      title: 'The game’s circle has 16 sides',
      text: 'No fractions and no fast square roots, so the original measures lengths with a shortcut. Mark every point it puts at the same distance from the centre and you get not a circle but a 16-sided shape (green), with little steps near the axes.',
      params: {},
      results: { circle: 'Lengths come out up to 3.8 % too long or up to 3 % too short.' },
    },
    camera: {
      title: 'The camera',
      text: 'The developers’ own run of a level on the original’s 240 × 320 screen. The camera looks further ahead the faster the runner goes (the cross), but stops when a wall is ahead (the cross turns green). And a leash (the box) keeps the middle of the screen (the dot) close to the runner.',
      params: { level: 'Level', workings: 'Show how the camera works' },
      results: { camera: 'The rival’s run takes {s} s.' },
    },
  },
};

export const RU: LabText = {
  lang: 'Русский',
  title: 'Лаборатория',
  subtitle: 'Как устроен Playman Extreme Running',
  intro:
    'Parapet Classic повторяет оригинал 2007 года шаг в шаг, поэтому на нём удобно разбирать, как оригинал устроен. Все опыты ниже идут на настоящих правилах игры и её собственных данных: меняйте настройки и смотрите, что будет с бегуном.',
  play: 'Запустить',
  pause: 'Пауза',
  story: 'Подробнее',
  backToGame: 'Играть',
  allFindings: 'Все 15 находок',
  rights:
    'Playman Extreme Running (2007) — игра Mr.Goodliving, издатель — RealNetworks. Графика, уровни и музыка принадлежат правообладателям. Эта страница — часть некоммерческого фанатского ремейка, который с ними никак не связан.',
  loading: 'Загружаем данные оригинала…',
  failed: 'В этом браузере опыты не запустились.',
  cards: {
    vault: {
      title: 'Игра не видит зажатых клавиш',
      text: 'Оригинал не знает, держите вы клавишу или нет: он ловит только момент нажатия и запоминает его. Нажмите UP ещё раз во время прыжка — нажатие подождёт (стрелка над головой), пока бегун не встанет на блок, и тогда он перемахнёт через него. Когда именно вы нажали, неважно. Но если в момент приземления нажать что-нибудь ещё, отложенное нажатие пропадёт.',
      params: {
        press: 'Второй UP — через {n} {n:шаг|шага|шагов} после прыжка',
        again: 'Нажать UP ещё раз в момент приземления',
      },
      results: {
        vault: 'Перемах: нажатие ждало приземления {w} {w:шаг|шага|шагов}.',
        lost: 'Перемаха нет: новое нажатие в момент приземления перебило отложенное.',
        jump: 'Нажали уже после приземления — это просто новый прыжок.',
      },
    },
    wallRun: {
      title: 'Бег по стене: жать можно заранее',
      text: 'В прыжке бегун «смотрит» вперёд невидимой линией. Как только она упирается в стену и зеленеет, можно жать UP: бег по стене начнётся сам, когда бегун коснётся стены. Есть тонкость: если нажать ровно в момент касания, будет два толчка и подъём на крышу, а если заранее — только один. Выключайте правила оригинала по одному и смотрите, какое за что отвечает.',
      params: {
        press: 'Второй UP — через {n} {n:шаг|шага|шагов} после прыжка',
        lookahead: 'Взгляд вперёд',
        keep33: 'Бег по стене помнит нажатие',
        keep30: 'Ожидание стены помнит нажатие',
      },
      results: {
        none: 'Ничего не вышло: бегун сполз по стене.',
        one: 'Один толчок — и вниз.',
        twoClimb: 'Два толчка и подъём на крышу.',
        twoFall: 'Два толчка, но до крыши не хватило.',
      },
    },
    landing: {
      title: 'Приземление гасит падение, но не разбег',
      text: 'В момент касания скорость падения (оранжевая стрелка) просто исчезает, а горизонтальная (синяя) остаётся как была. Насколько жёстким выйдет приземление, зависит только от высоты. DOWN в воздухе его смягчает.',
      params: {
        height: 'Высота: {n} {n:клетка|клетки|клеток}',
        down: 'Нажать DOWN в воздухе',
      },
      results: {
        clean: 'Приземлился и бежит дальше.',
        soft: 'Мягкое приземление: +25 очков, скорость не потеряна.',
        roll: 'Приземление с кувырком: +70 очков.',
        stumble: 'Слишком жёстко: бегун спотыкается и теряет половину скорости.',
        crash: 'Падение: чтобы подняться, уйдёт секунды четыре.',
      },
    },
    pace: {
      title: 'На медленном телефоне игра замедляется',
      text: 'Каждый кадр оригинал продвигает игру на столько, сколько этот кадр длился, но не больше чем на 150 единиц и без дробной части. Поэтому на медленном телефоне игра идёт как в замедленной съёмке, а на быстром экране понемногу отстаёт на каждом кадре. Parapet дробную часть не теряет и идёт с одной скоростью на любом экране.',
      params: { fps: '{n} {n:кадр|кадра|кадров} в секунду' },
      results: {
        pace: 'Оригинал шёл бы на {p} % своей скорости (внизу для сравнения — {c} {c:кадр|кадра|кадров} в секунду).',
      },
    },
    runner: {
      title: 'Бегун — векторная кукла',
      text: 'Бегун — это не набор готовых картинок, а кукла из 19 слоёв маленьких спрайтов. В каждом из 463 ключевых кадров они расставлены заново, а между кадрами игра плавно их смешивает. Разберите бегуна на части, переоденьте в другого персонажа или выключите смешивание.',
      params: {
        spread: 'Разнести части: ×{n}',
        look: 'Персонаж',
        tween: 'Плавно смешивать кадры',
        dots: 'Призрак (игра по очереди)',
      },
      results: { runner: '19 слоёв, 65 спрайтов, 463 ключевых кадра.' },
    },
    circle: {
      title: 'В игре у окружности 16 сторон',
      text: 'Дробей нет, быстрых квадратных корней тоже, поэтому длину оригинал считает по приближённой формуле. Если отметить все точки, которые она считает равноудалёнными от центра, получится не окружность, а 16-угольник (зелёный), да ещё со ступеньками у осей.',
      params: {},
      results: { circle: 'Длина выходит то до 3,8 % больше настоящей, то до 3 % меньше.' },
    },
    camera: {
      title: 'Камера',
      text: 'Забег самих разработчиков на экране оригинала 240 × 320. Камера смотрит вперёд тем дальше, чем быстрее бежит бегун (крестик), но перестаёт, когда впереди стена (крестик зеленеет). А «поводок» (рамка) не даёт центру экрана (точка) далеко уйти от бегуна.',
      params: { level: 'Уровень', workings: 'Показать, как работает камера' },
      results: { camera: 'Забег соперника длится {s} с.' },
    },
  },
};

export const LANGUAGES: readonly [string, LabText][] = [
  ['en', EN],
  ['ru', RU],
];

/** The plural categories a `{n:a|b|c}` hole lists its words in, by language. */
const FORMS: Record<string, readonly Intl.LDMLPluralRule[]> = {
  en: ['one', 'other'],
  ru: ['one', 'few', 'many'],
};

/**
 * `pattern` with its holes filled from `args`: `{n}` the value (numbers as `lang` writes them),
 * `{n:one|other}` the word for it in `lang`.
 */
export function fill(
  pattern: string,
  args: Record<string, string | number> = {},
  lang = 'en',
): string {
  const rules = new Intl.PluralRules(lang);
  const order = FORMS[lang] ?? FORMS['en']!;
  return pattern.replace(/\{(\w+)(?::([^}]*))?\}/g, (hole, key: string, words?: string) => {
    const value = args[key];
    if (value === undefined) return hole;
    if (words === undefined) {
      return typeof value === 'number'
        ? value.toLocaleString(lang, { maximumFractionDigits: 1 })
        : value;
    }
    const list = words.split('|');
    const i = order.indexOf(rules.select(Number(value)));
    return list[i >= 0 ? i : list.length - 1] ?? '';
  });
}

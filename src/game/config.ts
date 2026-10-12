/**
 * Neon Cyber Spin — Game Configuration
 * Все настройки, константы и параметры игры
 */

export const CONFIG = {
  // Поле
  REELS: 5,
  ROWS: 3,
  
  // Стартовый баланс (по умолчанию, выбирается на стартовом экране)
  DEFAULT_START_BALANCE: 1000,
  
  // Варианты начальных сумм на стартовом экране
  START_BALANCE_OPTIONS: [500, 1000, 2000, 5000, 10000],
  
  // Ставки (максимум 10 000)
  BET_LEVELS: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  DEFAULT_BET_INDEX: 0,
  
  // Символы (веса увеличены для низких — казино имеет преимущество)
  SYMBOLS: {
    CHERRY: { id: 'cherry', emoji: '🍒', weight: 14, type: 'low' as const },
    LEMON: { id: 'lemon', emoji: '🍋', weight: 12, type: 'low' as const },
    BELL: { id: 'bell', emoji: '🔔', weight: 8, type: 'medium' as const },
    DIAMOND: { id: 'diamond', emoji: '💎', weight: 3, type: 'high' as const },
    SEVEN: { id: 'seven', emoji: '7️⃣', weight: 2, type: 'high' as const },
    WILD: { id: 'wild', emoji: '⚡', weight: 1, type: 'wild' as const },
    SCATTER: { id: 'scatter', emoji: '🌀', weight: 1, type: 'scatter' as const },
  },
  
  // Таблица выплат — СНИЖЕНА для преимущества казино (~85-88% RTP)
  PAYTABLE: {
    cherry:  { 3: 3, 4: 10, 5: 25 },
    lemon:   { 3: 5, 4: 15, 5: 50 },
    bell:    { 3: 10, 4: 30, 5: 100 },
    diamond: { 3: 20, 4: 70, 5: 200 },
    seven:   { 3: 30, 4: 120, 5: 350 },
    wild:    { 3: 60, 4: 250, 5: 700 },
    scatter: { 3: 1, 4: 3, 5: 10 }, // умножается на общую ставку
  },
  
  // Полосы барабанов (strip-based reels) — по 40 символов каждый
  // Редкие символы встречаются реже, низкие — чаще
  REEL_STRIPS: [
    // Reel 1
    ['lemon','cherry','cherry','lemon','bell','lemon','cherry','lemon','bell','lemon',
     'cherry','lemon','bell','cherry','lemon','cherry','lemon','bell','lemon','cherry',
     'diamond','lemon','cherry','bell','lemon','cherry','lemon','bell','cherry','lemon',
     'bell','cherry','lemon','bell','cherry','lemon','bell','cherry','lemon','cherry'],
    // Reel 2
    ['bell','lemon','cherry','bell','cherry','lemon','bell','cherry','lemon','bell',
     'cherry','lemon','bell','cherry','lemon','bell','cherry','lemon','bell','cherry',
     'lemon','bell','cherry','lemon','bell','cherry','diamond','lemon','bell','cherry',
     'lemon','bell','cherry','lemon','bell','cherry','lemon','bell','cherry','lemon'],
    // Reel 3
    ['cherry','bell','lemon','cherry','bell','lemon','cherry','bell','lemon','cherry',
     'bell','lemon','cherry','bell','lemon','cherry','bell','lemon','cherry','bell',
     'lemon','cherry','bell','lemon','cherry','bell','lemon','diamond','cherry','bell',
     'lemon','cherry','bell','lemon','cherry','bell','lemon','cherry','bell','lemon'],
    // Reel 4
    ['lemon','cherry','bell','lemon','cherry','bell','lemon','cherry','bell','lemon',
     'cherry','bell','lemon','cherry','bell','lemon','cherry','bell','lemon','cherry',
     'bell','lemon','cherry','bell','lemon','cherry','bell','lemon','diamond','cherry',
     'bell','lemon','cherry','bell','lemon','cherry','bell','lemon','cherry','bell'],
    // Reel 5
    ['bell','cherry','lemon','bell','cherry','lemon','bell','cherry','lemon','bell',
     'cherry','lemon','bell','cherry','lemon','bell','cherry','lemon','bell','cherry',
     'lemon','bell','cherry','lemon','bell','cherry','lemon','bell','diamond','cherry',
     'lemon','bell','cherry','lemon','bell','cherry','lemon','bell','cherry','lemon'],
  ],
  
  // Линии выплат (row для каждого барабана: 0=top, 1=mid, 2=bot)
  PAYLINES: [
    [1, 1, 1, 1, 1], // Line 1: middle
    [0, 0, 0, 0, 0], // Line 2: top
    [2, 2, 2, 2, 2], // Line 3: bottom
    [0, 1, 2, 1, 0], // Line 4: V shape
    [2, 1, 0, 1, 2], // Line 5: inverted V
    [0, 0, 1, 2, 2], // Line 6: descending
    [2, 2, 1, 0, 0], // Line 7: ascending
    [1, 0, 0, 0, 1], // Line 8: top dip
    [1, 2, 2, 2, 1], // Line 9: bottom dip
    [0, 1, 0, 1, 0], // Line 10: zigzag
  ],
  
  // Длительность вращения барабанов (мс)
  REEL_SPIN_DURATION: [2000, 2300, 2600, 2900, 3200],
  
  // Займы
  LOAN_AMOUNT: 500,
  LOAN_INTEREST: 0.10, // 10%
  MAX_LOANS: 3,
  DEBT_REPAY_PERCENT: 0.50, // 50% выигрыша на погашение
  
  // Джекпот
  JACKPOT_START: 10000,
  JACKPOT_CONTRUTION: 0.01, // 1% от ставки
  JACKPOT_ODDS: 10000, // 1 к 10000
  
  // Фриспины
  FREE_SPINS_COUNT: 10,
  FREE_SPINS_MULTIPLIER: 2,
  FREE_SPINS_RETRIGGER: 5,
  SCATTER_MIN_TRIGGER: 3,
  
  // Near Miss
  NEAR_MISS_CHANCE: 0.18, // 18% проигрышных спинов с near miss
  
  // Big Win пороги
  BIG_WIN_MULTIPLIER: 20,
  MEGA_WIN_MULTIPLIER: 100,
  
  // Автоигра
  AUTO_SPIN_OPTIONS: [10, 25, 50, 100],
  
  // localStorage ключи
  STORAGE_PREFIX: 'neonCyberSpin_',
  
  // Достижения
  ACHIEVEMENTS: {
    FIRST_BLOOD: { id: 'first_blood', name: 'Первая кровь', desc: 'Первый выигрыш', icon: '🗡️' },
    BIG_FISH: { id: 'big_fish', name: 'Крупная рыба', desc: 'Выигрыш > x50 ставки', icon: '💰' },
    HIGHROLLER: { id: 'highroller', name: 'Хайроллер', desc: '100 спинов', icon: '🎰' },
    IN_PLUS: { id: 'in_plus', name: 'В плюсе', desc: 'Баланс выше стартового после 50 спинов', icon: '📈' },
    STREAK: { id: 'streak', name: 'Серия', desc: '3 выигрыша подряд', icon: '🔥' },
    DIAMOND_MAGNATE: { id: 'diamond_magnate', name: 'Алмазный магнат', desc: '5 алмазов на линии', icon: '💎' },
    BONUS_HUNTER: { id: 'bonus_hunter', name: 'Бонусный охотник', desc: 'Активировать фриспины 3 раза', icon: '🌀' },
    DEBTOR: { id: 'debtor', name: 'Должник', desc: 'Взять максимальный займ', icon: '🏦' },
    JACKPOT_WIN: { id: 'jackpot_win', name: 'Джекпот!', desc: 'Выиграть джекпот', icon: '🎊' },
  },
} as const;

export type SymbolId = keyof typeof CONFIG.SYMBOLS;
export type SymbolData = typeof CONFIG.SYMBOLS[SymbolId];

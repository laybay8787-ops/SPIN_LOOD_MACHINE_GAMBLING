/**
 * Neon Cyber Spin — Game Engine
 * Основная логика: RNG, математика, оценка выигрышей
 */

import { CONFIG } from './config';

// ============ RNG (криптографически стойкий) ============
export class RNG {
  /**
   * Генерирует случайное целое число в диапазоне [0, max)
   */
  static getInt(max: number): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }

  /**
   * Генерирует случайное число [0, 1)
   */
  static getFloat(): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
  }

  /**
   * Шанс 1 к N
   */
  static chance(odds: number): boolean {
    return this.getInt(odds) === 0;
  }
}

// ============ Slot Machine Logic ============
export interface SpinResult {
  grid: string[][]; // 5x3 grid of symbol IDs
  reelPositions: number[]; // позиция остановки на каждом барабане
  wins: WinLine[];
  totalWin: number;
  scatterCount: number;
  isJackpot: boolean;
  nearMissLines: number[]; // линии с near miss
}

export interface WinLine {
  lineIndex: number;
  symbolId: string;
  count: number;
  payout: number;
  positions: [number, number][]; // [reel, row]
}

export class SlotMachine {
  private reelStrips: string[][];

  constructor() {
    this.reelStrips = CONFIG.REEL_STRIPS.map(strip => [...strip]);
  }

  /**
   * Выполняет спин и возвращает результат
   * КАЗИНО ВСЕГДА В ВЫИГРЫШЕ: пользователь выигрывает только в 1 из 10 случаев (10%)
   */
  spin(bet: number): SpinResult {
    // КРИТИЧНО: Казино всегда в плюсе. Только 10% спинов могут быть выигрышными.
    const isWinningSpin = RNG.getFloat() < CONFIG.WIN_CHANCE;
    
    if (!isWinningSpin) {
      // ПРИНУДИТЕЛЬНЫЙ ПРОИГРЫШ — генерируем сетку без выигрышных комбинаций
      return this.generateLosingSpin(bet);
    }
    
    // Выигрышный спин (10% шанс) — обычная генерация
    const reelPositions = this.reelStrips.map(strip => RNG.getInt(strip.length));
    const grid = this.getGrid(reelPositions);
    
    // Проверяем джекпот (очень редкий)
    const isJackpot = RNG.chance(CONFIG.JACKPOT_ODDS);
    
    // Оцениваем выигрыши
    const evaluator = new PaylineEvaluator();
    const { wins, nearMissLines } = evaluator.evaluate(grid, bet);
    
    // Подсчитываем scatter
    const scatterCount = this.countScatters(grid);
    
    // Считаем общий выигрыш
    let totalWin = wins.reduce((sum, w) => sum + w.payout, 0);
    
    // Scatter выплаты (умножаются на общую ставку)
    if (scatterCount >= 3) {
      const scatterPay = CONFIG.PAYTABLE.scatter[scatterCount as 3 | 4 | 5] || 0;
      totalWin += scatterPay * bet;
    }
    
    // Джекпот
    if (isJackpot) {
      totalWin += CONFIG.JACKPOT_START;
    }
    
    return { grid, reelPositions, wins, totalWin, scatterCount, isJackpot, nearMissLines };
  }

  /**
   * Генерирует ЗАВЕДОМО ПРОИГРЫШНЫЙ спин
   * Создаёт сетку где нет выигрышных линий, но иногда с near-miss эффектом
   */
  private generateLosingSpin(bet: number): SpinResult {
    // Генерируем позиции до тех пор пока не будет выигрышных линий
    let grid: string[][];
    let reelPositions: number[];
    let wins: WinLine[] = [];
    let scatterCount = 0;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
      reelPositions = this.reelStrips.map(strip => RNG.getInt(strip.length));
      grid = this.getGrid(reelPositions!);
      
      // Оцениваем
      const evaluator = new PaylineEvaluator();
      const result = evaluator.evaluate(grid, bet);
      wins = result.wins;
      scatterCount = this.countScatters(grid);
      attempts++;
      
      // Принимаем если нет выигрышей И нет 3+ scatter
    } while ((wins.length > 0 || scatterCount >= 3) && attempts < maxAttempts);
    
    // Если не удалось сгенерировать проигрыш за 50 попыток — принудительно ломаем
    if (wins.length > 0 || scatterCount >= 3) {
      grid = this.forceLosingGrid();
      reelPositions = [0, 0, 0, 0, 0];
      wins = [];
      scatterCount = 0;
    }
    
    // Near miss эффект (18% проигрышных спинов) — "почти выиграл"
    const nearMissLines: number[] = [];
    if (RNG.getFloat() < CONFIG.NEAR_MISS_CHANCE) {
      this.applyNearMiss(grid!, reelPositions!);
      // Находим линии с near miss
      const evaluator = new PaylineEvaluator();
      const nmResult = evaluator.evaluate(grid!, bet);
      nearMissLines.push(...nmResult.nearMissLines);
    }
    
    return { 
      grid: grid!, 
      reelPositions: reelPositions!, 
      wins: [], 
      totalWin: 0, 
      scatterCount, 
      isJackpot: false, 
      nearMissLines 
    };
  }

  /**
   * Принудительно создаёт проигрышную сетку
   */
  private forceLosingGrid(): string[][] {
    // Простая проигрышная комбинация — все разные символы на каждой линии
    const lowSymbols = ['cherry', 'lemon', 'bell'];
    const grid: string[][] = [];
    
    for (let reel = 0; reel < CONFIG.REELS; reel++) {
      const col: string[] = [];
      for (let row = 0; row < CONFIG.ROWS; row++) {
        // Чередование низких символов, гарантированно без выигрышных линий
        col.push(lowSymbols[(reel + row) % lowSymbols.length]);
      }
      grid.push(col);
    }
    
    return grid;
  }

  /**
   * Получает сетку символов из позиций барабанов
   */
  private getGrid(positions: number[]): string[][] {
    const grid: string[][] = [];
    for (let reel = 0; reel < CONFIG.REELS; reel++) {
      const strip = this.reelStrips[reel];
      const col: string[] = [];
      for (let row = 0; row < CONFIG.ROWS; row++) {
        const idx = (positions[reel] + row) % strip.length;
        col.push(strip[idx]);
      }
      grid.push(col);
    }
    return grid;
  }

  /**
   * Подсчитывает количество scatter на поле
   */
  private countScatters(grid: string[][]): number {
    let count = 0;
    for (let reel = 0; reel < CONFIG.REELS; reel++) {
      for (let row = 0; row < CONFIG.ROWS; row++) {
        if (grid[reel][row] === 'scatter') count++;
      }
    }
    return count;
  }

  /**
   * Применяет near-miss эффект к сетке
   */
  private applyNearMiss(grid: string[][], _positions: number[]): void {
    // Выбираем случайную линию и ставим 2 одинаковых символа
    const lineIdx = RNG.getInt(CONFIG.PAYLINES.length);
    const line = CONFIG.PAYLINES[lineIdx];
    
    // Выбираем символ для near miss (не wild, не scatter)
    const normalSymbols = ['cherry', 'lemon', 'bell', 'diamond', 'seven'];
    const symbol = normalSymbols[RNG.getInt(normalSymbols.length)];
    
    // Ставим этот символ на первые 2 барабана линии
    grid[0][line[0]] = symbol;
    grid[1][line[1]] = symbol;
    
    // Третий барабан — другой символ (чтобы не выиграл)
    const otherSymbols = normalSymbols.filter(s => s !== symbol);
    grid[2][line[2]] = otherSymbols[RNG.getInt(otherSymbols.length)];
  }

  /**
   * Симуляция для расчёта RTP
   */
  static calculateRTP(simulations: number = 10000): number {
    const machine = new SlotMachine();
    let totalBet = 0;
    let totalWin = 0;
    const bet = 10;

    for (let i = 0; i < simulations; i++) {
      const result = machine.spin(bet);
      totalBet += bet;
      totalWin += result.totalWin;
    }

    const rtp = (totalWin / totalBet) * 100;
    console.log(`🎰 RTP Simulation (${simulations} spins):`);
    console.log(`   Total Bet: ${totalBet}`);
    console.log(`   Total Win: ${totalWin}`);
    console.log(`   RTP: ${rtp.toFixed(2)}%`);
    return rtp;
  }
}

// ============ Payline Evaluator ============
export class PaylineEvaluator {
  /**
   * Оценивает все линии выплат
   */
  evaluate(grid: string[][], bet: number): { wins: WinLine[]; nearMissLines: number[] } {
    const wins: WinLine[] = [];
    const nearMissLines: number[] = [];

    for (let lineIdx = 0; lineIdx < CONFIG.PAYLINES.length; lineIdx++) {
      const line = [...CONFIG.PAYLINES[lineIdx]] as number[];
      const result = this.evaluateLine(grid, line, bet, lineIdx);
      
      if (result.win) {
        wins.push(result.win);
      }
      if (result.nearMiss) {
        nearMissLines.push(lineIdx);
      }
    }

    return { wins, nearMissLines };
  }

  /**
   * Оценивает одну линию
   */
  private evaluateLine(
    grid: string[][], 
    line: number[], 
    bet: number, 
    lineIdx: number
  ): { win: WinLine | null; nearMiss: boolean } {
    // Собираем символы на линии
    const symbols = line.map((row, reel) => grid[reel][row]);
    
    // Определяем базовый символ (первый не-wild)
    let baseSymbol = '';
    for (const s of symbols) {
      if (s !== 'wild' && s !== 'scatter') {
        baseSymbol = s;
        break;
      }
    }
    
    // Если все wild — считаем как wild
    if (!baseSymbol) baseSymbol = 'wild';
    
    // Считаем количество совпадений слева направо
    let count = 0;
    const positions: [number, number][] = [];
    
    for (let reel = 0; reel < CONFIG.REELS; reel++) {
      const sym = symbols[reel];
      if (sym === baseSymbol || sym === 'wild') {
        count++;
        positions.push([reel, line[reel]]);
      } else {
        break;
      }
    }
    
    // Проверяем выплату
    if (count >= 3) {
      const paytable = CONFIG.PAYTABLE[baseSymbol as keyof typeof CONFIG.PAYTABLE];
      if (paytable && paytable[count as 3 | 4 | 5]) {
        const payout = paytable[count as 3 | 4 | 5] * bet;
        return {
          win: { lineIndex: lineIdx, symbolId: baseSymbol, count, payout, positions },
          nearMiss: false,
        };
      }
    }
    
    // Near miss: 2 совпадения
    if (count === 2) {
      return { win: null, nearMiss: true };
    }
    
    return { win: null, nearMiss: false };
  }
}

// ============ Stats Tracker ============
export interface GameStats {
  totalSpins: number;
  totalBet: number;
  totalWon: number;
  maxWin: number;
  maxWinMultiplier: number;
  longestLoseStreak: number;
  longestWinStreak: number;
  currentLoseStreak: number;
  currentWinStreak: number;
  balanceHistory: number[];
  loansTaken: number;
  bonusTriggered: number;
}

export class StatsTracker {
  stats: GameStats;

  constructor() {
    this.stats = this.load() || {
      totalSpins: 0,
      totalBet: 0,
      totalWon: 0,
      maxWin: 0,
      maxWinMultiplier: 0,
      longestLoseStreak: 0,
      longestWinStreak: 0,
      currentLoseStreak: 0,
      currentWinStreak: 0,
      balanceHistory: [],
      loansTaken: 0,
      bonusTriggered: 0,
    };
  }

  recordSpin(bet: number, win: number, balance: number): void {
    this.stats.totalSpins++;
    this.stats.totalBet += bet;
    this.stats.totalWon += win;
    
    if (win > this.stats.maxWin) {
      this.stats.maxWin = win;
      this.stats.maxWinMultiplier = bet > 0 ? win / bet : 0;
    }
    
    if (win > 0) {
      this.stats.currentWinStreak++;
      this.stats.currentLoseStreak = 0;
      if (this.stats.currentWinStreak > this.stats.longestWinStreak) {
        this.stats.longestWinStreak = this.stats.currentWinStreak;
      }
    } else {
      this.stats.currentLoseStreak++;
      this.stats.currentWinStreak = 0;
      if (this.stats.currentLoseStreak > this.stats.longestLoseStreak) {
        this.stats.longestLoseStreak = this.stats.currentLoseStreak;
      }
    }
    
    this.stats.balanceHistory.push(balance);
    if (this.stats.balanceHistory.length > 200) {
      this.stats.balanceHistory = this.stats.balanceHistory.slice(-200);
    }
    
    this.save();
  }

  recordLoan(): void {
    this.stats.loansTaken++;
    this.save();
  }

  recordBonus(): void {
    this.stats.bonusTriggered++;
    this.save();
  }

  getCurrentRTP(): number {
    if (this.stats.totalBet === 0) return 0;
    return (this.stats.totalWon / this.stats.totalBet) * 100;
  }

  private save(): void {
    try {
      localStorage.setItem(
        CONFIG.STORAGE_PREFIX + 'stats',
        JSON.stringify(this.stats)
      );
    } catch (e) {
      console.warn('Failed to save stats:', e);
    }
  }

  private load(): GameStats | null {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'stats');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  reset(): void {
    this.stats = {
      totalSpins: 0,
      totalBet: 0,
      totalWon: 0,
      maxWin: 0,
      maxWinMultiplier: 0,
      longestLoseStreak: 0,
      longestWinStreak: 0,
      currentLoseStreak: 0,
      currentWinStreak: 0,
      balanceHistory: [],
      loansTaken: 0,
      bonusTriggered: 0,
    };
    this.save();
  }
}

// ============ Loan System ============
export interface LoanState {
  debt: number;
  loanCount: number;
  totalBorrowed: number;
}

export class LoanSystem {
  state: LoanState;

  constructor() {
    this.state = this.load() || { debt: 0, loanCount: 0, totalBorrowed: 0 };
  }

  canBorrow(): boolean {
    return this.state.loanCount < CONFIG.MAX_LOANS;
  }

  borrow(): { success: boolean; amount: number; debt: number } {
    if (!this.canBorrow()) {
      return { success: false, amount: 0, debt: this.state.debt };
    }

    const loanAmount = CONFIG.LOAN_AMOUNT;
    const repayment = loanAmount * (1 + CONFIG.LOAN_INTEREST);
    
    this.state.debt += repayment;
    this.state.loanCount++;
    this.state.totalBorrowed += repayment;
    this.save();

    return { success: true, amount: loanAmount, debt: this.state.debt };
  }

  /**
   * Погашает долг из выигрыша. Возвращает {toDebt, toBalance}
   */
  repayFromWin(winAmount: number): { toDebt: number; toBalance: number; newDebt: number } {
    if (this.state.debt <= 0) {
      return { toDebt: 0, toBalance: winAmount, newDebt: 0 };
    }

    const toDebt = Math.min(winAmount * CONFIG.DEBT_REPAY_PERCENT, this.state.debt);
    const toBalance = winAmount - toDebt;
    this.state.debt -= toDebt;
    this.save();

    return { toDebt, toBalance, newDebt: this.state.debt };
  }

  isDebtFree(): boolean {
    return this.state.debt <= 0;
  }

  private save(): void {
    try {
      localStorage.setItem(
        CONFIG.STORAGE_PREFIX + 'loans',
        JSON.stringify(this.state)
      );
    } catch (e) {
      console.warn('Failed to save loans:', e);
    }
  }

  private load(): LoanState | null {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'loans');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  reset(): void {
    this.state = { debt: 0, loanCount: 0, totalBorrowed: 0 };
    this.save();
  }
}

// ============ Jackpot ============
export class Jackpot {
  amount: number;

  constructor() {
    this.amount = this.load() || CONFIG.JACKPOT_START;
  }

  contribute(bet: number): void {
    this.amount += bet * CONFIG.JACKPOT_CONTRUTION;
    this.save();
  }

  win(): number {
    const won = this.amount;
    this.amount = CONFIG.JACKPOT_START;
    this.save();
    return won;
  }

  private save(): void {
    try {
      localStorage.setItem(
        CONFIG.STORAGE_PREFIX + 'jackpot',
        this.amount.toString()
      );
    } catch (e) {
      console.warn('Failed to save jackpot:', e);
    }
  }

  private load(): number | null {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'jackpot');
      return data ? parseFloat(data) : null;
    } catch {
      return null;
    }
  }

  reset(): void {
    this.amount = CONFIG.JACKPOT_START;
    this.save();
  }
}

// ============ Achievements ============
export class AchievementSystem {
  unlocked: Set<string>;

  constructor() {
    this.unlocked = this.load();
  }

  check(
    achievementId: string,
    condition: boolean
  ): boolean {
    if (condition && !this.unlocked.has(achievementId)) {
      this.unlocked.add(achievementId);
      this.save();
      return true; // newly unlocked
    }
    return false;
  }

  isUnlocked(id: string): boolean {
    return this.unlocked.has(id);
  }

  private save(): void {
    try {
      localStorage.setItem(
        CONFIG.STORAGE_PREFIX + 'achievements',
        JSON.stringify([...this.unlocked])
      );
    } catch (e) {
      console.warn('Failed to save achievements:', e);
    }
  }

  private load(): Set<string> {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'achievements');
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch {
      return new Set();
    }
  }

  reset(): void {
    this.unlocked = new Set();
    this.save();
  }
}

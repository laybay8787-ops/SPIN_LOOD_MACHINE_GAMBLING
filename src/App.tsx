import { useState, useEffect, useRef, useCallback } from 'react';
import { CONFIG } from './game/config';
import { SlotMachine, StatsTracker, LoanSystem, Jackpot, AchievementSystem, type SpinResult } from './game/engine';
import { AudioManager } from './game/audio';

// ============ Particle System (Canvas) ============
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
}

class ParticleSystem {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private animationId: number = 0;
  private running = false;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  resize() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  emitConfetti(count: number = 300) {
    const colors = ['#00f0ff', '#ff00ea', '#fff700', '#00ff88', '#ff3366'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (this.canvas?.width || 800),
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 0,
        maxLife: 200 + Math.random() * 100,
      });
    }
    if (!this.running) this.start();
  }

  emitSparks(count: number = 50) {
    const colors = ['#fff700', '#ff8800', '#ff3366'];
    const cx = (this.canvas?.width || 800) / 2;
    const cy = (this.canvas?.height || 600) / 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * (5 + Math.random() * 10),
        vy: Math.sin(angle) * (5 + Math.random() * 10),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 4 + 2,
        rotation: 0,
        rotationSpeed: 0,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      });
    }
    if (!this.running) this.start();
  }

  private start() {
    this.running = true;
    this.loop();
  }

  private loop() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.rotation += p.rotationSpeed;
      p.life++;

      const alpha = 1 - p.life / p.maxLife;
      if (alpha <= 0) return false;

      this.ctx!.save();
      this.ctx!.translate(p.x, p.y);
      this.ctx!.rotate(p.rotation);
      this.ctx!.globalAlpha = alpha;
      this.ctx!.fillStyle = p.color;
      this.ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx!.restore();

      return true;
    });

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.loop());
    } else {
      this.running = false;
    }
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationId);
    this.particles = [];
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

// ============ Reel Component with Strip Animation ============
function ReelColumnFixed({ 
  symbols, 
  spinning, 
  stopped, 
  reelIndex,
  winningCells,
  nearMissCells,
  spinDuration,
}: {
  symbols: string[];
  spinning: boolean;
  stopped: boolean;
  reelIndex: number;
  winningCells: Set<number>;
  nearMissCells: Set<number>;
  spinDuration: number;
}) {
  const animRef = useRef<number>(0);
  const [displaySymbols, setDisplaySymbols] = useState<string[]>(symbols);
  const [offset, setOffset] = useState(0);
  const cellSize = 70;

  const getEmoji = (id: string) => {
    const sym = CONFIG.SYMBOLS[id.toUpperCase() as keyof typeof CONFIG.SYMBOLS];
    return sym?.emoji || '❓';
  };

  useEffect(() => {
    if (spinning && !stopped) {
      const duration = spinDuration;
      const startTime = performance.now();
      
      const strip: string[] = [];
      for (let i = 0; i < 25; i++) {
        const randomSymbols = ['cherry', 'lemon', 'bell', 'diamond', 'seven', 'cherry', 'lemon', 'bell'];
        strip.push(randomSymbols[Math.floor(Math.random() * randomSymbols.length)]);
      }
      strip.push(...symbols);
      setDisplaySymbols(strip);
      
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        const currentOffset = eased * (strip.length - 3) * cellSize;
        setOffset(-currentOffset);
        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        }
      };
      
      animRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animRef.current);
    } else {
      setDisplaySymbols(symbols);
      setOffset(0);
    }
  }, [spinning, stopped, symbols, reelIndex]);

  return (
    <div className="reel-enhanced rounded-lg" style={{ width: 'var(--cell-size)', height: `calc(var(--cell-size) * 3)` }}>
      <div 
        className="reel-strip relative z-10"
        style={{ 
          transform: `translateY(${offset}px)`,
          filter: spinning && !stopped ? 'blur(2px)' : 'none',
        }}
      >
        {displaySymbols.map((sym, i) => (
          <div
            key={`${reelIndex}-${i}`}
            className={`reel-symbol ${
              !spinning && winningCells.has(i) ? 'win-pulse' : ''
            } ${
              !spinning && nearMissCells.has(i) ? 'near-miss' : ''
            } ${
              stopped && i >= displaySymbols.length - 3 ? 'bounce-stop' : ''
            }`}
            style={{
              filter: !spinning && winningCells.has(i) 
                ? 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))' 
                : undefined,
            }}
          >
            {getEmoji(sym)}
          </div>
        ))}
      </div>
    </div>
  );
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// ============ Start Screen Component ============
function StartScreen({ onEnter, onExit }: { onEnter: (balance: number) => void; onExit: () => void }) {
  const [selectedBalance, setSelectedBalance] = useState<number>(CONFIG.START_BALANCE_OPTIONS[1] as number);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [passportNumber, setPassportNumber] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center grid-bg relative overflow-hidden safe-area-top safe-area-bottom">
      {/* Animated background effects */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(0, 240, 255, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(255, 0, 234, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(255, 247, 0, 0.03) 0%, transparent 70%)
        `
      }} />
      
      {/* Floating particles background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              background: ['#00f0ff', '#ff00ea', '#fff700'][i % 3],
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
      
      {/* Title with enhanced glow */}
      <div className="text-center mb-8 z-10 px-4">
        <div className="relative inline-block">
          <h1 
            className="title-gradient text-4xl sm:text-5xl md:text-6xl font-black mb-3 tracking-wider" 
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            NEON CYBER
          </h1>
          <h1 
            className="title-gradient text-3xl sm:text-4xl md:text-5xl font-black tracking-widest" 
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            SPIN
          </h1>
          <div className="absolute -inset-4 bg-cyan-500/5 blur-3xl rounded-full" />
        </div>
        <p className="text-gray-400 text-sm md:text-base mt-4 tracking-wider" style={{ fontFamily: 'Share Tech Mono' }}>
          ✨ КИБЕРПАНК СЛОТ ✨
        </p>
      </div>

      {/* Passport authentication */}
      {!isAuthenticated ? (
        <div className="z-10 text-center mb-8 px-4 w-full max-w-lg">
          <div className="glass-panel p-6">
            <div className="text-4xl mb-3">🛂</div>
            <h2 className="text-cyan-400 text-base sm:text-lg mb-4 font-bold tracking-wide" style={{ fontFamily: 'Orbitron' }}>
              АВТОРИЗАЦИЯ
            </h2>
            <p className="text-gray-400 text-xs mb-4">Введите номер паспорта для входа</p>
            <input
              type="text"
              placeholder="XX XX XXXXXX"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-black/50 border border-cyan-500/30 text-cyan-300 text-center text-lg font-bold focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all"
              style={{ fontFamily: 'Share Tech Mono' }}
              maxLength={12}
            />
            <button
              className="mt-4 px-8 py-3 rounded-lg font-bold text-sm transition-all border-2 border-cyan-400 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Orbitron' }}
              onClick={() => {
                if (passportNumber.trim().length > 0) {
                  setIsAuthenticated(true);
                }
              }}
              disabled={passportNumber.trim().length === 0}
            >
              ✓ ПОДТВЕРДИТЬ
            </button>
            <p className="text-gray-600 text-[10px] mt-3">* Это просто шутка, можно ввести что угодно</p>
          </div>
        </div>
      ) : (
      /* Balance selection with glass effect */
      <div className="z-10 text-center mb-8 px-4 w-full max-w-lg">
        <div className="text-xs text-green-400 mb-3 flex items-center justify-center gap-2">
          <span>✓</span>
          <span>Паспорт: {passportNumber}</span>
          <button 
            className="text-gray-500 hover:text-red-400 ml-2"
            onClick={() => { setIsAuthenticated(false); setPassportNumber(''); }}
          >
            ✕
          </button>
        </div>
        <h2 className="text-cyan-400 text-base sm:text-lg mb-5 font-bold tracking-wide" style={{ fontFamily: 'Orbitron' }}>
          💰 ВЫБЕРИТЕ СУММУ
        </h2>
        <div className="glass-panel p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CONFIG.START_BALANCE_OPTIONS.map((amount) => (
              <button
                key={amount}
                className={`relative px-4 py-4 rounded-xl font-bold text-base sm:text-lg transition-all duration-300 border-2 ${
                  selectedBalance === amount
                    ? 'border-cyan-400 bg-gradient-to-br from-cyan-400/20 to-cyan-600/10 text-cyan-300 shadow-[0_0_25px_rgba(0,240,255,0.4)] scale-105'
                    : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-cyan-600/50 hover:text-cyan-400 hover:bg-gray-800/50'
                }`}
                style={{ fontFamily: 'Share Tech Mono' }}
                onClick={() => setSelectedBalance(amount)}
                onMouseEnter={() => setHoveredOption(amount)}
                onMouseLeave={() => setHoveredOption(null)}
              >
                <div className="text-xl sm:text-2xl font-black">{amount.toLocaleString()}</div>
                {(hoveredOption === amount || selectedBalance === amount) && (
                  <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">кредитов</div>
                )}
                {selectedBalance === amount && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Enter button with enhanced effects */}
      <div className="z-10 flex flex-col items-center gap-5 px-4">
        <button
          className="group relative px-12 sm:px-16 lg:px-20 py-5 sm:py-6 rounded-full font-black text-lg sm:text-xl lg:text-2xl transition-all duration-300 border-2 border-cyan-400 bg-gradient-to-r from-cyan-400/10 via-cyan-500/20 to-cyan-400/10 text-cyan-300 hover:from-cyan-400/20 hover:via-cyan-500/30 hover:to-cyan-400/20 hover:shadow-[0_0_40px_rgba(0,240,255,0.5)] active:scale-95 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: 'Orbitron' }}
          onClick={() => onEnter(selectedBalance)}
          disabled={!isAuthenticated}
        >
          <span className="relative z-10 flex items-center gap-3">
            <span className="text-2xl sm:text-3xl">🎰</span>
            <span>ВОЙТИ В КАЗИНО</span>
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        </button>
        
        <button
          className="px-8 py-3 rounded-xl text-sm text-gray-500 hover:text-red-400 transition-all duration-300 border border-gray-700 hover:border-red-400/50 hover:bg-red-400/5 active:scale-95"
          style={{ fontFamily: 'Share Tech Mono' }}
          onClick={onExit}
        >
          <span className="flex items-center gap-2">
            <span>🚪</span>
            <span>Выйти</span>
          </span>
        </button>
      </div>

      {/* Footer info - compact */}
      <div className="absolute bottom-2 left-0 right-0 text-center z-10 px-4">
        <p className="text-gray-600 text-[10px] tracking-wide opacity-60">
          Демо • 18+
        </p>
      </div>

      {/* Decorative floating elements */}
      <div className="absolute top-8 left-8 text-4xl sm:text-5xl opacity-30 animate-pulse">🎰</div>
      <div className="absolute top-16 right-12 text-3xl sm:text-4xl opacity-30 animate-pulse" style={{ animationDelay: '0.5s' }}>💎</div>
      <div className="absolute bottom-24 left-12 text-3xl sm:text-4xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }}>⚡</div>
      <div className="absolute bottom-16 right-8 text-4xl sm:text-5xl opacity-30 animate-pulse" style={{ animationDelay: '1.5s' }}>🌀</div>
    </div>
  );
}

// ============ Exit Screen ============
function ExitScreen({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center grid-bg relative overflow-hidden safe-area-top safe-area-bottom">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 30% 40%, rgba(0, 240, 255, 0.05) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 60%, rgba(255, 0, 234, 0.05) 0%, transparent 50%)
        `
      }} />
      
      <div className="text-center z-10 px-6">
        <div className="text-7xl sm:text-8xl mb-8 exit-wave">👋</div>
        <h1 
          className="text-3xl sm:text-4xl font-black text-gray-300 mb-4 tracking-wide" 
          style={{ fontFamily: 'Orbitron' }}
        >
          До встречи!
        </h1>
        <p className="text-gray-500 mb-10 text-base sm:text-lg tracking-wide" style={{ fontFamily: 'Share Tech Mono' }}>
          Спасибо за игру в Neon Cyber Spin
        </p>
        <button
          className="group relative px-10 py-4 rounded-full font-bold text-base sm:text-lg transition-all duration-300 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400/10 hover:shadow-[0_0_30px_rgba(0,240,255,0.3)] active:scale-95 overflow-hidden"
          style={{ fontFamily: 'Orbitron' }}
          onClick={onReturn}
        >
          <span className="relative z-10 flex items-center gap-3">
            <span className="text-xl">🔄</span>
            <span>Вернуться</span>
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        </button>
      </div>
    </div>
  );
}

// ============ Main App Component ============
type GameScreen = 'start' | 'game' | 'exit';

export default function App() {
  // Screen state
  const [screen, setScreen] = useState<GameScreen>('start');
  
  // Game state
  const [balance, setBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'balance');
      return saved ? parseFloat(saved) : (CONFIG.DEFAULT_START_BALANCE as number);
    } catch (e) {
      console.warn('Failed to load balance from localStorage:', e);
      return CONFIG.DEFAULT_START_BALANCE as number;
    }
  });
  const [startBalance, setStartBalance] = useState<number>(CONFIG.DEFAULT_START_BALANCE as number);
  const [betIndex, setBetIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'betIndex');
      return saved ? parseInt(saved) : CONFIG.DEFAULT_BET_INDEX;
    } catch (e) {
      console.warn('Failed to load betIndex from localStorage:', e);
      return CONFIG.DEFAULT_BET_INDEX;
    }
  });
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState<string[][]>(() => {
    const symbols = ['cherry', 'lemon', 'bell', 'diamond', 'seven', 'cherry', 'lemon', 'bell'];
    return Array(5).fill(null).map(() => 
      Array(3).fill(null).map(() => symbols[Math.floor(Math.random() * symbols.length)])
    );
  });
  const [lastWin, setLastWin] = useState(0);
  const [winLines, setWinLines] = useState<SpinResult['wins']>([]);
  const [nearMissLines, setNearMissLines] = useState<number[]>([]);
  const [showBigWin, setShowBigWin] = useState(false);
  const [bigWinAmount, setBigWinAmount] = useState(0);
  const [isMegaWin, setIsMegaWin] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);
  const [freeSpinsTotalWin, setFreeSpinsTotalWin] = useState(0);
  const [freeSpinsActive, setFreeSpinsActive] = useState(false);
  const [autoSpins, setAutoSpins] = useState(0);
  const [autoSpinTotal, setAutoSpinTotal] = useState(0);
  const [toast, setToast] = useState<{ text: string; icon: string } | null>(null);
  const [soClose, setSoClose] = useState(false);
  const [history, setHistory] = useState<{ symbols: string; amount: number; multiplier: number }[]>([]);
  const [reelStopped, setReelStopped] = useState<boolean[]>([true, true, true, true, true]);
  const [debtCleared, setDebtCleared] = useState(false);
  const [loanCount, setLoanCount] = useState(0);
  const [debt, setDebt] = useState(0);
  const [statsVersion, setStatsVersion] = useState(0);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showExitSummary, setShowExitSummary] = useState(false);
  const [exitResult, setExitResult] = useState<{ type: 'profit' | 'loss'; amount: number } | null>(null);

  // Refs
  const slotMachineRef = useRef(new SlotMachine());
  const statsRef = useRef(new StatsTracker());
  const loanRef = useRef(new LoanSystem());
  const jackpotRef = useRef(new Jackpot());
  const achievementsRef = useRef(new AchievementSystem());
  const audioRef = useRef(new AudioManager());
  const particleRef = useRef(new ParticleSystem());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tickIntervalRef = useRef<number>(0);
  const reelTimersRef = useRef<number[]>([]);
  const freeSpinsRef = useRef(freeSpins);
  const autoSpinsRef = useRef(autoSpins);
  const balanceRef = useRef(balance);

  // Keep refs in sync
  useEffect(() => { freeSpinsRef.current = freeSpins; }, [freeSpins]);
  useEffect(() => { autoSpinsRef.current = autoSpins; }, [autoSpins]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  const bet = CONFIG.BET_LEVELS[betIndex];
  const jackpotAmount = jackpotRef.current.amount;

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current) {
      particleRef.current.attach(canvasRef.current);
    }
    const handleResize = () => particleRef.current.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      particleRef.current.stop();
    };
  }, []);

  // Save balance
  useEffect(() => {
    if (screen === 'game') {
      try {
        localStorage.setItem(CONFIG.STORAGE_PREFIX + 'balance', balance.toString());
      } catch (e) {
        console.warn('Failed to save balance to localStorage:', e);
      }
    }
  }, [balance, screen]);

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG.STORAGE_PREFIX + 'betIndex', betIndex.toString());
    } catch (e) {
      console.warn('Failed to save betIndex to localStorage:', e);
    }
  }, [betIndex]);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ============ Dynamic Reel Speed (based on debt) ============
  /**
   * Чем выше долг — тем быстрее крутятся барабаны
   * Это заставляет игрока проигрывать быстрее
   */
  const getReelSpeedMultiplier = useCallback((): number => {
    const currentDebt = debt;
    
    // Находим подходящий множитель
    let multiplier = 1.0;
    for (const threshold of CONFIG.DEBT_SPEED_THRESHOLDS) {
      if (currentDebt >= threshold.debt) {
        multiplier = threshold.multiplier;
      }
    }
    
    return multiplier;
  }, [debt]);

  const getAdjustedReelDurations = useCallback((): number[] => {
    const multiplier = getReelSpeedMultiplier();
    return CONFIG.REEL_SPIN_DURATION.map((base, i) => {
      const adjusted = Math.max(
        Math.floor(base * multiplier),
        CONFIG.REEL_SPIN_MIN[i]
      );
      return adjusted;
    });
  }, [getReelSpeedMultiplier]);

  // ============ Auto Loan System ============
  /**
   * Автоматически берёт кредиты пока баланс не покроет ставку
   * Возвращает true если удалось набрать нужную сумму
   */
  const autoLoan = useCallback((neededAmount: number): boolean => {
    let currentBalance = balanceRef.current;
    let loansTaken = 0;
    
    // БЕЗЛИМИТНЫЙ ДОЛГ — берём кредиты пока не наберём нужную сумму
    while (currentBalance < neededAmount) {
      const result = loanRef.current.borrow();
      if (result.success) {
        currentBalance += result.amount;
        loansTaken++;
      } else {
        break;
      }
    }
    
    if (loansTaken > 0) {
      // Обновляем и state, и ref синхронно
      setBalance(currentBalance);
      balanceRef.current = currentBalance; // Важно для последующих операций
      setLoanCount(loanRef.current.state.loanCount);
      setDebt(loanRef.current.state.debt);
      audioRef.current.playLoanTaken();
      statsRef.current.recordLoan();
      
      showToast('🏦', `Автокредит: +${loansTaken * CONFIG.LOAN_AMOUNT} (долг: ${Math.floor(loanRef.current.state.debt)})`);
      
      // Check debtor achievement (after 5 loans)
      if (loanRef.current.state.loanCount >= 5) {
        if (achievementsRef.current.check('debtor', true)) {
          showToast('🏦', 'Достижение: Должник!');
        }
      }
      
      return currentBalance >= neededAmount;
    }
    
    return currentBalance >= neededAmount;
  }, []);

  // ============ Game Logic ============
  const doSpin = useCallback(() => {
    if (spinning) return;
    
    const currentBet = CONFIG.BET_LEVELS[betIndex];
    
    // Check balance (skip for free spins)
    // АВТОКРЕДИТ: если не хватает — берём кредит БЕЗ ЛИМИТА
    if (freeSpinsRef.current <= 0 && balanceRef.current < currentBet) {
      autoLoan(currentBet);
    }

    setSpinning(true);
    setWinLines([]);
    setNearMissLines([]);
    setLastWin(0);
    setSoClose(false);
    setReelStopped([false, false, false, false, false]);

    // Deduct bet (not for free spins)
    if (freeSpinsRef.current <= 0) {
      const newBalance = balanceRef.current - currentBet;
      setBalance(newBalance);
      balanceRef.current = newBalance; // Синхронизируем ref
    }

    // Contribute to jackpot
    jackpotRef.current.contribute(currentBet);

    // Play spin sound
    audioRef.current.playSpinStart();

    // Start tick sound
    tickIntervalRef.current = window.setInterval(() => {
      audioRef.current.playTick();
    }, 100);

    // Perform spin calculation
    const result = slotMachineRef.current.spin(currentBet);

    // Animate reels stopping one by one (speed depends on debt!)
    const adjustedDurations = getAdjustedReelDurations();
    adjustedDurations.forEach((duration, reelIdx) => {
      const timer = window.setTimeout(() => {
        audioRef.current.playReelStop();
        setReelStopped(prev => {
          const next = [...prev];
          next[reelIdx] = true;
          return next;
        });

        // Last reel stopped
        if (reelIdx === CONFIG.REELS - 1) {
          clearInterval(tickIntervalRef.current);
          handleSpinResult(result, currentBet);
        }
      }, duration);
      reelTimersRef.current.push(timer);
    });

    // Set grid for animation
    setGrid(result.grid);
  }, [spinning, betIndex, autoLoan, getAdjustedReelDurations]);

  const handleSpinResult = (result: SpinResult, currentBet: number) => {
    setSpinning(false);
    
    let winAmount = result.totalWin;
    
    // Apply free spins multiplier
    if (freeSpinsRef.current > 0) {
      winAmount *= CONFIG.FREE_SPINS_MULTIPLIER;
    }

    // Handle jackpot
    if (result.isJackpot) {
      const jackpotWin = jackpotRef.current.win();
      winAmount += jackpotWin;
      audioRef.current.playJackpot();
      achievementsRef.current.check('jackpot_win', true);
      showToast('🎊', 'ДЖЕКПОТ! +' + jackpotWin.toLocaleString());
      particleRef.current.emitConfetti(300);
      particleRef.current.emitSparks(50);
    }

    // Handle debt repayment
    let finalWin = winAmount;
    if (winAmount > 0 && !loanRef.current.isDebtFree()) {
      const { toBalance, newDebt } = loanRef.current.repayFromWin(winAmount);
      finalWin = toBalance;
      setDebt(newDebt);
      if (newDebt <= 0) {
        audioRef.current.playDebtPaid();
        setDebtCleared(true);
        showToast('✅', 'Долг погашен!');
        setTimeout(() => setDebtCleared(false), 2000);
      }
      setBalance((b: number) => b + finalWin);
    } else {
      setBalance((b: number) => b + winAmount);
    }

    setLastWin(finalWin);
    setWinLines(result.wins);
    setNearMissLines(result.nearMissLines);

    // Sound effects
    if (winAmount > 0) {
      if (winAmount >= currentBet * CONFIG.BIG_WIN_MULTIPLIER) {
        audioRef.current.playWinBig();
      } else {
        audioRef.current.playWinSmall();
      }

      // Vibration
      if (navigator.vibrate) {
        if (winAmount >= currentBet * CONFIG.BIG_WIN_MULTIPLIER) {
          navigator.vibrate([200, 100, 200, 100, 500]);
        } else {
          navigator.vibrate([100, 50, 100, 50, 200]);
        }
      }
    }

    // Big Win overlay
    if (winAmount >= currentBet * CONFIG.BIG_WIN_MULTIPLIER) {
      setBigWinAmount(winAmount);
      setIsMegaWin(winAmount >= currentBet * CONFIG.MEGA_WIN_MULTIPLIER);
      setShowBigWin(true);
      particleRef.current.emitConfetti(300);
      if (winAmount >= currentBet * CONFIG.MEGA_WIN_MULTIPLIER) {
        particleRef.current.emitSparks(50);
      }
    }

    // Scatter / Free Spins
    if (result.scatterCount >= CONFIG.SCATTER_MIN_TRIGGER) {
      audioRef.current.playScatter();
      const newFreeSpins = CONFIG.FREE_SPINS_COUNT;
      setFreeSpins(prev => prev + newFreeSpins);
      setFreeSpinsActive(true);
      showToast('🌀', `БОНУС! ${newFreeSpins} фриспинов с x2!`);
      statsRef.current.recordBonus();
      
      const totalBonus = statsRef.current.stats.bonusTriggered;
      if (totalBonus >= 3) {
        checkAchievement('bonus_hunter');
      }
    }

    // Near miss effect
    if (result.nearMissLines.length > 0 && winAmount === 0) {
      setSoClose(true);
      setTimeout(() => setSoClose(false), 1000);
    }

    // History
    if (winAmount > 0) {
      const multiplier = winAmount / currentBet;
      const symbols = result.wins.length > 0 
        ? CONFIG.SYMBOLS[result.wins[0].symbolId.toUpperCase() as keyof typeof CONFIG.SYMBOLS]?.emoji || '💰'
        : '🌀';
      setHistory(prev => [
        { symbols: symbols.repeat(Math.min(result.wins[0]?.count || 1, 3)), amount: winAmount, multiplier },
        ...prev.slice(0, 9)
      ]);
    }

    // Record stats
    const newBalance = balanceRef.current - (freeSpinsRef.current > 0 ? 0 : currentBet) + finalWin;
    statsRef.current.recordSpin(currentBet, winAmount, newBalance);
    setStatsVersion(v => v + 1);

    // Check achievements
    checkAchievementsAfterSpin(winAmount, currentBet);

    // Handle free spins continuation
    if (freeSpinsRef.current > 0) {
      setFreeSpinsTotalWin(prev => prev + finalWin);
      const remaining = freeSpinsRef.current - 1;
      setFreeSpins(remaining);
      
      if (remaining <= 0) {
        setFreeSpinsActive(false);
        const totalFsWin = freeSpinsTotalWin + finalWin;
        if (totalFsWin > 0) {
          showToast('🎉', `Фриспины завершены! Выигрыш: ${totalFsWin}`);
        }
        setFreeSpinsTotalWin(0);
      } else {
        setTimeout(() => doSpin(), 1500);
      }
    }

    // Handle auto spins (долг безлимитный — всегда продолжаем)
    if (autoSpinsRef.current > 0 && freeSpinsRef.current <= 0) {
      const remaining = autoSpinsRef.current - 1;
      setAutoSpins(remaining);
      if (remaining > 0) {
        setTimeout(() => doSpin(), 1000);
      } else {
        setAutoSpinTotal(0);
      }
    }
  };

  const checkAchievementsAfterSpin = (winAmount: number, currentBet: number) => {
    const stats = statsRef.current.stats;
    
    if (winAmount > 0) {
      if (achievementsRef.current.check('first_blood', true)) {
        showToast('🗡️', 'Достижение: Первая кровь!');
      }
    }
    
    if (winAmount >= currentBet * 50) {
      if (achievementsRef.current.check('big_fish', true)) {
        showToast('💰', 'Достижение: Крупная рыба!');
      }
    }
    
    if (stats.totalSpins >= 100) {
      if (achievementsRef.current.check('highroller', true)) {
        showToast('🎰', 'Достижение: Хайроллер!');
      }
    }
    
    if (stats.totalSpins >= 50 && balance > startBalance) {
      if (achievementsRef.current.check('in_plus', true)) {
        showToast('📈', 'Достижение: В плюсе!');
      }
    }
    
    if (stats.currentWinStreak >= 3) {
      if (achievementsRef.current.check('streak', true)) {
        showToast('🔥', 'Достижение: Серия!');
      }
    }
    
    if (winLines.some(w => w.symbolId === 'diamond' && w.count === 5)) {
      if (achievementsRef.current.check('diamond_magnate', true)) {
        showToast('💎', 'Достижение: Алмазный магнат!');
      }
    }
  };

  const checkAchievement = (id: string) => {
    const ach = CONFIG.ACHIEVEMENTS[id.toUpperCase() as keyof typeof CONFIG.ACHIEVEMENTS];
    if (ach && achievementsRef.current.check(id, true)) {
      showToast(ach.icon, `Достижение: ${ach.name}!`);
    }
  };

  const showToast = (icon: string, text: string) => {
    setToast({ icon, text });
  };

  // ============ Actions ============
  const changeBet = (direction: 1 | -1) => {
    if (spinning) return;
    audioRef.current.playClick();
    setBetIndex((prev: number) => {
      const next = prev + direction;
      if (next < 0 || next >= CONFIG.BET_LEVELS.length) return prev;
      return next;
    });
  };

  const setMaxBet = () => {
    if (spinning) return;
    audioRef.current.playClick();
    setBetIndex(CONFIG.BET_LEVELS.length - 1);
  };

  const startAutoSpin = (count: number) => {
    if (spinning) return;
    audioRef.current.playClick();
    setAutoSpins(count);
    setAutoSpinTotal(count);
    doSpin();
  };

  const stopAutoSpin = () => {
    setAutoSpins(0);
    setAutoSpinTotal(0);
  };

  // 🇺🇸 External Debt USA - шуточная функция
  const takeUSADebt = () => {
    // Берём "внешний долг США" — огромная сумма с огромным процентом
    const usaLoanAmount = 1000000; // 1 миллион
    const usaInterest = 0.25; // 25% годовых (как у США)
    const repayment = usaLoanAmount * (1 + usaInterest);
    
    loanRef.current.state.debt += repayment;
    loanRef.current.state.loanCount++;
    loanRef.current.state.totalBorrowed += repayment;
    
    setBalance(b => b + usaLoanAmount);
    setDebt(loanRef.current.state.debt);
    setLoanCount(loanRef.current.state.loanCount);
    
    audioRef.current.playLoanTaken();
    statsRef.current.recordLoan();
    
    showToast('🇺🇸', `Внешний долг США: +${usaLoanAmount.toLocaleString()} (долг: ${Math.floor(loanRef.current.state.debt).toLocaleString()})`);
  };

  const handleEnterCasino = (selectedBalance: number) => {
    setBalance(selectedBalance);
    setStartBalance(selectedBalance);
    setBetIndex(0);
    setScreen('game');
    setFreeSpins(0);
    setFreeSpinsActive(false);
    setAutoSpins(0);
    setHistory([]);
    setLastWin(0);
    setWinLines([]);
    setNearMissLines([]);
    // Reset loans for new session
    loanRef.current.reset();
    setLoanCount(0);
    setDebt(0);
    statsRef.current.reset();
    setStatsVersion(0);
  };

  const handleExit = () => {
    // Останавливаем все процессы
    setAutoSpins(0);
    setFreeSpins(0);
    setFreeSpinsActive(false);
    clearInterval(tickIntervalRef.current);
    reelTimersRef.current.forEach(t => clearTimeout(t));
    reelTimersRef.current = [];
    
    // Рассчитываем итог
    const profit = balance - startBalance;
    const currentDebt = loanRef.current.state.debt;
    
    if (profit > 0 && currentDebt === 0) {
      // Чистый выигрыш
      setExitResult({ type: 'profit', amount: profit });
    } else if (currentDebt > 0) {
      // Есть долг
      setExitResult({ type: 'loss', amount: currentDebt });
    } else {
      // Проигрыш или ноль
      setExitResult({ type: 'loss', amount: Math.abs(profit) });
    }
    
    setShowExitSummary(true);
  };
  
  const confirmExit = () => {
    setShowExitSummary(false);
    setScreen('exit');
  };

  const handleReturnFromExit = () => {
    setScreen('start');
  };

  const resetGame = () => {
    try {
      localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'balance');
      localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'betIndex');
      localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'stats');
      localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'loans');
      localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'jackpot');
      localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'achievements');
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
    setBalance(CONFIG.DEFAULT_START_BALANCE);
    setStartBalance(CONFIG.DEFAULT_START_BALANCE);
    setBetIndex(CONFIG.DEFAULT_BET_INDEX);
    setFreeSpins(0);
    setFreeSpinsActive(false);
    setAutoSpins(0);
    setHistory([]);
    setLoanCount(0);
    setDebt(0);
    setStatsVersion(0);
    statsRef.current.reset();
    loanRef.current.reset();
    jackpotRef.current.reset();
    achievementsRef.current.reset();
    setScreen('start');
  };

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (screen !== 'game') return;
      if (e.code === 'Space' && !spinning) {
        e.preventDefault();
        doSpin();
      }
      if (e.code === 'Escape') {
        setShowBigWin(false);
        setShowPaytable(false);
        setShowStats(false);
        setShowAchievements(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [spinning, doSpin, screen]);

  // Expose debug tools
  useEffect(() => {
    (window as any).calculateRTP = SlotMachine.calculateRTP;
    (window as any).triggerBonus = () => {
      setFreeSpins(CONFIG.FREE_SPINS_COUNT);
      setFreeSpinsActive(true);
      console.log('🌀 Bonus triggered manually');
    };
  }, []);

  // ============ Render Helpers ============
  const getSymbolEmoji = (symbolId: string): string => {
    const sym = CONFIG.SYMBOLS[symbolId.toUpperCase() as keyof typeof CONFIG.SYMBOLS];
    return sym?.emoji || '❓';
  };

  const isWinningCell = (reel: number, row: number): boolean => {
    return winLines.some(w => w.positions.some(([r, r2]) => r === reel && r2 === row));
  };

  const isNearMissCell = (reel: number, row: number): boolean => {
    if (nearMissLines.length === 0) return false;
    return nearMissLines.some(lineIdx => {
      const line = CONFIG.PAYLINES[lineIdx];
      return line[reel] === row && reel < 2;
    });
  };

  const getHistoryClass = (multiplier: number): string => {
    if (multiplier >= 20) return 'big';
    if (multiplier >= 5) return 'medium';
    return 'small';
  };

  // ============ SCREENS ============
  
  // Start Screen
  if (screen === 'start') {
    return <StartScreen onEnter={handleEnterCasino} onExit={handleExit} />;
  }

  // Exit Screen
  if (screen === 'exit') {
    return <ExitScreen onReturn={handleReturnFromExit} />;
  }

  // ============ GAME SCREEN ============
  return (
    <div className={`w-full h-full flex flex-col grid-bg ${freeSpinsActive ? 'bonus-bg' : ''}`}>
      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Header with glass effect */}
      <header className="flex items-center justify-between px-2 sm:px-3 py-2 shrink-0 safe-area-top glass-panel mx-2 mt-2 rounded-xl">
        <h1 className="title-gradient font-bold text-sm sm:text-lg md:text-2xl tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          NEON CYBER
        </h1>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {/* Jackpot */}
          <div className="jackpot-bar px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold text-black">
            🎰 {Math.floor(jackpotAmount).toLocaleString()}
          </div>
          {/* Free spins counter */}
          {freeSpins > 0 && (
            <div className="free-spins-active px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-black/50 border border-yellow-400 text-yellow-400">
              🌀 {freeSpins}
            </div>
          )}
          {/* Auto spin */}
          {autoSpins > 0 && (
            <div className="hidden sm:block px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/50 border border-cyan-400 text-cyan-400">
              AUTO: {autoSpins}
            </div>
          )}
          {/* Speed indicator when in debt */}
          {debt > 0 && (
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-900/50 border border-red-500 text-red-400 animate-pulse">
              ⚡x{(1 / getReelSpeedMultiplier()).toFixed(1)}
            </div>
          )}
          {/* Exit button - "фиксируем прибыль" */}
          <button 
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-green-400 border border-green-500/50 bg-green-500/10 hover:bg-green-500/20 hover:border-green-400 hover:shadow-[0_0_10px_rgba(0,255,136,0.3)] transition-all active:scale-95 whitespace-nowrap"
            onClick={handleExit}
            title="Выйти на главный экран"
            style={{ fontFamily: 'Share Tech Mono' }}
          >
            💰 <span className="hidden sm:inline">фиксируем прибыль</span><span className="sm:hidden">забрать</span>
          </button>
        </div>
      </header>

      {/* History bar */}
      {history.length > 0 && (
        <div className="history-scroll px-3 shrink-0">
          {history.map((item, i) => (
            <div key={i} className={`history-item ${getHistoryClass(item.multiplier)}`}>
              {item.symbols} +{item.amount}
            </div>
          ))}
        </div>
      )}

      {/* Game Field with enhanced design */}
      <div className="flex-1 flex items-center justify-center px-2 sm:px-4 py-2 min-h-0">
        {/* Monkey flight zone - larger container for monkeys to fly around */}
        <div className="relative" style={{ 
          padding: '80px',
          margin: '-80px',
          maxWidth: 'calc(100% + 160px)',
          marginLeft: '-80px',
          marginRight: '-80px'
        }}>
          {/* Inner container for reels */}
          <div className={`relative rounded-2xl p-2 sm:p-3 border-2 transition-all duration-500 ${
            freeSpinsActive 
              ? 'border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.5),0_0_60px_rgba(255,215,0,0.2)]' 
              : debt > 0 
                ? 'border-red-500 shadow-[0_0_20px_rgba(255,51,102,0.4),0_0_40px_rgba(255,51,102,0.2)]'
                : 'border-cyan-500/70 shadow-[0_0_20px_rgba(0,240,255,0.3),0_0_40px_rgba(0,240,255,0.1)]'
          }`} style={{ 
            background: 'linear-gradient(135deg, rgba(15, 21, 53, 0.9) 0%, rgba(10, 14, 39, 0.95) 100%)',
            backdropFilter: 'blur(10px)',
          }}>
          {/* Inner glow effect */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
            boxShadow: 'inset 0 0 30px rgba(255, 0, 234, 0.08), inset 0 0 60px rgba(0, 240, 255, 0.05)'
          }} />
          {/* Corner decorations */}
          <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400/50 rounded-tl" />
          <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-400/50 rounded-tr" />
          <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-400/50 rounded-bl" />
          <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400/50 rounded-br" />
          
          {/* Reels with enhanced styling */}
          <div className="flex gap-2 sm:gap-3 relative p-2 sm:p-3 rounded-xl" style={{
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.05) 0%, rgba(255, 0, 234, 0.05) 100%)',
            boxShadow: 'inset 0 0 30px rgba(0, 240, 255, 0.1), 0 0 20px rgba(0, 240, 255, 0.2)'
          }}>
            {grid.map((reel, reelIdx) => {
              const winningCells = new Set<number>();
              const nearMissCells = new Set<number>();
              winLines.forEach(w => {
                w.positions.forEach(([r, row]) => {
                  if (r === reelIdx) winningCells.add(row);
                });
              });
              nearMissLines.forEach(lineIdx => {
                const line = CONFIG.PAYLINES[lineIdx];
                if (line[reelIdx] !== undefined && reelIdx < 2) {
                  nearMissCells.add(line[reelIdx]);
                }
              });
              
              return (
                <ReelColumnFixed
                  key={reelIdx}
                  symbols={reel}
                  spinning={spinning}
                  stopped={reelStopped[reelIdx]}
                  reelIndex={reelIdx}
                  winningCells={winningCells}
                  nearMissCells={nearMissCells}
                  spinDuration={getAdjustedReelDurations()[reelIdx]}
                />
              );
            })}

            {soClose && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="so-close-text text-2xl">SO CLOSE!</span>
              </div>
            )}
          </div>

          {/* Payline SVG overlay */}
          {winLines.length > 0 && (
            <svg className="payline-svg" viewBox={`0 0 ${5 * 74} ${3 * 74}`} preserveAspectRatio="none">
              {winLines.map((win, i) => {
                const line = CONFIG.PAYLINES[win.lineIndex];
                const color = win.symbolId === 'wild' ? '#ffd700' : 
                             ['diamond', 'seven'].includes(win.symbolId) ? '#ffd700' : '#00f0ff';
                const points = win.positions.map(([reel, row]) => 
                  `${reel * 74 + 37},${row * 74 + 37}`
                ).join(' ');
                return (
                  <polyline
                    key={i}
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    className="payline-active"
                    opacity="0.8"
                  />
                );
              })}
            </svg>
          )}
        </div>
        
        {/* CYBER MONKEY ARMY - 15 monkeys flying around the reels (OUTSIDE)! */}
        <div className="cyber-monkey" style={{ animationDelay: '0s', animationDuration: '6s' }}>🐵</div>
        <div className="cyber-monkey" style={{ animationDelay: '2s', animationDuration: '8s' }}>🐒</div>
        <div className="cyber-monkey" style={{ animationDelay: '4s', animationDuration: '7s' }}>🙊</div>
        <div className="cyber-monkey cyber-monkey-reverse" style={{ animationDelay: '1s', animationDuration: '9s' }}>🙉</div>
        <div className="cyber-monkey cyber-monkey-reverse" style={{ animationDelay: '3s', animationDuration: '6.5s' }}>🙈</div>
        <div className="cyber-monkey cyber-monkey-orbit" style={{ animationDelay: '0.5s', animationDuration: '5s' }}>🦧</div>
        <div className="cyber-monkey cyber-monkey-orbit" style={{ animationDelay: '2.5s', animationDuration: '7.5s' }}>🦍</div>
        <div className="cyber-monkey cyber-monkey-reverse" style={{ animationDelay: '1.5s', animationDuration: '10s' }}>🐵</div>
        <div className="cyber-monkey" style={{ animationDelay: '3.5s', animationDuration: '5.5s' }}>🐒</div>
        <div className="cyber-monkey cyber-monkey-orbit" style={{ animationDelay: '4.5s', animationDuration: '8.5s' }}>🙊</div>
        <div className="cyber-monkey" style={{ animationDelay: '0.8s', animationDuration: '6.8s' }}>🙉</div>
        <div className="cyber-monkey cyber-monkey-reverse" style={{ animationDelay: '2.8s', animationDuration: '9.5s' }}>🙈</div>
        <div className="cyber-monkey cyber-monkey-orbit" style={{ animationDelay: '1.8s', animationDuration: '7.2s' }}>🦧</div>
        <div className="cyber-monkey" style={{ animationDelay: '3.8s', animationDuration: '6.2s' }}>🦍</div>
        <div className="cyber-monkey cyber-monkey-reverse" style={{ animationDelay: '0.3s', animationDuration: '11s' }}>🐵</div>
        </div>
      </div>

      {/* Control Panel with glass effect */}
      <div className="shrink-0 px-3 sm:px-4 lg:px-6 pb-3 pt-2 safe-area-bottom">
        {/* Info row with glass panel */}
        <div className="glass-panel p-3 sm:p-4 mb-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="text-center flex-1">
              <div className="text-[9px] sm:text-xs text-cyan-300/70 uppercase tracking-wider font-bold">Баланс</div>
              <div className="text-base sm:text-lg lg:text-xl font-black text-cyan-400 neon-text-cyan" style={{ fontFamily: 'Share Tech Mono' }}>
                {Math.floor(balance).toLocaleString()}
              </div>
            </div>
            <div className="w-px h-8 sm:h-10 bg-white/10" />
            <div className="text-center flex-1">
              <div className="text-[9px] sm:text-xs text-yellow-300/70 uppercase tracking-wider font-bold">Ставка</div>
              <div className="text-base sm:text-lg lg:text-xl font-black text-yellow-400 neon-text-yellow" style={{ fontFamily: 'Share Tech Mono' }}>
                {bet.toLocaleString()}
              </div>
            </div>
            <div className="w-px h-8 sm:h-10 bg-white/10" />
            <div className="text-center flex-1">
              <div className="text-[9px] sm:text-xs text-green-300/70 uppercase tracking-wider font-bold">Выигрыш</div>
              <div className={`text-base sm:text-lg lg:text-xl font-black ${lastWin > 0 ? 'text-green-400 neon-text-green' : 'text-green-400/50'}`}
                style={{ fontFamily: 'Share Tech Mono' }}>
                {lastWin > 0 ? `+${lastWin.toLocaleString()}` : '0'}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6">
          {/* Bet controls */}
          <div className="flex flex-col items-center gap-1.5 sm:gap-2">
            <button className="ctrl-btn w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center text-lg sm:text-xl font-bold" onClick={() => changeBet(1)} disabled={spinning}>
              +
            </button>
            <button className="ctrl-btn text-[9px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5" onClick={setMaxBet} disabled={spinning}>
              MAX
            </button>
            <button className="ctrl-btn w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center text-lg sm:text-xl font-bold" onClick={() => changeBet(-1)} disabled={spinning}>
              -
            </button>
          </div>

          {/* SPIN button - enhanced */}
          <button
            className={`spin-btn w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 text-sm sm:text-base lg:text-lg ${spinning ? 'spinning' : ''}`}
            onClick={doSpin}
            disabled={spinning}
          >
            {spinning ? '...' : freeSpins > 0 ? 'FREE' : 'SPIN'}
          </button>

          {/* Side controls */}
          <div className="flex flex-col items-center gap-1.5 sm:gap-2">
            <button className="ctrl-btn w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center text-sm sm:text-base" onClick={() => audioRef.current.toggleMute()}>
              {audioRef.current.isMuted() ? '🔇' : '🔊'}
            </button>
            <button className="ctrl-btn text-sm sm:text-base w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center" onClick={() => setShowPaytable(true)}>
              📋
            </button>
            <button className="ctrl-btn text-sm sm:text-base w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center" onClick={() => setShowStats(true)}>
              📊
            </button>
          </div>
        </div>

        {/* Auto spin & Achievements */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mt-3">
          {autoSpins > 0 ? (
            <button className="ctrl-btn border-red-500/50 text-red-400 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold" onClick={stopAutoSpin}>
              ⏹ STOP
            </button>
          ) : (
            <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center">
              {CONFIG.AUTO_SPIN_OPTIONS.map(n => (
                <button key={n} className="ctrl-btn text-[10px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 font-bold" onClick={() => startAutoSpin(n)} disabled={spinning}>
                  AUTO {n}
                </button>
              ))}
            </div>
          )}
          <button className="ctrl-btn text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-2.5" onClick={() => setShowAchievements(true)}>
            🏆
          </button>
          {/* 🇺🇸 External Debt USA button */}
          <button 
            className="ctrl-btn text-[10px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 font-bold border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-all"
            onClick={takeUSADebt}
            title="Взять внешний долг США (+1,000,000 с 25% годовых)"
          >
            🇺🇸 ДОЛГ США
          </button>
        </div>
      </div>

      {/* ============ MODALS ============ */}

      {/* Big Win Overlay */}
      {showBigWin && (
        <div className="big-win-overlay" onClick={() => setShowBigWin(false)}>
          <div className="big-win-text">
            {isMegaWin ? 'MEGA WIN!' : 'BIG WIN!'}
          </div>
          <div className="text-4xl font-bold text-white mt-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            +{bigWinAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400 mt-4">Нажмите чтобы продолжить</div>
        </div>
      )}

      {/* Paytable Modal */}
      {showPaytable && (
        <div className="modal-backdrop" onClick={() => setShowPaytable(false)}>
          <div className="modal-content max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-cyan-400 mb-4 text-center" style={{ fontFamily: 'Orbitron' }}>
              📋 Таблица выплат
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {Object.entries(CONFIG.PAYTABLE).map(([key, pays]) => {
                const sym = CONFIG.SYMBOLS[key.toUpperCase() as keyof typeof CONFIG.SYMBOLS];
                return (
                  <div key={key} className="bg-black/30 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl text-center mb-1">{sym?.emoji}</div>
                    <div className="text-xs text-center text-gray-400">
                      x3: <span className="text-white">{(pays as any)[3]}</span> | 
                      x4: <span className="text-white">{(pays as any)[4]}</span> | 
                      x5: <span className="text-white">{(pays as any)[5]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <p>⚡ <b>Wild</b> — заменяет любой символ кроме Scatter</p>
              <p>🌀 <b>Scatter</b> — 3+ на поле = 10 фриспинов с x2!</p>
              <p>📏 Выплаты только слева направо, 3+ одинаковых</p>
              <p>💰 Scatter выплаты умножаются на общую ставку</p>
              <p>🎰 10 фиксированных линий выплат</p>
              <p>💳 При нехватке средств — автокредит (10% комиссия)</p>
            </div>
            <div className="mt-4 text-center">
              <button className="ctrl-btn" onClick={() => setShowPaytable(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStats && (
        <div className="modal-backdrop" onClick={() => setShowStats(false)}>
          <div className="modal-content max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-cyan-400 mb-4 text-center" style={{ fontFamily: 'Orbitron' }}>
              📊 Статистика
            </h2>
            <div key={statsVersion} className="space-y-2 text-sm">
              <StatRow label="Всего спинов" value={statsRef.current.stats.totalSpins.toString()} />
              <StatRow label="Всего поставлено" value={statsRef.current.stats.totalBet.toLocaleString()} />
              <StatRow label="Всего выиграно" value={statsRef.current.stats.totalWon.toLocaleString()} />
              <StatRow 
                label="Профит/Лосс" 
                value={(statsRef.current.stats.totalWon - statsRef.current.stats.totalBet).toLocaleString()}
                color={statsRef.current.stats.totalWon >= statsRef.current.stats.totalBet ? 'text-green-400' : 'text-red-400'}
              />
              <StatRow label="Макс. выигрыш" value={`${statsRef.current.stats.maxWin.toLocaleString()} (x${statsRef.current.stats.maxWinMultiplier.toFixed(1)})`} />
              <StatRow label="Текущий RTP" value={`${statsRef.current.getCurrentRTP().toFixed(2)}%`} />
              <StatRow label="Серия проигрышей (макс)" value={statsRef.current.stats.longestLoseStreak.toString()} />
              <StatRow label="Серия выигрышей (макс)" value={statsRef.current.stats.longestWinStreak.toString()} />
              <StatRow label="Займов взято" value={statsRef.current.stats.loansTaken.toString()} />
              <StatRow label="Бонусов активировано" value={statsRef.current.stats.bonusTriggered.toString()} />
            </div>
            {statsRef.current.stats.balanceHistory.length > 1 && (
              <div className="mt-4">
                <div className="text-xs text-gray-400 mb-1">График баланса:</div>
                <BalanceChart data={[...statsRef.current.stats.balanceHistory]} />
              </div>
            )}
            <div className="mt-4 flex gap-2 justify-center">
              <button className="ctrl-btn" onClick={() => setShowStats(false)}>Закрыть</button>
              <button className="ctrl-btn border-red-500 text-red-400" onClick={() => { resetGame(); setShowStats(false); }}>
                🗑️ Сбросить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="modal-backdrop" onClick={() => setShowAchievements(false)}>
          <div className="modal-content max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-yellow-400 mb-4 text-center" style={{ fontFamily: 'Orbitron' }}>
              🏆 Достижения
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {Object.values(CONFIG.ACHIEVEMENTS).map(ach => {
                const unlocked = achievementsRef.current.isUnlocked(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`achievement-badge text-center p-3 rounded-lg border ${
                      unlocked 
                        ? 'border-yellow-400 bg-yellow-400/10' 
                        : 'locked border-gray-600 bg-gray-800/30'
                    }`}
                  >
                    <div className="text-2xl mb-1">{unlocked ? ach.icon : '🔒'}</div>
                    <div className="text-[10px] font-bold">{ach.name}</div>
                    <div className="text-[9px] text-gray-400">{ach.desc}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <button className="ctrl-btn" onClick={() => setShowAchievements(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[3000] toast">
          <div className="bg-black/90 border border-cyan-400 rounded-lg px-4 py-3 flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
            <span className="text-xl">{toast.icon}</span>
            <span className="text-sm font-bold">{toast.text}</span>
          </div>
        </div>
      )}

      {/* Debt cleared flash */}
      {debtCleared && (
        <div className="fixed inset-0 pointer-events-none z-[2500] flex items-center justify-center">
          <div className="text-3xl font-bold text-green-400 animate-ping" style={{ fontFamily: 'Orbitron' }}>
            ✅ ДОЛГ ПОГАШЕН!
          </div>
        </div>
      )}



      {/* Exit Summary Modal */}
      {showExitSummary && exitResult && (
        <div className="modal-backdrop">
          <div className={`exit-summary-modal ${exitResult.type}`}>
            <div className="text-5xl mb-4">
              {exitResult.type === 'profit' ? '🎉' : '💸'}
            </div>
            <h2 
              className={`text-2xl font-black mb-2 ${
                exitResult.type === 'profit' ? 'text-green-400 neon-text-green' : 'text-red-400 neon-text-red'
              }`}
              style={{ fontFamily: 'Orbitron' }}
            >
              {exitResult.type === 'profit' ? 'ВЫ В ПЛЮСЕ!' : 'ВЫ В МИНУСЕ!'}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {exitResult.type === 'profit' 
                ? 'Поздравляем! Вы выиграли:' 
                : 'К сожалению, вы задолжали:'}
            </p>
            <div className="count-up">
              <div 
                className={`text-5xl font-black mb-2 ${
                  exitResult.type === 'profit' ? 'text-green-400' : 'text-red-400'
                }`}
                style={{ fontFamily: 'Share Tech Mono' }}
              >
                {exitResult.type === 'profit' ? '+' : '-'}
                {exitResult.amount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">кредитов</div>
            </div>
            
            {/* Stats preview */}
            <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-gray-500">Баланс</div>
                <div className="text-cyan-400 font-bold">{Math.floor(balance).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Спинов</div>
                <div className="text-white font-bold">{statsRef.current.stats.totalSpins}</div>
              </div>
            </div>
            
            <button
              className="mt-6 px-8 py-3 rounded-full font-bold text-sm transition-all active:scale-95 border-2"
              style={{ 
                fontFamily: 'Orbitron',
                borderColor: exitResult.type === 'profit' ? 'var(--neon-green)' : 'var(--neon-red)',
                color: exitResult.type === 'profit' ? 'var(--neon-green)' : 'var(--neon-red)',
                background: exitResult.type === 'profit' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 51, 102, 0.1)',
              }}
              onClick={confirmExit}
            >
              {exitResult.type === 'profit' ? '🎰 Забрать выигрыш' : '🚪 Выйти'}
            </button>
          </div>
        </div>
      )}

      {/* Fixed debt indicator - OUTSIDE overflow container, bottom right */}
      {debt > 0 && (
        <div 
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 99999,
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(139, 0, 0, 0.95) 0%, rgba(220, 20, 60, 0.9) 100%)',
            border: '3px solid #ff0000',
            boxShadow: '0 0 20px rgba(255, 0, 0, 0.6), 0 0 40px rgba(255, 0, 0, 0.4), 0 0 60px rgba(255, 0, 0, 0.2), inset 0 0 20px rgba(255, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
            animation: 'debtAggressivePulse 1.5s ease-in-out infinite'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>💳</span>
            <div>
              <div style={{ 
                fontSize: '9px', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em', 
                color: '#fca5a5', 
                fontWeight: 'bold' 
              }}>
                ДОЛГ
              </div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 900, 
                color: '#ef4444',
                fontFamily: 'Share Tech Mono, monospace',
                textShadow: '0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff3333'
              }}>
                {Math.floor(debt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Helper Components ============
function StatRow({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-white/5">
      <span className="text-gray-400">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function BalanceChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 300;
  const height = 60;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const lastVal = data[data.length - 1];
  const firstVal = data[0];
  const color = lastVal >= firstVal ? '#00ff88' : '#ff3366';

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="rounded bg-black/30">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

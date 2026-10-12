/**
 * Neon Cyber Spin — Audio Manager
 * Все звуки генерируются через Web Audio API (без внешних файлов)
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private masterGain: GainNode | null = null;
  private volume: number = 0.3;

  constructor() {
    this.muted = localStorage.getItem('neonCyberSpin_muted') === 'true';
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getMasterGain(): GainNode {
    this.getContext();
    return this.masterGain!;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    localStorage.setItem('neonCyberSpin_muted', this.muted.toString());
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Spin start — rising tone 200Hz → 400Hz, 200ms
   */
  playSpinStart(): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      
      osc.connect(gain);
      gain.connect(this.getMasterGain());
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) { /* silent fail */ }
  }

  /**
   * Reel stop — metallic click, 50ms
   */
  playReelStop(): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(this.getMasterGain());
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) { /* silent fail */ }
  }

  /**
   * Tick — быстрый тик во время вращения
   */
  playTick(): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.02);
      
      osc.connect(gain);
      gain.connect(this.getMasterGain());
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.02);
    } catch (e) { /* silent fail */ }
  }

  /**
   * Small win — мажорный аккорд C-E-G
   */
  playWinSmall(): void {
    try {
      const ctx = this.getContext();
      const notes = [261.63, 329.63, 392.00]; // C4, E4, G4
      
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.getMasterGain());
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + 0.3);
      });
    } catch (e) { /* silent fail */ }
  }

  /**
   * Big win — фанфары C-E-G-C
   */
  playWinBig(): void {
    try {
      const ctx = this.getContext();
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.15 + 0.3);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
        
        osc.connect(gain);
        gain.connect(this.getMasterGain());
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + 0.8);
      });
    } catch (e) { /* silent fail */ }
  }

  /**
   * Scatter — магический sweep
   */
  playScatter(): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.5);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(this.getMasterGain());
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) { /* silent fail */ }
  }

  /**
   * Loan taken — низкий негативный тон
   */
  playLoanTaken(): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.4);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(this.getMasterGain());
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) { /* silent fail */ }
  }

  /**
   * Debt paid — позитивный джингл
   */
  playDebtPaid(): void {
    try {
      const ctx = this.getContext();
      const notes = [392, 440, 523.25, 659.25]; // G4, A4, C5, E5
      
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.12 + 0.03);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.12 + 0.2);
        
        osc.connect(gain);
        gain.connect(this.getMasterGain());
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.2);
      });
    } catch (e) { /* silent fail */ }
  }

  /**
   * Jackpot — эпичная последовательность
   */
  playJackpot(): void {
    try {
      const ctx = this.getContext();
      const notes = [
        261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50,
        783.99, 659.25, 523.25, 659.25, 783.99, 1046.50
      ];
      
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        const start = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.03);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.12);
        gain.gain.linearRampToValueAtTime(0, start + 0.15);
        
        osc.connect(gain);
        gain.connect(this.getMasterGain());
        osc.start(start);
        osc.stop(start + 0.15);
      });
    } catch (e) { /* silent fail */ }
  }

  /**
   * Button click
   */
  playClick(): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
      
      osc.connect(gain);
      gain.connect(this.getMasterGain());
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.03);
    } catch (e) { /* silent fail */ }
  }
}

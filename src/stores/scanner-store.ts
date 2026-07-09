import { action, makeObservable, observable } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import RootStore from './root-store';

export type TStrategyType = 'even_odd' | 'over_under' | 'matches' | 'differs' | 'rise_fall' | '';
export type TSignalStatus = "TRADE NOW" | "WAIT" | "NEUTRAL";
export type TDigitFrequency = { digit: number; count: number; percentage: number };

export type TAnalysisResult = {
  digitFrequencies: TDigitFrequency[];
  evenCount: number;
  oddCount: number;
  evenPercentage: number;
  oddPercentage: number;
  highCount: number;
  lowCount: number;
  highPercentage: number;
  lowPercentage: number;
  entropy: number;
  powerIndex: {
    strongest: number; weakest: number; gap: number;
  };
  missingDigits: number[];
  streaks: { digit: number; count: number }[];
  totalTicks: number;
  lastDigits: number[];
};

export type TSignal = {
  type: TStrategyType;
  status: TSignalStatus;
  probability: number;
  recommendation: string;
  entryCondition: string;
  targetDigit?: number;
  signalDetails?: any;
};

export type TScanSignal = {
  symbol: string;
  strategy: TStrategyType;
  confidence: number;
  timestamp: number;
  details: TSignal;
  analysisResult: TAnalysisResult;
};

interface IScannerStore {
  is_open: boolean;
  is_scanning: boolean;
  selected_strategy: TStrategyType;
  selected_symbols: string[];
  scan_mode: 'single' | 'multiple';
  signals: TScanSignal[];
  current_signal: TScanSignal | null;
  setScannerVisibility: (is_open?: boolean) => void;
  setSelectedStrategy: (strategy: TStrategyType) => void;
  setSelectedSymbols: (symbols: string[]) => void;
  setScanMode: (mode: 'single' | 'multiple') => void;
  startScanning: () => void;
  stopScanning: () => void;
  resetScanner: () => void;
}

export default class ScannerStore implements IScannerStore {
  root_store: RootStore;
  is_open = false;
  is_scanning = false;
  selected_strategy: TStrategyType = 'even_odd';
  selected_symbols: string[] = [];
  scan_mode: 'single' | 'multiple' = 'multiple';
  signals: TScanSignal[] = [];
  current_signal: TScanSignal | null = null;
  private scanning_timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(root_store: RootStore) {
    makeObservable(this, {
      is_open: observable,
      is_scanning: observable,
      selected_strategy: observable,
      selected_symbols: observable,
      scan_mode: observable,
      signals: observable,
      current_signal: observable,
      setScannerVisibility: action,
      setSelectedStrategy: action,
      setSelectedSymbols: action,
      setScanMode: action,
      startScanning: action,
      stopScanning: action,
      resetScanner: action,
      addSignal: action,
    });

    this.root_store = root_store;
  }

  setScannerVisibility = (is_open?: boolean) => {
    this.is_open = is_open ?? !this.is_open;
    console.log('setScannerVisibility called, is_open now:', this.is_open);
  };

  setSelectedStrategy = (strategy: TStrategyType) => {
    this.selected_strategy = strategy;
  };

  setSelectedSymbols = (symbols: string[]) => {
    this.selected_symbols = symbols;
  };

  setScanMode = (mode: 'single' | 'multiple') => {
    this.scan_mode = mode;
  };

  addSignal = (signal: TScanSignal) => {
    // Update current signal if this is the best one
    if (!this.current_signal || signal.confidence > this.current_signal.confidence) {
      this.current_signal = signal;
    }
    this.signals = [signal, ...this.signals].slice(0, 20); // Keep last 20 signals
  };

  startScanning = async () => {
    if (!this.selected_symbols.length) {
      // If no symbols selected, select all available
      if (api_base.active_symbols) {
        const allSymbols = api_base.active_symbols
          .map((s: any) => s.symbol || s.underlying_symbol)
          .filter(Boolean);
        this.selected_symbols = allSymbols;
      } else {
        console.warn('[ScannerStore] No active symbols available');
        return;
      }
    }

    this.is_scanning = true;

    try {
      await this.analyzeMarkets();
      if (this.scan_mode === 'multiple') {
        this.setupContinuousScanning();
      }
    } catch (error) {
      console.error('[ScannerStore] Scanning error:', error);
      this.is_scanning = false;
    }
  };

  stopScanning = () => {
    this.is_scanning = false;
    if (this.scanning_timeout) {
      clearTimeout(this.scanning_timeout);
      this.scanning_timeout = null;
    }
  };

  resetScanner = () => {
    this.stopScanning();
    this.signals = [];
    this.current_signal = null;
  };

  private setupContinuousScanning = () => {
    if (this.is_scanning && this.scan_mode === 'multiple') {
      this.scanning_timeout = setTimeout(async () => {
        try {
          await this.analyzeMarkets();
          this.setupContinuousScanning();
        } catch (error) {
          console.error('[ScannerStore] Continuous scanning error:', error);
        }
      }, 2000); // Scan every 2 seconds
    }
  };

  // Helper: Extract last digit from quote
  private extractLastDigit = (quote: number): number => {
    return Math.floor(quote * 10) % 10;
  };

  // Step 1: Analyze ticks
  analyzeTicks = (ticks: any[]): TAnalysisResult => {
    if (!ticks || ticks.length === 0) {
      throw new Error('No ticks to analyze');
    }

    const totalTicks = ticks.length;
    const lastDigits = ticks.map(t => this.extractLastDigit(t.quote));
    const digitCounts = Array(10).fill(0);
    let evenCount = 0, oddCount = 0, highCount = 0, lowCount = 0;

    lastDigits.forEach(digit => {
      digitCounts[digit]++;
      if (digit % 2 === 0) evenCount++;
      else oddCount++;
      if (digit >= 5) highCount++;
      else lowCount++;
    });

    const digitFrequencies = digitCounts.map((count, digit) => ({
      digit,
      count,
      percentage: totalTicks > 0 ? (count / totalTicks) * 100 : 0
    }));

    const sortedDigits = [...digitFrequencies].sort((a, b) => b.percentage - a.percentage);
    const strongestDigit = sortedDigits[0].digit;
    const weakestDigit = sortedDigits[sortedDigits.length - 1].digit;
    const gap = sortedDigits[0].percentage - sortedDigits[sortedDigits.length - 1].percentage;

    const missingDigits = digitCounts.map((count, digit) => count === 0 ? digit : -1).filter(d => d !== -1);
    const streaks = this.detectStreaks(lastDigits);
    const entropy = this.calculateEntropy(digitFrequencies);

    return {
      digitFrequencies,
      evenCount,
      oddCount,
      evenPercentage: (evenCount / totalTicks) * 100,
      oddPercentage: (oddCount / totalTicks) * 100,
      highCount,
      lowCount,
      highPercentage: (highCount / totalTicks) * 100,
      lowPercentage: (lowCount / totalTicks) * 100,
      entropy,
      powerIndex: { strongest: strongestDigit, weakest: weakestDigit, gap },
      missingDigits,
      streaks,
      totalTicks,
      lastDigits
    };
  };

  // Step 2: Detect streaks
  detectStreaks = (digits: number[]): { digit: number; count: number }[] => {
    const streaks: { digit: number; count: number }[] = [];
    let currentDigit = digits[0];
    let currentCount = 1;

    for (let i = 1; i < digits.length; i++) {
      if (digits[i] === currentDigit) {
        currentCount++;
      } else {
        if (currentCount >= 2) {
          streaks.push({ digit: currentDigit, count: currentCount });
        }
        currentDigit = digits[i];
        currentCount = 1;
      }
    }

    if (currentCount >= 2) {
      streaks.push({ digit: currentDigit, count: currentCount });
    }
    return streaks;
  };

  // Step 3: Calculate Shannon entropy
  calculateEntropy = (frequencies: TDigitFrequency[]): number => {
    let entropy = 0;
    frequencies.forEach(f => {
      if (f.percentage > 0) {
        const p = f.percentage / 100;
        entropy -= p * Math.log2(p);
      }
    });
    return entropy;
  };

  // Step 4: Generate all standard signals
  generateAllSignals = (analysis: TAnalysisResult): Map<TStrategyType, TSignal> => {
    const signals = new Map<TStrategyType, TSignal>();

    // Even/Odd Signal
    const maxEvenOdd = Math.max(analysis.evenPercentage, analysis.oddPercentage);
    const isEvenBias = analysis.evenPercentage > analysis.oddPercentage;
    if (maxEvenOdd >= 60) {
      signals.set('even_odd', {
        type: 'even_odd',
        status: 'TRADE NOW',
        probability: maxEvenOdd / 100,
        recommendation: `Strong ${isEvenBias ? 'even' : 'odd'} bias detected at ${maxEvenOdd.toFixed(1)}%`,
        entryCondition: `Wait for 2+ consecutive ${isEvenBias ? 'odd' : 'even'} digits, then trade ${isEvenBias ? 'even' : 'odd'}`,
        signalDetails: { bias: isEvenBias ? 'even' : 'odd' }
      });
    } else if (maxEvenOdd >= 55) {
      signals.set('even_odd', {
        type: 'even_odd',
        status: 'WAIT',
        probability: maxEvenOdd / 100,
        recommendation: `Moderate ${isEvenBias ? 'even' : 'odd'} bias at ${maxEvenOdd.toFixed(1)}%`,
        entryCondition: 'Monitor for stronger signal'
      });
    } else {
      signals.set('even_odd', {
        type: 'even_odd',
        status: 'NEUTRAL',
        probability: 0,
        recommendation: 'No clear pattern',
        entryCondition: ''
      });
    }

    // Over/Under (Over/Under 4.5)
    const maxHighLow = Math.max(analysis.highPercentage, analysis.lowPercentage);
    const isHighBias = analysis.highPercentage > analysis.lowPercentage;
    if (maxHighLow >= 62 && analysis.powerIndex.gap >= 15) {
      signals.set('over_under', {
        type: 'over_under',
        status: 'TRADE NOW',
        probability: maxHighLow / 100,
        recommendation: `Strong ${isHighBias ? 'high (Over)' : 'low (Under)'} bias at ${maxHighLow.toFixed(1)}%`,
        entryCondition: `Trade when strongest digit appears (digit ${analysis.powerIndex.strongest})`,
        targetDigit: analysis.powerIndex.strongest,
        signalDetails: { bias: isHighBias ? 'high' : 'low' }
      });
    } else if (maxHighLow >= 58) {
      signals.set('over_under', {
        type: 'over_under',
        status: 'WAIT',
        probability: maxHighLow / 100,
        recommendation: `Moderate ${isHighBias ? 'high' : 'low'} bias at ${maxHighLow.toFixed(1)}%`,
        entryCondition: 'Wait for power gap to increase'
      });
    } else {
      signals.set('over_under', {
        type: 'over_under',
        status: 'NEUTRAL',
        probability: 0,
        recommendation: 'No clear pattern',
        entryCondition: ''
      });
    }

    // Matches
    const strongestFreq = analysis.digitFrequencies[analysis.powerIndex.strongest].percentage;
    if (strongestFreq >= 15) {
      signals.set('matches', {
        type: 'matches',
        status: 'TRADE NOW',
        probability: strongestFreq / 100,
        recommendation: `Digit ${analysis.powerIndex.strongest} has strong power at ${strongestFreq.toFixed(1)}%`,
        entryCondition: 'Trade immediately when digit appears',
        targetDigit: analysis.powerIndex.strongest
      });
    } else if (strongestFreq >= 12) {
      signals.set('matches', {
        type: 'matches',
        status: 'WAIT',
        probability: strongestFreq / 100,
        recommendation: `Digit ${analysis.powerIndex.strongest} showing moderate frequency at ${strongestFreq.toFixed(1)}%`,
        entryCondition: 'Wait for frequency to increase',
        targetDigit: analysis.powerIndex.strongest
      });
    } else {
      signals.set('matches', {
        type: 'matches',
        status: 'NEUTRAL',
        probability: 0,
        recommendation: 'No dominant digit',
        entryCondition: ''
      });
    }

    // Differs
    const leastFreq = analysis.digitFrequencies[analysis.powerIndex.weakest].percentage;
    if (leastFreq < 9) {
      signals.set('differs', {
        type: 'differs',
        status: 'TRADE NOW',
        probability: (100 - leastFreq) / 100,
        recommendation: `Digit ${analysis.powerIndex.weakest} appears only ${leastFreq.toFixed(1)}%`,
        entryCondition: 'Wait for rare digit to appear, then trade DIFFERS',
        targetDigit: analysis.powerIndex.weakest
      });
    } else {
      signals.set('differs', {
        type: 'differs',
        status: 'NEUTRAL',
        probability: 0,
        recommendation: 'No clear differs pattern',
        entryCondition: ''
      });
    }

    // Rise/Fall
    if (analysis.lastDigits.length >= 10) {
      const last10 = analysis.lastDigits.slice(-10);
      const firstTickValue = last10[0];
      const lastTickValue = last10[last10.length - 1];
      const trend = lastTickValue - firstTickValue;
      const direction = trend > 0 ? 'rise' : 'fall';
      const confidence = Math.min(60 + Math.abs(trend) * 10, 75);
      if (confidence >= 60) {
        signals.set('rise_fall', {
          type: 'rise_fall',
          status: 'TRADE NOW',
          probability: confidence / 100,
          recommendation: `${direction.toUpperCase()} trend detected with ${confidence.toFixed(1)}% confidence`,
          entryCondition: 'Trade in detected direction',
          signalDetails: { trend: direction, strength: Math.abs(trend) }
        });
      } else {
        signals.set('rise_fall', {
          type: 'rise_fall',
          status: 'NEUTRAL',
          probability: 0,
          recommendation: 'Insufficient trend strength',
          entryCondition: ''
        });
      }
    } else {
      signals.set('rise_fall', {
        type: 'rise_fall',
        status: 'NEUTRAL',
        probability: 0,
        recommendation: 'Not enough ticks',
        entryCondition: ''
      });
    }

    return signals;
  };

  private analyzeMarkets = async () => {
    const TicksService = (await import('@/external/bot-skeleton/services/api/ticks_service')).default;
    const ticksService = new TicksService();

    for (const symbol of this.selected_symbols) {
      try {
        const ticks = await ticksService.request({
          symbol,
          count: 10000
        });

        if (ticks && ticks.length > 0) {
          const analysisResult = this.analyzeTicks(ticks);
          const allSignals = this.generateAllSignals(analysisResult);

          // Check all strategies for this symbol
          for (const [strategy, signal] of allSignals) {
            if (signal.status === 'TRADE NOW' || signal.status === 'WAIT') {
              const scanSignal: TScanSignal = {
                symbol,
                strategy,
                confidence: signal.probability,
                timestamp: Date.now(),
                details: signal,
                analysisResult
              };
              this.addSignal(scanSignal);
            }
          }
        }
      } catch (error) {
        console.error(`[ScannerStore] Error analyzing symbol ${symbol}:`, error);
      }
    }
  };

  loadBotWithStrategy = async () => {
    if (!this.current_signal) return;

    const { quick_strategy } = this.root_store;
    const strategyTradetypeMap: Record<TStrategyType, string> = {
      even_odd: 'evenodd',
      over_under: 'overunder',
      matches: 'matchesdiffers',
      differs: 'matchesdiffers',
      rise_fall: 'callput',
      '': ''
    };

    const formData = {
      symbol: this.current_signal.symbol,
      tradetype: strategyTradetypeMap[this.current_signal.strategy],
      type: 'DIGITEVEN',
      durationtype: 't',
      duration: '1',
      stake: '1',
      action: 'LOAD',
    };

    await quick_strategy.onSubmit(formData as any);
  };

  loadBotAndRun = async () => {
    await this.loadBotWithStrategy();
    const { run_panel } = this.root_store;
    run_panel.onRunButtonClick();
  };
}

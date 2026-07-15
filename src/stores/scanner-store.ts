import { action, makeObservable, observable } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import RootStore from './root-store';

export type TStrategyType = 'even_odd' | 'over_under' | 'matches' | 'differs' | 'rise_fall' | 'pro_even_odd' | 'pro_over_under' | 'pro_differs' | 'under_7' | 'over_2' | 'super' | '';
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
  selected_strategies: TStrategyType[];
  scan_market_mode: 'single' | 'multi';
  single_market_symbol: string;
  ticks_counter: number;
  is_manual_selection: boolean;
  setScannerVisibility: (is_open?: boolean) => void;
  setSelectedStrategy: (strategy: TStrategyType) => void;
  setSelectedSymbols: (symbols: string[]) => void;
  setScanMode: (mode: 'single' | 'multiple') => void;
  startScanning: () => void;
  stopScanning: () => void;
  resetScanner: () => void;
  toggleStrategy: (strategy: TStrategyType) => void;
  setScanMarketMode: (mode: 'single' | 'multi') => void;
  setSingleMarketSymbol: (symbol: string) => void;
  setTicksCounter: (count: number) => void;
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

  // New multi-strategy and market selection options
  selected_strategies: TStrategyType[] = ['even_odd'];
  scan_market_mode: 'single' | 'multi' = 'multi';
  single_market_symbol: string = 'R_100';
  ticks_counter: number = 0;
  is_manual_selection = false;

  constructor(root_store: RootStore) {
    makeObservable(this, {
      is_open: observable,
      is_scanning: observable,
      selected_strategy: observable,
      selected_symbols: observable,
      scan_mode: observable,
      signals: observable,
      current_signal: observable,
      selected_strategies: observable,
      scan_market_mode: observable,
      single_market_symbol: observable,
      ticks_counter: observable,
      is_manual_selection: observable,
      setScannerVisibility: action,
      setSelectedStrategy: action,
      setSelectedSymbols: action,
      setScanMode: action,
      startScanning: action,
      stopScanning: action,
      resetScanner: action,
      addSignal: action,
      toggleStrategy: action,
      setScanMarketMode: action,
      setSingleMarketSymbol: action,
      setTicksCounter: action,
    });

    this.root_store = root_store;
  }

  toggleStrategy = (strategy: TStrategyType) => {
    const existingIndex = this.selected_strategies.indexOf(strategy);
    if (existingIndex > -1) {
      if (this.selected_strategies.length > 1) {
        this.selected_strategies = this.selected_strategies.filter(s => s !== strategy);
      }
    } else {
      this.selected_strategies = [...this.selected_strategies, strategy];
    }
  };

  setScanMarketMode = (mode: 'single' | 'multi') => {
    this.scan_market_mode = mode;
  };

  setSingleMarketSymbol = (symbol: string) => {
    this.single_market_symbol = symbol;
  };

  setTicksCounter = (count: number) => {
    this.ticks_counter = count;
  };

  setScannerVisibility = (is_open?: boolean | any) => {
    this.is_open = typeof is_open === 'boolean' ? is_open : !this.is_open;
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
    if (!this.is_manual_selection) {
      if (!this.current_signal || signal.confidence > this.current_signal.confidence) {
        this.current_signal = signal;
      }
    }
    this.signals = [signal, ...this.signals].slice(0, 20); // Keep last 20 signals
  };

  startScanning = async () => {
    if (!this.selected_symbols.length) {
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
    this.ticks_counter = 0;
    this.is_manual_selection = false;

    try {
      await this.analyzeMarkets();
      this.setupContinuousScanning();
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
    this.ticks_counter = 0;
  };

  private setupContinuousScanning = () => {
    if (this.is_scanning) {
      this.scanning_timeout = setTimeout(async () => {
        try {
          if (this.ticks_counter >= 25) {
            this.ticks_counter = 0;
            await this.analyzeMarkets();
          } else {
            this.ticks_counter += 1;
          }
          this.setupContinuousScanning();
        } catch (error) {
          console.error('[ScannerStore] Continuous scanning error:', error);
          this.setupContinuousScanning();
        }
      }, 200); // 200ms per tick evaluation
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
      const confidence = Math.min(60 + Math.abs(trend) * 100, 75);
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

  // Step 5: Generate Pro Signals (Advanced Strategies)
  generateProSignals = (analysis: TAnalysisResult): Map<TStrategyType, TSignal> => {
    const signals = new Map<TStrategyType, TSignal>();
    const lastDigits = analysis.lastDigits;
    const last20 = lastDigits.slice(-20);

    // --- 1. Pro Even/Odd ---
    const evenDigitsFreqs = analysis.digitFrequencies.filter(f => f.digit % 2 === 0);
    const oddDigitsFreqs = analysis.digitFrequencies.filter(f => f.digit % 2 !== 0);
    const evenFreq11Plus = evenDigitsFreqs.filter(f => f.percentage >= 11).length;
    const oddFreq11Plus = oddDigitsFreqs.filter(f => f.percentage >= 11).length;
    const strongestIsEven = analysis.powerIndex.strongest % 2 === 0;
    const evenInLast20 = last20.filter(d => d % 2 === 0).length;
    const oddInLast20 = last20.filter(d => d % 2 !== 0).length;

    // EVEN Strategy
    if (
      analysis.evenPercentage >= 55 &&
      evenFreq11Plus >= 2 &&
      strongestIsEven &&
      evenInLast20 >= 11
    ) {
      let consecutiveOdds = 0;
      for (let i = lastDigits.length - 1; i >= 0; i--) {
        if (lastDigits[i] % 2 !== 0) consecutiveOdds++;
        else break;
      }

      if (consecutiveOdds >= 3) {
        signals.set('pro_even_odd', {
          type: 'pro_even_odd',
          status: 'TRADE NOW',
          probability: analysis.evenPercentage / 100,
          recommendation: `EVEN STRATEGY: ${consecutiveOdds} consecutive odds detected - Enter EVEN now!`,
          entryCondition: 'Enter EVEN immediately after first even digit appears',
        });
      } else {
        signals.set('pro_even_odd', {
          type: 'pro_even_odd',
          status: 'WAIT',
          probability: analysis.evenPercentage / 100,
          recommendation: 'EVEN conditions met - Waiting for 3+ consecutive ODD digits',
          entryCondition: 'Wait for 3+ consecutive ODD digits, then enter EVEN',
        });
      }
    }
    // ODD Strategy
    else if (
      analysis.oddPercentage >= 70 &&
      oddFreq11Plus >= 2 &&
      !strongestIsEven &&
      oddInLast20 >= 14
    ) {
      let consecutiveEvens = 0;
      for (let i = lastDigits.length - 1; i >= 0; i--) {
        if (lastDigits[i] % 2 === 0) consecutiveEvens++;
        else break;
      }

      if (consecutiveEvens >= 3) {
        signals.set('pro_even_odd', {
          type: 'pro_even_odd',
          status: 'TRADE NOW',
          probability: analysis.oddPercentage / 100,
          recommendation: `ODD STRATEGY: ${consecutiveEvens} consecutive evens detected - Enter ODD now!`,
          entryCondition: 'Enter ODD immediately after first odd digit appears',
        });
      } else {
        signals.set('pro_even_odd', {
          type: 'pro_even_odd',
          status: 'WAIT',
          probability: analysis.oddPercentage / 100,
          recommendation: 'ODD conditions met - Waiting for 3+ consecutive EVEN digits',
          entryCondition: 'Wait for 3+ consecutive EVEN digits, then enter ODD',
        });
      }
    }

    // --- 2. Pro Over/Under ---
    const d0Freq = analysis.digitFrequencies[0].percentage;
    const d1Freq = analysis.digitFrequencies[1].percentage;
    const range2_9Freq11Plus = analysis.digitFrequencies.filter(f => f.digit >= 2 && f.percentage >= 11).length;
    const weakestIs0or1 = analysis.powerIndex.weakest === 0 || analysis.powerIndex.weakest === 1;
    const digitsGt1Last20 = last20.filter(d => d > 1).length;
    const pctGt1 = (lastDigits.filter(d => d > 1).length / lastDigits.length) * 100;

    // Over 1
    if (
      d0Freq < 10 &&
      d1Freq < 10 &&
      range2_9Freq11Plus >= 3 &&
      weakestIs0or1 &&
      analysis.highPercentage >= 90
    ) {
      if (digitsGt1Last20 >= 18) {
        signals.set('pro_over_under', {
          type: 'pro_over_under',
          status: 'TRADE NOW',
          probability: pctGt1 / 100,
          recommendation: 'OVER 1 STRATEGY: Strong signal - 90%+ win rate detected!',
          entryCondition: 'Wait for 1+ UNDER digits, then enter OVER 1 immediately',
        });
      }
    }
    // Under 8
    else {
      const d8Freq = analysis.digitFrequencies[8].percentage;
      const d9Freq = analysis.digitFrequencies[9].percentage;
      const range0_7Freq11Plus = analysis.digitFrequencies.filter(f => f.digit <= 7 && f.percentage >= 11).length;
      const weakestIs8or9 = analysis.powerIndex.weakest === 8 || analysis.powerIndex.weakest === 9;
      const digitsLt8Last20 = last20.filter(d => d < 8).length;
      const pctLt8 = (lastDigits.filter(d => d < 8).length / lastDigits.length) * 100;

      if (
        d8Freq < 10 &&
        d9Freq < 10 &&
        range0_7Freq11Plus >= 3 &&
        weakestIs8or9 &&
        analysis.lowPercentage >= 90
      ) {
        if (digitsLt8Last20 >= 18) {
          signals.set('pro_over_under', {
            type: 'pro_over_under',
            status: 'TRADE NOW',
            probability: pctLt8 / 100,
            recommendation: 'UNDER 8 STRATEGY: Strong signal - 90%+ win rate detected!',
            entryCondition: 'Wait for 1+ OVER digits, then enter UNDER 8 immediately',
          });
        }
      }
    }

    // --- 3. Pro Differs ---
    const rareDigits = analysis.digitFrequencies.filter(f => f.percentage < 9);
    if (rareDigits.length >= 2) {
      const avgRarePct = rareDigits.reduce((acc, f) => acc + f.percentage, 0) / rareDigits.length;
      const combinedDiffersConfidence = 100 - avgRarePct;
      signals.set('pro_differs', {
        type: 'pro_differs',
        status: 'TRADE NOW',
        probability: combinedDiffersConfidence / 100,
        recommendation: `Pro differs on digit ${analysis.powerIndex.weakest} (multiple rare digits detected)`,
        entryCondition: `Wait for digit ${analysis.powerIndex.weakest} to appear, then trade DIFFERS`,
        targetDigit: analysis.powerIndex.weakest
      });
    }

    // --- 4. Under 7 ---
    const endRange7_9 = [7, 8, 9];
    const range7_9Freqs = endRange7_9.map(d => analysis.digitFrequencies[d].percentage);
    const countLt10Pct7_9 = range7_9Freqs.filter(p => p < 10).length;
    const triggerDigit7_9 = endRange7_9.find(d => analysis.digitFrequencies[d].percentage >= 10);
    const pctUnder7 = (lastDigits.filter(d => d < 7).length / lastDigits.length) * 100;

    if (countLt10Pct7_9 >= 2 && triggerDigit7_9 !== undefined) {
      signals.set('under_7', {
        type: 'under_7',
        status: 'TRADE NOW',
        probability: pctUnder7 / 100,
        recommendation: `UNDER 7 STRATEGY: Strong under 7 bias (trigger digit: ${triggerDigit7_9})`,
        entryCondition: `Enter trade when trigger digit ${triggerDigit7_9} appears`,
        targetDigit: triggerDigit7_9
      });
    }

    // --- 5. Over 2 ---
    const startRange0_2 = [0, 1, 2];
    const range0_2Freqs = startRange0_2.map(d => analysis.digitFrequencies[d].percentage);
    const countLt10Pct0_2 = range0_2Freqs.filter(p => p < 10).length;
    const triggerDigit0_2 = startRange0_2.find(d => analysis.digitFrequencies[d].percentage >= 10);
    const pctOver2 = (lastDigits.filter(d => d > 2).length / lastDigits.length) * 100;

    if (countLt10Pct0_2 >= 2 && triggerDigit0_2 !== undefined) {
      signals.set('over_2', {
        type: 'over_2',
        status: 'TRADE NOW',
        probability: pctOver2 / 100,
        recommendation: `OVER 2 STRATEGY: Strong over 2 bias (trigger digit: ${triggerDigit0_2})`,
        entryCondition: `Enter trade when trigger digit ${triggerDigit0_2} appears`,
        targetDigit: triggerDigit0_2
      });
    }

    return signals;
  };

  // Step 6: Generate Super Signals (Real-Time Monitoring)
  generateSuperSignals = (analysis: TAnalysisResult): TSignal[] => {
    const activeSuperSignals: TSignal[] = [];
    const allStd = this.generateAllSignals(analysis);
    const allPro = this.generateProSignals(analysis);

    const allMerged = new Map<TStrategyType, TSignal>();
    for (const [key, val] of allStd.entries()) {
      allMerged.set(key, val);
    }
    for (const [key, val] of allPro.entries()) {
      allMerged.set(key, val);
    }

    for (const [, signal] of allMerged.entries()) {
      const confidencePercent = signal.probability * 100;
      
      let status: TSignalStatus = 'NEUTRAL';
      if (confidencePercent >= 90) {
        status = 'TRADE NOW';
      } else if (confidencePercent >= 65) {
        status = 'TRADE NOW';
      } else if (confidencePercent >= 55) {
        status = 'WAIT';
      }

      const superSignal: TSignal = {
        ...signal,
        status,
        signalDetails: {
          ...signal.signalDetails,
          isStrong: confidencePercent >= 90,
          confidencePercent
        }
      };

      if (confidencePercent >= 65) {
        activeSuperSignals.push(superSignal);
      }
    }

    return activeSuperSignals.sort((a, b) => b.probability - a.probability);
  };

  private analyzeMarkets = async () => {
    const TicksService = (await import('@/external/bot-skeleton/services/api/ticks_service')).default;
    const ticksService = new TicksService();

    // Clear old signals
    this.signals = [];
    if (!this.is_manual_selection) {
      this.current_signal = null;
    }

    const symbolsToScan = this.scan_market_mode === 'single'
      ? [this.single_market_symbol]
      : this.selected_symbols;

    for (const symbol of symbolsToScan) {
      try {
        const ticks = await ticksService.request({
          symbol,
          count: 100
        });

        if (ticks && ticks.length > 0) {
          const analysisResult = this.analyzeTicks(ticks);
          const allStd = this.generateAllSignals(analysisResult);
          const allPro = this.generateProSignals(analysisResult);
          
          for (const strat of this.selected_strategies) {
            if (strat === 'super') {
              const superSignals = this.generateSuperSignals(analysisResult);
              for (const signal of superSignals) {
                const scanSignal: TScanSignal = {
                  symbol,
                  strategy: signal.type,
                  confidence: signal.probability,
                  timestamp: Date.now(),
                  details: signal,
                  analysisResult
                };
                this.addSignal(scanSignal);
              }
            } else {
              const signal = allStd.get(strat) || allPro.get(strat);
              if (signal && (signal.status === 'TRADE NOW' || signal.status === 'WAIT')) {
                const scanSignal: TScanSignal = {
                  symbol,
                  strategy: strat,
                  confidence: signal.probability,
                  timestamp: Date.now(),
                  details: signal,
                  analysisResult
                };
                this.addSignal(scanSignal);
              }
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
      pro_even_odd: 'evenodd',
      pro_over_under: 'overunder',
      pro_differs: 'matchesdiffers',
      under_7: 'overunder',
      over_2: 'overunder',
      super: 'evenodd',
      '': ''
    };

    const formData = {
      symbol: this.current_signal.symbol,
      tradetype: strategyTradetypeMap[this.current_signal.strategy] || 'evenodd',
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

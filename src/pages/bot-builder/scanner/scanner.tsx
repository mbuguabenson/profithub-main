import React, { useEffect, useState, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { api_base } from '@/external/bot-skeleton';
import classNames from 'classnames';
import './scanner.scss';

// ─── Helper: stats for Stats tab ──────────────────────────────────────────────
const getStatsForStrategy = (analysis: any, strategy: string) => {
  if (!analysis) return { strength: 0, text: '-', details: {} as any };
  const lastDigits = analysis.lastDigits || [];
  const totalTicks = analysis.totalTicks || lastDigits.length || 1;

  if (strategy === 'even_odd') {
    const e = analysis.evenPercentage, o = analysis.oddPercentage;
    return { strength: Math.max(e, o), text: `Even ${e.toFixed(0)}% / Odd ${o.toFixed(0)}%`, details: { bias: e >= o ? 'even' : 'odd' } };
  }
  if (strategy === 'over_under') {
    const pO1 = (lastDigits.filter((d: number) => d > 1).length / totalTicks) * 100;
    const pO2 = (lastDigits.filter((d: number) => d > 2).length / totalTicks) * 100;
    const pO3 = (lastDigits.filter((d: number) => d > 3).length / totalTicks) * 100;
    const pU6 = (lastDigits.filter((d: number) => d < 6).length / totalTicks) * 100;
    const pU7 = (lastDigits.filter((d: number) => d < 7).length / totalTicks) * 100;
    const pU8 = (lastDigits.filter((d: number) => d < 8).length / totalTicks) * 100;
    const maxO = Math.max(pO1, pO2, pO3);
    const maxU = Math.max(pU6, pU7, pU8);
    const isOver = maxO >= maxU;
    const strength = isOver ? maxO : maxU;
    let targetDigit = isOver ? (pO3 === maxO ? 3 : pO2 === maxO ? 2 : 1) : (pU6 === maxU ? 6 : pU7 === maxU ? 7 : 8);
    return { strength, text: isOver ? `Over ${targetDigit}: ${strength.toFixed(0)}%` : `Under ${targetDigit}: ${strength.toFixed(0)}%`, details: { bias: isOver ? 'high' : 'low', targetDigit } };
  }
  if (strategy === 'differs') {
    const w = analysis.powerIndex.weakest;
    const p = analysis.digitFrequencies[w]?.percentage || 0;
    return { strength: 100 - p, text: `Differs ${w}: ${(100 - p).toFixed(0)}%`, details: { targetDigit: w } };
  }
  if (strategy === 'matches') {
    const s = analysis.powerIndex.strongest;
    const p = analysis.digitFrequencies[s]?.percentage || 0;
    return { strength: p, text: `Matches ${s}: ${p.toFixed(0)}%`, details: { targetDigit: s } };
  }
  if (strategy === 'rise_fall') {
    if (lastDigits.length >= 10) {
      const last10 = lastDigits.slice(-10);
      const trend = last10[last10.length - 1] - last10[0];
      const dir = trend > 0 ? 'rise' : 'fall';
      const s = Math.min(60 + Math.abs(trend) * 100, 75);
      return { strength: s, text: `${dir === 'rise' ? 'Rise' : 'Fall'}: ${s.toFixed(0)}%`, details: { bias: dir === 'rise' ? 'high' : 'low' } };
    }
  }
  return { strength: 0, text: '-', details: {} as any };
};

// ─── Strategy options ──────────────────────────────────────────────────────────
const STRATEGY_OPTIONS = [
  { value: 'even_odd', label: 'Even/Odd' },
  { value: 'over_under', label: 'Over/Under' },
  { value: 'matches', label: 'Matches' },
  { value: 'differs', label: 'Differs' },
  { value: 'rise_fall', label: 'Rise/Fall' },
  { value: 'pro_even_odd', label: 'Pro E/O' },
  { value: 'pro_over_under', label: 'Pro O/U' },
  { value: 'pro_differs', label: 'Pro Diff' },
  { value: 'under_7', label: 'Under 7' },
  { value: 'over_2', label: 'Over 2' },
  { value: 'super', label: 'Super' },
];

const PRED_STRATEGIES = new Set(['over_under', 'pro_over_under', 'under_7', 'over_2', 'matches', 'differs']);

const mapAltTradeType = (tradeTypeId: string): {
  purchaseType: string; entryOp: string; entryThreshold: number;
  prediction: number; tradeTypeCat: string; tradeType: string; hasPrediction: boolean;
} => {
  switch (tradeTypeId) {
    case 'even_odd':
      return { purchaseType: 'DIGITEVEN', entryOp: 'EQ', entryThreshold: 1, prediction: 0, tradeTypeCat: 'digits', tradeType: 'evenodd', hasPrediction: false };
    case 'over_under':
      return { purchaseType: 'DIGITOVER', entryOp: 'LTE', entryThreshold: 2, prediction: 2, tradeTypeCat: 'digits', tradeType: 'overunder', hasPrediction: true };
    case 'matches':
      return { purchaseType: 'DIGITMATCH', entryOp: 'EQ', entryThreshold: 5, prediction: 5, tradeTypeCat: 'digits', tradeType: 'matchesdiffers', hasPrediction: true };
    case 'differs':
      return { purchaseType: 'DIGITDIFF', entryOp: 'NEQ', entryThreshold: 5, prediction: 5, tradeTypeCat: 'digits', tradeType: 'matchesdiffers', hasPrediction: true };
    case 'rise_fall':
      return { purchaseType: 'CALL', entryOp: 'GTE', entryThreshold: 5, prediction: 0, tradeTypeCat: 'callput', tradeType: 'risefall', hasPrediction: false };
    default:
      return { purchaseType: 'DIGITEVEN', entryOp: 'EQ', entryThreshold: 1, prediction: 0, tradeTypeCat: 'digits', tradeType: 'evenodd', hasPrediction: false };
  }
};

const suggestAltType = (current: string, signals: any[]): string => {
  const exclude = new Set([current]);
  const scored = STRATEGY_OPTIONS
    .filter(s => !exclude.has(s.value))
    .map(s => {
      const sig = signals.find((sg: any) => sg.strategy === s.value);
      return { value: s.value, score: sig ? sig.confidence : 0 };
    });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.value ?? 'even_odd';
};

// ─── XML Bot Generator ─────────────────────────────────────────────────────────
function generateBotXML(opts: {
  stake: string;
  takeProfit: string;
  stopLoss: string;
  martingale: string;
  symbol: string;
  tradeTypeLabel: string;
  bestSignal: any;
  entryDigit?: number;
  recovery?: { lossThreshold: number; altTradeTypeId: string };
}): string {
  const { stake, takeProfit, stopLoss, martingale, symbol, tradeTypeLabel, bestSignal, entryDigit, recovery } = opts;

  let tradeTypeCat = 'digits';
  let tradeType = 'overunder';
  let predictionNum = 7;
  let underDigitNum = 7;
  let overDigitNum = 2;
  let singleMode = false;
  let singlePurchaseType = 'DIGITUNDER';
  let singleEntryOp = 'GTE';
  let singleEntryThreshold = 6;
  let singlePrediction = 7;

  if (bestSignal) {
    const dir = (bestSignal.tradeDirection ?? '').toUpperCase();
    const overMatch = dir.match(/^OVER\s+(\d+)$/);
    const underMatch = dir.match(/^UNDER\s+(\d+)$/);
    const matchesMatch = dir.match(/^MATCHES\s+(\d+)$/);
    const differsMatch = dir.match(/^DIFFERS\s+(\d+)$/);

    if (underMatch) {
      const underDigit = parseInt(underMatch[1], 10);
      tradeTypeCat = 'digits'; tradeType = 'overunder';
      singleMode = true; singlePurchaseType = 'DIGITUNDER';
      singlePrediction = underDigit;
      singleEntryOp = 'GTE'; singleEntryThreshold = underDigit;
    } else if (overMatch) {
      const overDigit = parseInt(overMatch[1], 10);
      tradeTypeCat = 'digits'; tradeType = 'overunder';
      singleMode = true; singlePurchaseType = 'DIGITOVER';
      singlePrediction = overDigit;
      singleEntryOp = 'LTE'; singleEntryThreshold = overDigit;
    } else if (dir === 'EVEN') {
      tradeTypeCat = 'digits'; tradeType = 'evenodd';
      singleMode = true; singlePurchaseType = 'DIGITEVEN';
      singlePrediction = 0; singleEntryOp = 'EQ'; singleEntryThreshold = 1;
    } else if (dir === 'ODD') {
      tradeTypeCat = 'digits'; tradeType = 'evenodd';
      singleMode = true; singlePurchaseType = 'DIGITODD';
      singlePrediction = 0; singleEntryOp = 'EQ'; singleEntryThreshold = 0;
    } else if (matchesMatch) {
      const matchDigit = parseInt(matchesMatch[1], 10);
      tradeTypeCat = 'digits'; tradeType = 'matchesdiffers';
      singleMode = true; singlePurchaseType = 'DIGITMATCH';
      singlePrediction = matchDigit; singleEntryOp = 'EQ'; singleEntryThreshold = matchDigit;
    } else if (differsMatch) {
      const differsDigit = parseInt(differsMatch[1], 10);
      tradeTypeCat = 'digits'; tradeType = 'matchesdiffers';
      singleMode = true; singlePurchaseType = 'DIGITDIFF';
      singlePrediction = differsDigit; singleEntryOp = 'NEQ'; singleEntryThreshold = differsDigit;
    } else if (dir === 'RISE') {
      tradeTypeCat = 'callput'; tradeType = 'risefall';
      singleMode = true; singlePurchaseType = 'CALL';
      singlePrediction = 0; singleEntryOp = 'GTE'; singleEntryThreshold = 5;
    } else if (dir === 'FALL') {
      tradeTypeCat = 'callput'; tradeType = 'risefall';
      singleMode = true; singlePurchaseType = 'PUT';
      singlePrediction = 0; singleEntryOp = 'LTE'; singleEntryThreshold = 4;
    }

    if (entryDigit !== undefined) {
      if (overMatch || underMatch) {
        singlePrediction = entryDigit;
        if (overMatch) { singleEntryOp = 'LTE'; singleEntryThreshold = entryDigit; }
        else { singleEntryOp = 'GTE'; singleEntryThreshold = entryDigit; }
      } else if (matchesMatch || differsMatch) {
        singlePrediction = entryDigit;
        singleEntryThreshold = entryDigit;
      }
    }
  } else {
    // Fallback manual configurations
    singleMode = true;
    const strategy = tradeTypeLabel.toLowerCase();
    if (strategy.includes('over_under') || strategy.includes('under_7')) {
      tradeTypeCat = 'digits'; tradeType = 'overunder';
      singlePurchaseType = 'DIGITUNDER';
      singlePrediction = entryDigit ?? 7;
      singleEntryOp = 'GTE';
      singleEntryThreshold = singlePrediction;
    } else if (strategy.includes('over_2')) {
      tradeTypeCat = 'digits'; tradeType = 'overunder';
      singlePurchaseType = 'DIGITOVER';
      singlePrediction = entryDigit ?? 2;
      singleEntryOp = 'LTE';
      singleEntryThreshold = singlePrediction;
    } else if (strategy.includes('even_odd')) {
      tradeTypeCat = 'digits'; tradeType = 'evenodd';
      singlePurchaseType = 'DIGITEVEN';
      singlePrediction = 0;
      singleEntryOp = 'EQ';
      singleEntryThreshold = 1;
    } else if (strategy.includes('matches')) {
      tradeTypeCat = 'digits'; tradeType = 'matchesdiffers';
      singlePurchaseType = 'DIGITMATCH';
      singlePrediction = entryDigit ?? 5;
      singleEntryOp = 'EQ';
      singleEntryThreshold = singlePrediction;
    } else if (strategy.includes('differs')) {
      tradeTypeCat = 'digits'; tradeType = 'matchesdiffers';
      singlePurchaseType = 'DIGITDIFF';
      singlePrediction = entryDigit ?? 5;
      singleEntryOp = 'NEQ';
      singleEntryThreshold = singlePrediction;
    } else if (strategy.includes('rise_fall')) {
      tradeTypeCat = 'callput'; tradeType = 'risefall';
      singlePurchaseType = 'CALL';
      singlePrediction = 0;
      singleEntryOp = 'GTE';
      singleEntryThreshold = 5;
    }
  }

  const noPredictionTypes = ['CALL', 'PUT', 'DIGITEVEN', 'DIGITODD'];
  const hasPrediction = singleMode ? !noPredictionTypes.includes(singlePurchaseType) : true;
  const predVal = singleMode ? singlePrediction : predictionNum;

  const isEvenOddParity = singlePurchaseType === 'DIGITEVEN' || singlePurchaseType === 'DIGITODD';
  const parityRemainder = singlePurchaseType === 'DIGITEVEN' ? 1 : 0;

  const altMap = recovery ? mapAltTradeType(recovery.altTradeTypeId) : null;

  const altPurchaseXml = recovery && altMap ? `
      <block type="controls_if" id="bp_rec_if">
        <value name="IF0">
          <block type="variables_get" id="bp_rec_get">
            <field name="VAR" id="v_rec_mode">Recovery Mode</field>
          </block>
        </value>
        <statement name="DO0">
          <block type="purchase" id="bp_rec_pur">
            <field name="PURCHASE_LIST">${altMap.purchaseType}</field>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="controls_if" id="bp_if1">
            <value name="IF0">
              <block type="logic_compare" id="bp_cmp1">
                <field name="OP">${isEvenOddParity ? 'EQ' : singleEntryOp}</field>
                <value name="A">
                  ${isEvenOddParity ? `<block type="math_arithmetic" id="bp_mod_arith">
                    <field name="OP">MODULO</field>
                    <value name="A">
                      <shadow type="math_number" id="bp_mod_a_sh"><field name="NUM">0</field></shadow>
                      <block type="last_digit" id="bp_ld1"></block>
                    </value>
                    <value name="B">
                      <shadow type="math_number" id="bp_mod_b_sh"><field name="NUM">2</field></shadow>
                      <block type="math_number" id="bp_mod_b"><field name="NUM">2</field></block>
                    </value>
                  </block>` : `<block type="last_digit" id="bp_ld1"></block>`}
                </value>
                <value name="B">
                  <block type="math_number" id="bp_mn1">
                    <field name="NUM">${isEvenOddParity ? parityRemainder : singleEntryThreshold}</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="purchase" id="bp_pur1">
                <field name="PURCHASE_LIST">${singlePurchaseType}</field>
              </block>
            </statement>
          </block>
        </statement>
      </block>` : '';

  const beforePurchaseStack = recovery
    ? altPurchaseXml
    : singleMode
      ? isEvenOddParity
        ? `
      <block type="controls_if" id="bp_if1">
        <value name="IF0">
          <block type="logic_compare" id="bp_cmp1">
            <field name="OP">EQ</field>
            <value name="A">
              <block type="math_arithmetic" id="bp_mod_arith">
                <field name="OP">MODULO</field>
                <value name="A">
                  <shadow type="math_number" id="bp_mod_a_sh"><field name="NUM">0</field></shadow>
                  <block type="last_digit" id="bp_ld1"></block>
                </value>
                <value name="B">
                  <shadow type="math_number" id="bp_mod_b_sh"><field name="NUM">2</field></shadow>
                  <block type="math_number" id="bp_mod_b"><field name="NUM">2</field></block>
                </value>
              </block>
            </value>
            <value name="B">
              <block type="math_number" id="bp_mn1">
                <field name="NUM">${parityRemainder}</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="purchase" id="bp_pur1">
            <field name="PURCHASE_LIST">${singlePurchaseType}</field>
          </block>
        </statement>
      </block>`
        : `
      <block type="controls_if" id="bp_if1">
        <value name="IF0">
          <block type="logic_compare" id="bp_cmp1">
            <field name="OP">${singleEntryOp}</field>
            <value name="A">
              <block type="last_digit" id="bp_ld1"></block>
            </value>
            <value name="B">
              <block type="math_number" id="bp_mn1">
                <field name="NUM">${singleEntryThreshold}</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="purchase" id="bp_pur1">
            <field name="PURCHASE_LIST">${singlePurchaseType}</field>
          </block>
        </statement>
      </block>`
      : `
      <block type="controls_if" id="bp_if1">
        <value name="IF0">
          <block type="logic_compare" id="bp_cmp1">
            <field name="OP">GTE</field>
            <value name="A">
              <block type="last_digit" id="bp_ld1"></block>
            </value>
            <value name="B">
              <block type="math_number" id="bp_mn1">
                <field name="NUM">0</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="purchase" id="bp_pur1">
            <field name="PURCHASE_LIST">DIGITOVER</field>
          </block>
        </statement>
      </block>`;

  const recLossThreshold = recovery?.lossThreshold ?? 3;

  const winRecResetXml = recovery ? `
                        <next>
                          <block type="variables_set" id="ap_win_rec_rst">
                            <field name="VAR" id="v_rec_mode">Recovery Mode</field>
                            <value name="VALUE">
                              <block type="logic_boolean" id="lb_win_rec">
                                <field name="BOOL">FALSE</field>
                              </block>
                            </value>` : '';

  const winRecCloseXml = recovery ? `
                          </block>
                        </next>` : '';

  const lossRecCheckXml = recovery ? `
                        <next>
                          <block type="controls_if" id="ap_loss_rec_chk">
                            <value name="IF0">
                              <block type="logic_compare" id="ap_loss_rec_cmp">
                                <field name="OP">GTE</field>
                                <value name="A">
                                  <block type="variables_get" id="ap_loss_lc_get">
                                    <field name="VAR" id="v_loss_cnt">Loss Count</field>
                                  </block>
                                </value>
                                <value name="B">
                                  <block type="math_number" id="ap_loss_thresh">
                                    <field name="NUM">${recLossThreshold}</field>
                                  </block>
                                </value>
                              </block>
                            </value>
                            <statement name="DO0">
                              <block type="variables_set" id="ap_loss_rec_set">
                                <field name="VAR" id="v_rec_mode">Recovery Mode</field>
                                <value name="VALUE">
                                  <block type="logic_boolean" id="lb_loss_rec">
                                    <field name="BOOL">TRUE</field>
                                  </block>
                                </value>
                              </block>
                            </statement>` : '';

  const lossRecCloseXml = recovery ? `
                          </block>
                        </next>` : '';

  const afterPurchaseWinLoss = singleMode
    ? `
              <block type="controls_if" id="ap_wl">
                <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
                <value name="IF0">
                  <block type="contract_check_result" id="ap_win_chk">
                    <field name="CHECK_RESULT">win</field>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="variables_set" id="ap_win_rs">
                    <field name="VAR" id="v_stake">Stake</field>
                    <value name="VALUE">
                      <block type="variables_get" id="ap_win_init">
                        <field name="VAR" id="v_init_stake">Initial Stake</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="ap_win_lc">
                        <field name="VAR" id="v_loss_cnt">Loss Count</field>
                        <value name="VALUE">
                          <block type="math_number" id="ap_win_lc_zero">
                            <field name="NUM">0</field>
                          </block>
                        </value>${winRecResetXml}
                        <next>
                          <block type="trade_again" id="ap_win_ta"></block>
                        </next>
                      </block>${winRecCloseXml}
                    </next>
                  </block>
                </statement>
                <statement name="ELSE">
                  <block type="variables_set" id="ap_loss_mg">
                    <field name="VAR" id="v_stake">Stake</field>
                    <value name="VALUE">
                      <block type="math_arithmetic" id="ap_mg_arith">
                        <field name="OP">MULTIPLY</field>
                        <value name="A">
                          <shadow type="math_number" id="ap_mg_a_sh">
                            <field name="NUM">1</field>
                          </shadow>
                          <block type="variables_get" id="ap_mg_stake_get">
                            <field name="VAR" id="v_stake">Stake</field>
                          </block>
                        </value>
                        <value name="B">
                          <shadow type="math_number" id="ap_mg_b_sh">
                            <field name="NUM">2</field>
                          </shadow>
                          <block type="variables_get" id="ap_mg_get">
                            <field name="VAR" id="v_mg">Martingale</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="math_change" id="ap_loss_lc_inc">
                        <field name="VAR" id="v_loss_cnt">Loss Count</field>
                        <value name="DELTA">
                          <shadow type="math_number" id="ap_lc_delta">
                            <field name="NUM">1</field>
                          </shadow>
                        </value>${lossRecCheckXml}
                        <next>
                          <block type="trade_again" id="ap_loss_ta"></block>
                        </next>
                      </block>${lossRecCloseXml}
                    </next>
                  </block>
                </statement>
              </block>`
    : `
              <block type="controls_if" id="ap_wl">
                <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
                <value name="IF0">
                  <block type="contract_check_result" id="ap_win_chk">
                    <field name="CHECK_RESULT">win</field>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="variables_set" id="ap_win_rs">
                    <field name="VAR" id="v_stake">Stake</field>
                    <value name="VALUE">
                      <block type="variables_get" id="ap_win_init">
                        <field name="VAR" id="v_init_stake">Initial Stake</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="ap_win_lc">
                        <field name="VAR" id="v_loss_cnt">Loss Count</field>
                        <value name="VALUE">
                          <block type="math_number" id="ap_win_lc_zero">
                            <field name="NUM">0</field>
                          </block>
                        </value>${winRecResetXml}
                        <next>
                          <block type="trade_again" id="ap_win_ta"></block>
                        </next>
                      </block>${winRecCloseXml}
                    </next>
                  </block>
                </statement>
                <statement name="ELSE">
                  <block type="variables_set" id="ap_loss_mg">
                    <field name="VAR" id="v_stake">Stake</field>
                    <value name="VALUE">
                      <block type="math_arithmetic" id="ap_mg_arith">
                        <field name="OP">MULTIPLY</field>
                        <value name="A">
                          <shadow type="math_number" id="ap_mg_a_sh">
                            <field name="NUM">1</field>
                          </shadow>
                          <block type="variables_get" id="ap_mg_stake_get">
                            <field name="VAR" id="v_stake">Stake</field>
                          </block>
                        </value>
                        <value name="B">
                          <shadow type="math_number" id="ap_mg_b_sh">
                            <field name="NUM">2</field>
                          </shadow>
                          <block type="variables_get" id="ap_mg_get">
                            <field name="VAR" id="v_mg">Martingale</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="math_change" id="ap_loss_lc_inc">
                        <field name="VAR" id="v_loss_cnt">Loss Count</field>
                        <value name="DELTA">
                          <shadow type="math_number" id="ap_lc_delta">
                            <field name="NUM">1</field>
                          </shadow>
                        </value>${lossRecCheckXml}
                        <next>
                          <block type="trade_again" id="ap_loss_ta"></block>
                        </next>
                      </block>${lossRecCloseXml}
                    </next>
                  </block>
                </statement>
              </block>`;

  const extraVars = singleMode
    ? ''
    : `
    <variable id="v_pred">Prediction</variable>
    <variable id="v_under_digit">Under Digit</variable>
    <variable id="v_over_digit">Over Digit</variable>`;

  const recoveryInitXml = recovery ? `
                                <next>
                                  <block type="variables_set" id="vs_rec_mode">
                                    <field name="VAR" id="v_rec_mode">Recovery Mode</field>
                                    <value name="VALUE">
                                      <block type="logic_boolean" id="lb_rec_mode">
                                        <field name="BOOL">FALSE</field>
                                      </block>
                                    </value>
                                  </block>
                                </next>` : '';

  const extraInit = singleMode
    ? recovery ? `
                        <next>
                          <block type="variables_set" id="vs_rec_mode">
                            <field name="VAR" id="v_rec_mode">Recovery Mode</field>
                            <value name="VALUE">
                              <block type="logic_boolean" id="lb_rec_mode">
                                <field name="BOOL">FALSE</field>
                              </block>
                            </value>
                          </block>
                        </next>` : ''
    : `
                        <next>
                          <block type="variables_set" id="vs_under">
                            <field name="VAR" id="v_under_digit">Under Digit</field>
                            <value name="VALUE">
                              <block type="math_number" id="mn_under">
                                <field name="NUM">${underDigitNum}</field>
                              </block>
                            </value>
                            <next>
                              <block type="variables_set" id="vs_over">
                                <field name="VAR" id="v_over_digit">Over Digit</field>
                                <value name="VALUE">
                                  <block type="math_number" id="mn_over">
                                    <field name="NUM">${overDigitNum}</field>
                                  </block>
                                </value>
                                <next>
                                  <block type="variables_set" id="vs_pred">
                                    <field name="VAR" id="v_pred">Prediction</field>
                                    <value name="VALUE">
                                      <block type="variables_get" id="vg_under_init">
                                        <field name="VAR" id="v_under_digit">Under Digit</field>
                                      </block>
                                    </value>${recoveryInitXml}
                                  </block>
                                </next>
                              </block>
                            </next>
                          </block>
                        </next>`;

  const predictionBlock = hasPrediction
    ? `
        <value name="PREDICTION">
          <block type="math_number_positive" id="pred_block">
            <field name="NUM">${predVal}</field>
          </block>
        </value>`
    : '';

  return `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="v_stake">Stake</variable>
    <variable id="v_init_stake">Initial Stake</variable>
    <variable id="v_tp">Take Profit</variable>
    <variable id="v_sl">Stop Loss</variable>
    <variable id="v_mg">Martingale</variable>
    <variable id="v_loss_cnt">Loss Count</variable>
    <variable id="v_rec_mode">Recovery Mode</variable>${extraVars}
  </variables>

  <block type="trade_definition" id="td_main" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="tdm1" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${symbol}</field>
        <next>
          <block type="trade_definition_tradetype" id="tdt1" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">${tradeTypeCat}</field>
            <field name="TRADETYPE_LIST">${tradeType}</field>
            <next>
              <block type="trade_definition_contracttype" id="tdct1" deletable="false" movable="false">
                <field name="TYPE_LIST">${singlePurchaseType === 'DIGITMATCH' ? 'DIGITMATCH' : singlePurchaseType === 'DIGITDIFF' ? 'DIGITDIFF' : 'both'}</field>
                <next>
                  <block type="trade_definition_candleinterval" id="tdci1" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="tdrbs1" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="tdroe1" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>

    <statement name="INITIALIZATION">
      <block type="variables_set" id="vs_stake">
        <field name="VAR" id="v_stake">Stake</field>
        <value name="VALUE">
          <block type="math_number" id="mn_stake">
            <field name="NUM">${stake}</field>
          </block>
        </value>
        <next>
          <block type="variables_set" id="vs_init_stake">
            <field name="VAR" id="v_init_stake">Initial Stake</field>
            <value name="VALUE">
              <block type="math_number" id="mn_init">
                <field name="NUM">${stake}</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="vs_tp">
                <field name="VAR" id="v_tp">Take Profit</field>
                <value name="VALUE">
                  <block type="math_number" id="mn_tp">
                    <field name="NUM">${takeProfit}</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="vs_sl">
                    <field name="VAR" id="v_sl">Stop Loss</field>
                    <value name="VALUE">
                      <block type="math_number" id="mn_sl">
                        <field name="NUM">${stopLoss}</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="vs_mg">
                        <field name="VAR" id="v_mg">Martingale</field>
                        <value name="VALUE">
                          <block type="math_number" id="mn_mg">
                            <field name="NUM">${martingale}</field>
                          </block>
                        </value>
                        <next>
                          <block type="variables_set" id="vs_loss_cnt">
                            <field name="VAR" id="v_loss_cnt">Loss Count</field>
                            <value name="VALUE">
                              <block type="math_number" id="mn_lc">
                                <field name="NUM">0</field>
                              </block>
                            </value>${extraInit}
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>

    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="tdto1">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="${hasPrediction}"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">
          <shadow type="math_number_positive" id="dur1">
            <field name="NUM">1</field>
          </shadow>
        </value>
        <value name="AMOUNT">
          <shadow type="math_number_positive" id="amt1">
            <field name="NUM">${stake}</field>
          </shadow>
          <block type="variables_get" id="vg_stake_sub">
            <field name="VAR" id="v_stake">Stake</field>
          </block>
        </value>${predictionBlock}
      </block>
    </statement>
  </block>

  <block type="before_purchase" id="bp1" deletable="false" x="0" y="900">
    <statement name="BEFOREPURCHASE_STACK">
      ${beforePurchaseStack}
    </statement>
  </block>

  <block type="after_purchase" id="ap1" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="ap_if_tp_sl">
        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>

        <value name="IF0">
          <block type="logic_compare" id="ap_cmp_tp">
            <field name="OP">GTE</field>
            <value name="A">
              <block type="total_profit" id="ap_tp_val"></block>
            </value>
            <value name="B">
              <block type="variables_get" id="ap_vg_tp">
                <field name="VAR" id="v_tp">Take Profit</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="text_print" id="ap_tp_msg">
            <value name="TEXT">
              <shadow type="text" id="ap_tp_shadow">
                <field name="TEXT">Pro AI ${tradeTypeLabel}: Take Profit Hit!</field>
              </shadow>
            </value>
          </block>
        </statement>

        <value name="IF1">
          <block type="logic_compare" id="ap_cmp_sl">
            <field name="OP">GTE</field>
            <value name="A">
              <block type="variables_get" id="ap_vg_lc">
                <field name="VAR" id="v_loss_cnt">Loss Count</field>
              </block>
            </value>
            <value name="B">
              <block type="variables_get" id="ap_vg_sl">
                <field name="VAR" id="v_sl">Stop Loss</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO1">
          <block type="text_print" id="ap_sl_msg">
            <value name="TEXT">
              <shadow type="text" id="ap_sl_shadow">
                <field name="TEXT">Pro AI ${tradeTypeLabel}: Stop Loss Reached.</field>
              </shadow>
            </value>
          </block>
        </statement>

        <statement name="ELSE">
          ${afterPurchaseWinLoss}
        </statement>
      </block>
    </statement>
  </block>

</xml>`;
}

// ─── Adapter: Map TScanSignal to bestSignal structure expected by generateBotXML ───
const mapSignalToBestSignal = (sig: any) => {
  if (!sig) return null;
  const strat = sig.strategy;
  const targetDigit = sig.details.targetDigit;
  let tradeDirection = '';

  if (strat === 'even_odd' || strat === 'pro_even_odd' || strat === 'super') {
    const rec = sig.details.recommendation.toLowerCase();
    if (rec.includes('even')) tradeDirection = 'EVEN';
    else if (rec.includes('odd')) tradeDirection = 'ODD';
  } else if (strat === 'over_under' || strat === 'pro_over_under') {
    const bias = sig.details.signalDetails?.bias;
    const digit = targetDigit ?? 5;
    if (bias === 'high' || sig.details.recommendation.toLowerCase().includes('over')) {
      tradeDirection = `OVER ${digit}`;
    } else {
      tradeDirection = `UNDER ${digit}`;
    }
  } else if (strat === 'under_7') {
    tradeDirection = 'UNDER 7';
  } else if (strat === 'over_2') {
    tradeDirection = 'OVER 2';
  } else if (strat === 'matches') {
    tradeDirection = `MATCHES ${targetDigit ?? 5}`;
  } else if (strat === 'differs' || strat === 'pro_differs') {
    tradeDirection = `DIFFERS ${targetDigit ?? 5}`;
  } else if (strat === 'rise_fall') {
    const trend = sig.details.signalDetails?.trend || (sig.details.recommendation.toLowerCase().includes('rise') ? 'rise' : 'fall');
    tradeDirection = trend.toUpperCase();
  }

  return {
    ...sig.details,
    tradeDirection,
    targetDigit,
    entryDigits: targetDigit !== undefined ? [targetDigit] : [],
  };
};

// ─── Main Scanner Component ────────────────────────────────────────────────────
const Scanner = observer(() => {
  const store = useStore();
  const { scanner } = store;
  const {
    is_open, is_scanning, selected_symbols, current_signal,
    setScannerVisibility, setSelectedSymbols, startScanning, stopScanning,
    selected_strategies, scan_market_mode, single_market_symbol, ticks_counter,
    toggleStrategy, setScanMarketMode, setSingleMarketSymbol,
  } = scanner;

  // ── Local UI state ──
  const [available_symbols, setAvailableSymbols] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'scanner' | 'stats' | 'dollarflipper'>('scanner');
  const [statsStrategy, setStatsStrategy] = useState<'even_odd' | 'over_under' | 'differs' | 'rise_fall' | 'matches'>('even_odd');

  // Prediction picker
  const [predictionChoice, setPredictionChoice] = useState<number | null>(null);

  // Recovery mode
  const [recMode, setRecMode] = useState(false);
  const [recLossThreshold, setRecLossThreshold] = useState('3');
  const [recAltType, setRecAltType] = useState('even_odd');
  const [showRecTypePicker, setShowRecTypePicker] = useState(false);
  const recTypePickerRef = useRef<HTMLDivElement>(null);

  // Bulk trade
  const [bulkCount, setBulkCount] = useState('3');
  const [showBulkPanel, setShowBulkPanel] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (recTypePickerRef.current && !recTypePickerRef.current.contains(e.target as Node)) {
        setShowRecTypePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load available symbols
  useEffect(() => {
    if (api_base.active_symbols && api_base.active_symbols.length > 0) {
      const symbols = api_base.active_symbols.filter((s: any) => {
        const sym = (s.symbol || s.underlying_symbol || '').toUpperCase();
        if (sym.includes('BOOM') || sym.includes('CRASH')) return false;
        if (sym.includes('1HZ15V') || sym.includes('1HZ30V') || sym.includes('1HZ90V')) return false;
        return sym.includes('1HZ') || sym.startsWith('R_') || sym.includes('JD') || sym.includes('JUMP');
      });
      const final = symbols.length > 0 ? symbols : api_base.active_symbols;
      setAvailableSymbols(final);
      if (selected_symbols.length === 0) {
        setSelectedSymbols(final.map((s: any) => s.symbol || s.underlying_symbol));
      }
    }
  }, []);

  // Sync prediction override to store
  useEffect(() => {
    (scanner as any).prediction_override = predictionChoice;
  }, [predictionChoice, scanner]);

  // Sync rec mode to store
  useEffect(() => {
    (scanner as any).rec_mode = recMode;
    (scanner as any).rec_loss_threshold = parseInt(recLossThreshold) || 3;
    (scanner as any).rec_alt_type = recAltType;
  }, [recMode, recLossThreshold, recAltType, scanner]);

  // Custom Bot Loader that loads the precise generated XML directly into Blockly
  const handleLoadBot = async () => {
    const signalToUse = mapSignalToBestSignal(current_signal);
    const entryDigit = predictionChoice ?? signalToUse?.targetDigit ?? undefined;

    const strategyName = current_signal?.strategy || 'even_odd';
    const tradeTypeLabel = STRATEGY_OPTIONS.find(t => t.value === strategyName)?.label ?? strategyName;

    const recovery = recMode
      ? { lossThreshold: parseInt(recLossThreshold, 10) || 3, altTradeTypeId: recAltType }
      : undefined;

    const targetSymbol = current_signal?.symbol || single_market_symbol;

    const xml = generateBotXML({
      stake: scanner.stake.toString(),
      takeProfit: scanner.take_profit.toString(),
      stopLoss: scanner.stop_loss.toString(),
      martingale: scanner.martingale_multiplier.toString(),
      symbol: targetSymbol,
      tradeTypeLabel,
      bestSignal: signalToUse,
      entryDigit,
      recovery,
    });

    try {
      if (typeof window !== 'undefined' && window.Blockly?.derivWorkspace) {
        const name = `ProAI_${tradeTypeLabel.replace(/[\s/]/g, '_')}_${targetSymbol}`;
        const { load_modal, dashboard } = store;
        if (load_modal && dashboard) {
          await load_modal.loadStrategyToBuilder({
            id: name,
            name,
            xml,
            save_type: 'local',
            timestamp: Date.now(),
          });
          dashboard.setActiveTab(1); // Switched directly to Blockly Builder Workspace tab
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load strategy directly to Blockly workspace:', e);
    }
  };

  const handleLoadBotAndRun = async () => {
    await handleLoadBot();
    setTimeout(() => {
      store.run_panel.onRunButtonClick();
    }, 1000);
  };

  const handleLoadBotFromStats = (sym: any, strategy: string, statsData: any, analysis: any) => {
    const symbolKey = sym.symbol || sym.underlying_symbol;
    scanner.current_signal = {
      symbol: symbolKey,
      strategy: strategy as any,
      confidence: statsData.strength / 100,
      timestamp: Date.now(),
      details: {
        type: strategy as any,
        status: 'TRADE NOW',
        probability: statsData.strength / 100,
        recommendation: statsData.text,
        entryCondition: 'Manual trigger from stats tab',
        targetDigit: statsData.details.targetDigit,
        signalDetails: { bias: statsData.details.bias },
      },
      analysisResult: analysis,
    };
    scanner.is_manual_selection = true;
    handleLoadBot();
  };

  // Get auto digit for prediction display
  const autoDigit = (() => {
    if (current_signal?.details?.targetDigit !== undefined) return current_signal.details.targetDigit;
    const strat = current_signal?.strategy || '';
    if (strat === 'over_2') return 2;
    if (strat === 'under_7') return 7;
    return 5;
  })();

  const currentStrategyHasPred = current_signal && PRED_STRATEGIES.has(current_signal.strategy);

  const statusColor = (sig: any) => {
    const c = sig.confidence;
    if (c >= 0.9) return '#10b981';
    if (c >= 0.7) return '#f5c542';
    return '#64748b';
  };

  return (
    <React.Fragment>
      {is_open && (
        <DraggableResizeWrapper
          boundary=".main"
          header={localize('AI Market Scanner')}
          onClose={setScannerVisibility}
          modalWidth={548}
          modalHeight={680}
          minWidth={530}
          minHeight={580}
          enableResizing
        >
          <div className="mhp-scanner">
            {/* ── Tab Bar ── */}
            <div className="mhp-tabs">
              {(['scanner', 'stats', 'dollarflipper'] as const).map(tab => (
                <button
                  key={tab}
                  className={classNames('mhp-tab', { active: activeTab === tab })}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'scanner' ? localize('Scanner') : tab === 'stats' ? localize('Stats') : localize('Dollarflipper')}
                  {activeTab === tab && <span className="mhp-tab-indicator" />}
                </button>
              ))}
            </div>

            {/* ── Scrollable Body ── */}
            <div className="mhp-body">

              {/* ═══════════ SCANNER TAB ═══════════ */}
              {activeTab === 'scanner' && (
                <React.Fragment>
                  {/* Market Selection */}
                  <div className="mhp-card">
                    <div className="mhp-card-header">
                      <span className="mhp-card-title">{localize('Markets')}</span>
                      <div className="mhp-mode-toggle">
                        <button className={classNames('mhp-mode-btn', { active: scan_market_mode === 'multi' })} onClick={() => setScanMarketMode('multi')}>
                          {localize('All Markets')}
                        </button>
                        <button className={classNames('mhp-mode-btn', { active: scan_market_mode === 'single' })} onClick={() => setScanMarketMode('single')}>
                          {localize('Single')}
                        </button>
                      </div>
                    </div>
                    {scan_market_mode === 'single' ? (
                      <select
                        className="mhp-select"
                        value={single_market_symbol}
                        onChange={e => setSingleMarketSymbol(e.target.value)}
                      >
                        {available_symbols.map((sym: any) => (
                          <option key={sym.symbol || sym.underlying_symbol} value={sym.symbol || sym.underlying_symbol}>
                            {sym.display_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mhp-info-text">{localize('Scanning all volatility indices and jump markets')}</p>
                    )}
                  </div>

                  {/* Strategy Selection */}
                  <div className="mhp-card">
                    <span className="mhp-card-title" style={{ marginBottom: 8, display: 'block' }}>
                      {localize('Select Strategies')}
                    </span>
                    <div className="mhp-strategy-grid">
                      {STRATEGY_OPTIONS.map(opt => {
                        const isSelected = selected_strategies.includes(opt.value as any);
                        return (
                          <button
                            key={opt.value}
                            className={classNames('mhp-strategy-chip', { active: isSelected })}
                            onClick={() => toggleStrategy(opt.value as any)}
                          >
                            <span className="mhp-chip-check">{isSelected ? '✓' : ''}</span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Trade Config */}
                  <div className="mhp-card">
                    <span className="mhp-card-title" style={{ marginBottom: 8, display: 'block' }}>
                      {localize('Trade Configuration')}
                    </span>
                    <div className="mhp-grid-2">
                      <div>
                        <label className="mhp-label">{localize('Stake ($)')}</label>
                        <input type="number" className="mhp-input" value={scanner.stake}
                          onChange={e => { scanner.stake = parseFloat(e.target.value) || 0; }} />
                      </div>
                      <div>
                        <label className="mhp-label">{localize('Martingale x')}</label>
                        <input type="number" step="0.1" className="mhp-input" value={scanner.martingale_multiplier}
                          onChange={e => { scanner.martingale_multiplier = parseFloat(e.target.value) || 0; }} />
                      </div>
                      <div>
                        <label className="mhp-label">{localize('Take Profit ($)')}</label>
                        <input type="number" className="mhp-input" value={scanner.take_profit}
                          onChange={e => { scanner.take_profit = parseFloat(e.target.value) || 0; }} />
                      </div>
                      <div>
                        <label className="mhp-label">{localize('Stop Loss (losses)')}</label>
                        <input type="number" className="mhp-input" value={scanner.stop_loss}
                          onChange={e => { scanner.stop_loss = parseFloat(e.target.value) || 0; }} />
                      </div>
                    </div>

                    {/* AI Full Automation */}
                    <div className={classNames('mhp-automation-box', { active: scanner.is_full_ai_automation })}>
                      <div className="mhp-automation-header">
                        <span className="mhp-automation-title">🤖 {localize('AI Full Automation')}</span>
                        <button
                          className={classNames('mhp-auto-badge', { active: scanner.is_full_ai_automation })}
                          onClick={() => scanner.setFullAiAutomation(!scanner.is_full_ai_automation)}
                        >
                          {scanner.is_full_ai_automation ? localize('ACTIVE') : localize('OFF')}
                        </button>
                      </div>
                      {scanner.is_full_ai_automation && (
                        <div className="mhp-automation-info">
                          <span className="mhp-dim">{localize('Auto-Pause Protection')}:</span>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>{localize('Smart Scan Active (< 60% pause)')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prediction Picker — shows if current signal uses digits */}
                  {currentStrategyHasPred && (
                    <div className="mhp-card mhp-pred-card">
                      <div className="mhp-pred-header">
                        <span className="mhp-card-title">🎯 {localize('Set Prediction Digit')}</span>
                        <span className="mhp-pred-auto">
                          {predictionChoice !== null ? `Digit ${predictionChoice} (manual)` : `Auto: ${autoDigit}`}
                        </span>
                      </div>
                      <div className="mhp-digit-grid">
                        {[0,1,2,3,4,5,6,7,8,9].map(d => (
                          <button
                            key={d}
                            className={classNames('mhp-digit-btn', {
                              selected: predictionChoice === d,
                              auto: autoDigit === d && predictionChoice === null,
                            })}
                            onClick={() => setPredictionChoice(predictionChoice === d ? null : d)}
                          >
                            <span className="mhp-digit-lbl">
                              {current_signal?.strategy === 'matches' ? 'MTCH' :
                               current_signal?.strategy === 'differs' ? 'DIFF' :
                               (current_signal?.details?.signalDetails?.bias === 'high' || current_signal?.strategy === 'over_2') ? 'OVER' : 'UNDR'}
                            </span>
                            <span className="mhp-digit-num">{d}</span>
                            {autoDigit === d && predictionChoice === null && <span className="mhp-ai-badge">AI</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recovery Mode */}
                  <div className={classNames('mhp-card mhp-rec-card', { active: recMode })}>
                    <button className="mhp-rec-toggle" onClick={() => { setRecMode(v => !v); }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🔄</span>
                        <span>{localize('Recovery Mode')}</span>
                        {recMode && <span className="mhp-rec-badge">{localize('ON')}</span>}
                      </span>
                      <span className={classNames('mhp-chevron', { open: recMode })}>▾</span>
                    </button>
                    {recMode && (
                      <div className="mhp-rec-body">
                        <div className="mhp-rec-row">
                          <label className="mhp-label">{localize('Trigger after losses')}</label>
                          <input
                            type="number" min={1} max={10}
                            value={recLossThreshold}
                            onChange={e => setRecLossThreshold(e.target.value)}
                            className="mhp-input mhp-input-sm"
                          />
                        </div>
                        <div className="mhp-rec-row">
                          <label className="mhp-label">{localize('Recovery strategy')}</label>
                          <div className="mhp-rec-picker" ref={recTypePickerRef}>
                            <button
                              className="mhp-rec-type-btn"
                              onClick={() => setShowRecTypePicker(v => !v)}
                            >
                              <span>{STRATEGY_OPTIONS.find(s => s.value === recAltType)?.label ?? recAltType}</span>
                              <span className={classNames('mhp-chevron', { open: showRecTypePicker })}>▾</span>
                            </button>
                            {showRecTypePicker && (
                              <div className="mhp-dropdown">
                                {STRATEGY_OPTIONS.map(t => (
                                  <button
                                    key={t.value}
                                    className={classNames('mhp-dropdown-item', { active: recAltType === t.value })}
                                    onClick={() => { setRecAltType(t.value); setShowRecTypePicker(false); }}
                                  >
                                    {t.label}
                                    {recAltType === t.value && <span>✓</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          className="mhp-suggest-btn"
                          onClick={() => setRecAltType(suggestAltType(current_signal?.strategy || '', scanner.signals))}
                        >
                          ✨ {localize('Auto-Suggest Best Recovery Strategy')}
                        </button>
                        <p className="mhp-rec-desc">
                          {STRATEGY_OPTIONS.find(s => s.value === (current_signal?.strategy || 'even_odd'))?.label ?? 'Current'} →{' '}
                          <strong style={{ color: '#f59e0b' }}>{STRATEGY_OPTIONS.find(s => s.value === recAltType)?.label}</strong>{' '}
                          {localize('after')} {recLossThreshold} {localize('losses')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bulk Trade */}
                  <div className="mhp-card">
                    <button className="mhp-rec-toggle" onClick={() => setShowBulkPanel(v => !v)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📈</span>
                        <span>{localize('Bulk Trade')}</span>
                        {showBulkPanel && <span className="mhp-bulk-badge">{bulkCount}x</span>}
                      </span>
                      <span className={classNames('mhp-chevron', { open: showBulkPanel })}>▾</span>
                    </button>
                    {showBulkPanel && (
                      <div className="mhp-rec-body">
                        <div className="mhp-rec-row">
                          <label className="mhp-label">{localize('Number of trades')}</label>
                          <input type="number" min={1} max={20} value={bulkCount}
                            onChange={e => setBulkCount(e.target.value)} className="mhp-input mhp-input-sm" />
                        </div>
                        <button className="mhp-suggest-btn" onClick={() => { setBulkCount(String(Math.max(1, Math.min(20, parseInt(bulkCount) || 3)))); setShowBulkPanel(false); }}>
                          {localize('Queue')} {bulkCount} {localize('Trades')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scan Progress */}
                  <div className="mhp-card mhp-progress-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={classNames('mhp-dot', { scanning: is_scanning })} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                        {is_scanning
                          ? `${localize('Scanning')}... (${ticks_counter}/25)`
                          : localize('Ready to scan')}
                      </span>
                    </div>
                    <div className="mhp-progress-bg">
                      <div className="mhp-progress-fill" style={{ width: is_scanning ? `${(ticks_counter / 25) * 100}%` : '0%' }} />
                    </div>
                  </div>

                  {/* Active Signals */}
                  <div className="mhp-card mhp-signals-card">
                    <span className="mhp-card-title" style={{ marginBottom: 8, display: 'block' }}>
                      {localize('Active Signals')} {scanner.signals.length > 0 && (
                        <span className="mhp-signal-count">{scanner.signals.length}</span>
                      )}
                    </span>
                    {scanner.signals.length === 0 ? (
                      <div className="mhp-empty-signals">
                        <div className="mhp-empty-icon">⚡</div>
                        <p>{is_scanning ? localize('Scanning for opportunities...') : localize('Click Scan to find setups')}</p>
                      </div>
                    ) : (
                      <div className="mhp-signals-list">
                        {scanner.signals.map((sig, idx) => {
                          const isSelected = current_signal && current_signal.symbol === sig.symbol && current_signal.strategy === sig.strategy;
                          const isStrong = sig.confidence >= 0.9;
                          const color = statusColor(sig);
                          return (
                            <div
                              key={idx}
                              className={classNames('mhp-signal-row', { selected: isSelected, strong: isStrong })}
                              onClick={() => {
                                scanner.current_signal = sig;
                                scanner.is_manual_selection = true;
                              }}
                            >
                              <div className="mhp-signal-rank" style={{
                                background: idx === 0 ? 'linear-gradient(135deg,#f5c542,#e67e22)' : idx === 1 ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : idx === 2 ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'rgba(148,163,184,0.3)'
                              }}>
                                {idx + 1}
                              </div>
                              <div className="mhp-signal-info">
                                <div className="mhp-signal-header">
                                  <span className="mhp-signal-symbol">{sig.symbol}</span>
                                  <span className="mhp-signal-strategy">{sig.strategy.replace(/_/g, ' ').toUpperCase()}</span>
                                  <span className="mhp-signal-pct" style={{ color }}>
                                    {(sig.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <p className="mhp-signal-rec">{sig.details.recommendation}</p>
                                <p className="mhp-signal-entry">{localize('Entry')}: {sig.details.entryCondition}</p>
                              </div>
                              {isSelected && <span className="mhp-selected-indicator">✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              )}

              {/* ═══════════ STATS TAB ═══════════ */}
              {activeTab === 'stats' && (
                <div className="mhp-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="mhp-card-title" style={{ marginBottom: 10, display: 'block' }}>
                    {localize('Market Statistics')}
                  </span>
                  <div className="mhp-stats-strategy-row">
                    {[
                      { key: 'even_odd', label: 'Even/Odd' },
                      { key: 'over_under', label: 'Over/Under' },
                      { key: 'differs', label: 'Differs' },
                      { key: 'rise_fall', label: 'Rise/Fall' },
                      { key: 'matches', label: 'Matches' },
                    ].map(btn => (
                      <button
                        key={btn.key}
                        onClick={() => setStatsStrategy(btn.key as any)}
                        className={classNames('mhp-stats-btn', { active: statsStrategy === btn.key })}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="mhp-stats-table">
                      <thead>
                        <tr>
                          <th>{localize('Index')}</th>
                          <th>{localize('Price')}</th>
                          <th style={{ textAlign: 'center' }}>{localize('Digit')}</th>
                          <th style={{ textAlign: 'right' }}>{localize('Stats')}</th>
                          <th style={{ textAlign: 'right' }}>{localize('Action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...available_symbols]
                          .map((sym: any) => {
                            const key = sym.symbol || sym.underlying_symbol;
                            const analysis = scanner.symbol_analysis[key];
                            const statsData = getStatsForStrategy(analysis, statsStrategy);
                            return { sym, key, analysis, statsData };
                          })
                          .sort((a, b) => b.statsData.strength - a.statsData.strength)
                          .map(({ sym, key, analysis, statsData }) => (
                            <tr key={key}>
                              <td style={{ fontWeight: 600, color: '#cbd5e1' }}>{sym.display_name.replace('Index', '')}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                {analysis ? analysis.lastQuote.toFixed(sym.display_name.includes('1s') ? 2 : 4) : '…'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {analysis && analysis.lastDigits.length > 0 ? (
                                  <span className="mhp-digit-badge">
                                    {analysis.lastDigits[analysis.lastDigits.length - 1]}
                                  </span>
                                ) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', color: '#f5c542', fontWeight: 700, fontSize: 11 }}>
                                {statsData.text}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {analysis ? (
                                  <button
                                    className="mhp-load-mini-btn"
                                    onClick={() => handleLoadBotFromStats(sym, statsStrategy, statsData, analysis)}
                                  >
                                    {localize('Load')}
                                  </button>
                                ) : <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>-</span>}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ═══════════ DOLLARFLIPPER TAB ═══════════ */}
              {activeTab === 'dollarflipper' && (
                <div className="mhp-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="mhp-card-title" style={{ color: '#10b981', fontSize: 14 }}>
                      💰 {localize('Dollarflipper Challenge')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f5c542' }}>
                      ${Number(store.client.balance || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="mhp-grid-2">
                    <div>
                      <label className="mhp-label">{localize('Target Profit ($)')}</label>
                      <input type="number" className="mhp-input"
                        value={store.dollarflipper.target_profit}
                        onChange={e => store.dollarflipper.setTargetProfit(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="mhp-label">{localize('Stake % of Capital')}</label>
                      <select className="mhp-select"
                        value={store.dollarflipper.stake_percentage}
                        onChange={e => store.dollarflipper.setStakePercentage(parseFloat(e.target.value) || 2)}>
                        {[2, 3, 4, 5].map(v => <option key={v} value={v}>{v}%</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mhp-label">{localize('Challenge Days')}</label>
                      <input type="number" className="mhp-input"
                        value={store.dollarflipper.challenge_days}
                        onChange={e => store.dollarflipper.setChallengeDays(parseInt(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label className="mhp-label">{localize('Sessions / Day')}</label>
                      <select className="mhp-select"
                        value={store.dollarflipper.sessions_per_day}
                        onChange={e => store.dollarflipper.setSessionsPerDay(parseInt(e.target.value) || 1)}>
                        <option value="1">1 Session</option>
                        <option value="2">2 Sessions</option>
                        <option value="3">3 Sessions</option>
                        <option value="4">4 Sessions</option>
                        <option value="24">24hrs (Continuous)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mhp-df-progress-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{localize('Completed Sessions:')}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                        {store.dollarflipper.completed_sessions} / {store.dollarflipper.challenge_days * store.dollarflipper.sessions_per_day}
                      </span>
                    </div>
                    <div className="mhp-progress-bg">
                      <div className="mhp-progress-fill mhp-progress-green" style={{
                        width: `${Math.min(100, (store.dollarflipper.completed_sessions / (store.dollarflipper.challenge_days * store.dollarflipper.sessions_per_day)) * 100)}%`
                      }} />
                    </div>
                  </div>

                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginTop: 'auto' }}>
                    {localize('Note: Dollarflipper automatically limits trades to Over (1,2,3) and Under (6,7,8) predictions.')}
                  </p>

                  <button
                    className={classNames('mhp-df-btn', { running: store.dollarflipper.is_running })}
                    onClick={() => store.dollarflipper.is_running ? store.dollarflipper.stopDollarflipper() : store.dollarflipper.startDollarflipper()}
                  >
                    {store.dollarflipper.is_running ? localize('Stop Dollarflipper') : localize('Start Compounding Challenge')}
                  </button>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="mhp-footer">
              <button className="mhp-btn mhp-btn-scan" onClick={is_scanning ? stopScanning : startScanning}>
                {is_scanning ? localize('Stop') : localize('Scan')}
              </button>
              <button className="mhp-btn mhp-btn-load" onClick={handleLoadBot} disabled={!current_signal}>
                {localize('Load Bot')}
              </button>
              <button className="mhp-btn mhp-btn-run" onClick={handleLoadBotAndRun} disabled={!current_signal}>
                {localize('Load & Run')}
              </button>
            </div>
          </div>
        </DraggableResizeWrapper>
      )}
    </React.Fragment>
  );
});

export default Scanner;

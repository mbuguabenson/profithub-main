export interface HostAuthPayload {
  active_loginid: string;
  token: string;
  currency: string;
  accountsList: Record<string, { token: string; currency: string }>;
}

export type HostMessageType =
  | 'INIT_AUTH'
  | 'ACCOUNT_CHANGED'
  | 'THEME_CHANGED'
  | 'IFRAME_READY';

export type ChildMessageType =
  | 'IFRAME_READY'
  | 'TRADE_EXECUTED'
  | 'REQUEST_REAUTH';

export interface HostMessage {
  type: HostMessageType;
  payload?: HostAuthPayload | { theme: 'dark' | 'light' } | unknown;
}

export interface ChildMessage {
  type: ChildMessageType;
  payload?: unknown;
}

export type AuthSyncHandler = (payload: HostAuthPayload) => void;
export type ThemeHandler = (theme: 'dark' | 'light') => void;

const PARENT_ORIGIN = '*';

class ChildAuthManager {
  private authHandler: AuthSyncHandler | null = null;
  private themeHandler: ThemeHandler | null = null;
  private ready = false;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as HostMessage;
      if (!data || !data.type) return;

      switch (data.type) {
        case 'INIT_AUTH':
        case 'ACCOUNT_CHANGED': {
          const payload = data.payload as HostAuthPayload;
          if (payload?.token) {
            this.authHandler?.(payload);
          }
          break;
        }
        case 'THEME_CHANGED': {
          const payload = data.payload as { theme: 'dark' | 'light' };
          if (payload?.theme) {
            this.themeHandler?.(payload.theme);
          }
          break;
        }
        default:
          break;
      }
    });
  }

  onAuthSync(handler: AuthSyncHandler) {
    this.authHandler = handler;
  }

  onThemeChange(handler: ThemeHandler) {
    this.themeHandler = handler;
  }

  signalReady() {
    if (this.ready) return;
    this.ready = true;
    window.parent.postMessage({ type: 'IFRAME_READY' }, PARENT_ORIGIN);
  }

  notifyTradeExecuted(contractData: unknown) {
    window.parent.postMessage(
      { type: 'TRADE_EXECUTED', payload: contractData },
      PARENT_ORIGIN
    );
  }

  requestReauth() {
    window.parent.postMessage({ type: 'REQUEST_REAUTH' }, PARENT_ORIGIN);
  }
}

export const childAuthManager = new ChildAuthManager();

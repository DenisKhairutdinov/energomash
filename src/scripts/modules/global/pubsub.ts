export type EventName =
  | 'join-modal: open-request'
  | 'join-modal: close'
  | 'policy-modal: open-request'
  | 'policy-modal: close'
  | 'rules-modal: open-request'
  | 'rules-modal: close'
  | 'request-modal: open-request'
  | 'request-modal: close'
  | 'request-modal: submit'
  | 'request-form: submit'
  | 'success-modal: open-request'
  | 'success-modal: close';

// Что показывает окно заявки: расчёт стоимости модели, обратный звонок или вопрос в свободной форме
export type RequestKind = 'price' | 'call' | 'contact';

export interface RequestModalPayload {
  kind: RequestKind;
  model?: string;
}

// Поля формы заявки как есть: имя поля → значение
export type RequestFormData = Record<string, string>;

// Окно подтверждения: без данных показывает обычный текст, с данными — свой заголовок и текст
export interface SuccessModalPayload {
  title?: string;
  text?: string;
}

// Данные событий, у которых они есть. У остальных событий данных нет
interface EventPayloads {
  'success-modal: open-request': SuccessModalPayload;
  'request-modal: open-request': RequestModalPayload;
  'request-modal: submit': RequestFormData;
  'request-form: submit': RequestFormData;
}

type PayloadOf<Event extends EventName> = Event extends keyof EventPayloads
  ? EventPayloads[Event]
  : unknown;

type Handler = (payload: never) => void;

const events = new Map<EventName, Handler[]>();

export const pubSub = {
  subscribe<Event extends EventName>(event: Event, handler: (payload: PayloadOf<Event>) => void) {
    const handlers = events.get(event) ?? [];

    handlers.push(handler);
    events.set(event, handlers);
  },
  publish<Event extends EventName>(event: Event, payload?: PayloadOf<Event>) {
    const handlers = events.get(event) ?? [];

    for (const handle of handlers) {
      handle(payload as never);
    }
  },
};

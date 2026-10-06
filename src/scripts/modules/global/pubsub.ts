export type EventName =
  | 'join-modal: open-request'
  | 'join-modal: close'
  | 'policy-modal: open-request'
  | 'policy-modal: close'
  | 'rules-modal: open-request'
  | 'rules-modal: close';

export const pubSub = {
  events: {} as Record<EventName, Array<(payload: unknown) => void>>,
  subscribe(event: EventName, handler: (payload: unknown) => void) {
    (this.events[event] ??= []).push(handler);
  },
  publish(event: EventName, payload?: unknown) {
    const handlers = this.events[event] || [];
    for (const handle of handlers) {
      handle(payload);
    }
  },
};

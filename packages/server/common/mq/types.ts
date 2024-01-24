import type { Channel } from 'amqplib';

export interface MQContext {
  channel: Channel | null;
}

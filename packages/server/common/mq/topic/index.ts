import { getLogger } from '@/common/logger';
import { MQContext } from '../types';
import { safeStringify, toErrString } from '@/common/utils';

export class TopicClient {
  static EXCHANGE_NAME = 'topic';

  ready = false;

  private _ctx: MQContext;
  private _exchange = '';
  private _queue = '';
  private _consumerTag = '';
  // msg type => callback
  private _callbacks = new Map<string, TopicMsgCallback>();
  // TODO: not a elegant impl
  private _topics = new Set<string>();

  constructor(ctx: MQContext) {
    this._ctx = ctx;
  }

  static async init(ctx: MQContext) {
    const client = new TopicClient(ctx);
    await client.init();
    return client;
  }

  async init() {
    const channel = this._ctx.channel;
    if (channel === null) {
      throw new Error('channel is null');
    }

    const { exchange } = await channel.assertExchange(
      TopicClient.EXCHANGE_NAME,
      'topic',
      {
        durable: false,
        autoDelete: false,
      },
    );
    this._exchange = exchange;
    getLogger()?.info(`exchange: ${this._exchange}`);

    const { queue } = await channel.assertQueue('', {
      durable: false,
      autoDelete: true,
    });
    this._queue = queue;
    getLogger()?.info(`queue: ${this._queue}`);

    this.ready = true;
  }

  async start() {
    if (!this.ready) {
      getLogger()?.error('not ready');
      return;
    }

    const channel = this._ctx.channel;
    if (channel === null) {
      getLogger()?.error('channel is null');
      return;
    }

    if (this._consumerTag !== '') {
      getLogger()?.error(`already consuming: consumerTag=${this._consumerTag}`);
      return;
    }

    const { consumerTag } = await channel.consume(
      this._queue,
      (rawMsg) => {
        try {
          if (rawMsg === null) {
            getLogger()?.warn('msg: null');
          } else {
            getLogger()?.debug(`consume: msg=${rawMsg.content.toString()}`);
            const msg = JSON.parse(rawMsg.content.toString()) as TopicMsg;
            this._callbacks.forEach((cb, type) => {
              if (type === msg.type) {
                cb(msg.data);
              }
            });
          }
        } catch (e) {
          getLogger()?.error(`consume error: toErrString(e)`);
        }
      },
      { noAck: true },
    );
    this._consumerTag = consumerTag;
    getLogger()?.info(`consume: consumerTag=${consumerTag}`);
  }

  /**
   * @param topic msg sub pattern
   * @param type msg type can process
   * @param callback
   * @returns
   */
  async sub<T>(topic: string, type: string, callback: TopicMsgCallback<T>) {
    if (!this.ready || this._ctx.channel === null) return;

    // call with same params will change nothing in rqbbitmq
    const channel = this._ctx.channel;
    await channel.bindQueue(this._queue, TopicClient.EXCHANGE_NAME, topic);
    getLogger()?.info(`bind queue=${this._queue} with routing key=${topic}`);

    // TODO: only allow one callback for each `type`
    if (this._callbacks.has(type)) {
      getLogger()?.warn(`previous callback remove: type=${type}`);
    }
    this._callbacks.set(type, callback);
    this._topics.add(topic);
  }

  async pub(topic: string, msg: TopicMsg) {
    if (this._ctx.channel === null) return;
    const channel = this._ctx.channel;

    getLogger()?.debug(`pub: topic=${topic} msg=${safeStringify(msg)}`);
    try {
      channel.publish(
        TopicClient.EXCHANGE_NAME,
        topic,
        Buffer.from(JSON.stringify(msg)),
      );
    } catch (e) {
      getLogger()?.error(`pub error: ${toErrString(e)}`);
    }
  }

  async stop() {
    try {
      await this._ctx.channel?.cancel(this._consumerTag);
    } catch (e) {
      getLogger()?.warn(`stop consuming error: ${toErrString(e)}`);
    }
  }

  async close() {
    try {
      this._topics.forEach(
        async (topic) =>
          await this._ctx.channel?.unbindQueue(
            this._queue,
            TopicClient.EXCHANGE_NAME,
            topic,
          ),
      );
      await this.stop();
    } catch (e) {
      getLogger()?.warn(`close error: ${toErrString(e)}`);
    }
  }
}

///////////
// Types //
///////////
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopicMsg<T = any> = {
  type: string;
  data: T;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopicMsgCallback<T = any> = (data: T) => void;

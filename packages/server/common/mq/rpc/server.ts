import { getLogger } from '@/common/logger';
import { MQContext } from '../types';
import { RPCServerMethods, RPCReq } from './types';
import { rpcInvalidMethod, rpcFail } from './utils';
import { toErrMessage, toErrString } from '@/common/utils';

export class RPCServer {
  private _ctx: MQContext;
  private _name: string;
  private _consumerTag: string | null = null;

  constructor(name: string, ctx: MQContext) {
    this._name = name;
    this._ctx = ctx;
  }

  static async init(name: string, ctx: MQContext, methods: RPCServerMethods) {
    const server = new RPCServer(name, ctx);
    await server.init(methods);
    return server;
  }

  async init(methods: RPCServerMethods) {
    const channel = this._ctx.channel;
    if (channel === null) {
      throw new Error('channel is null');
    }

    await channel.assertQueue(this._name, {
      durable: false,
      autoDelete: true,
    });
    getLogger()?.info(`queue: ${this._name}`);

    const { consumerTag } = await channel.consume(this._name, async (msg) => {
      try {
        if (msg === null) {
          getLogger()?.warn('msg: null');
        } else {
          // check corrID
          const corrID = msg.properties.correlationId;
          if (!corrID) {
            getLogger()?.warn(`no corrID`);
            return;
          }
          // check replyQueue
          const replyQueue = msg.properties.replyTo;
          if (!replyQueue) {
            getLogger()?.warn(`no replyQueue`);
            return;
          }
          const req = JSON.parse(msg.content.toString()) as RPCReq;
          const methodFunc = methods[req.method];
          const curChannel = this._ctx.channel;
          if (curChannel === null) {
            getLogger()?.warn(`channel becomes null`);
            return;
          }
          if (!methodFunc) {
            getLogger()?.error(`no method: ${req.method}`);
            const res = rpcInvalidMethod();
            curChannel.sendToQueue(
              replyQueue,
              Buffer.from(JSON.stringify(res)),
              { correlationId: corrID },
            );
            return;
          }
          // execute method
          try {
            const res = await methodFunc(req.body);
            curChannel.sendToQueue(
              replyQueue,
              Buffer.from(JSON.stringify(res)),
              { correlationId: corrID },
            );
          } catch (e) {
            getLogger()?.error(`exec method err: ${toErrString(e)}`);
            const res = rpcFail(toErrMessage(e));
            curChannel.sendToQueue(
              replyQueue,
              Buffer.from(JSON.stringify(res)),
              { correlationId: corrID },
            );
          }
        }
      } catch (e) {
        getLogger()?.error(`consume err: ${toErrString(e)}`);
      }
    });
    this._consumerTag = consumerTag;
  }

  async close() {
    try {
      const channel = this._ctx.channel;
      // stop consuming
      if (channel && this._consumerTag) {
        await channel.cancel(this._consumerTag);
      }
    } catch (e) {
      getLogger()?.error(`close err: ${toErrString(e)}`);
    }
  }
}

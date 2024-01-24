import { connect } from 'amqplib';
import type { Channel, Connection } from 'amqplib';
import { TopicClient } from './topic';
import { RPCClient } from './rpc/client';
import { RPCServer } from './rpc/server';
import { RPCServerMethods, WrapRPCRes } from './rpc/types';

interface MQManagerConfig {
  url: string;
  username?: string;
  password?: string;
}

class MQManager {
  // mq basic
  private _connection: Connection | null = null;
  private _channel: Channel | null = null;
  // mq class
  private _rpcClient: RPCClient | null = null;
  private _rpcServer: RPCServer | null = null;
  private _topicClient: TopicClient | null = null;

  static async init(config: MQManagerConfig): Promise<MQManager> {
    const manager = new MQManager();
    await manager._connect(config);
    return manager;
  }

  private async _connect(config: MQManagerConfig) {
    if (this._channel) return;

    this._connection = await connect(config);
    this._channel = await this._connection.createChannel();
  }

  async rpcClient(): Promise<RPCClient> {
    if (this._rpcClient) return this._rpcClient;

    this._rpcClient = await RPCClient.init(this);
    return this._rpcClient;
  }

  async rpcServer<T extends RPCServerMethods>(
    name: string,
    methods: WrapRPCRes<T>,
  ): Promise<RPCServer> {
    if (this._rpcServer) return this._rpcServer;

    this._rpcServer = await RPCServer.init(name, this, methods);
    return this._rpcServer;
  }

  async topicClient() {
    if (this._topicClient) return this._topicClient;

    this._topicClient = await TopicClient.init(this);
    return this._topicClient;
  }

  get channel() {
    return this._channel;
  }
}

export default MQManager;

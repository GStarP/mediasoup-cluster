import { TopicClient } from '@/common/mq/topic';
import { GetLoadFunc } from './types';

export class ClusterWorker {
  clusterName: string;
  private _topClient: TopicClient;
  private _getLoad: GetLoadFunc;

  constructor(
    clusterName: string,
    topicClient: TopicClient,
    getLoad: GetLoadFunc,
  ) {
    this.clusterName = clusterName;
    this._topClient = topicClient;
    this._getLoad = getLoad;
  }

  joinCluster() {
    this.reportLoad(true);
    setInterval(() => {
      this.reportLoad(false);
    }, 3000);
  }

  async reportLoad(isFirst: boolean) {
    this._topClient.pub(this.clusterName, {
      type: 'load',
      data: await this._getLoad(isFirst),
    });
  }
}

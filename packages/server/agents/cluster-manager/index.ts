import MQManager from '@/common/mq'
import config from './config.json'
import { type ClusterMangerPRCMethods, CM_RPC_SERVER_NAME } from './rpc.type'
import { createLogger } from '@/common/logger'
import { rpcFail, rpcSuccess } from '@/common/mq/rpc/utils'
import type { MediaServerLoad, MediaAgentLoad } from './cluster.type'
import { MEDIA_CLUSTER_NAME } from '@/agents/media/cluster.type'
import { v4 } from 'uuid'
import { PortalReqType } from '@shared/portal.type'

async function runClusterManager() {
  const uuid = `cluster-manager@${v4()}`
  const logger = createLogger(uuid)

  // media server name => media server load
  const mediaAgentLoads: Map<string, MediaServerLoad> = new Map()

  /**
   * MQ
   */
  const mqManager = await MQManager.init(config.mq)
  await mqManager.rpcServer<ClusterMangerPRCMethods>(CM_RPC_SERVER_NAME, {
    [PortalReqType.ALLOC_MEDIA]: async ({ type }) => {
      if (mediaAgentLoads.size === 0) {
        return rpcFail('none media agent')
      }
      // TODO: use the first matched router
      for (const [, load] of mediaAgentLoads) {
        for (const [rid, wl] of load.workers) {
          if (wl.type === type) {
            logger.info(`alloc media: server=${load.server} routerId=${rid}`)
            return rpcSuccess({
              sid: load.server,
              rid,
              rtp: wl.rtp,
            })
          }
        }
      }

      return rpcFail('no available media agent')
    },
  })

  const topicClient = await mqManager.topicClient()
  // TODO: need type strategy like rpc
  await topicClient.sub<MediaAgentLoad>(MEDIA_CLUSTER_NAME, 'load', (load) => {
    const preLoad = mediaAgentLoads.get(load.server)
    const workers: MediaServerLoad['workers'] = preLoad?.workers ?? new Map()
    for (const wl of load.workers) {
      // set complete worker load
      if ('type' in wl && 'rtp' in wl) {
        workers.set(wl.rid, wl)
      }
      // update using partial worker load
      else {
        const preWl = workers.get(wl.rid)
        if (preWl) {
          preWl.item = wl.item
          preWl.conn = wl.conn
        }
      }
    }
    mediaAgentLoads.set(load.server, {
      server: load.server,
      sys: load.sys,
      workers,
    })
  })
  await topicClient.start()

  logger.info('running')
}

runClusterManager()

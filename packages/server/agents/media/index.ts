import { v4 } from 'uuid'
import MQManager from '@/common/mq'
import config from './config.json'
import type { Worker } from 'mediasoup/node/lib/types'
import { createLogger } from '@/common/logger'
import { cpus } from 'os'
import { createWorker, getSupportedRtpCapabilities } from 'mediasoup'
import { RouterAppData, MediaWorkerType, WorkerAppData } from './index.type'
import { routerOptions } from './options'
import { numberReserve, safeStringify } from '@/common/utils'
import { ClusterWorker } from '@/common/cluster/worker'
import type { MediaAgentLoad } from '@/agents/cluster-manager/cluster.type'
import { currentLoad, mem } from 'systeminformation'
import { MEDIA_CLUSTER_NAME } from './cluster.type'
import type { MediaServerPRCMethods } from './rpc.type'
import { PortalReqType } from '@shared/portal.type'
import { rpcFail, rpcSuccess } from '@/common/mq/rpc/utils'

async function runMediaAgent() {
  const uuid = `media@${v4()}`
  const logger = createLogger(uuid)

  /**
   * Mediasoup
   */
  logger.debug(
    `mediasoup support: ${safeStringify(getSupportedRtpCapabilities())}`,
  )
  // routerId => worker
  const workers: Map<string, Worker<WorkerAppData>> = new Map()
  // TODO: ignore portRange[1]
  let port = config.portRange[0]
  for (let i = 0; i < cpus().length; i++) {
    // create producer worker first
    const type =
      i < config.producerWorkerNum
        ? MediaWorkerType.PRODUCER
        : MediaWorkerType.CONSUMER

    logger.info(`create worker: index=${i} type=${type}`)
    const worker = await createWorker<WorkerAppData>({
      logLevel: 'debug',
      appData:
        type === MediaWorkerType.PRODUCER
          ? {
              type,
              transports: new Map(),
              producers: new Map(),
            }
          : {
              type,
              transports: new Map(),
              consumers: new Map(),
            },
    })

    logger.info(
      `create webrtc server: listenIP=${config.listenIP} announcedIP=${config.announcedIP} port=${port}`,
    )
    const webRtcServer = await worker.createWebRtcServer({
      listenInfos: [
        {
          protocol: 'udp',
          ip: config.listenIP,
          announcedIp: config.announcedIP,
          port: port,
        },
        {
          protocol: 'tcp',
          ip: config.listenIP,
          announcedIp: config.announcedIP,
          port: port,
        },
      ],
    })
    port++
    worker.appData.webRtcServer = webRtcServer

    const router = await worker.createRouter<RouterAppData>({
      ...routerOptions,
      appData: {
        // ! all things store in worker, router only hold a reference to worker
        worker,
      },
    })
    worker.appData.router = router

    workers.set(router.id, worker)
    logger.info(`worker created: id=${worker.appData.router.id}`)
  }

  /**
   * MQ
   */
  const mqManager = await MQManager.init(config.mq)
  const topicClient = await mqManager.topicClient()
  await mqManager.rpcServer<MediaServerPRCMethods>(uuid, {
    [PortalReqType.CREATE_SEND_TRANSPORT]: async ({ uid, rid }) => {
      logger.info(`CREATE_SEND_TRANSPORT: uid=${uid} rid=${rid}`)

      const worker = workers.get(rid)
      if (!worker || !worker.appData.webRtcServer || !worker.appData.router) {
        const missingItem = worker
          ? worker.appData.webRtcServer
            ? worker.appData.router
              ? ''
              : 'router'
            : 'webRtcServer'
          : 'worker'
        logger.error(`${missingItem} not ready`)
        return rpcFail(`worker not ready: ${rid}`)
      }

      const transport = await worker.appData.router.createWebRtcTransport({
        webRtcServer: worker.appData.webRtcServer,
        enableUdp: true,
        enableTcp: true,
      })
      worker.appData.transports.set(uid, transport)

      return rpcSuccess({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      })
    },

    [PortalReqType.CONNECT_TRANSPORT]: async ({ uid, rid, tid, dtls }) => {
      logger.info(`CONNECT_TRANSPORT: uid=${uid} rid=${rid} tid=${tid}`)

      const worker = workers.get(rid)
      if (!worker) return rpcFail(`worker not ready: ${rid}`)

      const transport = worker.appData.transports.get(uid)
      if (!transport || transport.id !== tid) {
        return rpcFail(`no such transport: ${tid}`)
      }

      await transport.connect({ dtlsParameters: dtls })

      return rpcSuccess(undefined)
    },

    [PortalReqType.CREATE_PRODUCER]: async ({ uid, rid, tid, kind, rtp }) => {
      logger.info(
        `CREATE_PRODUCER: uid=${uid} rid=${rid} tid=${tid} kind=${kind}`,
      )

      const worker = workers.get(rid)
      if (!worker || worker.appData.type !== MediaWorkerType.PRODUCER)
        return rpcFail(`worker not ready: ${rid}`)

      const transport = worker.appData.transports.get(uid)
      if (!transport || transport.id !== tid) {
        return rpcFail(`no such transport: ${tid}`)
      }

      const producer = await transport.produce({
        kind,
        rtpParameters: rtp,
      })
      worker.appData.producers.set(producer.id, producer)

      return rpcSuccess(producer.id)
    },
  })

  /**
   * Cluster
   */
  async function getLoad(isFirst: boolean) {
    const { currentLoad: cpu } = await currentLoad()
    const { total, used } = await mem()
    const load: MediaAgentLoad = {
      server: uuid,
      sys: {
        cpu: numberReserve(cpu * 100, 2),
        mem: numberReserve((used / total) * 100, 2),
      },
      workers: [],
    }
    for (const [routerId, worker] of workers) {
      load.workers.push({
        // type and rtp will not change any more
        type: isFirst ? worker.appData.type : undefined,
        rtp: isFirst ? worker.appData.router?.rtpCapabilities : undefined,
        // rid is needed for locating
        rid: routerId,
        conn: worker.appData.transports.size,
        item:
          worker.appData.type === MediaWorkerType.PRODUCER
            ? worker.appData.producers.size
            : worker.appData.consumers.size,
      })
    }
    return load
  }
  const clusterWorker = new ClusterWorker(
    MEDIA_CLUSTER_NAME,
    topicClient,
    getLoad,
  )
  clusterWorker.joinCluster()
}

runMediaAgent()

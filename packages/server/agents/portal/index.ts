import { v4 } from 'uuid'
import { createLogger } from '@/common/logger'
import { Server } from 'socket.io'
import config from './config.json'
import {
  PortalClientEmitMap,
  PortalNotificationType,
  PortalReqType,
  PortalServerEmitMap,
} from '@shared/portal.type'
import type { DefaultEventsMap } from 'socket.io/dist/typed-events'
import type { SocketData } from './index.type'
import { createServer } from 'http'
import MQManager from '@/common/mq'
import { CM_RPC_SERVER_NAME } from '@/agents/cluster-manager/rpc.type'

async function runPortal() {
  const uuid = `portal@${v4()}`
  const logger = createLogger(uuid)

  /**
   * RPC
   */
  const mqManager = await MQManager.init(config.mq)
  const rpcClient = await mqManager.rpcClient()

  /**
   * WS
   */
  const httpServer = createServer()
  const io = new Server<
    PortalClientEmitMap,
    PortalServerEmitMap,
    DefaultEventsMap,
    SocketData
  >(httpServer, {
    cors: {
      origin: '*',
    },
  })

  io.on('connection', (socket) => {
    const channel = socket.handshake.auth['channel']
    if (typeof channel !== 'string') {
      socket.disconnect(true)
      logger.error(`missing channel: ${channel}`)
      return
    }

    try {
      const uid = v4()
      socket.data.uid = uid
      socket.data.channel = channel
      socket.emit(PortalNotificationType.JOIN_SUCCESS, uid)
      logger.info(`socket connected: channel=${channel} uid=${uid}`)
    } catch (e) {
      socket.disconnect(true)
      logger.error(e)
    }

    socket.on(PortalReqType.ALLOC_MEDIA, async (type, callback) => {
      logger.info(`alloc media: uid=${socket.data.uid}`)
      const res = await rpcClient.request(
        CM_RPC_SERVER_NAME,
        PortalReqType.ALLOC_MEDIA,
        {
          type,
          uid: socket.data.uid,
        },
      )
      // TODO: error handling
      callback({ code: 0, data: res })
      logger.info(`alloc media: server=${res.sid} rid=${res.rid}`)
    })

    socket.on(
      PortalReqType.CREATE_SEND_TRANSPORT,
      async (server, rid, callback) => {
        logger.info(`create send transport: server=${server} rid=${rid}`)
        const res = await rpcClient.request(
          server,
          PortalReqType.CREATE_SEND_TRANSPORT,
          {
            uid: socket.data.uid,
            rid,
          },
        )
        // TODO: error handling
        callback({ code: 0, data: res })
      },
    )

    socket.on(
      PortalReqType.CONNECT_TRANSPORT,
      async (sid, rid, tid, dtls, callback) => {
        logger.info(`connect transport: sid=${sid} rid=${rid} tid=${tid}`)
        const res = await rpcClient.request(
          sid,
          PortalReqType.CONNECT_TRANSPORT,
          {
            uid: socket.data.uid,
            rid,
            tid,
            dtls,
          },
        )
        // TODO: error handling
        callback({ code: 0, data: res })
      },
    )

    socket.on(
      PortalReqType.CREATE_PRODUCER,
      async (sid, rid, tid, kind, rtp, callback) => {
        logger.info(
          `create producer: sid=${sid} rid=${rid} tid=${tid} kind=${kind}`,
        )
        const res = await rpcClient.request(
          sid,
          PortalReqType.CREATE_PRODUCER,
          {
            uid: socket.data.uid,
            rid,
            tid,
            kind,
            rtp,
          },
        )
        // TODO: error handling
        callback({ code: 0, data: res })
      },
    )

    // broadcast user-publish to all other users in the same channel
    // TODO: similar forwarding may have easier way
    socket.on(PortalNotificationType.USER_PUBLISH, async (payload) => {
      logger.info(`forward USER_PUBLISH: ${JSON.stringify(payload)}`)
      const sockets = await io.fetchSockets()
      for (const sc of sockets) {
        if (
          sc.data.channel === payload.channel &&
          sc.data.uid !== payload.uid
        ) {
          sc.emit(PortalNotificationType.USER_PUBLISH, payload)
        }
      }
    })

    socket.on(
      PortalReqType.CREATE_RECV_TRANSPORT,
      async (server, rid, callback) => {
        logger.info(`create recv transport: server=${server} rid=${rid}`)
        const res = await rpcClient.request(
          server,
          PortalReqType.CREATE_RECV_TRANSPORT,
          {
            uid: socket.data.uid,
            rid,
          },
        )
        // TODO: error handling
        callback({ code: 0, data: res })
      },
    )

    socket.on(
      PortalReqType.CREATE_CONSUMER,
      async (sid, rid, tid, pid, rtp, ssid, srid, callback) => {
        logger.info(
          `create consumer: sid=${sid} rid=${rid} tid=${tid} pid=${pid}`,
        )
        const res = await rpcClient.request(
          sid,
          PortalReqType.CREATE_CONSUMER,
          {
            uid: socket.data.uid,
            rid,
            tid,
            pid,
            rtp,
            ssid,
            srid,
          },
        )
        // TODO: error handling
        callback({ code: 0, data: res })
      },
    )
  })

  io.listen(config.port)
  logger.info(`listening on ${config.port}`)
}

runPortal()

import { io } from 'socket.io-client'
import {
  ClientSocket,
  ClientStatus,
  ProduceMediaWorker,
  PublishOptions,
} from './client.type'
import { PortalNotificationType, PortalReqType } from '@shared/portal.type'
import { PublishError } from './error'
import { Device } from 'mediasoup-client'

class MCSClient {
  static PORTAL_URL = 'ws://localhost:8080'

  status = ClientStatus.IDLE

  private options = {
    timeout: 10 * 1000,
  }
  private socket: ClientSocket | null = null
  // server_rid => MediaWorker
  private produceWorkers: Map<string, ProduceMediaWorker> = new Map()

  async join(channel: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.debug(`join: url=${MCSClient.PORTAL_URL} channel=${channel}`)
      this.socket = io(MCSClient.PORTAL_URL, {
        auth: {
          channel,
        },
        ackTimeout: this.options.timeout,
      })

      this.socket.once(PortalNotificationType.JOIN_SUCCESS, (uid) => {
        console.debug(`JOIN_SUCCESS: ${uid}`)
        this.status = ClientStatus.JOINED
        resolve(uid)
      })

      this.socket.on('connect_error', (err) => {
        this.status = ClientStatus.IDLE
        reject(err)
      })

      this.socket.on('disconnect', (reason) => {
        this.status = ClientStatus.IDLE
        reject(new Error(reason))
      })
    })
  }

  async publish(options: PublishOptions) {
    console.debug(`publish:`, options)
    if (this.status === ClientStatus.IDLE || this.socket === null) {
      throw new Error(PublishError.INVALID_OPERATION)
    }

    if (this.status === ClientStatus.PUBLISHING) return
    this.status = ClientStatus.PUBLISHING

    try {
      const allocMediaRes = await this.socket.emitWithAck(
        PortalReqType.ALLOC_MEDIA,
      )
      if (allocMediaRes.code !== 0) return
      const { sid, rid, rtp } = allocMediaRes.data
      console.debug(`ALLOC_MEDIA:`, allocMediaRes.data)
      // if haven't be allocated to this worker before, remember it
      const workerId = generateWorkerId(sid, rid)
      if (!this.produceWorkers.has(workerId)) {
        this.produceWorkers.set(workerId, {
          serverId: sid,
          routerId: rid,
          producers: new Map(),
        })
      }

      const worker = this.produceWorkers.get(workerId)!
      // if device not loaded
      if (!worker.device || !worker.device.loaded) {
        const device = new Device()
        await device.load({ routerRtpCapabilities: rtp })
        worker.device = device
        console.debug(`device.load:`, device)
      }

      const device = worker.device!
      // if transport not connected
      if (
        !worker.transport ||
        worker.transport.connectionState !== 'connected'
      ) {
        const createTransportRes = await this.socket.emitWithAck(
          PortalReqType.CREATE_SEND_TRANSPORT,
          worker.serverId,
          worker.routerId,
        )
        if (createTransportRes.code !== 0) return
        const transportOptions = createTransportRes.data
        console.debug(`CREATE_SEND_TRANSPORT:`, createTransportRes.data)

        const transport = device.createSendTransport(transportOptions)
        worker.transport = transport
        console.debug(`device.createSendTransport:`, transport)

        transport.on('connect', async ({ dtlsParameters }, onOk, onErr) => {
          try {
            if (!this.socket) {
              throw new Error('socket is null')
            }
            console.debug(`transport.onconnect:`, dtlsParameters)
            const connectRes = await this.socket.emitWithAck(
              PortalReqType.CONNECT_TRANSPORT,
              worker.serverId,
              worker.routerId,
              transportOptions.id,
              dtlsParameters,
            )
            if (connectRes.code === 0) {
              onOk()
            } else {
              throw new Error(connectRes.data)
            }
          } catch (e) {
            console.error(e)
            onErr(e as Error)
          }
        })

        transport.on('connectionstatechange', (state) => {
          console.debug(
            `transport.onconnectionstatechange: id=${transport.id} state=${state}`,
          )
        })

        transport.on('produce', async (params, onOk, onErr) => {
          try {
            if (!this.socket) {
              throw new Error('socket is null')
            }
            console.debug(`transport.onproduce:`, params)
            const res = await this.socket.emitWithAck(
              PortalReqType.CREATE_PRODUCER,
              worker.serverId,
              worker.routerId,
              transportOptions.id,
              params.kind,
              params.rtpParameters,
            )
            if (res.code === 0) {
              console.debug(`CREATE_PRODUCER:`, res.data)
              onOk({ id: res.data })
            } else {
              throw new Error(res.data)
            }
          } catch (e) {
            console.error(e)
            onErr(e as Error)
          }
        })
      }

      const transport = worker.transport!
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      console.debug('getUserMedia', mediaStream)
      transport.produce({
        track: mediaStream.getVideoTracks()[0],
      })
    } catch (e) {
      this.status = ClientStatus.JOINED
      throw e
    }
  }
}

function generateWorkerId(serverName: string, routerId: string): string {
  return serverName + '_' + routerId
}

export default MCSClient

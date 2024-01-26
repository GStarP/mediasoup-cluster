import { io } from 'socket.io-client'
import {
  ClientSocket,
  ClientStatus,
  ConsumeMediaWorker,
  ProduceMediaWorker,
  PublishOptions,
} from './client.type'
import {
  MediaWorkerType,
  PortalNotificationType,
  PortalReqType,
  UserPublishPayload,
} from '@shared/portal.type'
import { PublishError } from './error'
import { Device } from 'mediasoup-client'

class MCSClient {
  static PORTAL_URL = 'ws://localhost:8080'

  status = ClientStatus.IDLE
  onUserPublish?: (payload: UserPublishPayload) => void = undefined

  private channel = 'unknown'
  private uid = 'unknown'

  private options = {
    timeout: 10 * 1000,
  }
  private socket: ClientSocket | null = null
  // server_rid => MediaWorker
  private producerWorkers: Map<string, ProduceMediaWorker> = new Map()
  private consumerWorkers: Map<string, ConsumeMediaWorker> = new Map()

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
        this.channel = channel
        this.uid = uid
        resolve(uid)
      })

      this.socket.on(PortalNotificationType.USER_PUBLISH, (payload) =>
        this.onUserPublish?.(payload),
      )

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
        MediaWorkerType.PRODUCER,
      )
      if (allocMediaRes.code !== 0) return
      const { sid, rid, rtp } = allocMediaRes.data
      console.debug(`ALLOC_MEDIA:`, allocMediaRes.data)
      // if haven't be allocated to this worker before, remember it
      const workerId = generateWorkerId(sid, rid)
      if (!this.producerWorkers.has(workerId)) {
        this.producerWorkers.set(workerId, {
          serverId: sid,
          routerId: rid,
          producers: new Map(),
        })
      }

      const worker = this.producerWorkers.get(workerId)!
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

      // TODO: producer should be stored
      const producer = await transport.produce({
        track: mediaStream.getVideoTracks()[0],
      })
      console.debug('producer:', producer)

      this.socket.emit(PortalNotificationType.USER_PUBLISH, {
        uid: this.uid,
        sid: sid,
        rid: rid,
        pid: producer.id,
        channel: this.channel,
      })
    } catch (e) {
      this.status = ClientStatus.JOINED
      throw e
    }
  }

  async subscribe(
    payload: UserPublishPayload,
  ): Promise<MediaStreamTrack | null> {
    console.debug(`onUserPublish:`, payload)
    try {
      if (!this.socket) throw new Error('socket invalid')

      const allocMediaRes = await this.socket.emitWithAck(
        PortalReqType.ALLOC_MEDIA,
        MediaWorkerType.CONSUMER,
      )
      if (allocMediaRes.code !== 0) return null
      const { sid, rid, rtp } = allocMediaRes.data
      console.debug(`ALLOC_MEDIA:`, allocMediaRes.data)
      const workerId = generateWorkerId(sid, rid)
      if (!this.consumerWorkers.has(workerId)) {
        this.consumerWorkers.set(workerId, {
          serverId: sid,
          routerId: rid,
          consumers: new Map(),
        })
      }

      const worker = this.consumerWorkers.get(workerId)!
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
          PortalReqType.CREATE_RECV_TRANSPORT,
          worker.serverId,
          worker.routerId,
        )
        if (createTransportRes.code !== 0) return null
        const transportOptions = createTransportRes.data
        console.debug(`CREATE_RECV_TRANSPORT:`, createTransportRes.data)

        const transport = device.createRecvTransport(transportOptions)
        worker.transport = transport
        console.debug(`device.createRecvTransport:`, transport)

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
      }

      const transport = worker.transport!
      const createConsumerRes = await this.socket.emitWithAck(
        PortalReqType.CREATE_CONSUMER,
        worker.serverId,
        worker.routerId,
        transport.id,
        payload.pid,
        device.rtpCapabilities,
        payload.sid,
        payload.rid,
      )
      if (createConsumerRes.code === 0) {
        console.debug(`CREATE_CONSUMER: ${createConsumerRes.data}`)
        const consumer = await transport.consume({
          id: createConsumerRes.data.id,
          producerId: createConsumerRes.data.pid,
          kind: createConsumerRes.data.kind,
          rtpParameters: createConsumerRes.data.rtp,
        })
        return consumer.track
      } else {
        throw new Error(createConsumerRes.data)
      }
    } catch (e) {
      console.error('[onUserPublish]', e)
    }
    return null
  }
}

function generateWorkerId(serverName: string, routerId: string): string {
  return serverName + '_' + routerId
}

export default MCSClient

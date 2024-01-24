import type { Socket } from 'socket.io-client'
import type {
  PortalClientEmitMap,
  PortalServerEmitMap,
} from '@shared/portal.type'
import type { Device } from 'mediasoup-client'
import type { Consumer, Producer, Transport } from 'mediasoup-client/lib/types'

export type ClientSocket = Socket<PortalServerEmitMap, PortalClientEmitMap>

export type MediaType = 'audio' | 'video' | 'screen'

export type PublishOptions = {
  type: MediaType
}

export enum ClientStatus {
  IDLE,
  JOINED,
  PUBLISHING,
}

export type MediaWorker = {
  serverId: string
  routerId: string
  device?: Device
  transport?: Transport
}

export type ProduceMediaWorker = MediaWorker & {
  producers: Map<string, Producer>
}

export type ConsumeMediaWorker = MediaWorker & {
  consumers: Map<string, Consumer>
}

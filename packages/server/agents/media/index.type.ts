import type { Consumer } from 'mediasoup/node/lib/Consumer'
import type { Producer } from 'mediasoup/node/lib/Producer'
import type { Router } from 'mediasoup/node/lib/Router'
import type { WebRtcTransport } from 'mediasoup/node/lib/WebRtcTransport'
import type { Worker } from 'mediasoup/node/lib/Worker'
import type { WebRtcServer } from 'mediasoup/node/lib/types'

export type MediaAgentConfig = {
  producerWorkerNum: number
}

export enum MediaWorkerType {
  PRODUCER,
  CONSUMER,
}

export type WorkerAppData = {
  webRtcServer?: WebRtcServer
  router?: Router
  transports: Map<string, WebRtcTransport>
} & (
  | {
      type: MediaWorkerType.PRODUCER
      producers: Map<string, Producer>
    }
  | { type: MediaWorkerType.CONSUMER; consumers: Map<string, Consumer> }
)

export type RouterAppData = {
  worker: Worker<WorkerAppData>
}

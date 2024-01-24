import { MediaWorkerType } from '@/agents/media/index.type'
import type { RtpCapabilities } from 'mediasoup-client/lib/RtpParameters'

export type MediaServerLoad = Pick<MediaAgentLoad, 'server' | 'sys'> & {
  workers: Map<string, MediaWorkerLoad>
}

export type MediaAgentLoad = {
  server: string // media server name
  sys: SystemLoad
  workers: (MediaWorkerLoad | PartialMediaWorkerLoad)[]
}

export type SystemLoad = {
  cpu: number // usage percentage (0~1)
  mem: number // usage percentage
}

export type MediaWorkerLoad = {
  type: MediaWorkerType
  rtp: RtpCapabilities

  rid: string // router id
  conn: number // transport num
  item: number // producer/consumer num
}

export type PartialMediaWorkerLoad = Pick<
  MediaWorkerLoad,
  'rid' | 'conn' | 'item'
>

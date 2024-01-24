import type {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup-client/lib/RtpParameters'
import type {
  DtlsParameters,
  TransportOptions,
} from 'mediasoup-client/lib/types'

// ! should share between portal(server) and sdk(client)
export enum PortalReqType {
  ALLOC_MEDIA = 'ALLOC_MEDIA',
  CREATE_SEND_TRANSPORT = 'CREATE_SEND_TRANSPORT',
  CONNECT_TRANSPORT = 'CONNECT_TRANSPORT',
  CREATE_PRODUCER = 'CREATE_PRODUCER',
}

export enum PortalNotificationType {
  JOIN_SUCCESS = 'JOIN_SUCCESS',
}

export type PortalServerEmitMap = {
  [PortalNotificationType.JOIN_SUCCESS]: (uid: string) => void
}

export type PortalClientEmitMap = {
  [PortalReqType.ALLOC_MEDIA]: (
    cb: (res: PortalRes<AllocMediaRet>) => void,
  ) => void

  [PortalReqType.CREATE_SEND_TRANSPORT]: (
    sid: string,
    rid: string,
    cb: (res: PortalRes<TransportOptions>) => void,
  ) => void

  [PortalReqType.CONNECT_TRANSPORT]: (
    sid: string,
    rid: string,
    tid: string,
    dtls: DtlsParameters,
    cb: (res: PortalRes<void>) => void,
  ) => void

  [PortalReqType.CREATE_PRODUCER]: (
    sid: string,
    rid: string,
    tid: string,
    kind: MediaKind,
    rtp: RtpParameters,
    cb: (res: PortalRes<string>) => void,
  ) => void
}

export type AllocMediaRet = {
  sid: string // server id
  rid: string // router id
  rtp: RtpCapabilities // routerRtpCapabilities
}
export type PortalRes<R> =
  | {
      code: 0
      data: R
    }
  | {
      code: 1
      data: string
    }

import type {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup-client/lib/RtpParameters'
import type {
  DtlsParameters,
  TransportOptions,
} from 'mediasoup-client/lib/types'

export enum PortalReqType {
  ALLOC_MEDIA = 'ALLOC_MEDIA',
  CREATE_SEND_TRANSPORT = 'CREATE_SEND_TRANSPORT',
  CONNECT_TRANSPORT = 'CONNECT_TRANSPORT',
  CREATE_PRODUCER = 'CREATE_PRODUCER',
  CREATE_RECV_TRANSPORT = 'CREATE_RECV_TRANSPORT',
  CREATE_CONSUMER = 'CREATE_CONSUMER',
}

export enum PortalNotificationType {
  JOIN_SUCCESS = 'JOIN_SUCCESS',
  USER_PUBLISH = 'USER_PUBLISH',
}

export type PortalServerEmitMap = {
  [PortalNotificationType.JOIN_SUCCESS]: (uid: string) => void
  [PortalNotificationType.USER_PUBLISH]: (payload: UserPublishPayload) => void
}

export type PortalClientEmitMap = {
  [PortalReqType.ALLOC_MEDIA]: (
    type: MediaWorkerType,
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

  [PortalReqType.CREATE_RECV_TRANSPORT]: (
    sid: string,
    rid: string,
    cb: (res: PortalRes<TransportOptions>) => void,
  ) => void

  [PortalReqType.CREATE_CONSUMER]: (
    sid: string,
    rid: string,
    tid: string,
    pid: string,
    rtp: RtpCapabilities,
    ssid: string,
    srid: string,
    cb: (res: PortalRes<CreateConsumerRet>) => void,
  ) => void

  [PortalNotificationType.USER_PUBLISH]: (payload: UserPublishPayload) => void
}

export enum MediaWorkerType {
  PRODUCER,
  CONSUMER,
}
export type AllocMediaRet = {
  sid: string // server id
  rid: string // router id
  rtp: RtpCapabilities // routerRtpCapabilities
}
export type CreateConsumerRet = {
  id: string
  pid: string
  kind: MediaKind
  rtp: RtpParameters
}
export type UserPublishPayload = {
  uid: string
  sid: string
  rid: string
  pid: string
  channel: string
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

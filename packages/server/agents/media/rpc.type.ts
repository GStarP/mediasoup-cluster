import { CreateConsumerRet, PortalReqType } from '@shared/portal.type'
import type {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup-client/lib/RtpParameters'
import type {
  DtlsParameters,
  TransportOptions,
} from 'mediasoup-client/lib/Transport'

export type MediaServerPRCMethods = {
  [PortalReqType.CREATE_SEND_TRANSPORT]: (body: {
    uid: string
    rid: string
  }) => Promise<TransportOptions>

  [PortalReqType.CONNECT_TRANSPORT]: (body: {
    uid: string
    rid: string
    tid: string
    dtls: DtlsParameters
  }) => Promise<void>

  [PortalReqType.CREATE_PRODUCER]: (body: {
    uid: string
    rid: string
    tid: string
    kind: MediaKind
    rtp: RtpParameters
  }) => Promise<string>

  [PortalReqType.CREATE_RECV_TRANSPORT]: (body: {
    uid: string
    rid: string
  }) => Promise<TransportOptions>

  [PortalReqType.CREATE_CONSUMER]: (body: {
    uid: string
    rid: string
    tid: string
    pid: string
    rtp: RtpCapabilities
    ssid: string
    srid: string
  }) => Promise<CreateConsumerRet>
}

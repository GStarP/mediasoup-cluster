import type {
  AllocMediaRet,
  MediaWorkerType,
  PortalReqType,
} from '@shared/portal.type'

export const CM_RPC_SERVER_NAME = 'rpc.cm'

export type ClusterMangerPRCMethods = {
  [PortalReqType.ALLOC_MEDIA]: (body: {
    uid: string
    type: MediaWorkerType
  }) => Promise<AllocMediaRet>
}

import { RPCRes } from './types';

export function rpcSuccess<R>(data: R): RPCRes<R> {
  return { code: 0, data };
}
export function rpcFail(msg: string): { code: 1; data: string } {
  return { code: 1, data: msg };
}
export function rpcTimeout(): { code: 2 } {
  return { code: 2 };
}
export function rpcInvalidMethod(): { code: 3 } {
  return { code: 3 };
}

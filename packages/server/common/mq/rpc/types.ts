export type RPCReq = {
  method: string;
  body: unknown;
};

export type RPCRes<R = unknown> =
  | {
      code: 0;
      data: R;
    }
  | {
      code: 1;
      data: string;
    }
  | { code: 2 } // timeout
  | { code: 3 }; // method not allow

export type RPCServerMethods = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: (body: any) => Promise<any>;
};

export type WrapRPCRes<T extends RPCServerMethods> = {
  [K in keyof T]: (
    args: Parameters<T[K]>[0],
  ) => Promise<RPCRes<Awaited<ReturnType<T[K]>>>>;
};

import path from 'path';
import { handler, HTTPHandler } from './serveBinaris';

export class HandlerError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export class UnauthorizedError extends HandlerError {
  public readonly name = 'UnauthorizedError';

  constructor(message: string) {
    super(message, 403);
  }
}

export type Handler = (...args: any) => any;

export function getHandler(backendDir: string, fnPath: string, handlerName: string): Handler {
  const joinedDir = path.resolve(backendDir, fnPath);
  if (path.relative(backendDir, joinedDir).startsWith('..')) {
    throw new UnauthorizedError(`Cannot reference path outside of root dir: ${fnPath}`);
  }
  const mod = require(joinedDir);
  const fn = mod[handlerName];
  // Cast to any so typescript doesn't complain against accessing __reshuffle__ on a function
  if (!(typeof fn === 'function' && (fn as any).__reshuffle__ && (fn as any).__reshuffle__.exposed)) {
    throw new  UnauthorizedError(`Cannot invoke ${fnPath}.${handlerName} - not an exposed function`);
  }
  return fn;
}

export { HTTPHandler };

export { handler };
export function setHTTPHandler(override: HTTPHandler) {
  module.exports.handler = override;
}

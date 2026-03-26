export interface UseCase<Request, Response> {
  code: string;
  execute(request?: Request): Promise<Response> | Response;
}

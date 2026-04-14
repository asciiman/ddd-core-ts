import assert from 'assert';

import { ResultOrError } from './result-or-error';
import { SomethingWentWrongError } from './something-went-wrong-error';
import { UseCase } from './use-case';

interface RequestMapper<RequestDTO, RequestDomain> {
  mapDTOToDomain(dto: RequestDTO): RequestDomain;
}

interface ResponseMapper<ResponseDomain, ResponseDTO> {
  mapDomainToDTO(domain: ResponseDomain): ResponseDTO;
}

export interface HandlerDefinition<
  RequestDTO = void,
  RequestDomain = void,
  ResponseDomain = void,
  ResponseDTO = void,
> {
  requestMapper?: RequestMapper<RequestDTO, RequestDomain>;
  responseMapper?: ResponseMapper<ResponseDomain, ResponseDTO>;
  useCaseExecutor: UseCase<RequestDomain, ResponseDomain>;
}

export async function handleRequest<RequestDTO, RequestDomain, ResponseDomain, ResponseDTO>(
  {
    requestMapper,
    useCaseExecutor,
    responseMapper,
  }: HandlerDefinition<RequestDTO, RequestDomain, ResponseDomain, ResponseDTO>,
  dto?: RequestDTO,
): Promise<ResultOrError<ResponseDTO, SomethingWentWrongError>> {
  try {
    let domainObject: RequestDomain | undefined;
    try {
      if (requestMapper) {
        assert(dto !== undefined, 'DTO was not defined even though requestMapper was configured');
        domainObject = requestMapper.mapDTOToDomain(dto);
      }
    } catch (error) {
      const message = 'Error while mapping request DTO to domain object';
      throw new Error(message, { cause: error });
    }

    const useCaseResult = await useCaseExecutor.execute(domainObject);

    try {
      const responseDTO = responseMapper
        ? responseMapper.mapDomainToDTO(useCaseResult)
        : (undefined as ResponseDTO);
      return ResultOrError.success(responseDTO);
    } catch (error) {
      const message = 'Error while mapping response domain to DTO';
      throw new Error(message, { cause: error });
    }
  } catch (cause) {
    const controllerCode = useCaseExecutor.code;
    const message = `Error handling controller request for use case ${controllerCode} in ddd-core-ts controller`;
    return ResultOrError.error(new SomethingWentWrongError(message, { cause }));
  }
}

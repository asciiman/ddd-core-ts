export type ResultOrError<Result, Error> =
  | (Result extends void
      ? {
          success: true;
        }
      : {
          success: true;
          result: Result;
        })
  | (Error extends void
      ? {
          success: false;
        }
      : {
          success: false;
          error: Error;
        });

function success<Result>(result: Result): ResultOrError<Result, never>;
function success(): ResultOrError<void, never>;
function success<Result>(result?: Result) {
  return result === undefined ? { success: true } : { success: true, result };
}

function error<Error>(err: Error): ResultOrError<never, Error>;
function error(): ResultOrError<never, void>;
function error<Error>(err?: Error) {
  return err === undefined ? { success: false } : { success: false, error: err };
}

export const ResultOrError = {
  success,
  error,
};

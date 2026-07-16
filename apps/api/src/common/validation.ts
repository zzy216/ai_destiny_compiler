import { BadRequestException, ValidationError } from '@nestjs/common';

import type { ValidationErrorDetailDto } from './api-contract.dto';

const VALIDATION_CODES: Readonly<Record<string, string>> = {
  isDefined: 'required',
  isNotEmpty: 'required',
  isUuid: 'invalid_uuid',
  isUrl: 'invalid_url',
  isEmail: 'invalid_email',
  whitelistValidation: 'not_allowed',
};

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetailDto[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownErrors = Object.entries(error.constraints ?? {}).map(
      ([constraint, message]) => ({
        field,
        message,
        code: VALIDATION_CODES[constraint] ?? 'invalid_value',
      }),
    );
    const childErrors = flattenValidationErrors(error.children ?? [], field);

    return [...ownErrors, ...childErrors];
  });
}

export function createValidationException(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    error: {
      code: 'validation_error',
      message: 'Request validation failed',
      details: flattenValidationErrors(errors),
    },
  });
}

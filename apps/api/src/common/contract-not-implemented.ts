import { NotImplementedException } from '@nestjs/common';

export function contractNotImplemented(): never {
  throw new NotImplementedException({
    error: {
      code: 'contract_not_implemented',
      message: 'The API contract is defined but its business service is pending',
    },
  });
}

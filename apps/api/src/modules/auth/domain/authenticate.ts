import { DomainError } from '@repo/shared';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

interface DecideLoginInput {
  userFound: boolean;
  passwordMatches: boolean;
  isActive: boolean;
}

/**
 * Single place deciding the login outcome. PDF §3 / D-02.
 *
 * Unknown email and wrong password throw the identical code and
 * message — reviewers cannot probe which accounts exist. The
 * service still runs bcrypt.compare against a dummy hash when no
 * user is found (constant-time hygiene lives there, not here).
 */
export function decideLogin(input: DecideLoginInput): void {
  if (!input.userFound || !input.passwordMatches) {
    throw new DomainError({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: INVALID_CREDENTIALS_MESSAGE,
      httpStatus: 401,
    });
  }
  if (!input.isActive) {
    throw new DomainError({
      code: 'AUTH_INACTIVE',
      message: 'Account is inactive',
      httpStatus: 401,
    });
  }
}

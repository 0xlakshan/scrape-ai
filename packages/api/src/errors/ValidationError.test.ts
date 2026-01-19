import { describe, it, expect } from 'vitest';
import { ValidationError, MissingFieldError, InvalidUrlError } from './ValidationError';
import { ErrorCode } from './errorCodes';

describe('ValidationError', () => {
  it('should create validation error with message', () => {
    const error = new ValidationError('Invalid input');

    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.statusCode).toBe(400);
  });

  it('should include details', () => {
    const error = new ValidationError('Invalid', { field: 'email' });

    expect(error.details).toEqual({ field: 'email' });
  });
});

describe('MissingFieldError', () => {
  it('should create error for missing field', () => {
    const error = new MissingFieldError('email');

    expect(error.message).toBe('Missing required field: email');
    expect(error.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ field: 'email' });
  });

  it('should handle different field names', () => {
    const error = new MissingFieldError('password');

    expect(error.message).toBe('Missing required field: password');
    expect(error.details).toEqual({ field: 'password' });
  });
});

describe('InvalidUrlError', () => {
  it('should create error for invalid URL', () => {
    const error = new InvalidUrlError('not-a-url');

    expect(error.message).toBe('Invalid URL: not-a-url');
    expect(error.code).toBe(ErrorCode.INVALID_URL);
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ url: 'not-a-url' });
  });

  it('should handle malformed URLs', () => {
    const error = new InvalidUrlError('htp://wrong');

    expect(error.message).toBe('Invalid URL: htp://wrong');
    expect(error.details).toEqual({ url: 'htp://wrong' });
  });
});

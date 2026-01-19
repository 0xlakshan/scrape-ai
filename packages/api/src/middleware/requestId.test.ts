import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestIdMiddleware } from "./requestId";

describe("requestIdMiddleware", () => {
  it("should add request ID to request object", () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.id).toBeDefined();
    expect(req.id).toMatch(/^req_[a-f0-9]{16}$/);
    expect(next).toHaveBeenCalledOnce();
  });

  it("should generate unique IDs", () => {
    const req1 = {} as Request;
    const req2 = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    requestIdMiddleware(req1, res, next);
    requestIdMiddleware(req2, res, next);

    expect(req1.id).not.toBe(req2.id);
  });

  it("should call next middleware", () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });
});

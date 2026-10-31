import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import api, { UNAUTHORIZED_EVENT } from "@/api/client";

function respond(status: number, url: string) {
  // Drive the response interceptor directly by calling axios' adapter path with a stubbed adapter.
  api.defaults.adapter = async (config) => {
    if (status >= 400) {
      throw new AxiosError("fail", String(status), config, undefined, {
        status,
        statusText: "",
        headers: {},
        config,
        data: { detail: "nope" },
      });
    }
    return { status, statusText: "OK", headers: {}, config: { ...config, headers: new AxiosHeaders() }, data: {} };
  };
  return api.get(url);
}

describe("api client", () => {
  afterEach(() => {
    api.defaults.adapter = undefined;
  });

  it("broadcasts an unauthorized event on 401 from report endpoints", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    await expect(respond(401, "/analytics/overview/1")).rejects.toBeInstanceOf(AxiosError);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("does not broadcast for /auth endpoints or other status codes", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    await expect(respond(401, "/auth/me")).rejects.toBeInstanceOf(AxiosError);
    await expect(respond(502, "/analytics/overview/1")).rejects.toBeInstanceOf(AxiosError);
    await expect(respond(200, "/analytics/overview/1")).resolves.toBeTruthy();
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });
});

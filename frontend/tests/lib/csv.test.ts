import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadText, reportToCsv } from "@/lib/csv";

describe("reportToCsv", () => {
  it("serialises headers and rows with CRLF", () => {
    const csv = reportToCsv({ headers: ["a", "b"], rows: [["1", "2"], ["3", "4"]] });
    expect(csv).toBe("a,b\r\n1,2\r\n3,4\r\n");
  });

  it("escapes commas, quotes and newlines", () => {
    const csv = reportToCsv({ headers: ["page"], rows: [['/a,b'], ['say "hi"'], ["line\nbreak"]] });
    expect(csv.split("\r\n")).toEqual(["page", '"/a,b"', '"say ""hi"""', '"line\nbreak"', ""]);
  });
});

describe("downloadText", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates and clicks a temporary anchor", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    downloadText("report.csv", "a,b\r\n", "text/csv");

    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:test");
    expect(document.querySelector("a[download]")).toBeNull(); // cleaned up
  });
});

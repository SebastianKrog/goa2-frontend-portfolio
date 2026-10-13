import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHeroMetadata, fetchHeroes } from "./rest";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("hero listing requests", () => {
  it("keeps playtest heroes excluded by default", async () => {
    await fetchHeroes();
    await fetchHeroMetadata();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/heroes");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/heroes/metadata");
  });

  it("opts into playtest heroes with the documented query parameter", async () => {
    await fetchHeroes({ includePlaytest: true });
    await fetchHeroMetadata({ includePlaytest: true });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/heroes?include_playtest=true");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/heroes/metadata?include_playtest=true");
  });
});

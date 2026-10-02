import { describe, it, expect } from "vitest";
import { citationHref } from "./citationHref";

describe("citationHref", () => {
  it("returns the plain url without a quote", () => {
    expect(citationHref({ url: "https://www.ecfr.gov/x" })).toBe("https://www.ecfr.gov/x");
  });
  it("adds a text fragment for a short quote", () => {
    expect(citationHref({ url: "https://www.ecfr.gov/x", quote: "may not engage in employment" })).toBe(
      "https://www.ecfr.gov/x#:~:text=may%20not%20engage%20in%20employment",
    );
  });
  it("uses a start,end range for long quotes so small differences in the middle still match", () => {
    const quote =
      "A nonimmigrant in the United States in a class defined in section 101(a)(15)(B) of the Act as a temporary visitor for pleasure may not engage in any employment.";
    const href = citationHref({ url: "https://www.ecfr.gov/x", quote });
    expect(href).toBe(
      "https://www.ecfr.gov/x#:~:text=A%20nonimmigrant%20in%20the%20United%20States,may%20not%20engage%20in%20any%20employment.",
    );
  });
  it("percent-encodes characters that are special in text fragments", () => {
    expect(citationHref({ url: "https://a.gov/p", quote: "B-1, B-2 & more" })).toBe(
      "https://a.gov/p#:~:text=B%2D1%2C%20B%2D2%20%26%20more",
    );
  });
  it("keeps an existing anchor and appends the directive", () => {
    expect(citationHref({ url: "https://a.gov/p#p-214.1(e)", quote: "employment" })).toBe(
      "https://a.gov/p#p-214.1(e):~:text=employment",
    );
  });
});

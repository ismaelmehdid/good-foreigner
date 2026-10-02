// Builds a link that opens an official source and scrolls to + highlights the quoted sentence,
// using URL text fragments (https://wicg.github.io/scroll-to-text-fragment/). Browsers without
// support simply open the page.

const RANGE_WORDS = 6;

function encodeFragmentText(text: string): string {
  // "-", "," and "&" have meaning inside a text directive and must be percent-encoded.
  return encodeURIComponent(text).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
}

export function citationHref(citation: { url: string; quote?: string }): string {
  const quote = citation.quote?.replace(/\s+/g, " ").trim();
  if (!quote) return citation.url;

  const words = quote.split(" ");
  const directive =
    words.length > RANGE_WORDS * 2
      ? `${encodeFragmentText(words.slice(0, RANGE_WORDS).join(" "))},${encodeFragmentText(words.slice(-RANGE_WORDS).join(" "))}`
      : encodeFragmentText(quote);

  const hashIndex = citation.url.indexOf("#");
  const base = hashIndex === -1 ? citation.url : citation.url.slice(0, hashIndex);
  const anchor = hashIndex === -1 ? "" : citation.url.slice(hashIndex + 1);
  return `${base}#${anchor}:~:text=${directive}`;
}

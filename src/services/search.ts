export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  try {
    console.log('[Search] Fetching DuckDuckGo for:', query);
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      console.error('[Search] HTTP error:', res.status);
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    console.log('[Search] Received HTML, length:', html.length);
    const results = parseDuckDuckGo(html, query);
    console.log('[Search] Parsed', results.length, 'results');
    return results;
  } catch (err) {
    console.error('[Search] Error:', err);
    return fallbackSearch(query);
  }
}

function parseDuckDuckGo(html: string, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  
  // Try multiple regex patterns to handle DuckDuckGo HTML variations
  const patterns = [
    // Pattern 1: Standard DuckDuckGo result structure
    /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    // Pattern 2: Alternative link structure
    /<a[^>]+rel="nofollow"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    // Pattern 3: Generic result links
    /<a[^>]+href="(https?:\/\/[^"]*)"[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
  ];

  const links: string[] = [];
  const titles: string[] = [];
  
  // Try each pattern until we find results
  for (const pattern of patterns) {
    const regex = new RegExp(pattern);
    let match;
    while ((match = regex.exec(html)) !== null) {
      let url = match[1];
      // Clean up DuckDuckGo redirect URLs
      if (url.includes("duckduckgo.com/l/?uddg=")) {
        try {
          const urlObj = new URL(url);
          const redirectUrl = urlObj.searchParams.get("uddg");
          if (redirectUrl) {
            url = decodeURIComponent(redirectUrl);
          }
        } catch {
          // If URL parsing fails, use as-is
        }
      }
      if (url.startsWith("//")) url = "https:" + url;
      
      // Skip DuckDuckGo internal links
      if (url.includes("duckduckgo.com") && !url.includes("uddg=")) continue;
      
      links.push(url);
      titles.push(stripHtml(match[2]).trim());
    }
    
    if (links.length >= 3) break; // Found enough results
  }

  // Extract snippets from result descriptions
  const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippets: string[] = [];
  let snippetMatch;
  while ((snippetMatch = snippetPattern.exec(html)) !== null) {
    snippets.push(stripHtml(snippetMatch[1]).trim());
  }

  // Also try alternative snippet patterns
  if (snippets.length === 0) {
    const altSnippetPattern = /<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi;
    let altMatch;
    while ((altMatch = altSnippetPattern.exec(html)) !== null) {
      snippets.push(stripHtml(altMatch[1]).trim());
    }
  }

  for (let i = 0; i < Math.min(links.length, 5); i++) {
    results.push({
      title: titles[i] || `Result ${i + 1}`,
      url: links[i],
      snippet: snippets[i] || "",
    });
  }

  console.log('[Parse] Extracted', results.length, 'results from HTML');
  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ");
}

function fallbackSearch(query: string): SearchResult[] {
  return [
    {
      title: `Search results for: ${query}`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: `Open DuckDuckGo search results for "${query}" in your browser.`,
    },
  ];
}

export function buildSearchContext(query: string, results: SearchResult[]): string {
  if (results.length === 0) return "";

  let context = `Internet search results for "${query}":\n\n`;
  for (const r of results) {
    context += `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\n\n`;
  }
  context += "Use the information above to answer the user's question. Cite sources where appropriate.\n";
  return context;
}

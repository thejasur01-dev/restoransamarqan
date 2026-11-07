// Domains people in Uzbekistan use most; a typo close to one of them gets a suggestion
const DOMAINS = ["gmail.com", "mail.ru", "yandex.ru", "yandex.com", "inbox.ru", "list.ru", "bk.ru", "icloud.com", "yahoo.com", "outlook.com", "hotmail.com", "umail.uz"];

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // Swapped neighbours ("gmial") count as one mistake
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
    }
  }
  return dp[a.length][b.length];
}

/** "ali@gmial.com" -> "ali@gmail.com"; null when the domain looks fine or isn't close to a known one. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain || DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of DOMAINS) {
    const d = distance(domain, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best && bestDistance <= 2 ? `${email.slice(0, at)}@${best}` : null;
}

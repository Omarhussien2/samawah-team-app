export type ProfileNameMatch = {
  id: string;
  full_name: string | null;
  email?: string | null;
};

const ARABIC_DIACRITICS = /[\u064b-\u065f\u0670\u06d6-\u06ed]/g;

export function normalizePersonName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\w\u0600-\u06ff\s.-]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function findProfileNameMatches(name: string | null | undefined, profiles: ProfileNameMatch[]) {
  const normalizedName = normalizePersonName(name);
  if (!normalizedName) return [];

  const matches = profiles.filter((profile) => {
    const profileName = normalizePersonName(profile.full_name);
    if (!profileName) return false;
    if (profileName === normalizedName) return true;

    const importedTokens = normalizedName.split(" ");
    const profileTokens = profileName.split(" ");
    if (importedTokens.length === 1) return profileTokens[0] === normalizedName;

    return profileName.startsWith(`${normalizedName} `) || normalizedName.startsWith(`${profileName} `);
  });

  return Array.from(new Map(matches.map((profile) => [profile.id, profile])).values());
}

export function findUniqueProfileByName(name: string | null | undefined, profiles: ProfileNameMatch[]) {
  const matches = findProfileNameMatches(name, profiles);
  return matches.length === 1 ? matches[0] : null;
}

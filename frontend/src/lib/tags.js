// How a tag is shown to visitors. The data keeps short tag names like
// 'personal-training'; people should read "Personal training".
const SPECIAL = { womens: "Women's" };

export function tagLabel(tag) {
  if (SPECIAL[tag]) return SPECIAL[tag];
  const words = tag.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

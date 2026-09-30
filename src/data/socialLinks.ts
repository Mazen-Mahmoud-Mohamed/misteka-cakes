/** Footer social / contact links. Edit URLs here only. */
export const socialLinks = {
  whatsapp: 'https://wa.me/201090138604',
  instagram: 'https://www.instagram.com/mestika_cakes',
  facebook: 'https://www.facebook.com/share/14vQQyXqafN/',
  tiktok: 'https://www.tiktok.com/@meatikacakes',
} as const

export type SocialLinkKey = keyof typeof socialLinks

import {createSharedPathnamesNavigation} from 'next-intl/navigation';

export const locales = ['en-US', 'zh-TW', 'zh-CN', 'ja-JP', 'th-TH'] as const;
export const defaultLocale = 'en-US' as const;

export const {Link, redirect, usePathname, useRouter} =
  createSharedPathnamesNavigation({locales}); 
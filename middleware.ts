import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // A list of all locales that are supported
  locales: ['en-US', 'zh-TW', 'zh-CN', 'ja-JP', 'th-TH'],

  // Used when no locale matches
  defaultLocale: 'en-US'
});

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(zh-TW|en-US|zh-CN|ja-JP|th-TH)/:path*']
}; 
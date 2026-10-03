import config from '../../../ngsw-config.json';

/** The service worker caches the built app only; server data always comes from the network. */
describe('Service worker config', () => {
  const files = config.assetGroups.flatMap((group) => group.resources.files);

  it('prefetches the app shell, including what the title screen needs offline', () => {
    expect(config.assetGroups.every((group) => group.installMode === 'prefetch')).toBe(true);
    for (const file of ['/index.html', '/manifest.webmanifest', '/*.js', '/*.css', '/i18n/**']) {
      expect(files).toContain(file);
    }
    expect(files).toContain('/fonts/*.ttf');
    expect(files).toContain('/icons/**');
  });

  it('never caches the API or content files', () => {
    expect('dataGroups' in config).toBe(false);
    expect(files.some((file) => /^\/(api|content|health)/.test(file))).toBe(false);
  });

  it('never answers server paths with the app page', () => {
    for (const excluded of ['!/api/**', '!/content/**', '!/health', '!/openapi/**']) {
      expect(config.navigationUrls).toContain(excluded);
    }
  });
});

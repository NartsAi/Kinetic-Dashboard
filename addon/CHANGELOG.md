# Changelog

## 1.8.1 - 2026-11-21

- Fix long Home camera grids stretching the forecast across multiple screens. Camera scrolling is independent and viewport-aware.
- Add Home/Security camera checkboxes in setup and preserve selections when regenerating configuration.

## 1.8.0 - 2026-11-21

- Publish saved configuration and dashboard assets to www/kinetic from setup, with ready-to-paste HA dashboard YAML.
- Keep Fully Single App Kiosk running the HA Companion app with a normal HA dashboard as its default. The embedded dashboard uses the current non-admin user's HA session.
- Map the HA configuration folder for explicit publication. Only www/kinetic is written; existing unmanaged folders are protected and no credentials are exported.

## 1.7.2 - 2026-11-21

- Allow signed-in non-admin users to open the configured dashboard through the Ingress sidebar panel. Configuration and discovery APIs remain admin-only.

## 1.7.1 - 2026-10-23

- Add the approved Kinetic house/dashboard icon and logo for the Home Assistant add-on store.

## 1.7.0 - 2026-10-23

- Add a feature configuration manager with visible pages, vehicle sensor pickers, common entity mappings and missing/unavailable entity diagnostics.
- Support explicit vehicle sensor mappings alongside legacy prefixes and refresh mapped values live.
- Explain missing vehicle setup instead of showing an empty page; tolerate absent status text maps.

## 1.6.0 - 2026-10-23

- Initial Home Assistant add-on preview with Ingress, per-user authentication, admin-only setup, area/device/entity discovery and atomic persistent configuration.
- Existing Kinetic dashboard engine and original standalone installation retained.


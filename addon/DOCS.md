# Installation and setup

1. In Home Assistant, open Settings → Add-ons → Add-on store → menu → Repositories.
2. For this review branch add `https://github.com/NartsAi/Kinetic-Dashboard#feature/ha-addon-ingress-20261023`.
3. Refresh the store, install **Kinetic Dashboard**, start it, and choose **Open Web UI**. The first image build can take several minutes.
4. Open setup as a Home Assistant administrator. The wizard normally reuses the parent frontend session. If that is unavailable, use **Sign in with Home Assistant**.
5. Select areas, generate mappings, review the JSON, then save. The dashboard opens immediately.

Use the dashboard Settings link to revisit setup. Refresh discovery to find added devices, then generate and review the new mappings before saving. Discovery does not silently overwrite your custom configuration.

# Authentication and permissions

The server listens on internal port 8099 with no host port mapping. It accepts only the Supervisor Ingress proxy at `172.30.32.2`; forwarded headers cannot bypass that restriction. Home Assistant authenticates Ingress sessions. The configuration API additionally verifies each bearer token with HA's `auth/current_user` WebSocket command and requires an administrator. Discovery uses that same user's credentials to query area, device and entity registries and current states.

The dashboard connects directly to Home Assistant on the current origin using its existing session/OAuth implementation. All entity controls retain the signed-in user's HA permissions. No Supervisor token, shared administrator token or long-lived token is used. Existing per-person page restrictions remain interface preferences, not entity authorization. Only trusted administrators should edit configuration, which supports existing branding HTML and advanced settings.

# Persistent configuration and migration

Configuration is saved as `/data/dashboard.json` with an opaque revision and a `config` JSON object. Writes use a temporary file and atomic rename, with revision checks to prevent accidental overwrites from two setup sessions. HA add-on backups include `/data`; use backups before upgrading or uninstalling. A corrupt file produces an error rather than resetting setup or replacing it with an empty file.

To migrate, convert the object assigned to `window.DASH_CONFIG` in your old config.js into **JSON**: remove the assignment, comments, expressions and trailing commas, quote property names, and remove `url` and `token`. Paste the object into the wizard editor and save. It is data, not executable JavaScript; the wizard never evaluates an imported config.js. Existing custom fields are retained. Credentials and prototype keys are rejected.

The wrapper provides the current origin and its own Settings URL at runtime. Themes and device preferences remain in the dashboard's existing browser storage. Setup OAuth refresh tokens are held in that browser session only; the add-on receives short-lived access tokens and never stores them.

# Discovery rules and manual mappings

An entity's explicit area takes precedence over its device area. Disabled and hidden entities are excluded. Selected areas generate room tiles, lights, covers, fans, climate, switches, temperature/humidity and presence/door/window sensors. Cameras, climate, media players, calendars, weather and alarm panels are populated from selected areas plus unassigned entities. Devices without states are still counted in the discovery summary but are not rendered as controls.

Refresh discovery after changing registry assignments. Generation replaces discovered mappings, retaining other advanced settings; review before saving. Features with no reliable registry mapping, including energy tariffs, irrigation scripts/timers, camera recording sources, siren scripts, vehicle mappings and custom scenes, need manual configuration using `config.example.js` as the reference. Existing HA scripts/automations in the repository still need installation in HA; the add-on does not modify HA configuration files. Camera WebRTC still depends on your camera integration and network connectivity.

# Troubleshooting and development

- A 403 on a direct port request is expected: open the UI through Home Assistant.
- An administrator is required for setup and registry discovery. Regular users can open the configured dashboard, subject to HA's own Ingress policy and entity permissions.
- A 409 on save means another session changed configuration. Reload setup and reconcile edits before saving.
- If Home Assistant is unavailable, retry after it has restarted. Backend connections use the internal `homeassistant:8123` hostname, without TLS, on the Supervisor network.
- Standalone Home Assistant Container/Core without Supervisor cannot install this add-on. The original `/local/` installation remains supported.

From the repository root: `npm install`, `npx playwright install chromium`, `npm run package:addon`, `npm test`, `npm run test:addon`. Build the container with `docker build -t kinetic-addon addon`. Committed assets in `addon/` allow the Supervisor to build using that directory alone; CI checks they match the generated engine.

Report issues at https://github.com/NartsAi/Kinetic-Dashboard/issues. The preview still requires a real Home Assistant OS install and camera/media check before a stable release. MIT license: ../LICENSE.

# Managing missing features (1.7.0)

Open dashboard Settings as an administrator and look for **Manage features and missing entities**. Diagnostics explain absent vehicle configuration, hidden Vehicle pages and missing/unavailable entity references. Under **Visible dashboard pages**, choose navigation items. Under **Vehicle configuration**, enable Vehicle, enter its name and select exact Home Assistant sensor IDs from the searchable suggestions. A legacy prefix remains supported, but individual mappings take precedence. The original renderer expects percentage fuel, kilometre range/odometer, L/100km consumption, numeric status codes, and binary on/off warnings; adapt other units or encodings using HA template sensors. This does not install a vehicle integration or invent telemetry.

Use **Common missing features** to map weather, alarm and indoor/outdoor temperature sensors. Click **Apply feature changes to editor**, review the resulting JSON, then **Save and open dashboard**. Unrelated advanced configuration is retained. For other feature mappings, the JSON editor remains available. Refresh discovery after changing integrations; this reloads the last saved configuration, so save or copy unsaved work first.

# GLA University app — login persistence (REA / static RE)

**Artifact:** `com.glauniversity.main_2.4.10.xapk` → package `com.glauniversity.main` v2.4.10  
**Runtime:** Flutter (AOT in `libapp.so`); plugins include `shared_preferences`, `local_auth`, `flutter_inappwebview`  
**Analyzed:** 2026-10-26 (REA Android decompiler unavailable — no JADX JAR; strings + live API probes)

## How it stays logged in (no password every launch)

The app does **not** store the portal password for silent reopen. It stores **tokens + a local 4-digit MPIN**:

1. **First login** — password (and often OTP) against the student/employee portal APIs.
2. **Set MPIN** — after password verify: “Password verified! Now set your 4-digit MPIN.” (`/SetMPin/`, UI in `SetupMPin/PinMainWidget.dart`).
3. **Persist tokens** in Android `SharedPreferences` via Flutter `shared_preferences` (`FinanceTokenService.saveTokens`):
   - `financeToken` — access token (sent as `Authorization: Bearer …`)
   - `financeRefreshToken` / `financerefreshToken` — refresh token
   - `financeTokenUpdateDate` — last successful refresh day
   - Also seen: `user_mpin`, `Mode_GLAU_Rgno`, `UserType`, `bearerName`
4. **Next launches** — skip full login UI → `MPinLoginPage` / `MPinLoginScreen`. User enters MPIN (optional biometric via `local_auth`). Message if wrong: “That MPIN is incorrect…”
5. **Silent network re-auth** — `FinanceTokenService.checkAndUpdateDaily()`:
   - If tokens already refreshed “today” → skip
   - Else POST refresh API; on success update prefs; on failure → “Session expired. Please sign in again.”

Password is only needed again when refresh fails or the user logs out / clears data.

## Confirmed network surface

| Piece | Evidence |
|-------|----------|
| Token API base | `https://glauniversity.in:8888/api/v1` (IIS) |
| Refresh | `POST https://glauniversity.in:8888/api/v1/refresh-token` |
| Refresh body | `{ "Token": "<access>", "RefreshToken": "<refresh>" }` (ASP.NET validation messages confirm both PascalCase fields) |
| Attendance (needs auth) | `POST https://student.glauniversity.in/api/employee/GetAttendance` → **401** without Bearer |
| Portal roots | `https://student.glauniversity.in/api/employee`, `…/api/student` |
| Relative auth paths in binary | `/token?LoginType=`, `/ValidatePassword/`, `/SendOtp`, `/checkloginotp`, `/CheckLoginOtp`, `/ValidateMPin`, `/SetMPin/`, `/Login/DirectLoginFromApp?userid=` |

Live probe notes:

- Empty refresh body → `The Token field is required.`
- Only `Token` → `The RefreshToken field is required.` (and vice versa)
- Invalid pair → `Sorry!! There is an error.. Please try after some time...`
- Browser CORS: OPTIONS 204 **without** `Access-Control-Allow-Origin` → **PWA cannot call GLA APIs directly**; needs same-origin proxy.

## RemindrX integration mapping

| Native | PWA equivalent |
|--------|----------------|
| SharedPreferences tokens | Encrypted/local session store (never store portal password long-term) |
| Daily `refresh-token` | On app/attendance open: proxy → refresh; restore session |
| MPIN + biometric | Optional RemindrX local PIN / WebAuthn unlock for GLA session |
| Bearer on employee APIs | Proxy attaches `Authorization: Bearer <financeToken>` |

## Gaps (need JADX or a user HAR)

Exact first-login request URL/body for `/token?LoginType=` and `/ValidatePassword/` not fully resolved (404 on guessed hosts). Attendance payload shape unknown. Prefer a one-time Charles/mitmproxy capture from the official app after user consent, or install JADX MCP for deeper Dart reconstruction.

## Security / ethics

Use only the student’s own credentials, with explicit consent. Prefer a server proxy so refresh tokens are not exposed to XSS. Do not scrape other students’ data.

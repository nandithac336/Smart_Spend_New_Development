# Copilot Instructions

## A3. Folder structure

Add these folders and files to the project structure:

- `hooks/useMediaQuery.js`
- `hooks/useDebouncedValue.js`
- `context/authContext.js`
- `components/settings/EffectsSetting.jsx`

## A5. Money and date rules

- `formatINR(value)`: never throws. `null`, `undefined`, `NaN` or non-numeric values show `"₹0"`. Negative values show a leading minus (for example `"-₹40"`). Uses `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` on `value / 100`.
- `toPaise(input)`: accepts a string or a finite non-negative number. It removes `"₹"`, commas and spaces. The only valid shape is digits, optionally followed by `"."` and at most 2 digits (`"5."` and `"5.5"` are valid so the keypad can build a number; `".5"` is not). It returns whole paise or `null`. It returns `null` for: empty or blank input, negative numbers, more than 2 decimals, letters, exponent notation, `NaN` and `Infinity`. It never rounds silently. Examples: `"120.50"` -> `12050`, `"0.1"` -> `10`, `"1,200"` -> `120000`, `"5."` -> `500`, `"12.345"` -> `null`, `""` -> `null`, `"-5"` -> `null`, `"abc"` -> `null`.
- `fromPaise(paise)` returns a Number of rupees (for example `120.5`). Input fields use `fromPaise(x).toFixed(2)`.
- `lib/dates.js` also exports `formatTxnTime(value, timeZone)` and `formatTxnDate(value, { timeZone })` (`"Today, 3:45 pm"`, `"Yesterday, 3:45 pm"`, `"12 Oct 2026, 3:45 pm"`). Components never format transaction dates themselves.

## A6. Auth and token rules

- AuthContext status can be `"loading"`, `"authenticated"`, `"unauthenticated"` or `"unavailable"`. `"unavailable"` means the server could not be reached or had an error while restoring the session. Tokens are kept in that state.
- A refresh failure ends the session (clear tokens, dispatch `"auth:logout"`) ONLY when there is no refresh token, or the refresh endpoint answers 400, 401 or 403. A network error, timeout, 429 or 5xx does NOT end the session: keep the tokens, do not dispatch the event, and reject the original request with that error.
- Only try a refresh when the failed response has error code `"UNAUTHORIZED"`.
- The same rule applies when restoring the session on app start: only 401 or 403 clears the tokens. Anything else becomes `"unavailable"` with a Retry button.
- `logout()` never throws. It always clears local state, even if the server call fails.
- AuthContext exposes `{ user, status, login, register, logout, updateUser, retryBootstrap }`.

## A9. Code quality

- Component files stay under 250 lines (shadcn files in `components/ui` are exempt). Split into smaller components, hooks and pure helper files when a file grows past that.
- `npm run lint` must finish with 0 errors and 0 warnings (shadcn files in `components/ui` are exempt from the `only-export-components` rule).
- No `console.*` calls at all. Where storage may be blocked, use a silent catch with a short comment.

## A12. Motion language

- Low-power mode is chosen automatically when `navigator.connection.saveData` is true, the connection type is `"2g"` or `"slow-2g"`, `navigator.deviceMemory` is 2 or less, or `navigator.hardwareConcurrency` is 2 or less. (CPU core count alone is a poor signal, so do not use a higher number.) The OS "reduce motion" setting is handled separately by `useMotionDisabled`.
- Settings has an "Effects" control with three choices: Auto (default, uses the rule above), Full (ignores the automatic rule, but never overrides the OS reduce-motion setting) and Reduced (forces low-power mode). The choice is saved in localStorage under `"smart-spend-effects"`.
- In low-power mode: use `.glass-flat` everywhere, turn off decorative animation (aurora, tilt, sheen, rotating words), and keep only quick fades.

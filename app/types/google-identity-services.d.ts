// Tipos mínimos de Google Identity Services (https://accounts.google.com/gsi/client).
// Basados en app-web-sigenet y en la landing, con `nonce` (el panel lo exige) y `cancel()`.
// `prompt()` (One Tap) no se declara a propósito: el panel solo usa el botón.

interface GoogleCredentialResponse {
  credential: string
  select_by: string
}

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  nonce?: string
  auto_select?: boolean
  ux_mode?: 'popup' | 'redirect'
}

interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void
  renderButton(parent: HTMLElement, options: GoogleButtonConfiguration): void
  disableAutoSelect(): void
  cancel(): void
}

interface Window {
  google?: {
    accounts: {
      id: GoogleAccountsId
    }
  }
}

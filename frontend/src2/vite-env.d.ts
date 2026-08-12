/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_NAME: string
  readonly VITE_LOGO_URL: string
  readonly VITE_LOGO_LIGHT: string
  readonly VITE_LOGO_DARK: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_ENVIRONMENT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
export const isGoogleConfigured =
  googleClientId !== '' && googleClientId !== 'your-google-client-id.apps.googleusercontent.com'

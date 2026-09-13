/** Default display timezone for the platform (India Standard Time). Storage is always UTC. */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Default locale for formatting. */
export const DEFAULT_LOCALE = 'en-IN';

/** Portals rendered by the web application. */
export const PORTALS = ['student', 'trainer', 'admin'] as const;
export type Portal = (typeof PORTALS)[number];

/** Environments recognised by both apps. */
export const APP_ENVS = ['local', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** API path prefix. */
export const API_PREFIX = '/api/v1';


export interface AuthTokenPayload {
    username: string;
    sub: {
        id: number,
        firstName: string,
        lastName: string,
        roles?: string[],
    },
    iss?: string, //'issuer' injected by signing process
    iat?: number //'issued at' injected by signing process
}

export interface JwtConstants {
    SECRET: string,
    SECRET_KEY_EXPIRATION: number,
    REFRESH_SECRET: string,
    REFRESH_SECRET_KEY_EXPIRATION: string,
    SECRET_PRIVATE_KEY: string,
    SECRET_PRIVATE_KEY_PASSPHRASE: string | null,
    SECRET_PUBLIC_KEY: string,
    SIGN_ALGORITHM: string
}

export interface GoogleOidcConstants {
    GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER: string,
    GOOGLE_API_KEY: string,
    GOOGLE_OAUTH2_CLIENT_ID: string,
    GOOGLE_OAUTH2_CLIENT_SECRET: string,
    GOOGLE_OAUTH2_REDIRECT_URI: string,
    GOOGLE_OAUTH2_SCOPE: string,
    CREATE_USER_IF_NOT_EXISTS: boolean
}

export interface FbConstants {
    APP_ID: string,
    APP_SECRET: string,
    CALLBACK_URL: string,
    SCOPE: string,
    PROFILE_FIELDS: string[],
    CREATE_USER_IF_NOT_EXISTS: boolean
}

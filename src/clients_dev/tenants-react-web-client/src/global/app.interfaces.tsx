/**
 * Abstract base type for entities
 */
export interface IBaseAbstract {
    id?: number;
    dateCreated?: Date;
    createdBy?: string;
    dateLastModified?: Date;
    lastModifiedBy?: string;
    lastChangeInfo?: string;
    deletedBy?: string;
}
/**
 * CustomTheme type
 */
export interface ICustomTheme extends IBaseAbstract {
    name?: string;
    description?: string;
    properties?: string;
    bulmaProperties?: { primaryColor: string, primaryBackground: string };
}

export enum TenantStatus {
    A = "active",
    S = "suspended",
    O = "owing"
}

export enum Gender {
    M = "male",
    F = "female"
}

export enum TenantTeamRole {
    A = "admin",
    M = "marketing",
    C = "content-manager"
}

export enum TenantAccountOfficerRole {
    M = "manager",
    T = "tech-support"
}

export interface IUser extends IBaseAbstract {
    landlord?: boolean;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    commonName?: string;
    homeAddress?: string;
    gender?: Gender;
    dateOfBirth?: Date;
    nationality?: string;
    stateOfOrigin?: string;
    zip?: string;
    photo?: string;
    photoMimeType?: string;
    isActive?: boolean;
    primaryEmailAddress?: string;
    backupEmailAddress?: string;
    phone?: { mobile?: string[], office?: string[], home?: string[] }
    isPrimaryEmailAddressVerified?: boolean;
    isBackupEmailAddressVerified?: boolean;
    passwordSalt?: string;
    passwordHash?: string;
    isPasswordChangeRequired?: boolean;
    resetPasswordToken?: string;
    resetPasswordExpiration?: Date;
    primaryEmailVerificationToken?: string;
    backupEmailVerificationToken?: string;
    emailVerificationTokenExpiration?: Date;
    otpEnabled?: boolean
    otpSecret?: string;
    roles?: IRole[];
    primaryContactForWhichTenants?: ITenant[];
    tenantTeamMemberships?: ITenantTeam[];
    accountOfficerForWhichTenants?: ITenantAccountOfficer[];

}

export interface IRole extends IBaseAbstract {
    name?: string;
    description?: string;
    users?: IUser[];
    landlord?: boolean; //Is this a role that is unique to landlords
}

export interface ITenantTeam extends IBaseAbstract {
    tenant?: ITenant
    user?: IUser
    roles?: TenantTeamRole[]
}

export interface ITenantAccountOfficer extends IBaseAbstract{ 
    tenant?: ITenant | null
    user?: IUser
    roles?: TenantAccountOfficerRole[]
}

export interface ITheme extends IBaseAbstract{
    name?: string;
    description?: string;
    properties?: string;
    tenants?: ITenant[];
}

export interface IBilling extends IBaseAbstract{
    uuid?: string;
    code?: string;
    description?: string;
    type?: string;
    tenant?: ITenant;
}

export interface ITenantConfigDetail extends IBaseAbstract{
    webServerProperties?: {
        //domain: string, //E.g. r1.peakharmony.com. Set it up in nameserver. A tenant1 unique name for e.g. can then have a URL slug, tenant1.r1.peakharmony.com. Use default domain to handle all on the server. Only need to add an nginx server block conf file for custom domain
        host: string,
        port?: number,
        login?: string,
        password?: {iv?: string, content?: string}
    };
    dbProperties?: {
        type: string,
        host: string,
        port: number,
        username: string,
        password: {iv?: string, content?: string},
        database: string,
        /* Below is example for self-signed certificate. See https://node-postgres.com/features/ssl
         * ssl: {
            rejectUnauthorized: boolean,
            ca: fs.readFileSync('/path/to/server-certificates/root.crt').toString(),
            key: fs.readFileSync('/path/to/client-key/postgresql.key').toString(),
            cert: fs.readFileSync('/path/to/client-certificates/postgresql.crt').toString(),
        }
         */
        ssl?: {
            rejectUnauthorized?: boolean,
            ca: string,
            key?: string,
            cert?: string
        }
    };
    dbSchema?: string;
    elasticSearchProperties?: {
        node: string,
        username: string,
        password: {iv?: string, content?: string},
        ca?: string //public key for elasticsearch if using 9300 secure port. See https://www.elastic.co/guide/en/elasticsearch/reference/current/security-basic-setup-https.html for secure setup
    };
    redisProperties?: {
        host: string,
        port: number,
        password: {iv?: string, content?: string},
        db?: number,
        //sentinels?: { host: string, port: number }[],
        sentinels?: string, //supposed to be { host: string, port: number }[]
        family?: number, //4 or 6 for ipv4 or ipv6
        ca?: string //in case of certificate. May not be needed if you follow the advise in https://redis.io/topics/security
    };
    rootFileSystem?: {
        path: string, //could be a network path 
        username?: string, //just in case, there is some form of basic authentication 
        password?: {iv?: string, content?: string},
        ca?: string //if certificate or key is needed
    };
    /*
    mailerOptions?: {
        smtpUser: string,
        smtpPword: string,
        smtpServer?: string,//smtpService below overrides smtpServer
        smtpPort?: number,
        smtpService?: string,
        smtpSecure: boolean
    };
    smtpAuth?: { //optional for the likes of Google OAuth2. See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
        type: string,
        user: string,
        clientId: string,
        clientSecret: string,
        refreshToken: string,
        accessToken: string,
        expires: number
    };*/
    smtpAuth?: { //optional for the likes of Google OAuth2. See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
        smtpUser: string,
        smtpPword: {iv?: string, content?: string},
        smtpHost: string,//smtpService below overrides smtpServer
        smtpPort: number,
        smtpService: string,
        smtpSecure: boolean,
        smtpOauth: boolean,
        smtpClientId: string,
        smtpClientSecret: string,
        smtpAccessToken: string,
        smtpRefreshToken: string,
        smtpAccessUrl: string,
        smtpPool: boolean,
        smtpMaximumConnections: number,
        smtpMaximumMessages: number
    };
    jwtConstants?: {
        jwtSecretKeyExpiration: number, //e.g. 300
        jwtRefreshSecretKeyExpiration: string, //e.g. '7d'
        //assuming the use of own keys/certificate. Can be accommodated if using jsonwebtoken directly (see https://www.npmjs.com/package/jsonwebtoken)
        jwtSecretKey: string,
        jwtRefreshSecret: string,
        jwtSecretPrivateKey: string,
        jwtSecretPrivateKeyPassphrase: string,
        jwtSecretPublicKey: string,
        jwtSignAlgorithm: string,
    };
    authEnabled?: {
        google: boolean,
        facebook: boolean,
        twoFactor: boolean
    };
    fbOauth2Constants?: {
        fBAppId: string, //this should be different for each client, read from their storage. Using common for now
        fBAppSecret: string,
        createUserIfNotExists: boolean
    };
    googleOidcConstants?: {
        googleOauth2ClientOidcIssuer: string,
        googleApiKey: string,
        googleOauth2ClientId: string,
        googleOauth2ClientSecret: string,
        createUserIfNotExists: boolean
    };
    otherUserOptions?: {
        resetPasswordMailOptionSettings_TextTemplate: string,
        confirmEmailMailOptionSettings_TextTemplate: string,
        passwordResetExpiration: number,
        emailVerificationExpiration: number
    };
    sizeLimits?: {
        logoFileSizeLimit: number,
        photoFileSizeLimit: number,
        generalFileSizeLimit: number
    };
    theme?: {
        custom: boolean, //if custom, the URL slug will be /tenantUniquePrefix
        type: string, //URL slug /standard
        rootUrl: string //this could be a remote Url 
    };
    logo?: {
        fileName: string,
        mimeType: string
    };
    tenant?: ITenant;
    region?: IRegion; //only used if creating region
    regionId?: number; //send the regionId if not creating region

}

/**
 * Region Type
 */
export interface IRegion extends IBaseAbstract {
    name: string;
    description?: string;
    country?: string;
    city?: string;
    rootDomainName?: string;
    tenantCountCapacity?: number;
    webServerProperties?: {
        //domain: string, //E.g. r1.peakharmony.com. Set it up in nameserver. A tenant1 unique name for e.g. can then have a URL slug, tenant1.r1.peakharmony.com. Use default domain to handle all on the server. Only need to add an nginx server block conf file for custom domain
        host: string, //IP
        port?: number,
        login?: string,
        password?: {iv?: string, content?: string}
    };
    dbProperties: {
        type: string,
        host: string,
        port: number,
        username: string,
        password: {iv?: string, content?: string}
        database: string,
        /* Below is example for self-signed certificate. See https://node-postgres.com/features/ssl
         * ssl: {
            rejectUnauthorized: boolean,
            ca: fs.readFileSync('/path/to/server-certificates/root.crt').toString(),
            key: fs.readFileSync('/path/to/client-key/postgresql.key').toString(),
            cert: fs.readFileSync('/path/to/client-certificates/postgresql.crt').toString(),
        }
         */
        ssl?: {
            rejectUnauthorized?: boolean,
            ca: string,
            key?: string,
            cert?: string
        }
    }; //for database connection
    elasticSearchProperties: {
        node: string,
        username: string,
        password: {iv?: string, content: string},
        ca: string | null //public key for elasticsearch if using 9300 secure port. See https://www.elastic.co/guide/en/elasticsearch/reference/current/security-basic-setup-https.html for secure setup
    };
    redisProperties: {
        host: string,
        port: number,
        password: {iv?: string, content: string},
        db?: number,
        //sentinels?: { host: string, port: number }[],
        family: number, //4 or 6 for ipv4 or ipv6
        ca?: string //in case of certificate. May not be needed if you follow the advise in https://redis.io/topics/security
    }; //for redis connection.
    rootFileSystem: {
        path: string,
        username?: string, //just in case, there is some form of basic authentication 
        password?: {iv?: string, content: string},
        ca?: string //if certificate or key is needed
    }; //the root file system for uploads for the region. Each tenant in the region should have a suffix based on tenant's uuid
    /*
    mailerOptions?: {
        smtpUser: string,
        smtpPword: string,
        smtpServer: string,//smtpService below overrides smtpServer
        smtpPort: number,
        smtpService: string,
        smtpSecure: boolean
    }
    smtpAuth?: { //optional for the likes of Google OAuth2. See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
        type: string,
        user: string,
        clientId: string,
        clientSecret: string,
        refreshToken: string,
        accessToken: string,
        expires: number
    }*/
    smtpAuth?: { //optional for the likes of Google OAuth2. See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
        smtpUser: string,
        smtpPword: {iv?: string, content?: string},
        smtpHost: string,//smtpService below overrides smtpServer
        smtpPort: number,
        smtpService: string,
        smtpSecure: boolean,
        smtpOauth: boolean,
        smtpClientId: string,
        smtpClientSecret: string,
        smtpAccessToken: string,
        smtpRefreshToken: string,
        smtpAccessUrl: string,
        smtpPool: boolean,
        smtpMaximumConnections: number,
        smtpMaximumMessages: number
    };
    jwtConstants?: {
        jwtSecretKeyExpiration: number, //e.g. 300
        jwtRefreshSecretKeyExpiration: string, //e.g. '7d'
        //assuming the use of own keys/certificate. Can be accommodated if using jsonwebtoken directly (see https://www.npmjs.com/package/jsonwebtoken)
        jwtSecretKey: string,
        jwtRefreshSecret: string,
        jwtSecretPrivateKey: string,
        jwtSecretPrivateKeyPassphrase: string,
        jwtSecretPublicKey: string,
        jwtSignAlgorithm: string,
    }
    authEnabled?: {
        google: boolean,
        facebook: boolean,
        twoFactor: boolean
    }
    fbOauth2Constants?: {
        fBAppId: string, //this should be different for each client, read from their storage. Using common for now
        fBAppSecret: string,
        createUserIfNotExists: boolean
    }
    googleOidcConstants?: {
        googleOauth2ClientOidcIssuer: string,
        googleApiKey: string,
        googleOauth2ClientId: string,
        googleOauth2ClientSecret: string,
        createUserIfNotExists: boolean
    }
    otherUserOptions?: {
        resetPasswordMailOptionSettings_TextTemplate: string,
        confirmEmailMailOptionSettings_TextTemplate: string,
        passwordResetExpiration: number,
        emailVerificationExpiration: number
    }
    sizeLimits?: {
        logoFileSizeLimit: number,
        photoFileSizeLimit: number,
        generalFileSizeLimit: number
    }
    theme?: {
        custom: boolean, //if custom, the URL slug will be /tenantUniquePrefix
        type: string, //URL slug /standard
        rootUrl: string, //this could be a remote Url 
        //I don't think I need to have properties here because that should be for theme builder app which is yet to be written.
    }
    tenantConfigDetails?: ITenantConfigDetail[];

}
/**
 * Tenant type
 */
export interface ITenant extends IBaseAbstract {
    uuid?: string;
    name?: string;
    subDomainName?: string | null; 
    address?: string;
    moreInfo?: string;
    logo?: string;
    logoMimeType?: string;
    status?: TenantStatus;
    customURLSlug?: string | null
    dateOfRegistration?: Date
    active?: boolean;
    customTheme?: ICustomTheme;
    primaryContact?: IUser;
    teamMembers?: ITenantTeam[];
    tenantAccountOfficers?: ITenantAccountOfficer[];
    uniqueSchema?: boolean;
    themes?: ITheme[];
    billings?: IBilling[];
    tenantConfigDetail?: ITenantConfigDetail;
    regionName?: string; //denomalized name
    regionRootDomainName?:string;
    [key: string]: any
}

/**
 * State variable type
 */
export interface IState {
    tenants?: ITenant[];
    tenantsCount?: number; //for total number that corresponds to present find, in case of pagination
    tenant?: ITenant | null; //This can be use for tenant to edit or tenant to view, depending on the function being carried out
    onAddTenant: boolean;
    onViewTenant: boolean;
    onEditTenant: boolean;
    alert: {
        show: boolean,
        message: string,
        type: any //problem making string compatible with type '"info" | "success" | "link" |
    }
}

/**
 * Action type for Reducer
 */
export interface IAction {
    //Indicate possible reducer action types here as you identify them in your codes
    type: 'FetchDataSuccess' | 'FetchDataFailure' | 'HandleOnAddTenant'
    | 'HandleCancelCreate' | 'BeforeCreateTenant' | 'CreateTenantSuccess'
    | 'CreateTenantFailure' | 'BeforeDeleteTenant' | 'DeleteTenantSuccess'
    | 'DeleteTenantFailure' | 'HandleEditTenant' | 'HandleCancelUpdate'
    | 'BeforeUpdateTenant' | 'UpdateTenantSuccess' | 'UpdateTenantFailure'
    | 'HandleCloseAlert' | 'HandleViewTenant' | 'HandleCloseViewTenant';
    payload?: {
        tenants?: ITenant[], tenantsCount?: number, tenant?: ITenant, error?: Error,
        id?: number | string
    }

}

/*
The idea below is to provide room for specifying read
https://github.com/typeorm/typeorm/blob/master/docs/find-options.md
*/
export interface IFindOptions {
    select?: string[];
    relations?: string[];
    skip?: number;
    take?: number;
    cache?: boolean;
    where?: {}[] | {};
    order?: {};

}

//Types that help to avoid overfetching
export interface IAssignableRegionInfo {
    id: number;
    rootDomainName: string;
    name: string;
    description: string;
    country: string;
    city: string;
    tenantCountCapacity: number;
    tenantCount: number;
}
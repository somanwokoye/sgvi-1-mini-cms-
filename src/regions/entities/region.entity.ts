import { BaseAbstractEntity } from "../../global/base-abstract.entity";
import { Column, Entity, Index, OneToMany } from "typeorm";
import * as crypto from 'crypto';
import { TenantConfigDetail } from "../../tenant-config-details/entities/tenant-config-detail.entity";
import { parsedEnv } from "../../global/app.settings";
import { CryptoTools } from "../../global/app.tools";

@Entity()
export class Region extends BaseAbstractEntity {

    @Column({ unique: true })
    @Index({ unique: true })
    name: string;

    @Column({ default: parsedEnv.DEFAULT_REGION_ROOT_DOMAIN_NAME })
    rootDomainName: string; //E.g. r1.peakharmony.com. Set *.rootDomainName up in nameserver. A tenant1 unique name for e.g. can then have a URL slug, tenant1.r1.peakharmony.com. Use default domain to handle all on the server. Only need to add an nginx server block conf file for custom domain. Defaults to no subdomain e.g. peakharmony.com

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    country: string;

    @Column({ nullable: true })
    city: string;

    @Column({ default: parseInt(parsedEnv.DEFAULT_REGION_TENANT_COUNT_CAPACITY) })
    tenantCountCapacity: number;

    @Column("simple-json", {
        nullable: true,
        default: {
            //domain: parsedEnv.DEFAULT_REGION_WEBSERVER_DOMAIN, //E.g. r1.peakharmony.com. Set it up in nameserver. A tenant1 unique name for e.g. can then have a URL slug, tenant1.r1.peakharmony.com. Use default domain to handle all on the server. Only need to add an nginx server block conf file for custom domain
            host: parsedEnv.DEFAULT_REGION_WEBSERVER_HOST, //IP
            port: parseInt(parsedEnv.DEFAULT_REGION_WEBSERVER_PORT),
            login: parsedEnv.DEFAULT_REGION_WEBSERVER_LOGIN,
            password: parsedEnv.DEFAULT_REGION_WEBSERVER_PASSWORD ? CryptoTools.encryptSync(parsedEnv.DEFAULT_REGION_WEBSERVER_PASSWORD) : null,
        }
    })//mainly for administrative access to webserver machine e.g. for setting up server blocks for custom urls
    webServerProperties: {
        //domain: string, //E.g. r1.peakharmony.com. Set it up in nameserver. A tenant1 unique name for e.g. can then have a URL slug, tenant1.r1.peakharmony.com. Use default domain to handle all on the server. Only need to add an nginx server block conf file for custom domain
        host: string | null, //IP
        port: number | null,
        login: string | null,
        password: { iv: string | null, content: string | null } | null;
    };

    @Column("simple-json")
    dbProperties: {
        type: string,
        host: string,
        port: number,
        username: string,
        password: { iv: string | null, content: string | null },
        database: string,
        /* Below is example for self-signed certificate. See https://node-postgres.com/features/ssl
         * ssl: {
            rejectUnauthorized: false,
            ca: fs.readFileSync('/path/to/server-certificates/root.crt').toString(),
            key: fs.readFileSync('/path/to/client-key/postgresql.key').toString(),
            cert: fs.readFileSync('/path/to/client-certificates/postgresql.crt').toString(),
        }
         */
        ssl: {
            rejectUnauthorized: boolean,
            ca: string,
            key: string | null, //nullable if not using self-signed
            cert: string | null //nullable if not using self-signed
        } | null
    }; //for database connection

    @Column("simple-json")
    elasticSearchProperties: {
        node: string,
        username: string,
        password: { iv: string | null, content: string | null },
        ca: string | null //public key for elasticsearch if using 9300 secure port. See https://www.elastic.co/guide/en/elasticsearch/reference/current/security-basic-setup-https.html for secure setup
    };

    @Column("simple-json") //use default region's values if null
    redisProperties: {
        host: string,
        port: number,
        password: { iv: string | null, content: string | null },
        db: number | null,
        //sentinels: { host: string, port: number }[] | null, //swagger has problem with this. Need to put in separate column or capture plain json string with string field
        sentinels: string | null, //supposed to be { host: string, port: number }[]
        family: number, //4 or 6 for ipv4 or ipv6
        ca: string | null //in case of certificate. May not be needed if you follow the advise in https://redis.io/topics/security
    }; //for redis connection.

    /**
     * This rootFileSystem path must be visible to this tms machine and visible to the tenants SaaS environment for that region. So, it should be a network file server unless both tms and saas are on the same machine. When a new tenant is created, the subdirectories will also have to be created by tms in the region.
     */
    @Column("simple-json", {
        default: {
            path: parsedEnv.DEFAULT_ROOT_FILESYSTEM_PATH,
            username: null, //just in case, there is some form of basic authentication 
            password: {},
            ca: null //if certificate or key is needed
        }
    })
    rootFileSystem: {
        path: string,
        username: string | null, //just in case, there is some form of basic authentication 
        password: { iv: string | null, content: string | null },
        ca: string | null //if certificate or key is needed
    }; //the root file system for uploads for the region. Each tenant in the region should have a suffix based on tenant's uuid

    /*
    @Column("simple-json",
        {
            default: {
                smtpUser: parsedEnv.DEFAULT_SMTP_USER,
                smtpPword: parsedEnv.DEFAULT_SMTP_PWORD,
                smtpServer: parsedEnv.DEFAULT_SMTP_SERVER,//smtpService below overrides smtpServer
                smtpPort: parsedEnv.DEFAULT_SMTP_PORT,
                smtpService: parsedEnv.DEFAULT_SMTP_SERVICE,
                smtpSecure: parsedEnv.DEFAULT_SMTP_SECURE === 'true'
            }
        })
    mailerOptions: {
        smtpUser: string,
        smtpPword: string,
        smtpServer: string,//smtpService below overrides smtpServer
        smtpPort: number,
        smtpService: string,
        smtpSecure: boolean
    }

    @Column("simple-json", { nullable: true }) //default is yet to be setup. Hence, no default
    smtpAuth: { //optional for the likes of Google OAuth2. See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
        type: string,
        user: string,
        clientId: string,
        clientSecret: string,
        refreshToken: string,
        accessToken: string,
        expires: number
    }
    */

    @Column("simple-json", {
        nullable: true, //nullable is just here to accommodate old records at dev time
        default: {
            smtpUser: parsedEnv.DEFAULT_SMTP_USER,
            smtpPword: parsedEnv.DEFAULT_SMTP_PWORD ? CryptoTools.encryptSync(parsedEnv.DEFAULT_SMTP_PWORD) : null,
            smtpHost: parsedEnv.DEFAULT_SMTP_HOST,//smtpService below overrides smtpServer
            smtpPort: parseInt(parsedEnv.DEFAULT_SMTP_PORT),
            smtpService: parsedEnv.DEFAULT_SMTP_SERVICE,
            smtpSecure: parsedEnv.DEFAULT_SMTP_SECURE === 'true' ? true : false,
            smtpOauth: parsedEnv.DEFAULT_SMTP_OAUTH === 'true' ? true : false,
            smtpClientId: parsedEnv.DEFAULT_SMTP_CLIENT_ID,
            smtpClientSecret: parsedEnv.DEFAULT_SMTP_CLIENT_SECRET,
            smtpAccessToken: parsedEnv.DEFAULT_SMTP_ACCESS_TOKEN,
            smtpRefreshToken: parsedEnv.DEFAULT_SMTP_REFRESH_TOKEN,
            smtpAccessUrl: parsedEnv.DEFAULT_SMTP_ACCESS_URL,
            smtpPool: parsedEnv.DEFAULT_SMTP_POOL === 'true' ? true : false,
            smtpMaximumConnections: parseInt(parsedEnv.DEFAULT_SMTP_MAXIMUM_CONNECTIONS),
            smtpMaximumMessages: parseInt(parsedEnv.DEFAULT_SMTP_MAXIMUM_MESSAGES)
        }
    }) //default is yet to be setup. Hence, no default
    smtpAuth: { //See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
        smtpUser: string,
        smtpPword: { iv: string | null, content: string | null },
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
    }

    @Column("simple-json", { //just in case not provided, at least put some default
        default: {
            jwtSecretKeyExpiration: parsedEnv.DEFAULT_JWT_SECRET_KEY_EXPIRATION,
            jwtRefreshSecretKeyExpiration: parsedEnv.DEFAULT_JWT_REFRESH_SECRET_KEY_EXPIRATION,
            //assuming the use of own keys/certificate. Can be accommodated if using jsonwebtoken directly (see https://www.npmjs.com/package/jsonwebtoken)
            jwtSecretKey: crypto.randomBytes(16).toString('hex'),
            jwtRefreshSecret: crypto.randomBytes(16).toString('hex'),
            jwtSecretPrivateKey: parsedEnv.DEFAULT_JWT_SECRET_PRIVATE_KEY,
            jwtSecretPrivateKeyPassphrase: parsedEnv.DEFAULT_JWT_SECRET_PRIVATE_KEY_PASSPHRASE,
            jwtSecretPublicKey: parsedEnv.DEFAULT_JWT_SECRET_PUBLIC_KEY,
            jwtSignAlgorithm: parsedEnv.DEFAULT_JWT_SIGN_ALGORITHM,
        }
    })
    jwtConstants: {
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

    @Column("simple-json", {
        default: {
            google: parsedEnv.DEFAULT_GOOGLE === 'true',
            facebook: parsedEnv.DEFAULT_FACEBOOK === 'true',
            twoFactor: parsedEnv.DEFAULT_TWO_FACTOR === 'true'
        }
    })
    authEnabled: {
        google: boolean,
        facebook: boolean,
        twoFactor: boolean
    }

    @Column("simple-json", { nullable: true })
    fbOauth2Constants: {
        fBAppId: string, //this should be different for each client, read from their storage. Using common for now
        fBAppSecret: string,
        createUserIfNotExists: boolean
    }

    @Column("simple-json", { nullable: true })
    googleOidcConstants: {
        googleOauth2ClientOidcIssuer: string,
        googleApiKey: string,
        googleOauth2ClientId: string,
        googleOauth2ClientSecret: string,
        createUserIfNotExists: boolean
    }

    @Column("simple-json",
        {
            default:
            {
                resetPasswordMailOptionSettings_TextTemplate: `${parsedEnv.DEFAULT_RESET_PASSWORD_MAIL_OPTION_SETTINGS_TEXT_TEMPLATE_LINE1}\n
            ${parsedEnv.DEFAULT_RESET_PASSWORD_MAIL_OPTION_SETTINGS_TEXT_TEMPLATE_LINE2}\n\n
            {url}\n
            ${parsedEnv.DEFAULT_RESET_PASSWORD_MAIL_OPTION_SETTINGS_TEXT_TEMPLATE_LINE3}\n\n`,

                confirmEmailMailOptionSettings_TextTemplate: `${parsedEnv.DEFAULT_CONFIRM_EMAIL_MAIL_OPTION_SETTINGS_TEXT_TEMPLATE_LINE1}\n
            ${parsedEnv.DEFAULT_CONFIRM_EMAIL_MAIL_OPTION_SETTINGS_TEXT_TEMPLATE_LINE2}\n\n
            {url}`,

                passwordResetExpiration: parseInt(parsedEnv.DEFAULT_PASSWORD_RESET_EXPIRATION),
                emailVerificationExpiration: parseInt(parsedEnv.DEFAULT_EMAIL_VERIFICATION_EXPIRATION)
            }
        })
    otherUserOptions: {
        resetPasswordMailOptionSettings_TextTemplate: string,
        confirmEmailMailOptionSettings_TextTemplate: string,
        passwordResetExpiration: number,
        emailVerificationExpiration: number
    }

    @Column("simple-json",
        {
            default: {
                logoFileSizeLimit: parseInt(parsedEnv.DEFAULT_LOGO_FILE_SIZE_LIMIT),
                photoFileSizeLimit: parseInt(parsedEnv.DEFAULT_PHOTO_FILE_SIZE_LIMIT),
                generalFileSizeLimit: parseInt(parsedEnv.DEFAULT_GENERAL_FILE_SIZE_LIMIT)
            }
        })
    sizeLimits: {
        logoFileSizeLimit: number,
        photoFileSizeLimit: number,
        generalFileSizeLimit: number
    }

    /**Todo: Redo theme to be more dynamic. Use upload root directory where themes are uploaded */
    @Column("simple-json",
        {
            default: {
                custom: parsedEnv.DEFAULT_THEME_CUSTOM === 'true',
                type: parsedEnv.DEFAULT_THEME_TYPE,
                rootUrl: parsedEnv.DEFAULT_THEME_ROOT_URL
            }
        })
    theme: {
        custom: boolean, //if custom, the URL slug will be /tenantUniquePrefix
        type: string, //URL slug /standard
        rootUrl: string, //this could be a remote Url 
        //I don't think I need to have properties here because that should be for theme builder app which is yet to be written.
    }

    @OneToMany(type => TenantConfigDetail, tenantConfigDetail => tenantConfigDetail.region)
    tenantConfigDetails: TenantConfigDetail[];
}

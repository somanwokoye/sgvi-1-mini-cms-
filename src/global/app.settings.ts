//The values used here should really come from a settings table in database or in env file, especially for multitenancy.

//import * as nodemailer from 'nodemailer';
import nodemailer, { SendMailOptions } from "nodemailer";
import { google } from "googleapis";
const OAuth2 = google.auth.OAuth2;
//import Mail from 'nodemailer/lib/mailer';
/*Below is to directly read .env file from settings. 
See https://www.npmjs.com/package/dotenv.
It is used to get the particulars of Gmail account for SMTP mailer
*/
//require('dotenv').config({ path: 'thirdparty.env' }); //no more using this. I have combined it with .env

//Better to use only the parsed env variables rather than keep calling process.env which is more expensive
import dotenv from 'dotenv';
//load and export parsedEnv for use in other modules
export const parsedEnv = dotenv.config().parsed; //only load what has been parsed from .env file

//user management
/*
export const PASSWORD_RESET_EXPIRATION = 86400000 * 2 //24 hours * 2 in milliseconds
export const EMAIL_VERIFICATION_EXPIRATION = 86400000 * 2 //24 hours * 2 in milliseconds
export const LOGO_FILE_SIZE_LIMIT = 1000 * 1024;
export const PHOTO_FILE_SIZE_LIMIT = 1000 * 1024;
*/
export const PASSWORD_RESET_EXPIRATION = parseInt(parsedEnv.PASSWORD_RESET_EXPIRATION);
export const EMAIL_VERIFICATION_EXPIRATION = parseInt(parsedEnv.EMAIL_VERIFICATION_EXPIRATION);
export const LOGO_FILE_SIZE_LIMIT = parseInt(parsedEnv.LOGO_FILE_SIZE_LIMIT);
export const PHOTO_FILE_SIZE_LIMIT = parseInt(parsedEnv.PHOTO_FILE_SIZE_LIMIT);

//Prepare nodemailer using sendgrid. I signed up for one. 
//See https://nodemailer.com/smtp/; https://nodemailer.com/smtp/#authentication
/* sendGrid account not active. Using Gmail instead. See below.*/
/*
const nodemailerOptions = {
    pool: true,
    host: "smtp.sendgrid.net",
    port: 465,
    secure: true,
    auth: {//I generated these with my free account
        user: "",
        pass: ""
    },
    logger: true,
    //debug: true

}
export const smtpTransport: Mail = nodemailer.createTransport(nodemailerOptions);
*/
/**
 * Settings for Gmail as SMTP server without oauth2
 */
/*
const nodemailerOptionsGmail = {
    service: 'gmail',
    auth: {
        user: parsedEnv.SMTPUSER,
        pass: parsedEnv.SMTPPWORD
    }
}
*/


/**
 * Settings for Gmail as SMTP server with oauth2
 */
/* Below does not work
const createTransporter = async () => {
    const nodemailerOptionsGmail = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            type: "OAuth2",
            user: parsedEnv.SMTPUSER, //your gmail account you used to set the project up in google cloud console"
            clientId: parsedEnv.GMAIL_CLIENT_ID,
            clientSecret: parsedEnv.GMAIL_CLIENT_SECRET,
            refreshToken: parsedEnv.GMAIL_REFRESH_TOKEN,
            accessToken: parsedEnv.GMAIL_ACCESS_TOKEN, //access token variable we defined earlier
            expires: 3599,

        }
    } as nodemailer.TransportOptions);

    return nodemailer.createTransport(nodemailerOptionsGmail);

}
*/
/**
 * Below involves getting a new access_token before proceeding
 * following https://dev.to/chandrapantachhetri/sending-emails-securely-using-node-js-nodemailer-smtp-gmail-and-oauth2-g3a
 */
const createTransporter = async (oauth2: boolean) => {
    if (oauth2) {
        try {
            const oauth2Client = new OAuth2(
                parsedEnv.SMTP_CLIENT_ID,
                parsedEnv.SMTP_CLIENT_SECRET,
                parsedEnv.SMTP_ACCESS_URL
            );

            oauth2Client.setCredentials({
                refresh_token: parsedEnv.SMTP_REFRESH_TOKEN
            });

            const accessToken = await new Promise((resolve, reject) => {
                oauth2Client.getAccessToken((err, token) => {
                    if (err) {
                        reject(`Failed to create access token: ${err.message}`);
                    }
                    resolve(token);
                });
            });

            const transporter = nodemailer.createTransport({
                host: parsedEnv.SMTP_HOST,
                port: parseInt(parsedEnv.SMTP_PORT),
                secure: parsedEnv.SMTP_SECURE === 'true' ? true : false,
                //service: "gmail",
                auth: {
                    type: "OAuth2",
                    user: parsedEnv.SMTP_USER,
                    accessToken,
                    clientId: parsedEnv.SMTP_CLIENT_ID,
                    clientSecret: parsedEnv.SMTP_CLIENT_SECRET,
                    refreshToken: parsedEnv.SMTP_REFRESH_TOKEN,
                },
                //pool options (see https://nodemailer.com/smtp/pooled/)
                pool: parsedEnv.SMTP_POOL === 'true' ? true : false,
                maxConnections: parseInt(parsedEnv.SMTP_MAXIMUM_CONNECTIONS),
                maxMessages: parseInt(parsedEnv.SMTP_MAXIMUM_MESSAGES),
                //others
                //logger: true,
                //debug: true
            } as nodemailer.TransportOptions);

            return transporter;

        } catch (error) {
            console.log(error)
        }
    } else { //not using oauth2
        const nodemailerOptionsGmail = {
            //service: 'gmail',
            host: parsedEnv.SMTP_HOST,
            port: parseInt(parsedEnv.SMTP_PORT),
            secure: parsedEnv.SMTP_SECURE === 'true' ? true : false,
            auth: {
                user: parsedEnv.SMTP_USER,
                pass: parsedEnv.SMTP_PWORD
            }
        }

        return nodemailer.createTransport(nodemailerOptionsGmail);

    }

};

export const mailSender = async (emailOptions: SendMailOptions) => {
    try {
        const emailTransporter = await createTransporter(parsedEnv.SMTP_OAUTH === 'true' ? true : false);
        if (emailTransporter)
            await emailTransporter.sendMail(emailOptions);
    } catch (error) {
        console.log(`Could not send mail: ${error}`);
    }
}


export const resetPasswordMailOptionSettings = {
    textTemplate: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n
    Please click on the following link, or paste this into your browser to complete the process:\n\n
    {url}
    If you did not request this, please ignore this email and your password will remain unchanged.\n\n`,
    //replyAddress: "noreply@pau.edu.ng",
    subject: "Reset Password - peakharmony.com",
    from: "noreply@peakharmony.com"

}

export const confirmEmailMailOptionSettings = {
    textTemplate: `You are receiving this because the email address associated with your account requires confirmation.\n
    Please click on the following link, or paste this into your browser to complete the process:\n\n
    {url}`,
    subject: "Confirm Email - peakharmony.com",
    from: "noreply@peakharmony.com"

}

export const tenantSuccessfullyCreatedMessage = {
    textTemplate: `Dear {name},\n\n
    Thank you for choosing our service. Your Loyalty Management and eCommerce Platform is set:\n
    For your business setup, go to {url} and login with your email address, {username} as your username. Your temporary password is {password}. \n
    It is advisable to change your password as soon as possible.\n\n
    Yours truly,\n
    Ugum Administrator`,
    subject: "Your Loyalty Management and eCommerce Platform is ready for use",
    from: "noreply@peakharmony.com"

}

export const SAAS_PROTOCOL: "http" | "https" = parsedEnv.DEFAULT_HTTP_PROTOCOL as 'http' | 'https';
export const SAAS_USE_API_VERSION_IN_URL: boolean = true;
export const SAAS_API_VERSION: string = "v1"




export const APP_NAME: string = "Tenant Management System (TMS)";

export const APP_DESCRIPTION: string = "This app is designed by Pius Onobhayedo for the management of tenants for any Web-based multitenant application";

export const API_VERSION: string = "v1";

export const USE_API_VERSION_IN_URL: boolean = true;

export const AUTO_SEND_CONFIRM_EMAIL: boolean = true;


export enum TenantTeamRole {
    A = "admin",
    M = "marketing",
    C = "content-manager"
}

export enum TenantAccountOfficerRole {
    M = "manager",
    T = "tech-support"
}

export enum LandLordRoles { //better use this for creating roles, so as to ensure that the names are always the same
    Admin = 'admin_landlord',
    SuperAdmin = 'superadmin_landlord',
    User = 'user_landlord'
}

export enum TenantRoles { //better use this for creating roles, so as to ensure that the names are always the same
    Admin = 'admin',
    SuperAdmin = 'superadmin',
    User = 'user'
}

export const PROTOCOL: "https" | "http" = parsedEnv.HTTP_PROTOCOL as 'https' | 'http';


//For JWT
export const jwtConstants = {
    SECRET: parsedEnv.SECRET_KEY,
    SECRET_KEY_EXPIRATION: parseInt(parsedEnv.SECRET_KEY_EXPIRATION),//integer value is read as seconds. string value with no unit specified, is read as millisecs. See https://www.npmjs.com/package/jsonwebtoken for units
    REFRESH_SECRET: parsedEnv.REFRESH_SECRET,
    REFRESH_SECRET_KEY_EXPIRATION: parsedEnv.REFRESH_SECRET_KEY_EXPIRATION

};

export const fbConstants = {
    APP_ID: parsedEnv.APP_ID,
    APP_SECRET: parsedEnv.APP_SECRET,
    CALLBACK_URL: API_VERSION != '' ? `${PROTOCOL}://${parsedEnv.APP_ROOT_HTTP_URL}/${API_VERSION}/auth/facebook/redirect` : `http://${parsedEnv.APP_ROOT_HTTP_URL}/auth/facebook/redirect`,
    SCOPE: 'email, user_gender, user_birthday, ', //see https://developers.facebook.com/docs/permissions/reference for possibilities
    PROFILE_FIELDS: ['id', 'displayName', 'photos', 'emails', 'gender', 'name', 'profileUrl'],
    CREATE_USER_IF_NOT_EXISTS: true
}

export const googleConstants = {
    GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER: parsedEnv.GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER,
    GOOGLE_API_KEY: parsedEnv.GOOGLE_API_KEY,
    GOOGLE_OAUTH2_CLIENT_ID: parsedEnv.GOOGLE_OAUTH2_CLIENT_ID,
    GOOGLE_OAUTH2_CLIENT_SECRET: parsedEnv.GOOGLE_OAUTH2_CLIENT_SECRET,
    GOOGLE_OAUTH2_REDIRECT_URI: API_VERSION != '' ? `${PROTOCOL}://${parsedEnv.APP_ROOT_HTTP_URL}/${API_VERSION}/auth/google/redirect` : `http://${parsedEnv.APP_ROOT_HTTP_URL}/auth/google/redirect`,
    GOOGLE_OAUTH2_SCOPE: 'openid profile email https://www.googleapis.com/auth/user.gender.read https://www.googleapis.com/auth/user.birthday.read https://www.googleapis.com/auth/profile.agerange.read',//see https://developers.google.com/people/api/rest/v1/people/get under Authorization Scopes section
    CREATE_USER_IF_NOT_EXISTS: true
}

export const UPLOAD_DIRECTORY = parsedEnv.UPLOAD_DIRECTORY;
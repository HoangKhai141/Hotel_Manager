import axios from "axios";
import crypto from "crypto";

export interface MoMoNotification {
    amount: string;
    extraData: string;
    message: string;
    orderId: string;
    orderInfo: string;
    orderType: string;
    partnerCode: string;
    payType: string;
    requestId: string;
    responseTime: string;
    resultCode: string;
    transId: string;
    signature: string;
}

export class MoMoPaymentRejectedError extends Error {}

interface MoMoConfig {
    partnerCode: string;
    accessKey: string;
    secretKey: string;
    endpoint: string;
    redirectUrl: string;
    ipnUrl: string;
}

const requiredConfigValue = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing MoMo configuration: ${name}`);
    return value;
};

const getMoMoConfig = (): MoMoConfig => {
    return {
        partnerCode: requiredConfigValue("MOMO_PARTNER_CODE"),
        accessKey: requiredConfigValue("MOMO_ACCESS_KEY"),
        secretKey: requiredConfigValue("MOMO_SECRET_KEY"),
        endpoint: requiredConfigValue("MOMO_ENDPOINT"),
        redirectUrl: requiredConfigValue("MOMO_REDIRECT_URL"),
        ipnUrl: requiredConfigValue("MOMO_IPN_URL")
    };
};

const sign = (rawSignature: string, secretKey: string): string =>
    crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");

const hasValidSignature = (rawSignature: string, signature: string, secretKey: string): boolean => {
    if (!/^[a-f\d]{64}$/i.test(signature)) return false;

    const expected = Buffer.from(sign(rawSignature, secretKey), "hex");
    const received = Buffer.from(signature, "hex");
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

const getNotificationSignaturePayload = (notification: MoMoNotification, accessKey: string): string =>
    `accessKey=${accessKey}&amount=${notification.amount}&extraData=${notification.extraData}` +
    `&message=${notification.message}&orderId=${notification.orderId}&orderInfo=${notification.orderInfo}` +
    `&orderType=${notification.orderType}&partnerCode=${notification.partnerCode}&payType=${notification.payType}` +
    `&requestId=${notification.requestId}&responseTime=${notification.responseTime}` +
    `&resultCode=${notification.resultCode}&transId=${notification.transId}`;

export const isValidMoMoNotification = (notification: MoMoNotification): boolean => {
    const config = getMoMoConfig();
    return notification.partnerCode === config.partnerCode &&
        hasValidSignature(
            getNotificationSignaturePayload(notification, config.accessKey),
            notification.signature,
            config.secretKey
        );
};

export const createMoMoPaymentUrl = async (
    bookingId: number,
    amount: number,
    orderId: string,
    requestId: string
) => {
    const config = getMoMoConfig();
    const orderInfo = `Thanh toan dat phong #${bookingId}`;
    const requestType = "payWithATM";
    const extraData = "";
    const rawSignature =
        `accessKey=${config.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${config.ipnUrl}` +
        `&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${config.partnerCode}` +
        `&redirectUrl=${config.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const requestBody = {
        partnerCode: config.partnerCode,
        partnerName: "Hotelier Demo",
        storeId: "MomoTestStore",
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl: config.redirectUrl,
        ipnUrl: config.ipnUrl,
        lang: "vi",
        requestType,
        autoCapture: true,
        extraData,
        signature: sign(rawSignature, config.secretKey)
    };

    try {
        const response = await axios.post(config.endpoint, requestBody);
        const data = response.data;

        if (
            data?.orderId !== orderId ||
            data?.requestId !== requestId ||
            Number(data?.amount) !== amount ||
            typeof data?.signature !== "string"
        ) {
            throw new Error("MoMo returned an invalid create-payment response.");
        }

        const responseSignature = [
            `accessKey=${config.accessKey}`,
            `amount=${data.amount}`,
            `message=${data.message}`,
            `orderId=${data.orderId}`,
            `partnerCode=${data.partnerCode}`,
            `requestId=${data.requestId}`,
            `responseTime=${data.responseTime}`,
            `resultCode=${data.resultCode}`
        ].join("&");

        if (
            data.partnerCode !== config.partnerCode ||
            !hasValidSignature(responseSignature, data.signature, config.secretKey)
        ) {
            throw new Error("MoMo create-payment response signature is invalid.");
        }

        if (data.resultCode !== 0) {
            throw new MoMoPaymentRejectedError("MoMo rejected the payment request.");
        }

        const payUrl = new URL(data.payUrl);
        if (payUrl.protocol !== "https:" || !payUrl.hostname.endsWith(".momo.vn")) {
            throw new Error("MoMo returned an invalid payment URL.");
        }

        return { ...data, payUrl: payUrl.toString() };
    } catch (error) {
        console.error("MoMo Service Error:", error);
        if (error instanceof MoMoPaymentRejectedError) throw error;
        throw new Error("Không thể xác nhận yêu cầu thanh toán với MoMo.");
    }
};

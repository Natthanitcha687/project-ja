import axios from "axios";

const GOOGLE_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
// Use Test Secret if RECAPTCHA_SECRET_KEY is not set
const TEST_SECRET_KEY = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";

export async function verifyRecaptcha(token) {
    if (!token) return false;

    const secret = process.env.RECAPTCHA_SECRET_KEY || TEST_SECRET_KEY;

    try {
        const response = await axios.post(
            GOOGLE_VERIFY_URL,
            null,
            {
                params: {
                    secret: secret,
                    response: token,
                },
            }
        );

        return response.data.success === true;
    } catch (error) {
        console.error("ReCAPTCHA verification failed:", error.message);
        return false;
    }
}
